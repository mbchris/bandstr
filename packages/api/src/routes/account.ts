import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { bandMembers, bands, users } from '../db/schema.js'
import { requireAuth, type AuthEnv } from '../middleware/auth.js'

export const account = new Hono<AuthEnv>()

account.use('*', requireAuth)

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
