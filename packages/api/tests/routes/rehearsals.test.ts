import { describe, it, expect, beforeEach } from 'vitest'
import { app } from '../../src/app.js'
import { cleanDatabase } from '../helpers/test-db.js'
import { createTestContext } from '../helpers/test-auth.js'

describe('Rehearsal Attendance API (/api/rehearsals)', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  it('rejects listing attendance when unauthenticated', async () => {
    const res = await app.request('/api/rehearsals/attendance')
    expect(res.status).toBe(401)
  })

  it('records and returns attendance for upcoming rehearsals', async () => {
    const ctx = await createTestContext()

    // Create a future rehearsal event
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const futureEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString()

    const createEventRes = await app.request('/api/calendar', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        title: 'Weekly Rehearsal',
        type: 'rehearsal',
        startTime: futureDate,
        endTime: futureEndDate,
      }),
    })
    expect(createEventRes.status).toBe(201)

    const listEventsRes = await app.request('/api/calendar', {
      headers: ctx.headers,
    })
    const events = await listEventsRes.json()
    const event = events[0]
    expect(event).toBeDefined()

    // Check attendance list
    const attendanceListRes = await app.request('/api/rehearsals/attendance', {
      headers: ctx.headers,
    })
    expect(attendanceListRes.status).toBe(200)
    const attendanceData = await attendanceListRes.json()
    expect(Array.isArray(attendanceData.rehearsals)).toBe(true)
    expect(attendanceData.rehearsals.length).toBe(1)
    expect(attendanceData.rehearsals[0].id).toBe(event.id)
    expect(attendanceData.rehearsals[0].summary).toBe('pending')

    // Set attendance to 'present' via PUT
    const setAttRes = await app.request(`/api/rehearsals/${event.id}/attendance`, {
      method: 'PUT',
      headers: ctx.headers,
      body: JSON.stringify({
        status: 'present',
      }),
    })
    expect(setAttRes.status).toBe(200)
    const attResult = await setAttRes.json()
    expect(attResult.success).toBe(true)

    // Fetch single rehearsal attendance
    const singleRes = await app.request(`/api/rehearsals/${event.id}/attendance`, {
      headers: ctx.headers,
    })
    expect(singleRes.status).toBe(200)
    const singleData = await singleRes.json()
    expect(singleData.rehearsalId).toBe(event.id)
    expect(singleData.myAttendance).toBe('present')
    expect(singleData.summary).toBe('all_present')

    // Check list again - summary should be all_present
    const listRes2 = await app.request('/api/rehearsals/attendance', {
      headers: ctx.headers,
    })
    const data2 = await listRes2.json()
    expect(data2.rehearsals[0].summary).toBe('all_present')
  })

  it('includes gigSetlistTitle in upcomingGigs for /rehearsals/next', async () => {
    const ctx = await createTestContext()
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    const futureEndDate = new Date(futureDate.getTime() + 3 * 60 * 60 * 1000)

    const createRes = await app.request('/api/calendar', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        title: 'Summer Festival Gig',
        type: 'gig',
        startTime: futureDate.toISOString(),
        endTime: futureEndDate.toISOString(),
      }),
    })
    expect(createRes.status).toBe(201)

    const nextRes = await app.request('/api/rehearsals/next', {
      headers: ctx.headers,
    })
    expect(nextRes.status).toBe(200)
    const nextData = await nextRes.json()
    expect(nextData.upcomingGigs.length).toBeGreaterThan(0)
    expect(nextData.upcomingGigs[0].gigSetlistTitle).toBe('Summer Festival Gig')
  })

  it('falls back to member with lowest beerCount when no bierwartOverrideId is set', async () => {
    const ctx = await createTestContext({ userName: 'High Beer Member' })

    // Set high beerCount for the owner
    const { db } = await import('../../src/db/index.js')
    const { bandMembers, users } = await import('../../src/db/schema.js')
    const { eq, and } = await import('drizzle-orm')
    const { randomUUID } = await import('node:crypto')

    await db
      .update(bandMembers)
      .set({ beerCount: 5, sortOrder: 1 })
      .where(and(eq(bandMembers.bandId, ctx.bandId), eq(bandMembers.userId, ctx.userId)))

    // Create a second member with lower beerCount
    const secondUserId = randomUUID()
    await db.insert(users).values({
      id: secondUserId,
      name: 'Low Beer Member',
      email: 'lowbeer@example.com',
    })
    await db.insert(bandMembers).values({
      bandId: ctx.bandId,
      userId: secondUserId,
      role: 'member',
      beerCount: 1,
      sortOrder: 2,
    })

    // Create future rehearsal
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
    const futureEndDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString()

    const createRes = await app.request('/api/calendar', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        title: 'Weekly Rehearsal',
        type: 'rehearsal',
        startTime: futureDate,
        endTime: futureEndDate,
      }),
    })
    expect(createRes.status).toBe(201)

    const nextRes = await app.request('/api/rehearsals/next', {
      headers: ctx.headers,
    })
    expect(nextRes.status).toBe(200)
    const nextData = await nextRes.json()
    expect(nextData.nextRehearsal).toBeDefined()
    expect(nextData.nextRehearsal.effectiveBierwartId).toBe(secondUserId)
  })
})
