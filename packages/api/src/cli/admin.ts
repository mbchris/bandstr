import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { and, eq } from 'drizzle-orm'
import { hashPassword } from 'better-auth/crypto'
import { db, pool } from '../db/index.js'
import {
  accounts,
  bandMembers,
  bands,
  calendarEvents,
  gigSetlists,
  gigSongs,
  rehearsalSongs,
  songs,
  users,
  votes,
} from '../db/schema.js'
import { sendPushToDevice } from '../lib/push-delivery.js'
import { listRegisteredPushDevicesForBand } from '../lib/push-device-admin.js'

type Role = 'owner' | 'admin' | 'member'

type ParsedArgs = {
  command: string | null
  options: Record<string, string | boolean>
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv
  const options: Record<string, string | boolean> = {}

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = rest[i + 1]
    if (!next || next.startsWith('--')) {
      options[key] = true
      continue
    }
    options[key] = next
    i += 1
  }

  return { command: command ?? null, options }
}

function requireStringOption(options: Record<string, string | boolean>, key: string): string {
  const value = options[key]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required option --${key}`)
  }
  return value.trim()
}

function optionalStringOption(options: Record<string, string | boolean>, key: string): string | null {
  const value = options[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readIntOption(options: Record<string, string | boolean>, key: string): number {
  const raw = requireStringOption(options, key)
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isInteger(parsed)) {
    throw new Error(`Option --${key} must be an integer`)
  }
  return parsed
}

function readBooleanOption(
  options: Record<string, string | boolean>,
  key: string,
  fallback: boolean,
): boolean {
  const value = options[key]
  if (value === undefined) return fallback
  if (value === true) return true
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false
  throw new Error(`Option --${key} must be a boolean (true/false)`)
}

function songSignature(input: {
  title: string
  artist: string
  type: string
  position: number
  spotifyUrl: string | null
  youtubeUrl: string | null
}): string {
  return [
    input.title.trim().toLowerCase(),
    input.artist.trim().toLowerCase(),
    input.type.trim().toLowerCase(),
    String(input.position),
    (input.spotifyUrl ?? '').trim().toLowerCase(),
    (input.youtubeUrl ?? '').trim().toLowerCase(),
  ].join('::')
}

function pushMapValue<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const current = map.get(key)
  if (current) {
    current.push(value)
    return
  }
  map.set(key, [value])
}

function sanitizeCell(value: string): string {
  // Strip ASCII control chars (including ESC sequences) to keep CLI output stable/readable.
  return value.replace(/[\u0000-\u001F\u007F]/g, '')
}

function printTextTable(headers: string[], rows: string[][]): void {
  const safeRows = rows.map((row) => row.map((cell) => sanitizeCell(cell)))
  const safeHeaders = headers.map((header) => sanitizeCell(header))
  const widths = safeHeaders.map((header, colIndex) =>
    Math.max(header.length, ...safeRows.map((row) => (row[colIndex] ?? '').length)),
  )

  const formatRow = (row: string[]): string =>
    row.map((cell, colIndex) => (cell ?? '').padEnd(widths[colIndex])).join('  ')

  console.log(formatRow(safeHeaders))
  console.log(widths.map((width) => '-'.repeat(width)).join('  '))
  for (const row of safeRows) {
    console.log(formatRow(row))
  }
}

async function listUsers(): Promise<void> {
  const result = await pool.query<{
    id: string
    email: string
    name: string
    dev_pro_plan: boolean
    band_count: string
  }>(
    `
      select
        u.id,
        u.email,
        u.name,
        u.dev_pro_plan,
        count(distinct bm.band_id)::text as band_count
      from "user" u
      left join band_members bm on bm.user_id = u.id
      group by u.id, u.email, u.name, u.dev_pro_plan
      order by u.created_at asc
    `,
  )

  if (result.rows.length === 0) {
    console.log('No users found.')
    return
  }

  printTextTable(
    ['ID', 'Email', 'Name', 'Dev Pro', 'Bands'],
    result.rows.map((row) => [
      row.id,
      row.email,
      row.name,
      row.dev_pro_plan ? 'yes' : 'no',
      row.band_count,
    ]),
  )
}

async function listBands(): Promise<void> {
  const result = await pool.query<{
    id: number
    slug: string
    name: string
    plan: string
    member_count: string
    inherited_admin_pro: boolean
  }>(
    `
      select
        b.id,
        b.slug,
        b.name,
        b.plan,
        count(distinct bm.user_id)::text as member_count,
        exists (
          select 1
          from band_members bm2
          inner join "user" u on u.id = bm2.user_id
          where bm2.band_id = b.id
            and bm2.role in ('owner', 'admin')
            and u.dev_pro_plan = true
        ) as inherited_admin_pro
      from bands b
      left join band_members bm on bm.band_id = b.id
      group by b.id, b.slug, b.name, b.plan
      order by b.created_at asc
    `,
  )

  if (result.rows.length === 0) {
    console.log('No bands found.')
    return
  }

  printTextTable(
    ['ID', 'Slug', 'Name', 'Plan', 'Members', 'Inherited Admin Pro'],
    result.rows.map((row) => [
      String(row.id),
      row.slug,
      row.name,
      row.plan,
      row.member_count,
      row.inherited_admin_pro ? 'yes' : 'no',
    ]),
  )
}

async function addUser(options: Record<string, string | boolean>): Promise<void> {
  const id = optionalStringOption(options, 'id') ?? `cli-${randomUUID()}`
  const name = requireStringOption(options, 'name')
  const email = requireStringOption(options, 'email')
  const emailVerified = readBooleanOption(options, 'email-verified', true)
  const devProPlan = readBooleanOption(options, 'dev-pro-plan', false)

  const [inserted] = await db
    .insert(users)
    .values({
      id,
      name,
      email,
      emailVerified,
      devProPlan,
      devProPlanAssignedAt: devProPlan ? new Date() : null,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      devProPlan: users.devProPlan,
    })

  console.log(
    `User created: id=${inserted.id} email=${inserted.email} name=${inserted.name} devProPlan=${
      inserted.devProPlan ? 'yes' : 'no'
    }`,
  )
}

async function deleteUser(options: Record<string, string | boolean>): Promise<void> {
  const userId = requireStringOption(options, 'user-id')

  const [deleted] = await db
    .delete(users)
    .where(eq(users.id, userId))
    .returning({ id: users.id, email: users.email, name: users.name })

  if (!deleted) {
    throw new Error(`User not found: ${userId}`)
  }

  console.log(`User deleted: id=${deleted.id} email=${deleted.email} name=${deleted.name}`)
}

async function verifyUserEmail(options: Record<string, string | boolean>): Promise<void> {
  const userId = optionalStringOption(options, 'user-id')
  const email = optionalStringOption(options, 'email')
  const verified = readBooleanOption(options, 'verified', true)

  if (!userId && !email) {
    throw new Error('Provide either --user-id or --email')
  }
  if (userId && email) {
    throw new Error('Use either --user-id or --email, not both')
  }

  const [updated] = await db
    .update(users)
    .set({
      emailVerified: verified,
      updatedAt: new Date(),
    })
    .where(userId ? eq(users.id, userId) : eq(users.email, email!))
    .returning({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
    })

  if (!updated) {
    throw new Error(`User not found (${userId ? `user-id=${userId}` : `email=${email}`})`)
  }

  console.log(
    `User email verification updated: userId=${updated.id} email=${updated.email} emailVerified=${
      updated.emailVerified ? 'yes' : 'no'
    }`,
  )
}

async function assignUserToBand(options: Record<string, string | boolean>): Promise<void> {
  const userId = requireStringOption(options, 'user-id')
  const bandId = readIntOption(options, 'band-id')
  const roleRaw = (optionalStringOption(options, 'role') ?? 'member') as Role
  const validRoles: Role[] = ['owner', 'admin', 'member']
  if (!validRoles.includes(roleRaw)) {
    throw new Error('Option --role must be one of: owner, admin, member')
  }

  const sortOrder = Number.parseInt(optionalStringOption(options, 'sort-order') ?? '0', 10)
  const isHidden = readBooleanOption(options, 'is-hidden', false)
  const beerCount = Number.parseInt(optionalStringOption(options, 'beer-count') ?? '0', 10)

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
  if (!user) throw new Error(`User not found: ${userId}`)

  const [band] = await db.select({ id: bands.id }).from(bands).where(eq(bands.id, bandId)).limit(1)
  if (!band) throw new Error(`Band not found: ${bandId}`)

  const [membership] = await db
    .insert(bandMembers)
    .values({
      userId,
      bandId,
      role: roleRaw,
      sortOrder,
      isHidden,
      beerCount,
      joinedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [bandMembers.bandId, bandMembers.userId],
      set: {
        role: roleRaw,
        sortOrder,
        isHidden,
        beerCount,
      },
    })
    .returning({
      userId: bandMembers.userId,
      bandId: bandMembers.bandId,
      role: bandMembers.role,
      sortOrder: bandMembers.sortOrder,
      isHidden: bandMembers.isHidden,
      beerCount: bandMembers.beerCount,
    })

  console.log(
    `Membership upserted: userId=${membership.userId} bandId=${membership.bandId} role=${membership.role} sortOrder=${membership.sortOrder} isHidden=${membership.isHidden ? 'yes' : 'no'} beerCount=${membership.beerCount}`,
  )
}

async function removeUserFromBand(options: Record<string, string | boolean>): Promise<void> {
  const userId = requireStringOption(options, 'user-id')
  const bandId = readIntOption(options, 'band-id')

  const [removed] = await db
    .delete(bandMembers)
    .where(and(eq(bandMembers.userId, userId), eq(bandMembers.bandId, bandId)))
    .returning({
      userId: bandMembers.userId,
      bandId: bandMembers.bandId,
      role: bandMembers.role,
    })

  if (!removed) {
    throw new Error(`Membership not found for user ${userId} in band ${bandId}`)
  }

  console.log(`Membership removed: userId=${removed.userId} bandId=${removed.bandId} role=${removed.role}`)
}

async function changeSubscriptionForUser(options: Record<string, string | boolean>): Promise<void> {
  const userId = requireStringOption(options, 'user-id')
  const enabled = readBooleanOption(options, 'enabled', true)

  const [updated] = await db
    .update(users)
    .set({
      devProPlan: enabled,
      devProPlanAssignedAt: enabled ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      devProPlan: users.devProPlan,
      devProPlanAssignedAt: users.devProPlanAssignedAt,
    })

  if (!updated) throw new Error(`User not found: ${userId}`)

  console.log(
    `User subscription updated: userId=${updated.id} devProPlan=${updated.devProPlan ? 'yes' : 'no'} assignedAt=${updated.devProPlanAssignedAt?.toISOString() ?? 'null'}`,
  )

  const affectedBands = await pool.query<{
    band_id: number
    band_name: string
    role: string
    band_plan: string
    inherited_admin_pro: boolean
  }>(
    `
      select
        b.id as band_id,
        b.name as band_name,
        bm.role,
        b.plan as band_plan,
        exists (
          select 1
          from band_members bm2
          inner join "user" u2 on u2.id = bm2.user_id
          where bm2.band_id = b.id
            and bm2.role in ('owner', 'admin')
            and u2.dev_pro_plan = true
        ) as inherited_admin_pro
      from band_members bm
      inner join bands b on b.id = bm.band_id
      where bm.user_id = $1
        and bm.role in ('owner', 'admin')
      order by b.id asc
    `,
    [userId],
  )

  if (affectedBands.rows.length === 0) {
    console.log('No owner/admin band memberships found for this user.')
    return
  }

  console.log('Affected bands (band inherits pro when any owner/admin has devProPlan=true):')
  for (const row of affectedBands.rows) {
    console.log(
      `- bandId=${row.band_id} name=${row.band_name} role=${row.role} band.plan=${row.band_plan} inheritedAdminPro=${row.inherited_admin_pro ? 'yes' : 'no'}`,
    )
  }
}

async function importSongsFromSqlDb(options: Record<string, string | boolean>): Promise<void> {
  const sourceDbUrl =
    optionalStringOption(options, 'source-db-url') ?? process.env.IMPORT_SOURCE_DATABASE_URL ?? null
  if (!sourceDbUrl) {
    throw new Error('Missing source DB URL. Use --source-db-url or IMPORT_SOURCE_DATABASE_URL.')
  }

  const sourceBandId = readIntOption(options, 'source-band-id')
  const targetBandId = readIntOption(options, 'target-band-id')
  const replace = readBooleanOption(options, 'replace', true)

  const sourcePool = new pg.Pool({
    connectionString: sourceDbUrl,
    max: 2,
    idleTimeoutMillis: 5_000,
  })

  try {
    const sourceSongs = await sourcePool.query<{
      id: number
      title: string
      artist: string
      spotify_url: string | null
      youtube_url: string | null
      thumbnail_url: string | null
      notes: string | null
      type: string | null
      pitch: number | null
      is_setlist: boolean | null
      position: number | null
      is_pinned: boolean | null
      added_by: string | null
      created_at: Date | null
    }>(
      `
        select
          id,
          title,
          artist,
          spotify_url,
          youtube_url,
          thumbnail_url,
          notes,
          type,
          pitch,
          is_setlist,
          position,
          is_pinned,
          added_by,
          created_at
        from songs
        where band_id = $1
        order by id asc
      `,
      [sourceBandId],
    )

    if (sourceSongs.rows.length === 0) {
      console.log('No source songs found. Nothing imported.')
      return
    }

    const [targetBand] = await db.select({ id: bands.id }).from(bands).where(eq(bands.id, targetBandId)).limit(1)
    if (!targetBand) throw new Error(`Target band not found: ${targetBandId}`)

    const existingUsers = await db.select({ id: users.id }).from(users)
    const userIds = new Set(existingUsers.map((row) => row.id))

    await db.transaction(async (tx) => {
      if (replace) {
        await tx.delete(songs).where(eq(songs.bandId, targetBandId))
      }

      for (const row of sourceSongs.rows) {
        const [inserted] = await tx
          .insert(songs)
          .values({
            bandId: targetBandId,
            title: row.title,
            artist: row.artist,
            spotifyUrl: row.spotify_url,
            youtubeUrl: row.youtube_url,
            thumbnailUrl: row.thumbnail_url,
            notes: row.notes,
            type: row.type ?? 'song',
            pitch: row.pitch ?? 0,
            isSetlist: row.is_setlist ?? false,
            position: row.position ?? 0,
            isPinned: row.is_pinned ?? false,
            addedBy: row.added_by && userIds.has(row.added_by) ? row.added_by : null,
            createdAt: row.created_at ?? new Date(),
          })
          .returning({ id: songs.id })

        console.log(`Imported song sourceId=${row.id} -> targetId=${inserted.id} "${row.title}"`)
      }
    })

    console.log(
      `Songs import done: sourceBandId=${sourceBandId} targetBandId=${targetBandId} imported=${sourceSongs.rows.length} replace=${replace ? 'yes' : 'no'}`,
    )
  } finally {
    await sourcePool.end()
  }
}

async function importVotingsFromSqlDb(options: Record<string, string | boolean>): Promise<void> {
  const sourceDbUrl =
    optionalStringOption(options, 'source-db-url') ?? process.env.IMPORT_SOURCE_DATABASE_URL ?? null
  if (!sourceDbUrl) {
    throw new Error('Missing source DB URL. Use --source-db-url or IMPORT_SOURCE_DATABASE_URL.')
  }

  const sourceBandId = readIntOption(options, 'source-band-id')
  const targetBandId = readIntOption(options, 'target-band-id')
  const replace = readBooleanOption(options, 'replace', true)

  const sourcePool = new pg.Pool({
    connectionString: sourceDbUrl,
    max: 2,
    idleTimeoutMillis: 5_000,
  })

  try {
    const sourceVotes = await sourcePool.query<{
      vote_id: number
      source_song_id: number
      user_id: string
      score: number
      comment: string | null
      created_at: Date | null
      title: string
      artist: string
      type: string | null
      position: number | null
      spotify_url: string | null
      youtube_url: string | null
    }>(
      `
        select
          v.id as vote_id,
          v.song_id as source_song_id,
          v.user_id,
          v.score,
          v.comment,
          v.created_at,
          s.title,
          s.artist,
          s.type,
          s.position,
          s.spotify_url,
          s.youtube_url
        from votes v
        inner join songs s on s.id = v.song_id
        where v.band_id = $1
          and s.band_id = $1
        order by v.id asc
      `,
      [sourceBandId],
    )

    if (sourceVotes.rows.length === 0) {
      console.log('No source votings found. Nothing imported.')
      return
    }

    const [targetBand] = await db.select({ id: bands.id }).from(bands).where(eq(bands.id, targetBandId)).limit(1)
    if (!targetBand) throw new Error(`Target band not found: ${targetBandId}`)

    const targetSongs = await db
      .select({
        id: songs.id,
        title: songs.title,
        artist: songs.artist,
        type: songs.type,
        position: songs.position,
        spotifyUrl: songs.spotifyUrl,
        youtubeUrl: songs.youtubeUrl,
      })
      .from(songs)
      .where(eq(songs.bandId, targetBandId))
      .orderBy(songs.id)

    const userRows = await db.select({ id: users.id }).from(users)
    const userIds = new Set(userRows.map((row) => row.id))

    const signatureToSongIds = new Map<string, number[]>()
    for (const row of targetSongs) {
      const signature = songSignature({
        title: row.title,
        artist: row.artist,
        type: row.type,
        position: row.position,
        spotifyUrl: row.spotifyUrl,
        youtubeUrl: row.youtubeUrl,
      })
      pushMapValue(signatureToSongIds, signature, row.id)
    }

    let insertedCount = 0
    let skippedMissingSong = 0
    let skippedMissingUser = 0
    const signatureCursor = new Map<string, number>()

    await db.transaction(async (tx) => {
      if (replace) {
        await tx.delete(votes).where(eq(votes.bandId, targetBandId))
      }

      for (const row of sourceVotes.rows) {
        const signature = songSignature({
          title: row.title,
          artist: row.artist,
          type: row.type ?? 'song',
          position: row.position ?? 0,
          spotifyUrl: row.spotify_url,
          youtubeUrl: row.youtube_url,
        })
        const matchingIds = signatureToSongIds.get(signature) ?? []
        const cursor = signatureCursor.get(signature) ?? 0
        const targetSongId = matchingIds[cursor] ?? null

        if (!targetSongId) {
          skippedMissingSong += 1
          continue
        }

        signatureCursor.set(signature, cursor + 1)

        if (!userIds.has(row.user_id)) {
          skippedMissingUser += 1
          continue
        }

        await tx
          .insert(votes)
          .values({
            bandId: targetBandId,
            songId: targetSongId,
            userId: row.user_id,
            score: row.score,
            comment: row.comment,
            createdAt: row.created_at ?? new Date(),
          })
          .onConflictDoUpdate({
            target: [votes.songId, votes.userId],
            set: {
              score: row.score,
              comment: row.comment,
              createdAt: row.created_at ?? new Date(),
              bandId: targetBandId,
            },
          })

        insertedCount += 1
      }
    })

    console.log(
      `Votings import done: sourceBandId=${sourceBandId} targetBandId=${targetBandId} insertedOrUpdated=${insertedCount} skippedMissingSong=${skippedMissingSong} skippedMissingUser=${skippedMissingUser} replace=${replace ? 'yes' : 'no'}`,
    )
  } finally {
    await sourcePool.end()
  }
}

async function sendBandPush(options: Record<string, string | boolean>): Promise<void> {
  const bandId = readIntOption(options, 'band-id')
  const title = requireStringOption(options, 'title')
  const body = requireStringOption(options, 'body')
  const path = optionalStringOption(options, 'path') ?? '/calendar'
  const query = optionalStringOption(options, 'query') ?? `bandId=${encodeURIComponent(String(bandId))}`
  const dryRun = readBooleanOption(options, 'dry-run', false)

  const [band] = await db
    .select({ id: bands.id, name: bands.name })
    .from(bands)
    .where(eq(bands.id, bandId))
    .limit(1)
  if (!band) throw new Error(`Band not found: ${bandId}`)

  const devices = await pool.query<{
    user_id: string
    token_type: string
    token: string
  }>(
    `
      select distinct upd.user_id, upd.token_type, upd.token
      from user_push_devices upd
      inner join band_members bm on bm.user_id = upd.user_id
      where bm.band_id = $1
        and upd.is_enabled = true
      order by upd.user_id asc
    `,
    [bandId],
  )

  if (devices.rows.length === 0) {
    console.log(`No enabled push devices found for band ${bandId} (${band.name}).`)
    return
  }

  let attempted = 0
  let delivered = 0
  let failed = 0
  for (const row of devices.rows) {
    const tokenType = row.token_type === 'apns' ? 'apns' : 'fcm'
    if (!dryRun) {
      const result = await sendPushToDevice({
        tokenType,
        token: row.token,
        title,
        body,
        path,
        query,
        context: {
          bandId,
          userId: row.user_id,
        },
      })
      if (result.ok) delivered += 1
      else failed += 1
    } else {
      delivered += 1
    }
    attempted += 1
  }

  console.log(
    `Push ${dryRun ? 'simulated' : 'completed'}: bandId=${bandId} bandName="${band.name}" attempted=${attempted} delivered=${delivered} failed=${failed} path=${path} query="${query}"`,
  )
}

async function listBandPushDevices(options: Record<string, string | boolean>): Promise<void> {
  const bandId = readIntOption(options, 'band-id')
  const includeDisabled = readBooleanOption(options, 'include-disabled', false)

  const [band] = await db
    .select({ id: bands.id, name: bands.name })
    .from(bands)
    .where(eq(bands.id, bandId))
    .limit(1)
  if (!band) throw new Error(`Band not found: ${bandId}`)

  const devices = await listRegisteredPushDevicesForBand(bandId, includeDisabled)

  console.log(
    `Registered push devices for band ${bandId} (${band.name}) includeDisabled=${includeDisabled ? 'yes' : 'no'} count=${devices.length}`,
  )

  if (devices.length === 0) {
    console.log('No matching push devices found.')
    return
  }

  printTextTable(
    ['userId', 'name', 'email', 'role', 'deviceId', 'platform', 'tokenType', 'enabled', 'lastSeenAt', 'token'],
    devices.map((device) => [
      device.userId,
      device.userName || '-',
      device.userEmail || '-',
      device.memberRole,
      String(device.deviceId),
      device.platform,
      device.tokenType,
      device.isEnabled ? 'yes' : 'no',
      device.lastSeenAt.toISOString(),
      device.tokenPreview,
    ]),
  )
}

export type SeedDemoAccountOptions = {
  email?: string
  password?: string
  name?: string
  bandName?: string
  'band-name'?: string
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'demo-band'
  )
}

export async function seedDemoAccount(
  rawOptions: Record<string, string | boolean> | SeedDemoAccountOptions = {},
): Promise<{ userId: string; bandId: number; email: string }> {
  const options = rawOptions as Record<string, string | boolean>
  const email = (optionalStringOption(options, 'email') ?? 'appcert@example.org').trim()
  const password = (optionalStringOption(options, 'password') ?? 'appcert@example.org').trim()
  const name = (optionalStringOption(options, 'name') ?? 'App Store Reviewer').trim()
  const bandName = (
    optionalStringOption(options, 'band-name') ??
    optionalStringOption(options, 'bandName') ??
    'The Bandstr Demo Band'
  ).trim()

  // 1. Upsert user record
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  let userId: string
  if (existingUser) {
    userId = existingUser.id
    await db
      .update(users)
      .set({
        name,
        emailVerified: true,
        devProPlan: true,
        devProPlanAssignedAt: existingUser.devProPlanAssignedAt ?? new Date(),
        subscriptionPlan: 'pro',
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
  } else {
    userId = `demo-usr-${randomUUID()}`
    await db.insert(users).values({
      id: userId,
      name,
      email,
      emailVerified: true,
      devProPlan: true,
      devProPlanAssignedAt: new Date(),
      subscriptionPlan: 'pro',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  // 2. Upsert credential row in account table
  const hashedPassword = await hashPassword(password)
  const [existingAccount] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')))
    .limit(1)

  if (existingAccount) {
    await db
      .update(accounts)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, existingAccount.id))
  } else {
    await db.insert(accounts).values({
      id: `demo-acc-${randomUUID()}`,
      accountId: userId,
      providerId: 'credential',
      userId,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  // 3. Upsert demo band
  const bandSlug = slugify(bandName)
  const [existingBand] = await db
    .select()
    .from(bands)
    .where(eq(bands.slug, bandSlug))
    .limit(1)

  let bandId: number
  if (existingBand) {
    bandId = existingBand.id
    await db
      .update(bands)
      .set({
        name: bandName,
        plan: 'pro',
      })
      .where(eq(bands.id, bandId))
  } else {
    const [newBand] = await db
      .insert(bands)
      .values({
        name: bandName,
        slug: bandSlug,
        plan: 'pro',
        createdAt: new Date(),
      })
      .returning({ id: bands.id })
    bandId = newBand.id
  }

  // Update user's defaultBandId
  await db
    .update(users)
    .set({ defaultBandId: bandId })
    .where(eq(users.id, userId))

  // 4. Attach user as owner in band_members
  const [existingMembership] = await db
    .select()
    .from(bandMembers)
    .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.userId, userId)))
    .limit(1)

  if (existingMembership) {
    await db
      .update(bandMembers)
      .set({
        role: 'owner',
      })
      .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.userId, userId)))
  } else {
    await db.insert(bandMembers).values({
      bandId,
      userId,
      role: 'owner',
      sortOrder: 1,
      isHidden: false,
      beerCount: 0,
      joinedAt: new Date(),
    })
  }

  // 5. Ensure sample songs exist
  const existingSongs = await db
    .select()
    .from(songs)
    .where(eq(songs.bandId, bandId))

  let songIds = existingSongs.map((s) => s.id)
  if (existingSongs.length === 0) {
    const sampleSongsData = [
      {
        bandId,
        title: 'Nordwind',
        artist: 'Aurora Kollektiv',
        notes: 'Intro 8 bars',
        type: 'song',
        pitch: 0,
        isSetlist: true,
        position: 1,
        isPinned: true,
        addedBy: userId,
        lengthMs: 212000,
        bpm: 128,
      },
      {
        bandId,
        title: 'Glasfassade',
        artist: 'Stadtlichter',
        notes: 'Half step down',
        type: 'song',
        pitch: -1,
        isSetlist: true,
        position: 2,
        isPinned: false,
        addedBy: userId,
        lengthMs: 238000,
        bpm: 112,
      },
      {
        bandId,
        title: 'Kurzschluss',
        artist: bandName,
        notes: 'Original song',
        type: 'song',
        pitch: 0,
        isSetlist: true,
        position: 3,
        isPinned: false,
        addedBy: userId,
        lengthMs: 254000,
        bpm: 140,
      },
      {
        bandId,
        title: 'Rückenwind',
        artist: 'Elin Marsh',
        notes: 'Candidate for next set',
        type: 'song',
        pitch: 0,
        isSetlist: false,
        position: 0,
        isPinned: false,
        addedBy: userId,
        lengthMs: 247000,
        bpm: 118,
      },
      {
        bandId,
        title: 'Kalte Sonne',
        artist: 'Marlow Trio',
        notes: null,
        type: 'song',
        pitch: 0,
        isSetlist: false,
        position: 0,
        isPinned: false,
        addedBy: userId,
        lengthMs: 219000,
        bpm: 100,
      },
    ]

    const insertedSongs = await db
      .insert(songs)
      .values(sampleSongsData)
      .returning({ id: songs.id })
    songIds = insertedSongs.map((s) => s.id)
  }

  // 6. Ensure calendar events (rehearsal and gig) exist
  const existingEvents = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.bandId, bandId))

  let rehearsalEventId: number | null = null
  let gigEventId: number | null = null

  if (existingEvents.length === 0) {
    const now = new Date()
    const rehearsalStart = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    rehearsalStart.setHours(19, 0, 0, 0)
    const rehearsalEnd = new Date(rehearsalStart.getTime() + 3 * 60 * 60 * 1000)

    const gigStart = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    gigStart.setHours(20, 0, 0, 0)
    const gigEnd = new Date(gigStart.getTime() + 3 * 60 * 60 * 1000)

    const [rehearsal] = await db
      .insert(calendarEvents)
      .values({
        bandId,
        title: 'Band Rehearsal',
        description: 'Go through new setlist',
        startTime: rehearsalStart,
        endTime: rehearsalEnd,
        type: 'rehearsal',
        isTentative: false,
      })
      .returning({ id: calendarEvents.id })

    const [gig] = await db
      .insert(calendarEvents)
      .values({
        bandId,
        title: 'Club Concert',
        description: 'Live performance - 45 min set',
        startTime: gigStart,
        endTime: gigEnd,
        type: 'gig',
        isTentative: false,
      })
      .returning({ id: calendarEvents.id })

    rehearsalEventId = rehearsal.id
    gigEventId = gig.id
  } else {
    const r = existingEvents.find((e) => e.type === 'rehearsal')
    const g = existingEvents.find((e) => e.type === 'gig')
    if (r) rehearsalEventId = r.id
    if (g) gigEventId = g.id
  }

  // 7. Ensure setlists exist
  const existingSetlists = await db
    .select()
    .from(gigSetlists)
    .where(eq(gigSetlists.bandId, bandId))

  if (existingSetlists.length === 0) {
    const [setlist] = await db
      .insert(gigSetlists)
      .values({
        bandId,
        title: 'Main Setlist',
        location: 'Main Stage',
        gigDate: 'Next Saturday',
        gigTime: '20:00',
        notes: 'Standard 45min set',
        calendarEventId: gigEventId,
      })
      .returning({ id: gigSetlists.id })

    if (songIds.length > 0) {
      const setlistSongs = songIds.slice(0, 3)
      for (let i = 0; i < setlistSongs.length; i += 1) {
        await db.insert(gigSongs).values({
          bandId,
          gigId: setlist.id,
          songId: setlistSongs[i],
          position: i + 1,
        })
      }
    }
  }

  // Ensure rehearsal songs exist
  if (rehearsalEventId && songIds.length > 0) {
    const existingRehearsalSongs = await db
      .select()
      .from(rehearsalSongs)
      .where(and(eq(rehearsalSongs.rehearsalId, rehearsalEventId), eq(rehearsalSongs.bandId, bandId)))

    if (existingRehearsalSongs.length === 0) {
      const toLink = songIds.slice(0, 2)
      for (const sId of toLink) {
        await db.insert(rehearsalSongs).values({
          bandId,
          rehearsalId: rehearsalEventId,
          songId: sId,
        })
      }
    }
  }

  // 8. Ensure votes exist
  const existingVotes = await db
    .select()
    .from(votes)
    .where(eq(votes.bandId, bandId))

  if (existingVotes.length === 0 && songIds.length >= 4) {
    await db.insert(votes).values([
      {
        bandId,
        songId: songIds[3],
        userId,
        score: 3,
        comment: 'Great candidate for the next setlist!',
      },
      {
        bandId,
        songId: songIds[4] ?? songIds[0],
        userId,
        score: 2,
        comment: 'Good tempo, needs some polish on the outro.',
      },
    ])
  }

  console.log(
    `Demo account seeded: email=${email} userId=${userId} bandId=${bandId} bandName="${bandName}"`,
  )

  return { userId, bandId, email }
}

function printHelp(): void {
  console.log(`
bandstr admin CLI (run inside container):
node /app/packages/api/dist/cli/admin.js <command> [options]

Commands:
  list-users
  list-bands
  add-user --name "<name>" --email "<email>" [--id "<id>"] [--email-verified true|false] [--dev-pro-plan true|false]
  verify-user-email [--user-id "<user-id>" | --email "<email>"] [--verified true|false]
  delete-user --user-id "<user-id>"
  assign-user-to-band --user-id "<user-id>" --band-id <id> [--role owner|admin|member] [--sort-order <n>] [--is-hidden true|false] [--beer-count <n>]
  remove-user-from-band --user-id "<user-id>" --band-id <id>
  import-songs-from-sql-db --source-db-url "<postgres-url>" --source-band-id <id> --target-band-id <id> [--replace true|false]
  import-votings-from-sql-db --source-db-url "<postgres-url>" --source-band-id <id> --target-band-id <id> [--replace true|false]
  change-subscription-for-user --user-id "<user-id>" --enabled true|false
  list-band-push-devices --band-id <id> [--include-disabled true|false]
  send-band-push --band-id <id> --title "<title>" --body "<body>" [--path "/calendar"] [--query "bandId=1"] [--dry-run true|false]
  seed-demo-account [--email "<email>"] [--password "<password>"] [--name "<name>"] [--band-name "<band-name>"]

Notes:
  - "votings" maps source songs to target songs by song signature (title/artist/type/position/links).
  - Band pro entitlement can be inherited from owner/admin users with devProPlan=true.
`)
}

async function main(): Promise<void> {
  const { command, options } = parseArgs(process.argv.slice(2))
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp()
    return
  }

  switch (command) {
    case 'list-users':
      await listUsers()
      break
    case 'list-bands':
      await listBands()
      break
    case 'add-user':
      await addUser(options)
      break
    case 'delete-user':
      await deleteUser(options)
      break
    case 'verify-user-email':
      await verifyUserEmail(options)
      break
    case 'assign-user-to-band':
      await assignUserToBand(options)
      break
    case 'remove-user-from-band':
      await removeUserFromBand(options)
      break
    case 'import-songs-from-sql-db':
      await importSongsFromSqlDb(options)
      break
    case 'import-votings-from-sql-db':
      await importVotingsFromSqlDb(options)
      break
    case 'change-subscription-for-user':
      await changeSubscriptionForUser(options)
      break
    case 'list-band-push-devices':
      await listBandPushDevices(options)
      break
    case 'send-band-push':
      await sendBandPush(options)
      break
    case 'seed-demo-account':
      await seedDemoAccount(options)
      break
    default:
      throw new Error(`Unknown command "${command}". Run with "help" for usage.`)
  }
}

const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST)
const isDirectRun =
  !isTestEnv &&
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('admin.ts') || process.argv[1].endsWith('admin.js'))

if (isDirectRun) {
  main()
    .catch((error: unknown) => {
      console.error('[admin-cli] failed', error)
      process.exitCode = 1
    })
    .finally(async () => {
      await pool.end()
    })
}

