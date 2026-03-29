import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, asc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { songs as songsTable, votes as votesTable, personalNotes } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant, type TenantEnv } from '../middleware/tenant.js'
import { fetchSpotifyMetadata } from '../lib/spotify.js'
import { bandHasProPlan } from '../lib/entitlements.js'

export const songs = new Hono<TenantEnv>()
const FREE_SETLIST_LIMIT = 15

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
      ? await fetchSpotifyMetadata(body.spotifyUrl)
      : { title: body.title, artist: body.artist, thumbnail: null }

  const [song] = await db
    .insert(songsTable)
    .values({
      bandId,
      title: body.title || meta.title || 'Untitled',
      artist: body.artist || meta.artist || 'Unknown Artist',
      spotifyUrl: body.spotifyUrl,
      youtubeUrl: body.youtubeUrl,
      thumbnailUrl: meta.thumbnail,
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
  const spotifyUrl = body.spotifyUrl !== undefined ? body.spotifyUrl : existing.spotifyUrl
  const needsMeta =
    (body.spotifyUrl !== undefined && body.spotifyUrl !== existing.spotifyUrl) ||
    (spotifyUrl && !thumbnailUrl)

  if (needsMeta && spotifyUrl) {
    const meta = await fetchSpotifyMetadata(spotifyUrl)
    thumbnailUrl = meta.thumbnail ?? thumbnailUrl
  }

  const [updated] = await db
    .update(songsTable)
    .set({
      title: body.title ?? existing.title,
      artist: body.artist ?? existing.artist,
      spotifyUrl: body.spotifyUrl ?? existing.spotifyUrl,
      youtubeUrl: body.youtubeUrl ?? existing.youtubeUrl,
      thumbnailUrl,
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

// GET /songs/lookup?url=...
songs.get('/lookup', async (c) => {
  const url = c.req.query('url')
  if (!url) return c.json({ error: 'url is required' }, 400)
  const meta = await fetchSpotifyMetadata(url)
  return c.json(meta)
})

// GET /songs/notes?songId=...
songs.get('/notes', async (c) => {
  const bandId = c.get('bandId')
  const userId = c.get('user').id
  const songId = Number(c.req.query('songId'))
  if (!songId) return c.json({ error: 'songId is required' }, 400)
  const hasProPlan = await bandHasProPlan(bandId)
  if (!hasProPlan) return c.json({ error: 'Personal notes are available on pro plans only.' }, 403)

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
