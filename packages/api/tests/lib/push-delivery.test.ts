import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { sendPushToDevice } from '../../src/lib/push-delivery.js'

describe('Push Delivery - APNs', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    delete process.env.APNS_TEAM_ID
    delete process.env.APNS_KEY_ID
    delete process.env.APNS_PRIVATE_KEY
    delete process.env.APNS_BUNDLE_ID
    delete process.env.APPLE_TEAM_ID
    delete process.env.APPLE_BUNDLE_ID
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('fails gracefully when APNs credentials are not configured', async () => {
    const result = await sendPushToDevice({
      tokenType: 'apns',
      token: '08AEC9976E87',
      title: 'Test Notification',
      body: 'Testing APNs delivery',
      path: '/calendar',
      query: 'bandId=6',
    })

    expect(result.provider).toBe('apns')
    expect(result.ok).toBe(false)
    expect(result.status).toBeNull()
    expect(result.error).toContain('Missing APNs configuration')
    expect(result.error).toContain('APNS_TEAM_ID')
    expect(result.error).toContain('APNS_KEY_ID')
    expect(result.error).toContain('APNS_PRIVATE_KEY')
  })

  it('falls back to APPLE_TEAM_ID and APPLE_BUNDLE_ID when APNS_ prefixes are absent', async () => {
    process.env.APPLE_TEAM_ID = 'HX8LRFU9BH'
    process.env.APPLE_BUNDLE_ID = '-ki.app.bandstr'
    // Missing only key and private key:
    const result = await sendPushToDevice({
      tokenType: 'apns',
      token: '08AEC9976E87',
      title: 'Test Notification',
      body: 'Testing APNs fallback',
      path: '/calendar',
      query: 'bandId=6',
    })

    expect(result.provider).toBe('apns')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Missing APNs configuration')
    expect(result.error).not.toContain('APNS_TEAM_ID')
    expect(result.error).not.toContain('APNS_BUNDLE_ID')
    expect(result.error).toContain('APNS_KEY_ID')
    expect(result.error).toContain('APNS_PRIVATE_KEY')
  })
})
