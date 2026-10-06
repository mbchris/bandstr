import { describe, it, expect, beforeEach } from 'vitest'
import { songService } from '../../src/services/song.service.js'
import { cleanDatabase } from '../helpers/test-db.js'
import { createTestContext } from '../helpers/test-auth.js'

describe('songService repertoire uniqueness', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  it('returns 409 conflict when creating duplicate song in repertoire', async () => {
    const ctx = await createTestContext()

    const first = await songService.createSong({
      bandId: ctx.bandId,
      userId: ctx.userId,
      userName: 'Test User',
      data: {
        title: 'Wonderwall',
        artist: 'Oasis',
        type: 'song',
        isSetlist: true,
      },
    })
    expect(first.status).toBe(201)

    // Attempt to create duplicate with whitespace and different casing
    const duplicate = await songService.createSong({
      bandId: ctx.bandId,
      userId: ctx.userId,
      userName: 'Test User',
      data: {
        title: '  wonderwall  ',
        artist: 'OASIS',
        type: 'song',
        isSetlist: true,
      },
    })

    expect(duplicate.status).toBe(409)
    expect(duplicate.error).toBe('A song with this title and artist already exists in your repertoire.')
  })

  it('allows duplicate title and artist if type is not song', async () => {
    const ctx = await createTestContext()

    const firstPause = await songService.createSong({
      bandId: ctx.bandId,
      userId: ctx.userId,
      userName: 'Test User',
      data: {
        title: 'PAUSE',
        artist: '-',
        type: 'pause',
        isSetlist: true,
      },
    })
    expect(firstPause.status).toBe(201)

    const secondPause = await songService.createSong({
      bandId: ctx.bandId,
      userId: ctx.userId,
      userName: 'Test User',
      data: {
        title: 'PAUSE',
        artist: '-',
        type: 'pause',
        isSetlist: true,
      },
    })
    expect(secondPause.status).toBe(201)
  })

  it('returns 409 conflict when updating a song to collide with an existing repertoire song', async () => {
    const ctx = await createTestContext()

    const song1 = await songService.createSong({
      bandId: ctx.bandId,
      userId: ctx.userId,
      userName: 'Test User',
      data: {
        title: 'Song One',
        artist: 'Artist A',
        type: 'song',
        isSetlist: true,
      },
    })
    expect(song1.status).toBe(201)

    const song2 = await songService.createSong({
      bandId: ctx.bandId,
      userId: ctx.userId,
      userName: 'Test User',
      data: {
        title: 'Song Two',
        artist: 'Artist B',
        type: 'song',
        isSetlist: true,
      },
    })
    expect(song2.status).toBe(201)

    // Updating song2 to song1 title and artist should fail
    const updateResult = await songService.updateSong({
      bandId: ctx.bandId,
      id: (song2 as any).song.id,
      data: {
        title: 'song one',
        artist: 'artist a',
      },
    })

    expect(updateResult).toEqual({
      status: 409,
      error: 'A song with this title and artist already exists in your repertoire.',
    })
  })

  it('allows updating a song without conflicting with itself', async () => {
    const ctx = await createTestContext()

    const song = await songService.createSong({
      bandId: ctx.bandId,
      userId: ctx.userId,
      userName: 'Test User',
      data: {
        title: 'Unique Song',
        artist: 'Unique Artist',
        type: 'song',
        isSetlist: true,
      },
    })
    expect(song.status).toBe(201)

    const updateResult = await songService.updateSong({
      bandId: ctx.bandId,
      id: (song as any).song.id,
      data: {
        bpm: 120,
      },
    })

    expect(updateResult).not.toBeNull()
    expect((updateResult as any).status).toBe(200)
    expect((updateResult as any).song.title).toBe('Unique Song')
    expect((updateResult as any).song.bpm).toBe(120)
  })
})
