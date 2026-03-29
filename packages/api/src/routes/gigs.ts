import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { calendarEvents, gigSongs, songs as songsTable } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant, type TenantEnv } from '../middleware/tenant.js'

export const gigs = new Hono<TenantEnv>()

gigs.use('*', requireAuth, requireTenant)

// GET /gigs
gigs.get('/', async (c) => {
  const bandId = c.get('bandId')
  const rows = await db
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.type, 'gig'), eq(calendarEvents.bandId, bandId)))
    .orderBy(asc(calendarEvents.startTime))
  return c.json(rows)
})

// GET /gigs/:id/songs
gigs.get('/:id/songs', async (c) => {
  const bandId = c.get('bandId')
  const gigId = Number(c.req.param('id'))

  const rows = await db
    .select({
      id: songsTable.id,
      title: songsTable.title,
      artist: songsTable.artist,
      type: songsTable.type,
      pitch: songsTable.pitch,
      spotifyUrl: songsTable.spotifyUrl,
      youtubeUrl: songsTable.youtubeUrl,
      thumbnailUrl: songsTable.thumbnailUrl,
      notes: songsTable.notes,
      position: gigSongs.position,
      gigSongId: gigSongs.id,
    })
    .from(gigSongs)
    .innerJoin(songsTable, eq(gigSongs.songId, songsTable.id))
    .where(and(eq(gigSongs.gigId, gigId), eq(gigSongs.bandId, bandId)))
    .orderBy(asc(gigSongs.position))

  return c.json(rows)
})

// POST /gigs/:id/songs — add song to gig
gigs.post(
  '/:id/songs',
  zValidator('json', z.object({ songId: z.number(), position: z.number().default(0) })),
  async (c) => {
    const bandId = c.get('bandId')
    const gigId = Number(c.req.param('id'))
    const { songId, position } = c.req.valid('json')

    const [row] = await db.insert(gigSongs).values({ bandId, gigId, songId, position }).returning()
    return c.json(row, 201)
  },
)

// POST /gigs/:id/songs/reorder
gigs.post(
  '/:id/songs/reorder',
  zValidator('json', z.object({ order: z.array(z.object({ id: z.number(), position: z.number() })) })),
  async (c) => {
    const bandId = c.get('bandId')
    const { order } = c.req.valid('json')

    await Promise.all(
      order.map(({ id, position }) =>
        db
          .update(gigSongs)
          .set({ position })
          .where(and(eq(gigSongs.id, id), eq(gigSongs.bandId, bandId))),
      ),
    )

    return c.json({ success: true })
  },
)

// DELETE /gigs/:id/songs/:songId
gigs.delete('/:id/songs/:songId', async (c) => {
  const bandId = c.get('bandId')
  const gigId = Number(c.req.param('id'))
  const songId = Number(c.req.param('songId'))

  await db
    .delete(gigSongs)
    .where(and(eq(gigSongs.gigId, gigId), eq(gigSongs.songId, songId), eq(gigSongs.bandId, bandId)))

  return c.json({ success: true })
})
