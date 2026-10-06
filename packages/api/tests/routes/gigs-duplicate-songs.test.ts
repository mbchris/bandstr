import { describe, it, expect, beforeEach } from 'vitest'
import { app } from '../../src/app.js'
import { cleanDatabase } from '../helpers/test-db.js'
import { createTestContext } from '../helpers/test-auth.js'

describe('Gig Setlists Granular Song Deletion (/api/gigs/:id/songs/:songId)', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  it('deletes only specific gigSong entry when gigSongId query parameter is provided', async () => {
    const ctx = await createTestContext()

    // 1. Create a song in repertoire
    const songRes = await app.request('/api/songs', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        title: 'Song Repeated',
        artist: 'Band',
        type: 'song',
        isSetlist: true,
      }),
    })
    expect(songRes.status).toBe(201)
    const song = await songRes.json()

    // 2. Create a gig
    const gigRes = await app.request('/api/gigs', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        title: 'Headline Show',
      }),
    })
    expect(gigRes.status).toBe(201)
    const gig = await gigRes.json()

    // 3. Add same song twice (e.g., opener and encore)
    const add1 = await app.request(`/api/gigs/${gig.id}/songs`, {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({ songId: song.id, position: 0 }),
    })
    expect(add1.status).toBe(201)
    const entry1 = await add1.json()

    const add2 = await app.request(`/api/gigs/${gig.id}/songs`, {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({ songId: song.id, position: 1 }),
    })
    expect(add2.status).toBe(201)
    const entry2 = await add2.json()

    // Verify both exist
    const listRes = await app.request(`/api/gigs/${gig.id}/songs`, {
      headers: ctx.headers,
    })
    expect(listRes.status).toBe(200)
    const gigSongsList = await listRes.json()
    expect(gigSongsList).toHaveLength(2)

    // 4. Delete only the first occurrence using ?gigSongId=<id>
    const deleteRes = await app.request(`/api/gigs/${gig.id}/songs/${song.id}?gigSongId=${entry1.id}`, {
      method: 'DELETE',
      headers: ctx.headers,
    })
    expect(deleteRes.status).toBe(200)

    // 5. Verify the second occurrence still remains
    const remainingRes = await app.request(`/api/gigs/${gig.id}/songs`, {
      headers: ctx.headers,
    })
    expect(remainingRes.status).toBe(200)
    const remainingSongs = await remainingRes.json()
    expect(remainingSongs).toHaveLength(1)
    expect(remainingSongs[0].gigSongId).toBe(entry2.id)
  })
})
