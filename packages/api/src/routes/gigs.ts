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

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

const gigSongParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  songId: z.coerce.number().int().positive(),
})

const gigSetlistBodySchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  calendarEventId: z.number().int().positive().nullable().optional(),
  location: z.string().trim().max(500).nullable().optional(),
  gigDate: z.string().trim().max(50).nullable().optional(),
  gigTime: z.string().trim().max(50).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
})

const addSongBodySchema = z.object({
  songId: z.number().int().positive(),
  position: z.number().int().default(0),
})

const reorderSongsBodySchema = z.object({
  order: z.array(z.object({ id: z.number(), position: z.number() })),
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
gigs.get('/', async (c) => {
  const bandId = c.get('bandId')

  // Clean up invalid links where calendar event no longer exists or is not of type 'gig'
  await db.execute(sql`
    UPDATE "gig_setlists"
    SET "calendar_event_id" = NULL
    WHERE "band_id" = ${bandId}
      AND "calendar_event_id" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "calendar_events" ce
        WHERE ce."id" = "gig_setlists"."calendar_event_id"
          AND ce."band_id" = ${bandId}
          AND ce."type" = 'gig'
      )
  `)

  const rows = await db
    .select({
      id: gigSetlists.id,
      bandId: gigSetlists.bandId,
      title: gigSetlists.title,
      location: gigSetlists.location,
      gigDate: gigSetlists.gigDate,
      gigTime: gigSetlists.gigTime,
      notes: gigSetlists.notes,
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
        eq(calendarEvents.type, 'gig'),
      ),
    )
    .where(eq(gigSetlists.bandId, bandId))
    .orderBy(asc(sql`coalesce(${calendarEvents.startTime}, ${gigSetlists.createdAt})`), asc(gigSetlists.id))

  return c.json(rows)
})

// POST /gigs
gigs.post('/', zValidator('json', gigSetlistBodySchema), async (c) => {
  const bandId = c.get('bandId')
  const { title, calendarEventId, location, gigDate, gigTime, notes } = c.req.valid('json')

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
      location: location ?? null,
      gigDate: gigDate ?? null,
      gigTime: gigTime ?? null,
      notes: notes ?? null,
    })
    .returning()

  return c.json(row, 201)
})

// PUT /gigs/:id
gigs.put('/:id', zValidator('param', idParamSchema), zValidator('json', gigSetlistBodySchema), async (c) => {
  const bandId = c.get('bandId')
  const { id: gigId } = c.req.valid('param')

  const gig = await getGigSetlistForBandOrNull(bandId, gigId)
  if (!gig) return c.json({ error: 'Gig setlist not found' }, 404)

  const { title, calendarEventId, location, gigDate, gigTime, notes } = c.req.valid('json')

  if (typeof calendarEventId === 'number') {
    const event = await getCalendarGigForBandOrNull(bandId, calendarEventId)
    if (!event) return c.json({ error: 'Linked calendar gig not found' }, 404)

    await db
      .update(gigSetlists)
      .set({ calendarEventId: null })
      .where(
        and(
          eq(gigSetlists.bandId, bandId),
          eq(gigSetlists.calendarEventId, calendarEventId),
        ),
      )
  }

  const updatePayload: Record<string, any> = {
    title: title?.trim() || gig.title,
    calendarEventId: calendarEventId === undefined ? gig.calendarEventId : calendarEventId,
  }
  if (location !== undefined) updatePayload.location = location
  if (gigDate !== undefined) updatePayload.gigDate = gigDate
  if (gigTime !== undefined) updatePayload.gigTime = gigTime
  if (notes !== undefined) updatePayload.notes = notes

  const [updated] = await db
    .update(gigSetlists)
    .set(updatePayload)
    .where(and(eq(gigSetlists.id, gigId), eq(gigSetlists.bandId, bandId)))
    .returning()

  return c.json(updated)
})

// POST /gigs/:id/duplicate
gigs.post('/:id/duplicate', zValidator('param', idParamSchema), async (c) => {
  const bandId = c.get('bandId')
  const { id: gigId } = c.req.valid('param')

  const gig = await getGigSetlistForBandOrNull(bandId, gigId)
  if (!gig) return c.json({ error: 'Gig setlist not found' }, 404)

  const newTitle = `${gig.title} (Kopie)`

  const [newGig] = await db
    .insert(gigSetlists)
    .values({
      bandId,
      title: newTitle,
      location: gig.location,
      gigDate: gig.gigDate,
      gigTime: gig.gigTime,
      notes: gig.notes,
      calendarEventId: null,
    })
    .returning()

  // Copy songs from original gig
  const existingSongs = await db
    .select({
      songId: gigSongs.songId,
      position: gigSongs.position,
    })
    .from(gigSongs)
    .where(and(eq(gigSongs.gigId, gigId), eq(gigSongs.bandId, bandId)))
    .orderBy(asc(gigSongs.position))

  if (existingSongs.length > 0) {
    await db.insert(gigSongs).values(
      existingSongs.map((s) => ({
        bandId,
        gigId: newGig.id,
        songId: s.songId,
        position: s.position,
      })),
    )
  }

  return c.json(newGig, 201)
})

// DELETE /gigs/:id
gigs.delete('/:id', zValidator('param', idParamSchema), async (c) => {
  const bandId = c.get('bandId')
  const { id: gigId } = c.req.valid('param')

  await db.delete(gigSetlists).where(and(eq(gigSetlists.id, gigId), eq(gigSetlists.bandId, bandId)))
  return c.json({ success: true })
})

// GET /gigs/:id/songs
gigs.get('/:id/songs', zValidator('param', idParamSchema), async (c) => {
  const bandId = c.get('bandId')
  const { id: gigId } = c.req.valid('param')

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

// POST /gigs/:id/songs
gigs.post(
  '/:id/songs',
  zValidator('param', idParamSchema),
  zValidator('json', addSongBodySchema),
  async (c) => {
    const bandId = c.get('bandId')
    const { id: gigId } = c.req.valid('param')

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
  zValidator('param', idParamSchema),
  zValidator('json', reorderSongsBodySchema),
  async (c) => {
    const bandId = c.get('bandId')
    const { id: gigId } = c.req.valid('param')

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
gigs.delete('/:id/songs/:songId', zValidator('param', gigSongParamSchema), async (c) => {
  const bandId = c.get('bandId')
  const { id: gigId, songId } = c.req.valid('param')

  const gig = await getGigSetlistForBandOrNull(bandId, gigId)
  if (!gig) return c.json({ error: 'Gig setlist not found' }, 404)

  await db
    .delete(gigSongs)
    .where(and(eq(gigSongs.gigId, gigId), eq(gigSongs.songId, songId), eq(gigSongs.bandId, bandId)))

  return c.json({ success: true })
})
