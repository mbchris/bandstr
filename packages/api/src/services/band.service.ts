import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { db } from '../db/index.js'
import { bands as bandsTable, bandInviteCodes, bandMembers, users as usersTable } from '../db/schema/index.js'
import { bandHasProPlan, normalizePlan, userEffectivePlan, userHasProPlan } from '../lib/entitlements.js'

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

function toBandSlug(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const baseName = sanitized || 'band'
  const shortId = randomBytes(4).toString('hex')
  return `${shortId}-${baseName}`
}

export const bandService = {
  async listBandsForUser(userId: string) {
    const [userRow] = await db
      .select({ defaultBandId: usersTable.defaultBandId })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)

    const rows = await db
      .select({
        id: bandsTable.id,
        name: bandsTable.name,
        slug: bandsTable.slug,
        plan: bandsTable.plan,
        logo: bandsTable.logo,
        logoDark: bandsTable.logoDark,
        logoBright: bandsTable.logoBright,
        subscriptionStatus: bandsTable.subscriptionStatus,
        subscriptionInterval: bandsTable.subscriptionInterval,
        subscriptionCurrentPeriodEnd: bandsTable.subscriptionCurrentPeriodEnd,
        subscriptionCancelAtPeriodEnd: bandsTable.subscriptionCancelAtPeriodEnd,
        subscriptionProvider: bandsTable.subscriptionProvider,
        role: bandMembers.role,
      })
      .from(bandMembers)
      .innerJoin(bandsTable, eq(bandsTable.id, bandMembers.bandId))
      .where(eq(bandMembers.userId, userId))

    let defaultBandId = userRow?.defaultBandId ?? null
    if (rows.length === 1 && defaultBandId !== rows[0].id) {
      const [updatedUser] = await db
        .update(usersTable)
        .set({ defaultBandId: rows[0].id })
        .where(eq(usersTable.id, userId))
        .returning({ defaultBandId: usersTable.defaultBandId })
      defaultBandId = updatedUser?.defaultBandId ?? rows[0].id
    }

    if (rows.length > 1 && defaultBandId != null && !rows.some((row) => row.id === defaultBandId)) {
      const [updatedUser] = await db
        .update(usersTable)
        .set({ defaultBandId: null })
        .where(eq(usersTable.id, userId))
        .returning({ defaultBandId: usersTable.defaultBandId })
      defaultBandId = updatedUser?.defaultBandId ?? null
    }

    return Promise.all(
      rows.map(async (row) => {
        const normalizedPlan = normalizePlan(row.plan)
        const [hasPro, effectivePlan] = await Promise.all([
          bandHasProPlan(row.id),
          userEffectivePlan(userId, row.id),
        ])
        return {
          ...row,
          plan: normalizedPlan,
          isDefault: row.id === defaultBandId,
          hasProPlan: hasPro,
          effectivePlan,
        }
      }),
    )
  },

  async createBand(params: { userId: string; name: string }) {
    const { userId, name } = params

    // Check free plan membership limit (free users can only be in one band)
    const existingBandCount = await db
      .select({ id: bandMembers.bandId })
      .from(bandMembers)
      .where(eq(bandMembers.userId, userId))
    const hasPro = await userHasProPlan(userId)

    if (!hasPro && existingBandCount.length >= 1) {
      return {
        error: 'Free plan allows being a member of only one band. Upgrade to pro to join multiple bands.',
        status: 403 as const,
      }
    }

    let band: typeof bandsTable.$inferSelect | undefined

    for (let attempts = 0; attempts < 6; attempts += 1) {
      const slug = toBandSlug(name)
      try {
        ;[band] = await db.insert(bandsTable).values({ name, slug }).returning()
        break
      } catch {
        // Retry on unique slug collisions
      }
    }

    if (!band) {
      return { error: 'Could not create band', status: 500 as const }
    }

    await db.insert(bandMembers).values({
      bandId: band.id,
      userId,
      role: 'owner',
    })

    const normalizedPlan = normalizePlan(band.plan)
    return {
      band: {
        ...band,
        plan: normalizedPlan,
        hasProPlan: await bandHasProPlan(band.id),
      },
      status: 201 as const,
    }
  },

  async getBandDetails(bandId: number) {
    const [band] = await db.select().from(bandsTable).where(eq(bandsTable.id, bandId)).limit(1)
    if (!band) return null
    const normalizedPlan = normalizePlan(band.plan)
    return {
      ...band,
      plan: normalizedPlan,
      hasProPlan: await bandHasProPlan(band.id),
    }
  },

  async updateBand(bandId: number, data: { name?: string }) {
    const [updated] = await db
      .update(bandsTable)
      .set(data)
      .where(eq(bandsTable.id, bandId))
      .returning()
    return updated ?? null
  },

  async deleteBand(bandId: number) {
    await db.delete(bandsTable).where(eq(bandsTable.id, bandId))
    return { ok: true }
  },

  async listInviteCodes(bandId: number) {
    const activeSince = inviteActiveThreshold()
    const rows = await db
      .select({
        id: bandInviteCodes.id,
        code: bandInviteCodes.code,
        createdAt: bandInviteCodes.createdAt,
        createdBy: bandInviteCodes.createdBy,
        creatorName: usersTable.name,
      })
      .from(bandInviteCodes)
      .leftJoin(usersTable, eq(usersTable.id, bandInviteCodes.createdBy))
      .where(
        and(
          eq(bandInviteCodes.bandId, bandId),
          isNull(bandInviteCodes.usedAt),
          isNull(bandInviteCodes.invalidatedAt),
          gt(bandInviteCodes.createdAt, activeSince),
        ),
      )
      .orderBy(desc(bandInviteCodes.createdAt))

    return rows.map((row) => ({
      ...row,
      expiresAt: inviteExpiry(row.createdAt).toISOString(),
    }))
  },

  async createInviteCode(bandId: number, userId: string) {
    const hasPro = await bandHasProPlan(bandId)
    if (!hasPro) {
      const currentMembers = await db
        .select({ id: bandMembers.userId })
        .from(bandMembers)
        .where(eq(bandMembers.bandId, bandId))
      if (currentMembers.length >= FREE_MEMBER_LIMIT) {
        return {
          error: `Free plan allows up to ${FREE_MEMBER_LIMIT} members per band. Upgrade to pro to invite more.`,
          status: 403 as const,
        }
      }
    }

    const code = randomBytes(4).toString('hex').toUpperCase()
    const [invite] = await db
      .insert(bandInviteCodes)
      .values({
        bandId,
        code,
        createdBy: userId,
      })
      .returning()

    return {
      invite: {
        id: invite.id,
        code: invite.code,
        createdAt: invite.createdAt,
        expiresAt: inviteExpiry(invite.createdAt).toISOString(),
      },
      status: 201 as const,
    }
  },

  async revokeInviteCode(bandId: number, inviteId: number, userId: string) {
    const [revoked] = await db
      .update(bandInviteCodes)
      .set({
        invalidatedAt: new Date(),
        invalidatedBy: userId,
      })
      .where(and(eq(bandInviteCodes.id, inviteId), eq(bandInviteCodes.bandId, bandId)))
      .returning({ id: bandInviteCodes.id })

    return Boolean(revoked)
  },
}
