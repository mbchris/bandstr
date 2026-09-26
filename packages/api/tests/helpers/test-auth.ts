import { db } from '../../src/db/index.js'
import { users, bands, bandMembers, sessions } from '../../src/db/schema.js'
import { randomBytes, randomUUID } from 'node:crypto'

export async function createTestContext(options: {
  userName?: string
  userEmail?: string
  bandName?: string
  role?: 'owner' | 'admin' | 'member'
} = {}) {
  const userId = randomUUID()
  const userName = options.userName ?? 'Test User'
  const userEmail = options.userEmail ?? `test-${userId.slice(0, 8)}@example.com`
  const role = options.role ?? 'owner'

  // Insert user
  await db.insert(users).values({
    id: userId,
    name: userName,
    email: userEmail,
  })

  // Insert band
  const slug = `test-band-${randomBytes(4).toString('hex')}`
  const [band] = await db
    .insert(bands)
    .values({
      name: options.bandName ?? 'Test Band',
      slug,
      plan: 'free',
    })
    .returning()

  // Insert membership
  await db.insert(bandMembers).values({
    bandId: band.id,
    userId,
    role,
  })

  // Create session
  const token = randomBytes(32).toString('hex')
  const sessionId = randomUUID()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    token,
    expiresAt,
  })

  return {
    userId,
    userEmail,
    bandId: band.id,
    bandSlug: band.slug,
    token,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Band-Id': String(band.id),
      'Content-Type': 'application/json',
    },
    authHeader: {
      Authorization: `Bearer ${token}`,
    },
  }
}
