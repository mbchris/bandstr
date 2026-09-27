import { describe, it, expect } from 'vitest'
import { app } from '../../src/app.js'
import { auth } from '../../src/lib/auth.js'

describe('Sign in with Apple Backend (Guideline 4.8)', () => {
  it('supports apple provider in /api/mobile-auth/start', async () => {
    const callbackURL = 'org.capacitor.bandstr://localhost/#/login'
    const res = await app.request(
      `/api/mobile-auth/start?provider=apple&callbackURL=${encodeURIComponent(callbackURL)}`,
    )
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('provider: "apple"')
    expect(html).toContain(callbackURL)
  })

  it('configures apple social provider in auth options', () => {
    expect(auth.options.socialProviders).toHaveProperty('apple')
  })
})
