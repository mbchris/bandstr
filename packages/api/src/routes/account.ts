import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { and, eq, sql } from 'drizzle-orm'
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

  const blockingBandsResult = await db.execute<{ band_id: number }>(sql`
    select bm.band_id
    from ${bandMembers} bm
    where bm.user_id = ${userId}
      and bm.role = 'owner'
      and exists (
        select 1 from ${bandMembers} m
        where m.band_id = bm.band_id
          and m.user_id <> ${userId}
      )
      and not exists (
        select 1 from ${bandMembers} o
        where o.band_id = bm.band_id
          and o.role = 'owner'
          and o.user_id <> ${userId}
      )
  `)

  const blockingBandIds = blockingBandsResult.rows.map((row) => row.band_id)

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
    await tx.delete(users).where(eq(users.id, userId))

    // Remove orphaned bands left without members (for example after deleting a sole-owner account).
    await tx
      .delete(bands)
      .where(
        sql`not exists (
          select 1
          from ${bandMembers}
          where ${bandMembers.bandId} = ${bands.id}
        )`,
      )
  })

  return c.json({ ok: true })
})
