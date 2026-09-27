import { describe, it, expect, beforeEach } from 'vitest'
import { app } from '../../src/app.js'
import { cleanDatabase } from '../helpers/test-db.js'
import { createTestContext } from '../helpers/test-auth.js'
import { db } from '../../src/db/index.js'
import { songs, votes as votesTable } from '../../src/db/schema.js'
import { eq, sql } from 'drizzle-orm'

describe('Votes API (/api/votes)', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  async function createTestSong(bandId: number) {
    const [song] = await db
      .insert(songs)
      .values({
        bandId,
        title: 'Test Song',
        artist: 'Test Artist',
      })
      .returning()
    return song
  }

  it('rejects unauthenticated requests with 401', async () => {
    const res = await app.request('/api/votes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId: 1, score: 5 }),
    })
    expect(res.status).toBe(401)
  })

  it('rejects vote without X-Band-Id with 400', async () => {
    const ctx = await createTestContext()
    const res = await app.request('/api/votes', {
      method: 'POST',
      headers: {
        ...ctx.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ songId: 1, score: 5 }),
    })
    expect(res.status).toBe(400)
  })

  it('accepts vote score of 9', async () => {
    const ctx = await createTestContext()
    const song = await createTestSong(ctx.bandId)

    const res = await app.request('/api/votes', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        songId: song.id,
        score: 9,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.action).toBe('added')
  })

  it('rejects vote score of 10', async () => {
    const ctx = await createTestContext()
    const song = await createTestSong(ctx.bandId)

    const res = await app.request('/api/votes', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        songId: song.id,
        score: 10,
      }),
    })
    expect(res.status).toBe(400)
  })

  it('accepts vote score of 0', async () => {
    const ctx = await createTestContext()
    const song = await createTestSong(ctx.bandId)

    const res = await app.request('/api/votes', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        songId: song.id,
        score: 0,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('rejects vote score below 0', async () => {
    const ctx = await createTestContext()
    const song = await createTestSong(ctx.bandId)

    const res = await app.request('/api/votes', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        songId: song.id,
        score: -1,
      }),
    })
    expect(res.status).toBe(400)
  })

  it('updates an existing vote with new score and comment', async () => {
    const ctx = await createTestContext()
    const song = await createTestSong(ctx.bandId)

    const initialRes = await app.request('/api/votes', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        songId: song.id,
        score: 3,
        comment: 'Initial comment',
      }),
    })
    expect(initialRes.status).toBe(201)

    const updateRes = await app.request('/api/votes', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        songId: song.id,
        score: 8,
        comment: 'Updated comment',
      }),
    })
    expect(updateRes.status).toBe(200)
    const updateBody = await updateRes.json()
    expect(updateBody.action).toBe('updated')
  })

  it('removes a vote when remove is true', async () => {
    const ctx = await createTestContext()
    const song = await createTestSong(ctx.bandId)

    await app.request('/api/votes', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        songId: song.id,
        score: 5,
      }),
    })

    const removeRes = await app.request('/api/votes', {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({
        songId: song.id,
        remove: true,
      }),
    })
    expect(removeRes.status).toBe(200)
    const body = await removeRes.json()
    expect(body.action).toBe('removed')
  })

  it('migrates legacy 0..3 votes by multiplying 1..3 by 3 and preserving 0', async () => {
    const ctx = await createTestContext()
    const song = await createTestSong(ctx.bandId)

    // Insert score 0
    const [v0] = await db.insert(votesTable).values({ bandId: ctx.bandId, songId: song.id, userId: ctx.userId, score: 0 }).returning()
    await db.execute(sql`UPDATE "votes" SET "score" = "score" * 3 WHERE "score" BETWEEN 1 AND 3`)
    const [after0] = await db.select().from(votesTable).where(eq(votesTable.id, v0.id))
    expect(after0.score).toBe(0)

    // Test score 1 -> 3
    await db.update(votesTable).set({ score: 1 }).where(eq(votesTable.id, v0.id))
    await db.execute(sql`UPDATE "votes" SET "score" = "score" * 3 WHERE "score" BETWEEN 1 AND 3`)
    const [after1] = await db.select().from(votesTable).where(eq(votesTable.id, v0.id))
    expect(after1.score).toBe(3)

    // Test score 2 -> 6
    await db.update(votesTable).set({ score: 2 }).where(eq(votesTable.id, v0.id))
    await db.execute(sql`UPDATE "votes" SET "score" = "score" * 3 WHERE "score" BETWEEN 1 AND 3`)
    const [after2] = await db.select().from(votesTable).where(eq(votesTable.id, v0.id))
    expect(after2.score).toBe(6)

    // Test score 3 -> 9
    await db.update(votesTable).set({ score: 3 }).where(eq(votesTable.id, v0.id))
    await db.execute(sql`UPDATE "votes" SET "score" = "score" * 3 WHERE "score" BETWEEN 1 AND 3`)
    const [after3] = await db.select().from(votesTable).where(eq(votesTable.id, v0.id))
    expect(after3.score).toBe(9)
  })
})
