import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../../src/db/index.js'
import {
  songs,
  gigSetlists,
  gigSongs,
  calendarEvents,
  rehearsalSongs,
  votes,
} from '../../src/db/schema.js'
import { cleanDatabase } from '../helpers/test-db.js'
import { createTestContext } from '../helpers/test-auth.js'
import { listDuplicateSongs, deleteDuplicateSongs } from '../../src/cli/admin.js'

describe('Admin CLI: duplicate songs maintenance', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  it('lists duplicate songs in repertoire for a band', async () => {
    const ctx = await createTestContext()

    const [song1] = await db
      .insert(songs)
      .values({
        bandId: ctx.bandId,
        title: 'Creep',
        artist: 'Radiohead',
        type: 'song',
        isSetlist: true,
      })
      .returning()

    const [song2] = await db
      .insert(songs)
      .values({
        bandId: ctx.bandId,
        title: ' creep ',
        artist: 'RADIOHEAD',
        type: 'song',
        isSetlist: true,
      })
      .returning()

    const [uniqueSong] = await db
      .insert(songs)
      .values({
        bandId: ctx.bandId,
        title: 'Karma Police',
        artist: 'Radiohead',
        type: 'song',
        isSetlist: true,
      })
      .returning()

    const result = await listDuplicateSongs({ 'band-id': String(ctx.bandId) })
    expect(result).toHaveLength(1)
    expect(result[0].title.toLowerCase().trim()).toBe('creep')
    expect(result[0].duplicateCount).toBe(2)
    expect(result[0].songIds).toContain(song1.id)
    expect(result[0].songIds).toContain(song2.id)
  })

  it('remaps gigSongs, rehearsalSongs, and votes before deleting duplicate songs', async () => {
    const ctx = await createTestContext()

    // 1. Create duplicate songs with complementary metadata
    const [survivor] = await db
      .insert(songs)
      .values({
        bandId: ctx.bandId,
        title: 'Wonderwall',
        artist: 'Oasis',
        type: 'song',
        isSetlist: true,
        bpm: 120,
        spotifyUrl: null,
      })
      .returning()

    const [duplicate] = await db
      .insert(songs)
      .values({
        bandId: ctx.bandId,
        title: 'wonderwall',
        artist: 'oasis',
        type: 'song',
        isSetlist: true,
        bpm: null,
        spotifyUrl: 'https://open.spotify.com/track/12345',
      })
      .returning()

    // 2. Link duplicate song to a gig
    const [gig] = await db
      .insert(gigSetlists)
      .values({
        bandId: ctx.bandId,
        title: 'Summer Festival',
      })
      .returning()

    await db.insert(gigSongs).values({
      bandId: ctx.bandId,
      gigId: gig.id,
      songId: duplicate.id,
      position: 1,
    })

    // 3. Link duplicate song to rehearsal
    const [rehearsal] = await db
      .insert(calendarEvents)
      .values({
        bandId: ctx.bandId,
        title: 'Rehearsal',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        type: 'rehearsal',
      })
      .returning()

    await db.insert(rehearsalSongs).values({
      bandId: ctx.bandId,
      rehearsalId: rehearsal.id,
      songId: duplicate.id,
    })

    // 4. Vote on duplicate song
    await db.insert(votes).values({
      bandId: ctx.bandId,
      songId: duplicate.id,
      userId: ctx.userId,
      score: 5,
    })

    // Run deleteDuplicateSongs
    const deleteResult = await deleteDuplicateSongs({ 'band-id': String(ctx.bandId) })
    expect(deleteResult.deletedCount).toBe(1)
    expect(deleteResult.survivorId).toBe(survivor.id)

    // Check duplicate song is deleted
    const remainingSongs = await db.select().from(songs).where(eq(songs.bandId, ctx.bandId))
    expect(remainingSongs).toHaveLength(1)
    expect(remainingSongs[0].id).toBe(survivor.id)
    // Check merged metadata
    expect(remainingSongs[0].bpm).toBe(120)
    expect(remainingSongs[0].spotifyUrl).toBe('https://open.spotify.com/track/12345')

    // Check gigSongs remapped to survivor
    const remainingGigSongs = await db.select().from(gigSongs).where(eq(gigSongs.gigId, gig.id))
    expect(remainingGigSongs).toHaveLength(1)
    expect(remainingGigSongs[0].songId).toBe(survivor.id)

    // Check rehearsalSongs remapped to survivor
    const remainingRehearsalSongs = await db
      .select()
      .from(rehearsalSongs)
      .where(eq(rehearsalSongs.rehearsalId, rehearsal.id))
    expect(remainingRehearsalSongs).toHaveLength(1)
    expect(remainingRehearsalSongs[0].songId).toBe(survivor.id)

    // Check votes remapped to survivor
    const remainingVotes = await db.select().from(votes).where(eq(votes.bandId, ctx.bandId))
    expect(remainingVotes).toHaveLength(1)
    expect(remainingVotes[0].songId).toBe(survivor.id)
  })
})
