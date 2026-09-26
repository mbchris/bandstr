import { describe, it, expect, beforeEach } from 'vitest'
import { app } from '../../src/app.js'
import { cleanDatabase } from '../helpers/test-db.js'
import { createTestContext } from '../helpers/test-auth.js'

describe('Calendar API (/api/calendar)', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  it('rejects unauthenticated requests with 401', async () => {
    const res = await app.request('/api/calendar')
    expect(res.status).toBe(401)
  })

  it('rejects requests missing X-Band-Id with 400', async () => {
    const ctx = await createTestContext()
    const res = await app.request('/api/calendar', {
      headers: ctx.authHeader,
    })
    expect(res.status).toBe(400)
  })

  it('lists empty events for new band', async () => {
    const ctx = await createTestContext()
    const res = await app.request('/api/calendar', {
      headers: ctx.headers,
    })
    expect(res.status).toBe(200)
    const events = await res.json()
    expect(Array.isArray(events)).toBe(true)
    expect(events.length).toBe(0)
  })

  it('creates and lists calendar events', async () => {
    const ctx = await createTestContext()
    const now = new Date()
    const later = new Date(now.getTime() + 1000 * 60 * 60 * 2)

    const createRes = await app.request('/api/calendar', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        title: 'Band Rehearsal',
        startTime: now.toISOString(),
        endTime: later.toISOString(),
        type: 'rehearsal',
      }),
    })
    expect(createRes.status).toBe(201)
    const createBody = await createRes.json()
    expect(createBody.success).toBe(true)

    const listRes = await app.request('/api/calendar', {
      headers: ctx.headers,
    })
    expect(listRes.status).toBe(200)
    const events = await listRes.json()
    expect(events.length).toBe(1)
    expect(events[0].title).toBe('Band Rehearsal')
  })

  it('deletes calendar event', async () => {
    const ctx = await createTestContext()
    const now = new Date()
    const later = new Date(now.getTime() + 1000 * 60 * 60 * 2)

    await app.request('/api/calendar', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        title: 'Gig at Central Park',
        startTime: now.toISOString(),
        endTime: later.toISOString(),
        type: 'gig',
      }),
    })

    const listRes = await app.request('/api/calendar', {
      headers: ctx.headers,
    })
    const events = await listRes.json()
    const event = events[0]

    const deleteRes = await app.request(`/api/calendar/${event.id}`, {
      method: 'DELETE',
      headers: ctx.headers,
    })
    expect(deleteRes.status).toBe(200)

    const afterListRes = await app.request('/api/calendar', {
      headers: ctx.headers,
    })
    const remainingEvents = await afterListRes.json()
    expect(remainingEvents.length).toBe(0)
  })
})
