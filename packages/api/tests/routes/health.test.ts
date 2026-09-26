import { describe, it, expect } from 'vitest'
import { app } from '../../src/app.js'

describe('GET /health', () => {
  it('returns ok: true and current version', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body).toHaveProperty('version')
  })
})
