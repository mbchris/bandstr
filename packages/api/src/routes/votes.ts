import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { votes as votesTable, bandMembers } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant, type TenantEnv } from '../middleware/tenant.js'

export const votes = new Hono<TenantEnv>()

votes.use('*', requireAuth, requireTenant)

const voteSchema = z.object({
  songId: z.number(),
  score: z.number().int().min(0).max(3).optional(),
  comment: z.string().optional(),
  remove: z.boolean().optional(),
})

// POST /votes — create, update, or remove a vote
votes.post('/', zValidator('json', voteSchema), async (c) => {
  const bandId = c.get('bandId')
  const userId = c.get('user').id
  const { songId, score, comment, remove } = c.req.valid('json')

  // Hidden members cannot vote
  const [membership] = await db
    .select({ isHidden: bandMembers.isHidden })
    .from(bandMembers)
    .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.userId, userId)))
    .limit(1)

  if (membership?.isHidden) {
    return c.json({ error: 'Hidden members cannot vote' }, 403)
  }

  const [existing] = await db
    .select()
    .from(votesTable)
    .where(and(eq(votesTable.songId, songId), eq(votesTable.userId, userId), eq(votesTable.bandId, bandId)))
    .limit(1)

  if (remove) {
    if (existing) {
      await db.delete(votesTable).where(eq(votesTable.id, existing.id))
    }
    return c.json({ success: true, action: 'removed' })
  }

  if (existing) {
    await db
      .update(votesTable)
      .set({ score: score ?? existing.score, comment: comment ?? existing.comment })
      .where(eq(votesTable.id, existing.id))
    return c.json({ success: true, action: 'updated' })
  }

  if (score === undefined) {
    return c.json({ error: 'score is required for new votes' }, 400)
  }

  await db.insert(votesTable).values({ bandId, songId, userId, score, comment })
  return c.json({ success: true, action: 'added' }, 201)
})
