import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db } from '../db/index.js'
import { users, bandMembers } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant, type TenantEnv } from '../middleware/tenant.js'
import { requireRole } from '../middleware/rbac.js'

export const usersRouter = new Hono<TenantEnv>()

usersRouter.use('*', requireAuth, requireTenant)

const createMemberSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  role: z.enum(['admin', 'member']).default('member'),
  isHidden: z.boolean().default(false),
  beerCount: z.number().int().min(0).default(0),
})

// GET /users — list band members with user info
usersRouter.get('/', async (c) => {
  const bandId = c.get('bandId')

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: bandMembers.role,
      sortOrder: bandMembers.sortOrder,
      isHidden: bandMembers.isHidden,
      beerCount: bandMembers.beerCount,
      joinedAt: bandMembers.joinedAt,
    })
    .from(bandMembers)
    .innerJoin(users, eq(bandMembers.userId, users.id))
    .where(eq(bandMembers.bandId, bandId))
    .orderBy(bandMembers.sortOrder)

  return c.json(members)
})

// POST /users — add member by email (create user row if needed)
usersRouter.post('/', requireRole('admin'), zValidator('json', createMemberSchema), async (c) => {
  const bandId = c.get('bandId')
  const payload = c.req.valid('json')
  const normalizedEmail = payload.email.toLowerCase()

  const [existingUser] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(sql`lower(${users.email}) = ${normalizedEmail}`)
    .limit(1)

  const userId = existingUser?.id ?? randomUUID()
  if (!existingUser) {
    await db.insert(users).values({
      id: userId,
      name: payload.name,
      email: normalizedEmail,
    })
  }

  const [memberCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bandMembers)
    .where(eq(bandMembers.bandId, bandId))
    .limit(1)

  await db
    .insert(bandMembers)
    .values({
      bandId,
      userId,
      role: payload.role,
      isHidden: payload.isHidden,
      beerCount: payload.beerCount,
      sortOrder: memberCountRow?.count ?? 0,
    })
    .onConflictDoNothing({ target: [bandMembers.bandId, bandMembers.userId] })

  const [createdMember] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: bandMembers.role,
      sortOrder: bandMembers.sortOrder,
      isHidden: bandMembers.isHidden,
      beerCount: bandMembers.beerCount,
      joinedAt: bandMembers.joinedAt,
    })
    .from(bandMembers)
    .innerJoin(users, eq(bandMembers.userId, users.id))
    .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.userId, userId)))
    .limit(1)

  if (!createdMember) {
    return c.json({ error: 'Could not create member' }, 500)
  }

  return c.json(createdMember, 201)
})

// PATCH /users/:id — update band-level member attributes
const patchMemberSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']).optional(),
  isHidden: z.boolean().optional(),
  beerCount: z.number().int().min(0).optional(),
  sortOrder: z.number().int().optional(),
})

usersRouter.patch(
  '/:id',
  zValidator('json', patchMemberSchema),
  async (c) => {
    const bandId = c.get('bandId')
    const targetUserId = c.req.param('id')
    const data = c.req.valid('json')
    const requesterRole = c.get('bandRole') as 'member' | 'admin' | 'owner'

    const keys = Object.keys(data) as Array<keyof typeof data>
    if (keys.length === 0) {
      return c.json({ error: 'No fields to update' }, 400)
    }

    const isBeerOnlyUpdate = keys.every((key) => key === 'beerCount')
    const canManageMembers = requesterRole === 'admin' || requesterRole === 'owner'
    if (!isBeerOnlyUpdate && !canManageMembers) {
      return c.json({ error: 'Forbidden: requires admin role' }, 403)
    }

    const [updated] = await db
      .update(bandMembers)
      .set(data)
      .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.userId, targetUserId)))
      .returning()

    if (!updated) return c.json({ error: 'Member not found' }, 404)
    return c.json(updated)
  },
)

// POST /users/reorder
usersRouter.post(
  '/reorder',
  requireRole('admin'),
  zValidator('json', z.object({ order: z.array(z.object({ id: z.string(), sortOrder: z.number() })) })),
  async (c) => {
    const bandId = c.get('bandId')
    const { order } = c.req.valid('json')

    await Promise.all(
      order.map(({ id, sortOrder }) =>
        db
          .update(bandMembers)
          .set({ sortOrder })
          .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.userId, id))),
      ),
    )

    return c.json({ success: true })
  },
)

// DELETE /users/:id — remove a member from the current band
usersRouter.delete('/:id', requireRole('admin'), async (c) => {
  const bandId = c.get('bandId')
  const targetUserId = c.req.param('id')

  const [membership] = await db
    .select({ role: bandMembers.role })
    .from(bandMembers)
    .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.userId, targetUserId)))
    .limit(1)

  if (!membership) return c.json({ error: 'Member not found' }, 404)

  if (membership.role === 'owner') {
    const [ownerCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bandMembers)
      .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.role, 'owner')))
      .limit(1)

    if ((ownerCount?.count ?? 0) <= 1) {
      return c.json({ error: 'Cannot remove the last owner from the band' }, 400)
    }
  }

  await db
    .delete(bandMembers)
    .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.userId, targetUserId)))

  return c.json({ ok: true })
})
