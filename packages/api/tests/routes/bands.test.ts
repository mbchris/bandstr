import { describe, it, expect, beforeEach } from 'vitest'
import { app } from '../../src/app.js'
import { cleanDatabase } from '../helpers/test-db.js'
import { createTestContext } from '../helpers/test-auth.js'

describe('Bands API (/api/bands)', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  it('rejects unauthenticated requests with 401', async () => {
    const res = await app.request('/api/bands')
    expect(res.status).toBe(401)
  })

  it('lists bands for authenticated user', async () => {
    const ctx = await createTestContext({ bandName: 'Rolling Stones' })
    const res = await app.request('/api/bands', {
      headers: ctx.authHeader,
    })
    expect(res.status).toBe(200)
    const bands = await res.json()
    expect(Array.isArray(bands)).toBe(true)
    expect(bands.length).toBe(1)
    expect(bands[0].name).toBe('Rolling Stones')
  })

  it('creates a new band when within plan limits', async () => {
    const ctx = await createTestContext({ role: 'owner' })
    // ctx already has 1 band, free limit is 1. We expect 403 on second band creation.
    const res = await app.request('/api/bands', {
      method: 'POST',
      headers: {
        ...ctx.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'The Beatles' }),
    })
    expect(res.status).toBe(403)
  })

  it('rejects get details when X-Band-Id is missing', async () => {
    const ctx = await createTestContext()
    const res = await app.request(`/api/bands/${ctx.bandId}`, {
      headers: ctx.authHeader,
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('X-Band-Id')
  })

  it('gets band details with valid X-Band-Id', async () => {
    const ctx = await createTestContext({ bandName: 'Pink Floyd' })
    const res = await app.request(`/api/bands/${ctx.bandId}`, {
      headers: ctx.headers,
    })
    expect(res.status).toBe(200)
    const band = await res.json()
    expect(band.name).toBe('Pink Floyd')
  })

  it('updates band details when user has admin or owner role', async () => {
    const ctx = await createTestContext({ bandName: 'Original Name', role: 'admin' })
    const res = await app.request(`/api/bands/${ctx.bandId}`, {
      method: 'PATCH',
      headers: ctx.headers,
      body: JSON.stringify({ name: 'Renamed Band' }),
    })
    expect(res.status).toBe(200)
    const updated = await res.json()
    expect(updated.name).toBe('Renamed Band')
  })

  it('deletes band when user is owner', async () => {
    const ctx = await createTestContext({ role: 'owner' })
    const res = await app.request(`/api/bands/${ctx.bandId}`, {
      method: 'DELETE',
      headers: ctx.headers,
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})
