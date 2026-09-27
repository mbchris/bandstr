import { generateKeyPairSync } from 'node:crypto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  sendPushToDevice,
  normalizeApnsPrivateKey,
  createApnsJwt,
  clearApnsJwtCache,
} from '../../src/lib/push-delivery.js'

describe('Push Delivery - APNs', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    delete process.env.APNS_TEAM_ID
    delete process.env.APNS_KEY_ID
    delete process.env.APNS_PRIVATE_KEY
    delete process.env.APNS_BUNDLE_ID
    delete process.env.APPLE_TEAM_ID
    delete process.env.APPLE_BUNDLE_ID
    clearApnsJwtCache()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    clearApnsJwtCache()
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

  describe('normalizeApnsPrivateKey', () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    const validPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string

    it('handles standard PEM format with newlines', () => {
      const normalized = normalizeApnsPrivateKey(validPem)
      expect(normalized).toContain('-----BEGIN PRIVATE KEY-----')
      expect(normalized).toContain('-----END PRIVATE KEY-----')
      expect(normalized).toBe(validPem.trim())
    })

    it('handles escaped newlines (\\n) from .env files', () => {
      const escaped = validPem.replace(/\n/g, '\\n')
      const normalized = normalizeApnsPrivateKey(escaped)
      expect(normalized).toBe(validPem.trim())
    })

    it('handles double-escaped newlines (\\\\n) from docker-compose / shell escaping', () => {
      const doubleEscaped = validPem.replace(/\n/g, '\\\\n')
      const normalized = normalizeApnsPrivateKey(doubleEscaped)
      expect(normalized).toBe(validPem.trim())
    })

    it('handles enclosing quotes around the key', () => {
      const quoted = `"${validPem.replace(/\n/g, '\\n')}"`
      const normalized = normalizeApnsPrivateKey(quoted)
      expect(normalized).toBe(validPem.trim())
    })

    it('handles line continuation backslashes attached to header/footer', () => {
      const mangled = validPem
        .replace(/\n/g, '\\\\n')
        .replace('-----BEGIN PRIVATE KEY-----\\\\n', '-----BEGIN PRIVATE KEY-----\\\\')
      const normalized = normalizeApnsPrivateKey(mangled)
      expect(normalized).toBe(validPem.trim())
    })

    it('handles base64-encoded full PEM', () => {
      const base64Pem = Buffer.from(validPem).toString('base64')
      const normalized = normalizeApnsPrivateKey(base64Pem)
      expect(normalized).toBe(validPem.trim())
    })
  })

  describe('createApnsJwt', () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    const validPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string

    it('generates a valid ES256 JWT with 64-byte IEEE P1363 signature', () => {
      process.env.APNS_TEAM_ID = 'HX8LRFU9BH'
      process.env.APNS_KEY_ID = '7845P5PCR4'
      process.env.APNS_PRIVATE_KEY = validPem

      const { jwt, error } = createApnsJwt()
      expect(error).toBeNull()
      expect(jwt).toBeTruthy()

      const parts = jwt!.split('.')
      expect(parts.length).toBe(3)

      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
      expect(header).toEqual({ alg: 'ES256', kid: '7845P5PCR4' })

      const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
      expect(claims.iss).toBe('HX8LRFU9BH')
      expect(claims.iat).toBeTypeOf('number')

      // RFC 7515 Section 3.4: ES256 JWS signature MUST be IEEE P1363 (64 bytes raw R || S)
      const sigBuffer = Buffer.from(parts[2], 'base64url')
      expect(sigBuffer.length).toBe(64)
    })

    it('successfully generates JWT even when APNS_PRIVATE_KEY has double-escaped \\\\n', () => {
      process.env.APNS_TEAM_ID = 'HX8LRFU9BH'
      process.env.APNS_KEY_ID = '7845P5PCR4'
      process.env.APNS_PRIVATE_KEY = validPem.replace(/\n/g, '\\\\n')

      const { jwt, error } = createApnsJwt()
      expect(error).toBeNull()
      expect(jwt).toBeTruthy()

      const parts = jwt!.split('.')
      const sigBuffer = Buffer.from(parts[2], 'base64url')
      expect(sigBuffer.length).toBe(64)
    })

    it('returns an informative error when the key format is invalid', () => {
      process.env.APNS_TEAM_ID = 'HX8LRFU9BH'
      process.env.APNS_KEY_ID = '7845P5PCR4'
      process.env.APNS_PRIVATE_KEY = 'invalid-not-a-real-key'

      const { jwt, error } = createApnsJwt()
      expect(jwt).toBeNull()
      expect(error).toBeTruthy()
    })
  })
})
