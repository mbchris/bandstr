import { describe, it, expect, beforeEach } from 'vitest'
import { app } from '../../src/app.js'
import { cleanDatabase } from '../helpers/test-db.js'
import { createTestContext } from '../helpers/test-auth.js'

describe('Support API (/api/support)', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  it('rejects unauthenticated requests with 401', async () => {
    const res = await app.request('/api/support/config')
    expect(res.status).toBe(401)
  })

  it('gets support config for authenticated user', async () => {
    const ctx = await createTestContext()
    const res = await app.request('/api/support/config', {
      headers: ctx.authHeader,
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('githubEnabled')
    expect(body).toHaveProperty('buildId')
    expect(body).toHaveProperty('environment')
  })

  it('returns 503 when submitting ticket without GitHub token configured', async () => {
    const ctx = await createTestContext()
    const res = await app.request('/api/support/tickets', {
      method: 'POST',
      headers: {
        ...ctx.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'bug',
        message: 'Something went wrong while testing the application.',
        email: ctx.userEmail,
      }),
    })
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toContain('Support GitHub integration is not configured')
  })
})
