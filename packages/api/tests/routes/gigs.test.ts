import { describe, it, expect, beforeEach } from 'vitest'
import { app } from '../../src/app.js'
import { cleanDatabase } from '../helpers/test-db.js'
import { createTestContext } from '../helpers/test-auth.js'

describe('Gig Setlists API (/api/gigs)', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  it('creates and lists gig setlists with location and dates', async () => {
    const ctx = await createTestContext()

    const createRes = await app.request('/api/gigs', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        title: 'Summer Open Air',
        location: 'Schlachthof Wiesbaden',
        gigDate: '2026-08-15',
        gigTime: '20:00',
        notes: 'Soundcheck 17:00',
      }),
    })
    expect(createRes.status).toBe(201)
    const gig = await createRes.json()
    expect(gig.title).toBe('Summer Open Air')
    expect(gig.location).toBe('Schlachthof Wiesbaden')
    expect(gig.gigDate).toBe('2026-08-15')
    expect(gig.gigTime).toBe('20:00')

    // List gigs
    const listRes = await app.request('/api/gigs', {
      headers: ctx.headers,
    })
    expect(listRes.status).toBe(200)
    const gigs = await listRes.json()
    expect(gigs.length).toBe(1)
    expect(gigs[0].location).toBe('Schlachthof Wiesbaden')
  })

  it('duplicates a gig setlist along with its songs', async () => {
    const ctx = await createTestContext()

    // 1. Create a song
    const songRes = await app.request('/api/songs', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        title: 'Song 1',
        artist: 'Band',
        type: 'song',
      }),
    })
    const song = await songRes.json()

    // 2. Create a gig setlist
    const gigRes = await app.request('/api/gigs', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        title: 'Original Gig',
        location: 'Main Stage',
      }),
    })
    const gig = await gigRes.json()

    // 3. Add song to gig
    const addSongRes = await app.request(`/api/gigs/${gig.id}/songs`, {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        songId: song.id,
        position: 0,
      }),
    })
    expect(addSongRes.status).toBe(201)

    // 4. Duplicate gig
    const dupRes = await app.request(`/api/gigs/${gig.id}/duplicate`, {
      method: 'POST',
      headers: ctx.headers,
    })
    expect(dupRes.status).toBe(201)
    const dupGig = await dupRes.json()
    expect(dupGig.title).toBe('Original Gig (Kopie)')
    expect(dupGig.location).toBe('Main Stage')

    // 5. Verify songs in duplicated gig
    const dupSongsRes = await app.request(`/api/gigs/${dupGig.id}/songs`, {
      headers: ctx.headers,
    })
    expect(dupSongsRes.status).toBe(200)
    const dupSongs = await dupSongsRes.json()
    expect(dupSongs.length).toBe(1)
    expect(dupSongs[0].title).toBe('Song 1')
  })
})
