import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, asc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { gigSetlists, calendarEvents, gigSongs, songs as songsTable } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant, type TenantEnv } from '../middleware/tenant.js'

export const gigs = new Hono<TenantEnv>()

gigs.use('*', requireAuth, requireTenant)

const gigSetlistBodySchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  calendarEventId: z.number().int().positive().nullable().optional(),
})

async function getGigSetlistForBandOrNull(bandId: number, gigId: number) {
  const [gig] = await db
    .select()
    .from(gigSetlists)
    .where(and(eq(gigSetlists.id, gigId), eq(gigSetlists.bandId, bandId)))
    .limit(1)
  return gig ?? null
}

async function getCalendarGigForBandOrNull(bandId: number, calendarEventId: number) {
  const [event] = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.id, calendarEventId),
        eq(calendarEvents.bandId, bandId),
        eq(calendarEvents.type, 'gig'),
      ),
    )
    .limit(1)
  return event ?? null
}

// GET /gigs
// Gig setlists are now independent from calendar entries and can optionally link to one.
gigs.get('/', async (c) => {
  const bandId = c.get('bandId')
  const rows = await db
    .select({
      id: gigSetlists.id,
      bandId: gigSetlists.bandId,
      title: gigSetlists.title,
      calendarEventId: gigSetlists.calendarEventId,
      createdAt: gigSetlists.createdAt,
      calendarEventTitle: calendarEvents.title,
      startTime: calendarEvents.startTime,
      endTime: calendarEvents.endTime,
      isTentative: calendarEvents.isTentative,
    })
    .from(gigSetlists)
    .leftJoin(
      calendarEvents,
      and(
        eq(gigSetlists.calendarEventId, calendarEvents.id),
        eq(calendarEvents.bandId, bandId),
      ),
    )
    .where(eq(gigSetlists.bandId, bandId))
    .orderBy(asc(sql`coalesce(${calendarEvents.startTime}, ${gigSetlists.createdAt})`), asc(gigSetlists.id))

  return c.json(rows)
})

// POST /gigs
// Create an independent gig setlist with optional calendar entry link.
gigs.post('/', zValidator('json', gigSetlistBodySchema), async (c) => {
  const bandId = c.get('bandId')
  const { title, calendarEventId } = c.req.valid('json')

  let linkedCalendarTitle: string | null = null
  if (typeof calendarEventId === 'number') {
    const event = await getCalendarGigForBandOrNull(bandId, calendarEventId)
    if (!event) return c.json({ error: 'Linked calendar gig not found' }, 404)
    linkedCalendarTitle = event.title
  }

  const finalTitle = title?.trim() || linkedCalendarTitle || 'Gig Setlist'

  const [row] = await db
    .insert(gigSetlists)
    .values({
      bandId,
      title: finalTitle,
      calendarEventId: calendarEventId ?? null,
    })
    .returning()

  return c.json(row, 201)
})

// PUT /gigs/:id
// Update title and/or calendar link for a gig setlist.
gigs.put('/:id', zValidator('json', gigSetlistBodySchema), async (c) => {
  const bandId = c.get('bandId')
  const gigId = Number(c.req.param('id'))
  if (!Number.isFinite(gigId) || gigId <= 0) return c.json({ error: 'Invalid gig id' }, 400)

  const gig = await getGigSetlistForBandOrNull(bandId, gigId)
  if (!gig) return c.json({ error: 'Gig setlist not found' }, 404)

  const { title, calendarEventId } = c.req.valid('json')

  if (typeof calendarEventId === 'number') {
    const event = await getCalendarGigForBandOrNull(bandId, calendarEventId)
    if (!event) return c.json({ error: 'Linked calendar gig not found' }, 404)
  }

  const [updated] = await db
    .update(gigSetlists)
    .set({
      title: title?.trim() || gig.title,
      calendarEventId: calendarEventId === undefined ? gig.calendarEventId : calendarEventId,
    })
    .where(and(eq(gigSetlists.id, gigId), eq(gigSetlists.bandId, bandId)))
    .returning()

  return c.json(updated)
})

// DELETE /gigs/:id
// Remove a gig setlist. Linked songs are removed via FK cascade.
gigs.delete('/:id', async (c) => {
  const bandId = c.get('bandId')
  const gigId = Number(c.req.param('id'))
  if (!Number.isFinite(gigId) || gigId <= 0) return c.json({ error: 'Invalid gig id' }, 400)

  await db.delete(gigSetlists).where(and(eq(gigSetlists.id, gigId), eq(gigSetlists.bandId, bandId)))
  return c.json({ success: true })
})

// GET /gigs/:id/songs
gigs.get('/:id/songs', async (c) => {
  const bandId = c.get('bandId')
  const gigId = Number(c.req.param('id'))
  if (!Number.isFinite(gigId) || gigId <= 0) return c.json({ error: 'Invalid gig id' }, 400)

  const gig = await getGigSetlistForBandOrNull(bandId, gigId)
  if (!gig) return c.json({ error: 'Gig setlist not found' }, 404)

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
      lengthMs: songsTable.lengthMs,
      bpm: songsTable.bpm,
      tags: songsTable.tags,
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

// POST /gigs/:id/songs — add song to gig setlist
gigs.post(
  '/:id/songs',
  zValidator('json', z.object({ songId: z.number().int().positive(), position: z.number().int().default(0) })),
  async (c) => {
    const bandId = c.get('bandId')
    const gigId = Number(c.req.param('id'))
    if (!Number.isFinite(gigId) || gigId <= 0) return c.json({ error: 'Invalid gig id' }, 400)

    const gig = await getGigSetlistForBandOrNull(bandId, gigId)
    if (!gig) return c.json({ error: 'Gig setlist not found' }, 404)

    const { songId, position } = c.req.valid('json')

    const [song] = await db
      .select({ id: songsTable.id })
      .from(songsTable)
      .where(and(eq(songsTable.id, songId), eq(songsTable.bandId, bandId)))
      .limit(1)
    if (!song) return c.json({ error: 'Song not found' }, 404)

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
    const gigId = Number(c.req.param('id'))
    if (!Number.isFinite(gigId) || gigId <= 0) return c.json({ error: 'Invalid gig id' }, 400)

    const gig = await getGigSetlistForBandOrNull(bandId, gigId)
    if (!gig) return c.json({ error: 'Gig setlist not found' }, 404)

    const { order } = c.req.valid('json')

    await Promise.all(
      order.map(({ id, position }) =>
        db
          .update(gigSongs)
          .set({ position })
          .where(and(eq(gigSongs.id, id), eq(gigSongs.gigId, gigId), eq(gigSongs.bandId, bandId))),
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

  if (!Number.isFinite(gigId) || gigId <= 0) return c.json({ error: 'Invalid gig id' }, 400)
  if (!Number.isFinite(songId) || songId <= 0) return c.json({ error: 'Invalid song id' }, 400)

  const gig = await getGigSetlistForBandOrNull(bandId, gigId)
  if (!gig) return c.json({ error: 'Gig setlist not found' }, 404)

  await db
    .delete(gigSongs)
    .where(and(eq(gigSongs.gigId, gigId), eq(gigSongs.songId, songId), eq(gigSongs.bandId, bandId)))

  return c.json({ success: true })
})
