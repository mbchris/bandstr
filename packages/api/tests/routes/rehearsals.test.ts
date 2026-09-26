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
})
