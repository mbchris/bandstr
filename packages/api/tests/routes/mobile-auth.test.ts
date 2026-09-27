import { describe, it, expect } from 'vitest'
import { app, formatMobileRedirectTarget } from '../../src/app.js'

describe('Mobile Auth Redirect Format', () => {
  it('formats Android intent URI with action.VIEW, category.BROWSABLE, and package', () => {
    const rawTarget = 'org.capacitor.bandstr://localhost/#/login?redirect=%2F&token=test-token&mobileAuth=ok'
    const formatted = formatMobileRedirectTarget(rawTarget, true)

    expect(formatted).toBe(
      'intent://localhost/#/login?redirect=%2F&token=test-token&mobileAuth=ok#Intent;scheme=org.capacitor.bandstr;package=org.capacitor.bandstr;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end;',
    )
  })

  it('leaves custom scheme untouched for iOS / non-Android platforms', () => {
    const rawTarget = 'org.capacitor.bandstr://localhost/#/login?redirect=%2F&token=test-token&mobileAuth=ok'
    const formatted = formatMobileRedirectTarget(rawTarget, false)

    expect(formatted).toBe(rawTarget)
  })

  it('leaves standard https URLs untouched even on Android', () => {
    const rawTarget = 'https://bandstr.apps.4ki.app/login?redirect=%2F'
    const formatted = formatMobileRedirectTarget(rawTarget, true)

    expect(formatted).toBe(rawTarget)
  })

  it('handles /api/mobile-auth/complete on Android by delivering the intent URL', async () => {
    const appCallbackURL = 'org.capacitor.bandstr://localhost/#/login?redirect=%2F'
    const res = await app.request(
      `/api/mobile-auth/complete?appCallbackURL=${encodeURIComponent(appCallbackURL)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 16; Pixel 7a Build/CP1A.260305.018; wv) AppleWebKit/537.36 Chrome/146.0.7680.119 Mobile Safari/537.36',
        },
      },
    )
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('intent://localhost/#/login?redirect=%2F')
    expect(html).toContain('package=org.capacitor.bandstr;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end;')
  })

  it('handles /api/mobile-auth/complete on iOS by delivering the raw custom scheme URL', async () => {
    const appCallbackURL = 'org.capacitor.bandstr://localhost/#/login?redirect=%2F'
    const res = await app.request(
      `/api/mobile-auth/complete?appCallbackURL=${encodeURIComponent(appCallbackURL)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        },
      },
    )
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('org.capacitor.bandstr://localhost/#/login?redirect=%2F')
    expect(html).not.toContain('intent://')
  })

  it('handles /api/mobile-auth/error on Android by delivering the intent URL', async () => {
    const appErrorURL = 'org.capacitor.bandstr://localhost/#/login?redirect=%2F'
    const res = await app.request(
      `/api/mobile-auth/error?appErrorURL=${encodeURIComponent(appErrorURL)}&error=access_denied`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 16; Pixel 7a) Chrome/146.0.0.0 Mobile Safari/537.36',
        },
      },
    )
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('intent://localhost/#/login?redirect=%2F')
    expect(html).toContain('package=org.capacitor.bandstr;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end;')
  })
})
