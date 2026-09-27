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

  it('automatically creates a gig setlist for a gig entry and links them', async () => {
    const ctx = await createTestContext()
    const now = new Date()
    const later = new Date(now.getTime() + 1000 * 60 * 60 * 2)

    // Create gig entry
    const createRes = await app.request('/api/calendar', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        title: 'Open Air Concert',
        description: 'Festival stage',
        startTime: now.toISOString(),
        endTime: later.toISOString(),
        type: 'gig',
      }),
    })
    expect(createRes.status).toBe(201)

    // Check calendar event has linked gig setlist
    const listCalendarRes = await app.request('/api/calendar', {
      headers: ctx.headers,
    })
    const events = await listCalendarRes.json()
    expect(events.length).toBe(1)
    expect(events[0].gigSetlistId).toBeTruthy()
    expect(events[0].gigSetlistTitle).toBe('Open Air Concert')

    // Check gig setlist in /api/gigs
    const listGigsRes = await app.request('/api/gigs', {
      headers: ctx.headers,
    })
    const gigs = await listGigsRes.json()
    expect(gigs.length).toBe(1)
    expect(gigs[0].title).toBe('Open Air Concert')
    expect(gigs[0].calendarEventId).toBe(events[0].id)
    expect(gigs[0].notes).toBe('Festival stage')
  })

  it('links to existing gig setlist when gigSetlistId is provided on create and update', async () => {
    const ctx = await createTestContext()
    const now = new Date()
    const later = new Date(now.getTime() + 1000 * 60 * 60 * 2)

    // Pre-create an existing gig setlist
    const preGigRes = await app.request('/api/gigs', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        title: 'Existing Draft Setlist',
        location: 'Club Rock',
      }),
    })
    expect(preGigRes.status).toBe(201)
    const existingGig = await preGigRes.json()

    // Create gig entry explicitly pointing to existingGig.id
    const createRes = await app.request('/api/calendar', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        title: 'Saturday Gig',
        startTime: now.toISOString(),
        endTime: later.toISOString(),
        type: 'gig',
        gigSetlistId: existingGig.id,
      }),
    })
    expect(createRes.status).toBe(201)

    // Verify only 1 gig setlist exists (the existing one was linked, not duplicated)
    const listGigsRes = await app.request('/api/gigs', {
      headers: ctx.headers,
    })
    const gigs = await listGigsRes.json()
    expect(gigs.length).toBe(1)
    expect(gigs[0].id).toBe(existingGig.id)
    expect(gigs[0].title).toBe('Existing Draft Setlist')

    // Check calendar event link
    const listCalendarRes = await app.request('/api/calendar', {
      headers: ctx.headers,
    })
    const events = await listCalendarRes.json()
    expect(events[0].gigSetlistId).toBe(existingGig.id)

    // Create another gig setlist
    const secondGigRes = await app.request('/api/gigs', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        title: 'Second Gig Setlist',
      }),
    })
    const secondGig = await secondGigRes.json()

    // Update calendar event to switch to second gig setlist
    const updateRes = await app.request(`/api/calendar/${events[0].id}`, {
      method: 'PUT',
      headers: ctx.headers,
      body: JSON.stringify({
        gigSetlistId: secondGig.id,
      }),
    })
    expect(updateRes.status).toBe(200)

    const afterUpdateCalendarRes = await app.request('/api/calendar', {
      headers: ctx.headers,
    })
    const updatedEvents = await afterUpdateCalendarRes.json()
    expect(updatedEvents[0].gigSetlistId).toBe(secondGig.id)

    // First gig setlist is now unlinked
    const afterUpdateGigsRes = await app.request('/api/gigs', {
      headers: ctx.headers,
    })
    const updatedGigs = await afterUpdateGigsRes.json()
    const firstGigInList = updatedGigs.find((g: any) => g.id === existingGig.id)
    const secondGigInList = updatedGigs.find((g: any) => g.id === secondGig.id)
    expect(firstGigInList.calendarEventId).toBeNull()
    expect(secondGigInList.calendarEventId).toBe(events[0].id)
  })

  it('removes invalid links when calendar event is deleted or type is changed', async () => {
    const ctx = await createTestContext()
    const now = new Date()
    const later = new Date(now.getTime() + 1000 * 60 * 60 * 2)

    // Create gig entry (auto creates gig setlist)
    await app.request('/api/calendar', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        title: 'Gig to Change',
        startTime: now.toISOString(),
        endTime: later.toISOString(),
        type: 'gig',
      }),
    })

    const listEventsRes = await app.request('/api/calendar', { headers: ctx.headers })
    const events = await listEventsRes.json()
    const gigEvent = events[0]
    expect(gigEvent.gigSetlistId).toBeTruthy()

    // Change type from 'gig' to 'rehearsal'
    const updateRes = await app.request(`/api/calendar/${gigEvent.id}`, {
      method: 'PUT',
      headers: ctx.headers,
      body: JSON.stringify({
        type: 'rehearsal',
      }),
    })
    expect(updateRes.status).toBe(200)

    // Gig setlist should now be unlinked in /api/gigs
    const gigsRes = await app.request('/api/gigs', { headers: ctx.headers })
    const gigs = await gigsRes.json()
    expect(gigs.length).toBe(1)
    expect(gigs[0].calendarEventId).toBeNull()
    expect(gigs[0].calendarEventTitle).toBeNull()
  })
})
