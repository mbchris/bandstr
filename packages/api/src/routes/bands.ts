import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { db } from '../db/index.js'
import { bands as bandsTable, bandInviteCodes, bandMembers } from '../db/schema.js'
import { requireAuth, type AuthEnv } from '../middleware/auth.js'
import { requireTenant } from '../middleware/tenant.js'
import { requireRole } from '../middleware/rbac.js'
import { bandHasProPlan, normalizePlan, userHasDeveloperProPlan } from '../lib/entitlements.js'

export const bands = new Hono<AuthEnv>()
const INVITE_TTL_DAYS = 30
const FREE_MEMBER_LIMIT = 5

function inviteActiveThreshold() {
  const threshold = new Date()
  threshold.setDate(threshold.getDate() - INVITE_TTL_DAYS)
  return threshold
}

function inviteExpiry(createdAt: Date | string) {
  const base = createdAt instanceof Date ? createdAt : new Date(createdAt)
  return new Date(base.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)
}

// List bands the authenticated user belongs to
bands.get('/', requireAuth, async (c) => {
  const userId = c.get('user').id
  const rows = await db
    .select({
      id: bandsTable.id,
      name: bandsTable.name,
      slug: bandsTable.slug,
      plan: bandsTable.plan,
      logo: bandsTable.logo,
      subscriptionStatus: bandsTable.subscriptionStatus,
      subscriptionInterval: bandsTable.subscriptionInterval,
      subscriptionCurrentPeriodEnd: bandsTable.subscriptionCurrentPeriodEnd,
      subscriptionCancelAtPeriodEnd: bandsTable.subscriptionCancelAtPeriodEnd,
      role: bandMembers.role,
    })
    .from(bandMembers)
    .innerJoin(bandsTable, eq(bandsTable.id, bandMembers.bandId))
    .where(eq(bandMembers.userId, userId))
  const enriched = await Promise.all(
    rows.map(async (row) => {
      const normalizedPlan = normalizePlan(row.plan)
      return {
        ...row,
        plan: normalizedPlan,
        hasProPlan: await bandHasProPlan(row.id),
      }
    }),
  )
  return c.json(enriched)
})

// Create a new band
const createBandSchema = z.object({
  name: z.string().min(1).max(100),
})

function toBandSlug(name: string) {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const baseName = sanitized || 'band'
  const shortId = randomBytes(4).toString('hex')
  return `${shortId}-${baseName}`
}

bands.post('/', requireAuth, zValidator('json', createBandSchema), async (c) => {
  const userId = c.get('user').id
  const { name } = c.req.valid('json')
  const ownedBands = await db
    .select({ plan: bandsTable.plan })
    .from(bandMembers)
    .innerJoin(bandsTable, eq(bandsTable.id, bandMembers.bandId))
    .where(and(eq(bandMembers.userId, userId), eq(bandMembers.role, 'owner')))
  const userHasProPlan = await userHasDeveloperProPlan(userId)

  const canCreateAnotherBand =
    userHasProPlan || ownedBands.length === 0 || ownedBands.some((band) => normalizePlan(band.plan) !== 'free')

  if (!canCreateAnotherBand) {
    return c.json(
      {
        error: 'Free plan allows creating only one band. Upgrade to create additional bands.',
      },
      403,
    )
  }

  let band:
    | {
        id: number
        name: string
        slug: string
        plan: string
        logo: string | null
        stripeCustomerId: string | null
        createdAt: Date
      }
    | undefined

  for (let attempts = 0; attempts < 6; attempts += 1) {
    const slug = toBandSlug(name)
    try {
      ;[band] = await db.insert(bandsTable).values({ name, slug }).returning()
      break
    } catch {
      // Retry on rare unique slug collisions.
    }
  }

  if (!band) return c.json({ error: 'Could not create band' }, 500)

  await db.insert(bandMembers).values({
    bandId: band.id,
    userId,
    role: 'owner',
  })

  const normalizedPlan = normalizePlan(band.plan)
  return c.json({ ...band, plan: normalizedPlan, hasProPlan: await bandHasProPlan(band.id) }, 201)
})

// Get band details (must be a member)
bands.get('/:id', requireAuth, requireTenant, async (c) => {
  const bandId = c.get('bandId')
  const [band] = await db.select().from(bandsTable).where(eq(bandsTable.id, bandId)).limit(1)
  if (!band) return c.json({ error: 'Not found' }, 404)
  const normalizedPlan = normalizePlan(band.plan)
  return c.json({ ...band, plan: normalizedPlan, hasProPlan: await bandHasProPlan(band.id) })
})

// Update band (admin+)
const updateBandSchema = z.object({
  name: z.string().min(1).max(100).optional(),
})

bands.patch(
  '/:id',
  requireAuth,
  requireTenant,
  requireRole('admin'),
  zValidator('json', updateBandSchema),
  async (c) => {
    const bandId = c.get('bandId')
    const data = c.req.valid('json')
    const [updated] = await db
      .update(bandsTable)
      .set(data)
      .where(eq(bandsTable.id, bandId))
      .returning()
    return c.json(updated)
  },
)

// Delete band (owner only)
bands.delete('/:id', requireAuth, requireTenant, requireRole('owner'), async (c) => {
  const bandId = c.get('bandId')
  await db.delete(bandsTable).where(eq(bandsTable.id, bandId))
  return c.json({ ok: true })
})

// List band members
bands.get('/:id/members', requireAuth, requireTenant, async (c) => {
  const bandId = c.get('bandId')
  const members = await db
    .select({
      userId: bandMembers.userId,
      role: bandMembers.role,
      sortOrder: bandMembers.sortOrder,
      isHidden: bandMembers.isHidden,
      beerCount: bandMembers.beerCount,
      joinedAt: bandMembers.joinedAt,
    })
    .from(bandMembers)
    .where(eq(bandMembers.bandId, bandId))
    .orderBy(bandMembers.sortOrder)
  return c.json(members)
})

// List invitation codes for the active band (admin+)
bands.get('/:id/invite-codes', requireAuth, requireTenant, requireRole('admin'), async (c) => {
  const bandId = c.get('bandId')
  const threshold = inviteActiveThreshold()
  const rows = await db
    .select({
      id: bandInviteCodes.id,
      code: bandInviteCodes.code,
      createdBy: bandInviteCodes.createdBy,
      usedBy: bandInviteCodes.usedBy,
      invalidatedBy: bandInviteCodes.invalidatedBy,
      createdAt: bandInviteCodes.createdAt,
      usedAt: bandInviteCodes.usedAt,
      invalidatedAt: bandInviteCodes.invalidatedAt,
    })
    .from(bandInviteCodes)
    .where(eq(bandInviteCodes.bandId, bandId))
    .orderBy(desc(bandInviteCodes.createdAt))
  return c.json(
    rows.map((row) => {
      const expiresAt = inviteExpiry(row.createdAt)
      const expired = !row.usedAt && !row.invalidatedAt && row.createdAt <= threshold
      return {
        ...row,
        expiresAt,
        expired,
      }
    }),
  )
})

// Create invitation code for active band (admin+)
bands.post('/:id/invite-codes', requireAuth, requireTenant, requireRole('admin'), async (c) => {
  const bandId = c.get('bandId')
  const userId = c.get('user').id

  let created:
    | {
        id: number
        bandId: number
        code: string
        createdBy: string
        usedBy: string | null
        invalidatedBy: string | null
        createdAt: Date
        usedAt: Date | null
        invalidatedAt: Date | null
      }
    | undefined

  for (let attempts = 0; attempts < 5; attempts += 1) {
    const code = `BND-${randomBytes(12).toString('hex').toUpperCase()}`
    try {
      ;[created] = await db
        .insert(bandInviteCodes)
        .values({
          bandId,
          code,
          createdBy: userId,
        })
        .returning()
      break
    } catch {
      // Retry on potential unique collisions.
    }
  }

  if (!created) return c.json({ error: 'Could not generate invitation code' }, 500)
  return c.json(
    {
      ...created,
      expiresAt: inviteExpiry(created.createdAt),
      expired: false,
    },
    201,
  )
})

// Invalidate invitation code (admin+)
bands.post('/:id/invite-codes/:inviteId/invalidate', requireAuth, requireTenant, requireRole('admin'), async (c) => {
  const bandId = c.get('bandId')
  const userId = c.get('user').id
  const inviteId = Number(c.req.param('inviteId'))
  const threshold = inviteActiveThreshold()

  if (!Number.isInteger(inviteId) || inviteId <= 0) return c.json({ error: 'Invalid invitation id' }, 400)

  const [updated] = await db
    .update(bandInviteCodes)
    .set({ invalidatedBy: userId, invalidatedAt: new Date() })
    .where(
      and(
        eq(bandInviteCodes.id, inviteId),
        eq(bandInviteCodes.bandId, bandId),
        gt(bandInviteCodes.createdAt, threshold),
        isNull(bandInviteCodes.usedAt),
        isNull(bandInviteCodes.invalidatedAt),
      ),
    )
    .returning()

  if (!updated) return c.json({ error: 'Invitation code not found, expired, or already inactive' }, 404)
  return c.json({
    ...updated,
    expiresAt: inviteExpiry(updated.createdAt),
    expired: false,
  })
})

const joinBandSchema = z.object({
  code: z.string().trim().min(4).max(64),
})

// Join a band with a one-time invitation code.
bands.post('/join', requireAuth, zValidator('json', joinBandSchema), async (c) => {
  const userId = c.get('user').id
  const code = c.req.valid('json').code.toUpperCase()
  const threshold = inviteActiveThreshold()

  const [invite] = await db
    .select()
    .from(bandInviteCodes)
    .where(
      and(
        eq(bandInviteCodes.code, code),
        gt(bandInviteCodes.createdAt, threshold),
        isNull(bandInviteCodes.usedAt),
        isNull(bandInviteCodes.invalidatedAt),
      ),
    )
    .limit(1)

  if (!invite) return c.json({ error: 'Invitation code is invalid, expired, or already used' }, 404)

  const [existing] = await db
    .select({ bandId: bandMembers.bandId })
    .from(bandMembers)
    .where(and(eq(bandMembers.bandId, invite.bandId), eq(bandMembers.userId, userId)))
    .limit(1)

  if (existing) return c.json({ error: 'You are already a member of this band' }, 409)

  const [targetBand] = await db
    .select({ id: bandsTable.id })
    .from(bandsTable)
    .where(eq(bandsTable.id, invite.bandId))
    .limit(1)

  if (!targetBand) return c.json({ error: 'Band not found' }, 404)

  const hasProPlan = await bandHasProPlan(targetBand.id)
  if (!hasProPlan) {
    const members = await db
      .select({ userId: bandMembers.userId })
      .from(bandMembers)
      .where(eq(bandMembers.bandId, invite.bandId))
    if (members.length >= FREE_MEMBER_LIMIT) {
      return c.json(
        { error: 'Free plan allows up to 5 members. Upgrade to pro to add more members.' },
        403,
      )
    }
  }

  const result = await db.transaction(async (tx) => {
    const [consumed] = await tx
      .update(bandInviteCodes)
      .set({ usedBy: userId, usedAt: new Date() })
      .where(
        and(
          eq(bandInviteCodes.id, invite.id),
          isNull(bandInviteCodes.usedAt),
          isNull(bandInviteCodes.invalidatedAt),
        ),
      )
      .returning()

    if (!consumed) return null

    await tx.insert(bandMembers).values({
      bandId: invite.bandId,
      userId,
      role: 'member',
    })

    const [band] = await tx.select().from(bandsTable).where(eq(bandsTable.id, invite.bandId)).limit(1)
    if (!band) return null

    const normalizedPlan = normalizePlan(band.plan)
    return {
      id: band.id,
      name: band.name,
      slug: band.slug,
      plan: normalizedPlan,
      hasProPlan: await bandHasProPlan(band.id),
      logo: band.logo,
      role: 'member',
    }
  })

  if (!result) return c.json({ error: 'Invitation code is invalid, expired, or already used' }, 409)
  return c.json(result, 201)
})
