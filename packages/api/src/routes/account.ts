import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { bandMembers, bands, users } from '../db/schema.js'
import { requireAuth, type AuthEnv } from '../middleware/auth.js'

export const account = new Hono<AuthEnv>()

account.use('*', requireAuth)

const setDefaultBandSchema = z.object({
  bandId: z.number().int().positive(),
})

account.put('/default-band', zValidator('json', setDefaultBandSchema), async (c) => {
  const userId = c.get('user').id
  const { bandId } = c.req.valid('json')

  const [membership] = await db
    .select({ userId: bandMembers.userId })
    .from(bandMembers)
    .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.userId, userId)))
    .limit(1)

  if (!membership) {
    return c.json({ error: 'Forbidden: not a member of this band' }, 403)
  }

  const [updated] = await db
    .update(users)
    .set({ defaultBandId: bandId })
    .where(eq(users.id, userId))
    .returning({ defaultBandId: users.defaultBandId })

  return c.json({ defaultBandId: updated?.defaultBandId ?? bandId })
})

account.delete('/', async (c) => {
  const userId = c.get('user').id

  // Find bands where this user is the sole owner but there are other members
  const ownedBandIds = (
    await db
      .select({ bandId: bandMembers.bandId })
      .from(bandMembers)
      .where(and(eq(bandMembers.userId, userId), eq(bandMembers.role, 'owner')))
  ).map((r) => r.bandId)

  const blockingBandIds: number[] = []
  for (const bandId of ownedBandIds) {
    const allMembers = await db
      .select({ userId: bandMembers.userId, role: bandMembers.role })
      .from(bandMembers)
      .where(eq(bandMembers.bandId, bandId))

    const hasOtherMembers = allMembers.some((m) => m.userId !== userId)
    const hasOtherOwner = allMembers.some((m) => m.userId !== userId && m.role === 'owner')

    if (hasOtherMembers && !hasOtherOwner) {
      blockingBandIds.push(bandId)
    }
  }

  if (blockingBandIds.length > 0) {
    return c.json(
      {
        error:
          'Account cannot be deleted while you are the last owner of a band with other members. Transfer ownership first.',
        blockingBandIds,
      },
      409,
    )
  }

  await db.transaction(async (tx) => {
    // Delete the user — cascades to sessions, accounts, band_members, votes, personal_notes
    await tx.delete(users).where(eq(users.id, userId))

    // Remove orphaned bands that now have no members
    const remainingBandIds = (
      await tx.select({ bandId: bandMembers.bandId }).from(bandMembers)
    ).map((r) => r.bandId)

    const bandsToDelete = ownedBandIds.filter((id) => !remainingBandIds.includes(id))
    for (const bandId of bandsToDelete) {
      await tx.delete(bands).where(eq(bands.id, bandId))
    }
  })

  return c.json({ ok: true })
})
