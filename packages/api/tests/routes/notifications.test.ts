import { describe, it, expect, beforeEach } from 'vitest'
import { app } from '../../src/app.js'
import { cleanDatabase } from '../helpers/test-db.js'
import { createTestContext } from '../helpers/test-auth.js'

describe('Notifications API (/api/notifications)', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  it('rejects unauthenticated requests with 401', async () => {
    const res = await app.request('/api/notifications/settings')
    expect(res.status).toBe(401)
  })

  it('gets notification settings for authenticated user', async () => {
    const ctx = await createTestContext()
    const res = await app.request('/api/notifications/settings', {
      headers: ctx.authHeader,
    })
    expect(res.status).toBe(200)
    const settings = await res.json()
    expect(settings.userId).toBe(ctx.userId)
    expect(settings.notifyGig).toBe(true)
  })

  it('updates notification settings', async () => {
    const ctx = await createTestContext()
    const res = await app.request('/api/notifications/settings', {
      method: 'PUT',
      headers: {
        ...ctx.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notifyGig: false,
      }),
    })
    expect(res.status).toBe(200)
    const updated = await res.json()
    expect(updated.notifyGig).toBe(false)
  })

  it('marks all notifications as read', async () => {
    const ctx = await createTestContext()
    const res = await app.request('/api/notifications/read-all', {
      method: 'POST',
      headers: ctx.headers,
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('lists notifications for band', async () => {
    const ctx = await createTestContext()
    const res = await app.request('/api/notifications', {
      headers: ctx.headers,
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.notifications)).toBe(true)
    expect(body.unreadCount).toBe(0)
  })
})
