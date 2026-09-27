import { describe, it, expect, beforeEach } from 'vitest'
import { eq, and } from 'drizzle-orm'
import { verifyPassword } from 'better-auth/crypto'
import { db } from '../../src/db/index.js'
import {
  users,
  accounts,
  bands,
  bandMembers,
  songs,
  calendarEvents,
  gigSetlists,
  votes,
} from '../../src/db/schema.js'
import { cleanDatabase } from '../helpers/test-db.js'
import { seedDemoAccount } from '../../src/cli/admin.js'
import { app } from '../../src/app.js'

describe('Admin CLI: seedDemoAccount', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  it('creates demo user, credential account, band, songs, calendar events, setlists, and votes', async () => {
    const result = await seedDemoAccount()

    expect(result).toBeDefined()
    expect(result.email).toBe('appcert@example.org')

    // 1. Verify user record
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'appcert@example.org'))
      .limit(1)

    expect(user).toBeDefined()
    expect(user.emailVerified).toBe(true)
    expect(user.devProPlan).toBe(true)
    expect(user.name).toBe('App Store Reviewer')

    // 2. Verify account credential row
    const [account] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, 'credential')))
      .limit(1)

    expect(account).toBeDefined()
    expect(account.accountId).toBe(user.id)
    expect(account.password).toBeTruthy()

    const passwordMatches = await verifyPassword({
      hash: account.password!,
      password: 'appcert@example.org',
    })
    expect(passwordMatches).toBe(true)

    // 3. Verify demo band exists
    const [band] = await db
      .select()
      .from(bands)
      .where(eq(bands.id, result.bandId))
      .limit(1)

    expect(band).toBeDefined()
    expect(band.name).toBe('The Bandstr Demo Band')

    // 4. Verify user is owner in band_members
    const [membership] = await db
      .select()
      .from(bandMembers)
      .where(and(eq(bandMembers.bandId, band.id), eq(bandMembers.userId, user.id)))
      .limit(1)

    expect(membership).toBeDefined()
    expect(membership.role).toBe('owner')

    // 5. Verify sample songs exist
    const bandSongs = await db
      .select()
      .from(songs)
      .where(eq(songs.bandId, band.id))

    expect(bandSongs.length).toBeGreaterThanOrEqual(3)

    // 6. Verify calendar events (rehearsal and gig)
    const events = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.bandId, band.id))

    const rehearsals = events.filter((e) => e.type === 'rehearsal')
    const gigs = events.filter((e) => e.type === 'gig')
    expect(rehearsals.length).toBeGreaterThanOrEqual(1)
    expect(gigs.length).toBeGreaterThanOrEqual(1)

    // 7. Verify setlists exist
    const setlists = await db
      .select()
      .from(gigSetlists)
      .where(eq(gigSetlists.bandId, band.id))

    expect(setlists.length).toBeGreaterThanOrEqual(1)

    // 8. Verify votes exist
    const bandVotes = await db
      .select()
      .from(votes)
      .where(eq(votes.bandId, band.id))

    expect(bandVotes.length).toBeGreaterThanOrEqual(1)
  })

  it('is idempotent when run multiple times', async () => {
    const firstRun = await seedDemoAccount()
    const secondRun = await seedDemoAccount()

    expect(secondRun.email).toBe(firstRun.email)
    expect(secondRun.bandId).toBe(firstRun.bandId)

    const allUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, 'appcert@example.org'))
    expect(allUsers.length).toBe(1)

    const allAccounts = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, allUsers[0].id), eq(accounts.providerId, 'credential')))
    expect(allAccounts.length).toBe(1)

    const passwordMatches = await verifyPassword({
      hash: allAccounts[0].password!,
      password: 'appcert@example.org',
    })
    expect(passwordMatches).toBe(true)
  })

  it('supports custom options for email, password, name, and band name', async () => {
    const customResult = await seedDemoAccount({
      email: 'custom.reviewer@apple.com',
      password: 'CustomSecretPassword123!',
      name: 'Custom Reviewer',
      'band-name': 'Custom Demo Band',
    })

    expect(customResult.email).toBe('custom.reviewer@apple.com')

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'custom.reviewer@apple.com'))
      .limit(1)

    expect(user).toBeDefined()
    expect(user.name).toBe('Custom Reviewer')

    const [account] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, 'credential')))
      .limit(1)

    const passwordMatches = await verifyPassword({
      hash: account.password!,
      password: 'CustomSecretPassword123!',
    })
    expect(passwordMatches).toBe(true)

    const [band] = await db
      .select()
      .from(bands)
      .where(eq(bands.id, customResult.bandId))
      .limit(1)

    expect(band.name).toBe('Custom Demo Band')
  })

  it('allows reviewer to sign in via /api/auth/sign-in/email', async () => {
    await seedDemoAccount()

    const res = await app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:9000',
      },
      body: JSON.stringify({
        email: 'appcert@example.org',
        password: 'appcert@example.org',
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user).toBeDefined()
    expect(body.user.email).toBe('appcert@example.org')
    expect(body.token).toBeTruthy()
  })
})
