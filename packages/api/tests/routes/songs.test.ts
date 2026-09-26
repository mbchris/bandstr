import { describe, it, expect, beforeEach } from 'vitest'
import { app } from '../../src/app.js'
import { cleanDatabase } from '../helpers/test-db.js'
import { createTestContext } from '../helpers/test-auth.js'

describe('Songs API (/api/songs)', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  it('rejects listing songs when unauthenticated', async () => {
    const res = await app.request('/api/songs')
    expect(res.status).toBe(401)
  })

  it('rejects listing songs without X-Band-Id', async () => {
    const ctx = await createTestContext()
    const res = await app.request('/api/songs', {
      headers: ctx.authHeader,
    })
    expect(res.status).toBe(400)
  })

  it('lists empty songs array for new band', async () => {
    const ctx = await createTestContext()
    const res = await app.request('/api/songs', {
      headers: ctx.headers,
    })
    expect(res.status).toBe(200)
    const songs = await res.json()
    expect(Array.isArray(songs)).toBe(true)
    expect(songs.length).toBe(0)
  })

  it('creates and lists a song', async () => {
    const ctx = await createTestContext()
    const createRes = await app.request('/api/songs', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        title: 'Comfortably Numb',
        artist: 'Pink Floyd',
        pitch: 0,
        type: 'song',
      }),
    })
    expect(createRes.status).toBe(201)
    const createdSong = await createRes.json()
    expect(createdSong.title).toBe('Comfortably Numb')
    expect(createdSong.artist).toBe('Pink Floyd')

    // List songs
    const listRes = await app.request('/api/songs', {
      headers: ctx.headers,
    })
    expect(listRes.status).toBe(200)
    const songs = await listRes.json()
    expect(songs.length).toBe(1)
    expect(songs[0].id).toBe(createdSong.id)
  })

  it('updates a song', async () => {
    const ctx = await createTestContext()
    const createRes = await app.request('/api/songs', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        title: 'Time',
        artist: 'Pink Floyd',
        pitch: 0,
        type: 'song',
      }),
    })
    const song = await createRes.json()

    const updateRes = await app.request(`/api/songs/${song.id}`, {
      method: 'PUT',
      headers: ctx.headers,
      body: JSON.stringify({
        pitch: 2,
      }),
    })
    expect(updateRes.status).toBe(200)
    const updated = await updateRes.json()
    expect(updated.pitch).toBe(2)
  })

  it('deletes a song', async () => {
    const ctx = await createTestContext()
    const createRes = await app.request('/api/songs', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        title: 'Money',
        artist: 'Pink Floyd',
        pitch: 0,
        type: 'song',
      }),
    })
    const song = await createRes.json()

    const deleteRes = await app.request(`/api/songs/${song.id}`, {
      method: 'DELETE',
      headers: ctx.headers,
    })
    expect(deleteRes.status).toBe(200)

    const listRes = await app.request('/api/songs', {
      headers: ctx.headers,
    })
    const songs = await listRes.json()
    expect(songs.length).toBe(0)
  })
})
