import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant, type TenantEnv } from '../middleware/tenant.js'
import { songService } from '../services/song.service.js'
import { bandHasProPlan } from '../lib/entitlements.js'
import { fetchSpotifyEnrichedMetadata } from '../lib/spotify.js'

export const songs = new Hono<TenantEnv>()

const MAX_TAG_COUNT = 20
const MAX_TAG_LENGTH = 40

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

const songIdParamSchema = z.object({
  songId: z.coerce.number().int().positive(),
})

const listSongsQuerySchema = z.object({
  setlist: z.string().optional(),
})

const createSongSchema = z.object({
  title: z.string().optional(),
  artist: z.string().optional(),
  spotifyUrl: z.string().url().optional(),
  youtubeUrl: z.string().url().optional(),
  lengthMs: z.number().int().min(0).optional(),
  bpm: z.number().int().positive().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(MAX_TAG_LENGTH)).max(MAX_TAG_COUNT).default([]),
  notes: z.string().optional(),
  type: z.enum(['song', 'pause', 'tuning', 'note', 'set', 'encore']).default('song'),
  pitch: z.number().int().min(-5).max(5).default(0),
  isSetlist: z.boolean().default(false),
  position: z.number().int().default(0),
  isPinned: z.boolean().default(false),
  isArchived: z.boolean().default(false),
})

const updateSongSchema = z.object({
  title: z.string().optional(),
  artist: z.string().optional(),
  spotifyUrl: z.string().optional().nullable(),
  youtubeUrl: z.string().optional().nullable(),
  lengthMs: z.number().int().min(0).optional().nullable(),
  bpm: z.number().int().positive().optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(MAX_TAG_LENGTH)).max(MAX_TAG_COUNT).optional(),
  notes: z.string().optional().nullable(),
  type: z.enum(['song', 'pause', 'tuning', 'note', 'set', 'encore']).optional(),
  pitch: z.number().int().min(-5).max(5).optional(),
  isSetlist: z.boolean().optional(),
  position: z.number().int().optional(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
})

const reorderSchema = z.object({
  order: z.array(z.object({ id: z.number(), position: z.number() })),
})

const userSetlistSongSchema = z.object({
  songId: z.number().int().positive(),
  position: z.number().int().min(0).optional(),
  isPinned: z.boolean().optional(),
})

const userSetlistUpdateSchema = userSetlistSongSchema.partial()

const userSetlistReorderSchema = z.object({
  order: z.array(z.object({ songId: z.number(), position: z.number() })),
})

const lookupQuerySchema = z.object({
  url: z.string().min(1),
})

const notesQuerySchema = z.object({
  songId: z.coerce.number().int().positive().optional(),
})

const noteBodySchema = z.object({
  songId: z.number(),
  content: z.string(),
})

// All song routes require auth + tenant context
songs.use('*', requireAuth, requireTenant)

// GET /songs — list all songs with vote aggregates
songs.get('/', zValidator('query', listSongsQuerySchema), async (c) => {
  const bandId = c.get('bandId')
  const userId = c.get('user').id
  const { setlist } = c.req.valid('query')
  const isSetlistOnly = setlist === 'true'

  const songList = await songService.listSongs(bandId, userId, isSetlistOnly)
  return c.json(songList)
})

// POST /songs — create song
songs.post('/', zValidator('json', createSongSchema), async (c) => {
  const bandId = c.get('bandId')
  const userId = c.get('user').id
  const userName = c.get('user').name
  const body = c.req.valid('json')

  const result = await songService.createSong({
    bandId,
    userId,
    userName,
    data: body,
  })

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result.song, 201)
})

// PUT /songs/:id — update song
songs.put('/:id', zValidator('param', idParamSchema), zValidator('json', updateSongSchema), async (c) => {
  const bandId = c.get('bandId')
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')

  const result = await songService.updateSong({
    bandId,
    id,
    data: body as any,
  })

  if (!result) return c.json({ error: 'Not found' }, 404)
  if ('error' in result) return c.json({ error: result.error }, result.status)
  return c.json(result.song)
})

// DELETE /songs/:id
songs.delete('/:id', zValidator('param', idParamSchema), async (c) => {
  const bandId = c.get('bandId')
  const { id } = c.req.valid('param')

  const result = await songService.deleteSong(bandId, id)
  if (!result) return c.json({ error: 'Not found' }, 404)
  return c.json(result)
})

// POST /songs/reorder
songs.post('/reorder', zValidator('json', reorderSchema), async (c) => {
  const bandId = c.get('bandId')
  const { order } = c.req.valid('json')

  const result = await songService.reorderSongs(bandId, order)
  return c.json(result)
})

// GET /songs/user-setlist
songs.get('/user-setlist', async (c) => {
  const bandId = c.get('bandId')
  const userId = c.get('user').id

  const rows = await songService.getUserSetlist(bandId, userId)
  return c.json(rows)
})

// POST /songs/user-setlist
songs.post('/user-setlist', zValidator('json', userSetlistSongSchema), async (c) => {
  const bandId = c.get('bandId')
  const userId = c.get('user').id
  const body = c.req.valid('json')

  const result = await songService.addUserSetlistSong({
    bandId,
    userId,
    songId: body.songId,
    position: body.position,
    isPinned: body.isPinned,
  })

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json({ success: true }, 201)
})

// PUT /songs/user-setlist/:songId
songs.put(
  '/user-setlist/:songId',
  zValidator('param', songIdParamSchema),
  zValidator('json', userSetlistUpdateSchema),
  async (c) => {
    const bandId = c.get('bandId')
    const userId = c.get('user').id
    const { songId } = c.req.valid('param')
    const data = c.req.valid('json')

    const result = await songService.updateUserSetlistSong({
      bandId,
      userId,
      songId,
      data,
    })

    return c.json(result)
  },
)

// DELETE /songs/user-setlist/:songId
songs.delete('/user-setlist/:songId', zValidator('param', songIdParamSchema), async (c) => {
  const bandId = c.get('bandId')
  const userId = c.get('user').id
  const { songId } = c.req.valid('param')

  const result = await songService.deleteUserSetlistSong(bandId, userId, songId)
  return c.json(result)
})

// POST /songs/user-setlist/reorder
songs.post('/user-setlist/reorder', zValidator('json', userSetlistReorderSchema), async (c) => {
  const bandId = c.get('bandId')
  const userId = c.get('user').id
  const { order } = c.req.valid('json')

  const result = await songService.reorderUserSetlistSongs(bandId, userId, order)
  return c.json(result)
})

// GET /songs/lookup?url=...
songs.get('/lookup', zValidator('query', lookupQuerySchema), async (c) => {
  const { url } = c.req.valid('query')
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
songs.get('/notes', zValidator('query', notesQuerySchema), async (c) => {
  const bandId = c.get('bandId')
  const userId = c.get('user').id
  const { songId } = c.req.valid('query')

  const hasProPlan = await bandHasProPlan(bandId)
  if (!hasProPlan) return c.json({ error: 'Personal notes are available on pro plans only.' }, 403)

  if (!songId) {
    const rows = await songService.listPersonalNotes(bandId, userId)
    return c.json(rows)
  }

  const note = await songService.getPersonalNote(bandId, userId, songId)
  return c.json(note)
})

// POST /songs/notes
songs.post('/notes', zValidator('json', noteBodySchema), async (c) => {
  const bandId = c.get('bandId')
  const userId = c.get('user').id
  const { songId, content } = c.req.valid('json')

  const hasProPlan = await bandHasProPlan(bandId)
  if (!hasProPlan) return c.json({ error: 'Personal notes are available on pro plans only.' }, 403)

  const result = await songService.savePersonalNote({
    bandId,
    userId,
    songId,
    content,
  })

  return c.json(result)
})
