import { describe, it, expect, beforeEach, vi } from 'vitest'
import { app } from '../../src/app.js'
import { cleanDatabase } from '../helpers/test-db.js'
import { createTestContext } from '../helpers/test-auth.js'

describe('Support API (/api/support)', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  it('allows unauthenticated requests to get support config', async () => {
    const res = await app.request('/api/support/config')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('githubEnabled')
    expect(body).toHaveProperty('buildId')
    expect(body).toHaveProperty('environment')
  })

  it('allows unauthenticated requests to submit ticket with email (reaches support handler, returns 503 without github token)', async () => {
    const res = await app.request('/api/support/tickets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'bug',
        message: 'Something went wrong while testing the application anonymously.',
        email: 'guest@example.com',
      }),
    })
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toContain('Support GitHub integration is not configured')
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

  it('creates GitHub issue for unauthenticated user with email when token is configured', async () => {
    const originalToken = process.env.SUPPORT_GITHUB_TOKEN
    process.env.SUPPORT_GITHUB_TOKEN = 'ghp_mock_token'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ number: 42, html_url: 'https://github.com/prj120/bandstr/issues/42' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    try {
      const res = await app.request('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'bug',
          message: 'Anonymous user bug report with more than ten characters.',
          email: 'anonymous-reporter@example.com',
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.issueNumber).toBe(42)

      expect(fetchMock).toHaveBeenCalled()
      const issuePayload = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(issuePayload.title).toBe('[Support][Bug] Anonymous user bug report with more than ten characters.')
      expect(issuePayload.body).toContain('- user: anonymous-reporter@example.com (anonymous)')
      expect(issuePayload.body).toContain('- account email: anonymous-reporter@example.com')
      expect(issuePayload.body).toContain('- reply email: anonymous-reporter@example.com')
    } finally {
      vi.unstubAllGlobals()
      if (originalToken !== undefined) {
        process.env.SUPPORT_GITHUB_TOKEN = originalToken
      } else {
        delete process.env.SUPPORT_GITHUB_TOKEN
      }
    }
  })
})
