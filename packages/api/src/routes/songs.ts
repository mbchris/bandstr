import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, asc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { songs as songsTable, votes as votesTable, personalNotes, userSetlistSongs } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant, type TenantEnv } from '../middleware/tenant.js'
import { fetchSpotifyEnrichedMetadata } from '../lib/spotify.js'
import { bandHasProPlan } from '../lib/entitlements.js'

export const songs = new Hono<TenantEnv>()
const FREE_SETLIST_LIMIT = 15
const MAX_TAG_COUNT = 20
const MAX_TAG_LENGTH = 40

function normalizeTags(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined
  if (!Array.isArray(raw)) return []
  const normalized = raw
    .filter((item): item is string => typeof item === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, MAX_TAG_COUNT)
    .map((tag) => tag.slice(0, MAX_TAG_LENGTH))
  return Array.from(new Set(normalized))
}

async function setlistSongCountForBand(bandId: number, excludeSongId?: number) {
  const conditions = [
    eq(songsTable.bandId, bandId),
    eq(songsTable.isSetlist, true),
    eq(songsTable.type, 'song'),
  ]
  if (excludeSongId) conditions.push(sql`${songsTable.id} <> ${excludeSongId}`)

  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(songsTable)
    .where(and(...conditions))

  return Number(row?.count ?? 0)
}

// All song routes require auth + tenant context
songs.use('*', requireAuth, requireTenant)

// GET /songs — list all songs with vote aggregates
songs.get('/', async (c) => {
  const bandId = c.get('bandId')
  const userId = c.get('user').id

  const allSongs = await db
    .select()
    .from(songsTable)
    .where(eq(songsTable.bandId, bandId))
    .orderBy(asc(songsTable.position))

  const allVotes = await db
    .select()
    .from(votesTable)
    .where(eq(votesTable.bandId, bandId))

  const isSetlistOnly = c.req.query('setlist') === 'true'

  return c.json(
    allSongs
      .filter((s) => (isSetlistOnly ? s.isSetlist : true))
      .map((song) => {
        const songVotes = allVotes.filter((v) => v.songId === song.id)
        const myVote = songVotes.find((v) => v.userId === userId)
        return {
          ...song,
          voteCount: songVotes.length,
          voteAverage:
            songVotes.length > 0
              ? songVotes.reduce((acc, v) => acc + v.score, 0) / songVotes.length
              : 0,
          hasVoted: myVote ? myVote.score : -1,
          allVotes: songVotes,
        }
      })
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1
        if (!a.isPinned && b.isPinned) return 1
        return a.position - b.position || b.voteAverage - a.voteAverage
      }),
  )
})

// POST /songs — create song
const createSongSchema = z.object({
  title: z.string().optional(),
  artist: z.string().optional(),
  spotifyUrl: z.string().url().optional(),
  youtubeUrl: z.string().url().optional(),
  lengthMs: z.number().int().min(0).optional(),
  tags: z.array(z.string().trim().min(1).max(MAX_TAG_LENGTH)).max(MAX_TAG_COUNT).default([]),
  notes: z.string().optional(),
  type: z.enum(['song', 'pause', 'tuning']).default('song'),
  pitch: z.number().int().min(-5).max(5).default(0),
  isSetlist: z.boolean().default(false),
  position: z.number().int().default(0),
  isPinned: z.boolean().default(false),
})

songs.post('/', zValidator('json', createSongSchema), async (c) => {
  const bandId = c.get('bandId')
  const userId = c.get('user').id
  const body = c.req.valid('json')
  const hasProPlan = await bandHasProPlan(bandId)

  if (!hasProPlan && body.notes !== undefined) {
    return c.json({ error: 'Song shared notes are available on pro plans only.' }, 403)
  }

  if (!hasProPlan && body.isSetlist && body.type === 'song') {
    const setlistCount = await setlistSongCountForBand(bandId)
    if (setlistCount >= FREE_SETLIST_LIMIT) {
      return c.json(
        { error: 'Free plan allows up to 15 setlist songs. Upgrade to pro to add more.' },
        403,
      )
    }
  }

  const meta =
    body.type === 'song' && body.spotifyUrl
      ? await fetchSpotifyEnrichedMetadata(body.spotifyUrl)
      : {
          title: body.title ?? null,
          artist: body.artist ?? null,
          thumbnail: null,
          durationMs: body.lengthMs ?? null,
        }

  const [song] = await db
    .insert(songsTable)
    .values({
      bandId,
      title: body.title || meta.title || 'Untitled',
      artist: body.artist || meta.artist || 'Unknown Artist',
      spotifyUrl: body.spotifyUrl,
      youtubeUrl: body.youtubeUrl,
      thumbnailUrl: meta.thumbnail,
      lengthMs: body.lengthMs ?? meta.durationMs,
      tags: body.tags,
      notes: body.notes,
      type: body.type,
      pitch: body.pitch,
      isSetlist: body.isSetlist,
      position: body.position,
      isPinned: body.isPinned,
      addedBy: userId,
    })
    .returning()

  return c.json(song, 201)
})

// PUT /songs/:id — update song
songs.put('/:id', async (c) => {
  const bandId = c.get('bandId')
  const id = Number(c.req.param('id'))
  const body = await c.req.json()
  const hasProPlan = await bandHasProPlan(bandId)

  const [existing] = await db
    .select()
    .from(songsTable)
    .where(and(eq(songsTable.id, id), eq(songsTable.bandId, bandId)))
    .limit(1)

  if (!existing) return c.json({ error: 'Not found' }, 404)

  if (!hasProPlan && body.notes !== undefined) {
    return c.json({ error: 'Song shared notes are available on pro plans only.' }, 403)
  }

  const nextIsSetlist = body.isSetlist ?? existing.isSetlist
  const nextType = body.type ?? existing.type
  const becomesCountedSetlistSong = nextIsSetlist && nextType === 'song' && !(existing.isSetlist && existing.type === 'song')

  if (!hasProPlan && becomesCountedSetlistSong) {
    const setlistCount = await setlistSongCountForBand(bandId, id)
    if (setlistCount >= FREE_SETLIST_LIMIT) {
      return c.json(
        { error: 'Free plan allows up to 15 setlist songs. Upgrade to pro to add more.' },
        403,
      )
    }
  }

  let thumbnailUrl = existing.thumbnailUrl
  let lengthMs = existing.lengthMs
  const spotifyUrl = body.spotifyUrl !== undefined ? body.spotifyUrl : existing.spotifyUrl
  const needsMeta =
    (body.spotifyUrl !== undefined && body.spotifyUrl !== existing.spotifyUrl) ||
    (spotifyUrl && (!thumbnailUrl || !lengthMs))

  if (needsMeta && spotifyUrl) {
    const meta = await fetchSpotifyEnrichedMetadata(spotifyUrl)
    thumbnailUrl = meta.thumbnail ?? thumbnailUrl
    lengthMs = meta.durationMs ?? lengthMs
  }

  const [updated] = await db
    .update(songsTable)
    .set({
      title: body.title ?? existing.title,
      artist: body.artist ?? existing.artist,
      spotifyUrl: body.spotifyUrl ?? existing.spotifyUrl,
      youtubeUrl: body.youtubeUrl ?? existing.youtubeUrl,
      thumbnailUrl,
      lengthMs: body.lengthMs ?? lengthMs,
      tags: normalizeTags(body.tags) ?? existing.tags,
      notes: body.notes ?? existing.notes,
      type: body.type ?? existing.type,
      pitch: body.pitch ?? existing.pitch,
      isSetlist: body.isSetlist ?? existing.isSetlist,
      position: body.position ?? existing.position,
      isPinned: body.isPinned ?? existing.isPinned,
    })
    .where(and(eq(songsTable.id, id), eq(songsTable.bandId, bandId)))
    .returning()

  return c.json(updated)
})

// DELETE /songs/:id
songs.delete('/:id', async (c) => {
  const bandId = c.get('bandId')
  const id = Number(c.req.param('id'))

  const [existing] = await db
    .select()
    .from(songsTable)
    .where(and(eq(songsTable.id, id), eq(songsTable.bandId, bandId)))
    .limit(1)

  if (!existing) return c.json({ error: 'Not found' }, 404)

  await db.delete(votesTable).where(and(eq(votesTable.songId, id), eq(votesTable.bandId, bandId)))
  await db.delete(songsTable).where(and(eq(songsTable.id, id), eq(songsTable.bandId, bandId)))

  return c.json({ success: true })
})

// POST /songs/reorder
songs.post(
  '/reorder',
  zValidator('json', z.object({ order: z.array(z.object({ id: z.number(), position: z.number() })) })),
  async (c) => {
    const bandId = c.get('bandId')
    const { order } = c.req.valid('json')

    await Promise.all(
      order.map(({ id, position }) =>
        db
          .update(songsTable)
          .set({ position })
          .where(and(eq(songsTable.id, id), eq(songsTable.bandId, bandId))),
      ),
    )

    return c.json({ success: true })
  },
)

const userSetlistSongSchema = z.object({
  songId: z.number().int().positive(),
  position: z.number().int().min(0).optional(),
  isPinned: z.boolean().optional(),
})

// GET /songs/user-setlist
songs.get('/user-setlist', async (c) => {
  const bandId = c.get('bandId')
  const userId = c.get('user').id

  const rows = await db
    .select({
      id: songsTable.id,
      bandId: songsTable.bandId,
      title: songsTable.title,
      artist: songsTable.artist,
      spotifyUrl: songsTable.spotifyUrl,
      youtubeUrl: songsTable.youtubeUrl,
      thumbnailUrl: songsTable.thumbnailUrl,
      lengthMs: songsTable.lengthMs,
      tags: songsTable.tags,
      notes: songsTable.notes,
      type: songsTable.type,
      pitch: songsTable.pitch,
      isSetlist: songsTable.isSetlist,
      position: songsTable.position,
      isPinned: songsTable.isPinned,
      addedBy: songsTable.addedBy,
      createdAt: songsTable.createdAt,
      userSetlistPosition: userSetlistSongs.position,
      userSetlistPinned: userSetlistSongs.isPinned,
    })
    .from(userSetlistSongs)
    .innerJoin(songsTable, eq(userSetlistSongs.songId, songsTable.id))
    .where(and(eq(userSetlistSongs.bandId, bandId), eq(userSetlistSongs.userId, userId)))
    .orderBy(asc(userSetlistSongs.position), asc(songsTable.id))

  return c.json(rows)
})

// POST /songs/user-setlist
songs.post('/user-setlist', zValidator('json', userSetlistSongSchema), async (c) => {
  const bandId = c.get('bandId')
  const userId = c.get('user').id
  const body = c.req.valid('json')

  const [song] = await db
    .select({ id: songsTable.id, type: songsTable.type })
    .from(songsTable)
    .where(and(eq(songsTable.id, body.songId), eq(songsTable.bandId, bandId)))
    .limit(1)

  if (!song) return c.json({ error: 'Song not found' }, 404)
  if (song.type !== 'song') return c.json({ error: 'Only songs can be added to personal setlist.' }, 400)

  const [maxRow] = await db
    .select({ maxPosition: sql<number>`coalesce(max(${userSetlistSongs.position}), -1)` })
    .from(userSetlistSongs)
    .where(and(eq(userSetlistSongs.bandId, bandId), eq(userSetlistSongs.userId, userId)))

  const nextPosition = typeof body.position === 'number' ? body.position : Number(maxRow?.maxPosition ?? -1) + 1

  await db
    .insert(userSetlistSongs)
    .values({
      bandId,
      userId,
      songId: body.songId,
      position: nextPosition,
      isPinned: body.isPinned ?? false,
    })
    .onConflictDoUpdate({
      target: [userSetlistSongs.bandId, userSetlistSongs.userId, userSetlistSongs.songId],
      set: {
        position: nextPosition,
        isPinned: body.isPinned ?? false,
      },
    })

  return c.json({ success: true }, 201)
})

// PUT /songs/user-setlist/:songId
songs.put('/user-setlist/:songId', async (c) => {
  const bandId = c.get('bandId')
  const userId = c.get('user').id
  const songId = Number(c.req.param('songId'))
  if (!Number.isFinite(songId) || songId <= 0) return c.json({ error: 'Invalid song id' }, 400)
  const payload = userSetlistSongSchema.partial().parse(await c.req.json())

  await db
    .update(userSetlistSongs)
    .set({
      position: payload.position,
      isPinned: payload.isPinned,
    })
    .where(
      and(
        eq(userSetlistSongs.bandId, bandId),
        eq(userSetlistSongs.userId, userId),
        eq(userSetlistSongs.songId, songId),
      ),
    )

  return c.json({ success: true })
})

// DELETE /songs/user-setlist/:songId
songs.delete('/user-setlist/:songId', async (c) => {
  const bandId = c.get('bandId')
  const userId = c.get('user').id
  const songId = Number(c.req.param('songId'))
  if (!Number.isFinite(songId) || songId <= 0) return c.json({ error: 'Invalid song id' }, 400)

  await db
    .delete(userSetlistSongs)
    .where(
      and(
        eq(userSetlistSongs.bandId, bandId),
        eq(userSetlistSongs.userId, userId),
        eq(userSetlistSongs.songId, songId),
      ),
    )

  return c.json({ success: true })
})

// POST /songs/user-setlist/reorder
songs.post(
  '/user-setlist/reorder',
  zValidator('json', z.object({ order: z.array(z.object({ songId: z.number(), position: z.number() })) })),
  async (c) => {
    const bandId = c.get('bandId')
    const userId = c.get('user').id
    const { order } = c.req.valid('json')

    await Promise.all(
      order.map(({ songId, position }) =>
        db
          .update(userSetlistSongs)
          .set({ position })
          .where(
            and(
              eq(userSetlistSongs.bandId, bandId),
              eq(userSetlistSongs.userId, userId),
              eq(userSetlistSongs.songId, songId),
            ),
          ),
      ),
    )

    return c.json({ success: true })
  },
)

// GET /songs/lookup?url=...
songs.get('/lookup', async (c) => {
  const url = c.req.query('url')
  if (!url) return c.json({ error: 'url is required' }, 400)
  try {
    const meta = await fetchSpotifyEnrichedMetadata(url)
    return c.json({
      title: meta.title,
      artist: meta.artist,
      thumbnail: meta.thumbnail,
      lengthMs: meta.durationMs,
      trackTimeMillis: meta.trackTimeMillis,
      durationSource: meta.durationSource,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lookup failed'
    return c.json({ error: message }, 400)
  }
})

// GET /songs/notes?songId=...
songs.get('/notes', async (c) => {
  const bandId = c.get('bandId')
  const userId = c.get('user').id
  const songIdParam = c.req.query('songId')
  const songId = songIdParam ? Number(songIdParam) : null
  const hasProPlan = await bandHasProPlan(bandId)
  if (!hasProPlan) return c.json({ error: 'Personal notes are available on pro plans only.' }, 403)

  if (!songIdParam) {
    const rows = await db
      .select({
        id: personalNotes.id,
        songId: personalNotes.songId,
        content: personalNotes.content,
        createdAt: personalNotes.createdAt,
        songTitle: songsTable.title,
        songArtist: songsTable.artist,
        spotifyUrl: songsTable.spotifyUrl,
        youtubeUrl: songsTable.youtubeUrl,
      })
      .from(personalNotes)
      .innerJoin(songsTable, eq(personalNotes.songId, songsTable.id))
      .where(and(eq(personalNotes.userId, userId), eq(personalNotes.bandId, bandId)))
      .orderBy(asc(songsTable.title))

    return c.json(rows)
  }

  if (!Number.isFinite(songId) || !songId || songId <= 0) {
    return c.json({ error: 'songId must be a positive number' }, 400)
  }

  const [note] = await db
    .select()
    .from(personalNotes)
    .where(
      and(
        eq(personalNotes.songId, songId),
        eq(personalNotes.userId, userId),
        eq(personalNotes.bandId, bandId),
      ),
    )
    .limit(1)

  return c.json(note ?? null)
})

// POST /songs/notes
songs.post(
  '/notes',
  zValidator('json', z.object({ songId: z.number(), content: z.string() })),
  async (c) => {
    const bandId = c.get('bandId')
    const userId = c.get('user').id
    const { songId, content } = c.req.valid('json')
    const hasProPlan = await bandHasProPlan(bandId)
    if (!hasProPlan) return c.json({ error: 'Personal notes are available on pro plans only.' }, 403)

    const existing = await db
      .select()
      .from(personalNotes)
      .where(
        and(
          eq(personalNotes.songId, songId),
          eq(personalNotes.userId, userId),
          eq(personalNotes.bandId, bandId),
        ),
      )
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(personalNotes)
        .set({ content })
        .where(
          and(
            eq(personalNotes.songId, songId),
            eq(personalNotes.userId, userId),
            eq(personalNotes.bandId, bandId),
          ),
        )
    } else {
      await db.insert(personalNotes).values({ bandId, songId, userId, content })
    }

    return c.json({ success: true })
  },
)
