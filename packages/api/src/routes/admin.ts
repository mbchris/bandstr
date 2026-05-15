import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant, type TenantEnv } from '../middleware/tenant.js'
import { requireRole } from '../middleware/rbac.js'
import { db } from '../db/index.js'
import { bands, bandMembers, songs, votes, calendarEvents, users } from '../db/schema.js'
import { eq, inArray } from 'drizzle-orm'
import { bandHasProPlan } from '../lib/entitlements.js'
import { listRegisteredPushDevicesForBand } from '../lib/push-device-admin.js'

export const admin = new Hono<TenantEnv>()

admin.use('*', requireAuth, requireTenant, requireRole('admin'))

async function ensureProBandOrThrow(bandId: number) {
  const [band] = await db.select({ id: bands.id }).from(bands).where(eq(bands.id, bandId)).limit(1)
  if (!band) return { ok: false as const, status: 404, message: 'Band not found' }
  const hasProPlan = await bandHasProPlan(bandId)
  if (!hasProPlan) {
    return {
      ok: false as const,
      status: 403,
      message: 'Import/export features are available on pro plans only.',
    }
  }
  return { ok: true as const }
}

// GET /admin/status
admin.get('/status', async (c) => {
  return c.json({
    ok: true,
    database: 'postgresql',
    env: {
      googleOAuth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      githubOAuth: !!(process.env.GHUB_CLIENT_ID && process.env.GHUB_CLIENT_SECRET),
      stripe: !!process.env.STRIPE_SECRET_KEY,
    },
  })
})

// GET /admin/push-devices
admin.get('/push-devices', async (c) => {
  const bandId = c.get('bandId')
  const includeDisabled = c.req.query('includeDisabled') === 'true'

  const [band] = await db.select({ id: bands.id, name: bands.name }).from(bands).where(eq(bands.id, bandId)).limit(1)
  if (!band) return c.json({ error: 'Band not found' }, 404)

  const devices = await listRegisteredPushDevicesForBand(bandId, includeDisabled)
  return c.json({
    band: {
      id: band.id,
      name: band.name,
    },
    includeDisabled,
    count: devices.length,
    devices: devices.map((device) => ({
      userId: device.userId,
      userName: device.userName,
      userEmail: device.userEmail,
      memberRole: device.memberRole,
      deviceId: device.deviceId,
      platform: device.platform,
      tokenType: device.tokenType,
      tokenPreview: device.tokenPreview,
      isEnabled: device.isEnabled,
      lastSeenAt: device.lastSeenAt,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    })),
  })
})

// GET /admin/db/export — export band data as JSON
admin.get('/db/export', async (c) => {
  const bandId = c.get('bandId')
  const entitlement = await ensureProBandOrThrow(bandId)
  if (!entitlement.ok) return c.json({ error: entitlement.message }, entitlement.status as 403 | 404)

  const [bandData, members, songsData, votesData, events] = await Promise.all([
    db.select().from(bands).where(eq(bands.id, bandId)).limit(1),
    db.select().from(bandMembers).where(eq(bandMembers.bandId, bandId)),
    db.select().from(songs).where(eq(songs.bandId, bandId)),
    db.select().from(votes).where(eq(votes.bandId, bandId)),
    db.select().from(calendarEvents).where(eq(calendarEvents.bandId, bandId)),
  ])

  c.header('Content-Type', 'application/json; charset=utf-8')
  c.header('Content-Disposition', 'attachment; filename="bandstr-backup.v1.json"')

  return c.json({
    format: 'bandstr-db-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    band: bandData[0],
    members,
    songs: songsData,
    votes: votesData,
    calendarEvents: events,
  })
})

const updateLogoSchema = z.object({
  variant: z.enum(['dark', 'bright']),
  logoDataUrl: z.string().min(1),
})

const MAX_LOGO_BYTES = 150 * 1024

function getDataUrlBytes(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex === -1) return 0
  const base64 = dataUrl.slice(commaIndex + 1)
  const padding = (base64.match(/=+$/)?.[0].length ?? 0)
  return Math.floor((base64.length * 3) / 4) - padding
}

// GET /admin/logo
admin.get('/logo', async (c) => {
  const bandId = c.get('bandId')
  const [band] = await db
    .select({ logo: bands.logo, logoDark: bands.logoDark, logoBright: bands.logoBright })
    .from(bands)
    .where(eq(bands.id, bandId))
    .limit(1)
  return c.json({
    logo: band?.logo ?? null,
    logoDark: band?.logoDark ?? null,
    logoBright: band?.logoBright ?? null,
  })
})

// PUT /admin/logo
admin.put('/logo', zValidator('json', updateLogoSchema), async (c) => {
  const bandId = c.get('bandId')
  const { variant, logoDataUrl } = c.req.valid('json')

  if (!logoDataUrl.startsWith('data:image/webp;base64,')) {
    return c.json({ error: 'Logo must be a WEBP data URL' }, 400)
  }

  const bytes = getDataUrlBytes(logoDataUrl)
  if (bytes > MAX_LOGO_BYTES) {
    return c.json({ error: 'Logo exceeds 150KB limit' }, 400)
  }

  const updateData =
    variant === 'dark'
      ? ({ logoDark: logoDataUrl } as const)
      : ({ logoBright: logoDataUrl } as const)

  const [updated] = await db.update(bands).set(updateData).where(eq(bands.id, bandId)).returning({
    logo: bands.logo,
    logoDark: bands.logoDark,
    logoBright: bands.logoBright,
  })

  return c.json({
    logo: updated?.logo ?? null,
    logoDark: updated?.logoDark ?? null,
    logoBright: updated?.logoBright ?? null,
  })
})

// DELETE /admin/logo
admin.delete('/logo', async (c) => {
  const bandId = c.get('bandId')
  const variant = c.req.query('variant')

  if (variant === 'dark') {
    await db.update(bands).set({ logoDark: null }).where(eq(bands.id, bandId))
  } else if (variant === 'bright') {
    await db.update(bands).set({ logoBright: null }).where(eq(bands.id, bandId))
  } else {
    await db.update(bands).set({ logo: null, logoDark: null, logoBright: null }).where(eq(bands.id, bandId))
  }

  const [updated] = await db
    .select({ logo: bands.logo, logoDark: bands.logoDark, logoBright: bands.logoBright })
    .from(bands)
    .where(eq(bands.id, bandId))
    .limit(1)

  return c.json({
    ok: true,
    logo: updated?.logo ?? null,
    logoDark: updated?.logoDark ?? null,
    logoBright: updated?.logoBright ?? null,
  })
})

// GET /admin/calendar/export — export only calendar events as JSON
admin.get('/calendar/export', async (c) => {
  const bandId = c.get('bandId')
  const entitlement = await ensureProBandOrThrow(bandId)
  if (!entitlement.ok) return c.json({ error: entitlement.message }, entitlement.status as 403 | 404)
  const events = await db.select().from(calendarEvents).where(eq(calendarEvents.bandId, bandId))

  c.header('Content-Type', 'application/json; charset=utf-8')
  c.header('Content-Disposition', 'attachment; filename="calendar_export.json"')

  return c.json(events)
})

const backupSchema = z.object({
  format: z.literal('bandstr-db-backup'),
  version: z.literal(1),
  exportedAt: z.string(),
  band: z
    .object({
      name: z.string().min(1).optional(),
      logo: z.string().nullable().optional(),
      logoDark: z.string().nullable().optional(),
      logoBright: z.string().nullable().optional(),
    })
    .optional(),
  members: z
    .array(
      z.object({
        userId: z.string().min(1),
        role: z.enum(['owner', 'admin', 'member']).optional(),
        sortOrder: z.number().int().optional(),
        isHidden: z.boolean().optional(),
        beerCount: z.number().int().optional(),
        joinedAt: z.string().optional(),
      }),
    )
    .default([]),
  songs: z
    .array(
      z.object({
        id: z.number().int(),
        title: z.string().min(1),
        artist: z.string().min(1),
        spotifyUrl: z.string().nullable().optional(),
        youtubeUrl: z.string().nullable().optional(),
        thumbnailUrl: z.string().nullable().optional(),
        lengthMs: z.number().int().nullable().optional(),
        bpm: z.number().int().nullable().optional(),
        notes: z.string().nullable().optional(),
        type: z.enum(['song', 'pause', 'tuning']).optional(),
        pitch: z.number().int().optional(),
        isSetlist: z.boolean().optional(),
        position: z.number().int().optional(),
        isPinned: z.boolean().optional(),
        addedBy: z.string().nullable().optional(),
        createdAt: z.string().optional(),
      }),
    )
    .default([]),
  votes: z
    .array(
      z.object({
        songId: z.number().int(),
        userId: z.string().min(1),
        score: z.number().int(),
        comment: z.string().nullable().optional(),
        createdAt: z.string().optional(),
      }),
    )
    .default([]),
  calendarEvents: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().nullable().optional(),
        startTime: z.string(),
        endTime: z.string(),
        type: z.enum(['rehearsal', 'gig', 'event', 'unavailability']).optional(),
        userId: z.string().nullable().optional(),
        bierwartOverrideId: z.string().nullable().optional(),
        isTentative: z.boolean().optional(),
        createdAt: z.string().optional(),
      }),
    )
    .default([]),
})

function parseDateOrNull(value: string | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

// POST /admin/db/import — import custom backup JSON
admin.post('/db/import', async (c) => {
  const bandId = c.get('bandId')
  const userId = c.get('user').id
  const entitlement = await ensureProBandOrThrow(bandId)
  if (!entitlement.ok) return c.json({ error: entitlement.message }, entitlement.status as 403 | 404)

  const form = await c.req.formData().catch(() => null)
  const uploaded = form?.get('file')
  if (!(uploaded instanceof File)) {
    return c.json({ error: 'No backup file uploaded' }, 400)
  }

  const filename = uploaded.name.toLowerCase()
  if (!filename.endsWith('.json')) {
    return c.json({ error: 'Only .json backup imports are supported' }, 400)
  }

  const payloadText = await uploaded.text()
  if (!payloadText.trim()) {
    return c.json({ error: 'Backup file is empty' }, 400)
  }

  try {
    const parsedJson = JSON.parse(payloadText) as unknown
    const parsedBackup = backupSchema.safeParse(parsedJson)
    if (!parsedBackup.success) {
      return c.json({ error: 'Invalid backup format' }, 400)
    }

    const backup = parsedBackup.data
    const referencedUserIds = new Set<string>()
    for (const member of backup.members) referencedUserIds.add(member.userId)
    for (const voteEntry of backup.votes) referencedUserIds.add(voteEntry.userId)
    for (const songEntry of backup.songs) {
      if (songEntry.addedBy) referencedUserIds.add(songEntry.addedBy)
    }
    for (const eventEntry of backup.calendarEvents) {
      if (eventEntry.userId) referencedUserIds.add(eventEntry.userId)
      if (eventEntry.bierwartOverrideId) referencedUserIds.add(eventEntry.bierwartOverrideId)
    }
    referencedUserIds.add(userId)

    const knownUsers =
      referencedUserIds.size > 0
        ? await db
            .select({ id: users.id })
            .from(users)
            .where(inArray(users.id, Array.from(referencedUserIds)))
        : []
    const knownUserIdSet = new Set(knownUsers.map((u) => u.id))

    const memberMap = new Map<
      string,
      { role: 'owner' | 'admin' | 'member'; sortOrder: number; isHidden: boolean; beerCount: number; joinedAt: Date | undefined }
    >()
    for (const member of backup.members) {
      if (!knownUserIdSet.has(member.userId)) continue
      memberMap.set(member.userId, {
        role: member.role ?? 'member',
        sortOrder: member.sortOrder ?? 0,
        isHidden: member.isHidden ?? false,
        beerCount: member.beerCount ?? 0,
        joinedAt: parseDateOrNull(member.joinedAt) ?? undefined,
      })
    }
    if (knownUserIdSet.has(userId) && !memberMap.has(userId)) {
      memberMap.set(userId, {
        role: 'admin',
        sortOrder: 0,
        isHidden: false,
        beerCount: 0,
        joinedAt: undefined,
      })
    }

    const dedupedVotes = new Map<string, (typeof backup.votes)[number]>()
    for (const voteEntry of backup.votes) {
      dedupedVotes.set(`${voteEntry.songId}:${voteEntry.userId}`, voteEntry)
    }

    const importStats = await db.transaction(async (tx) => {
      if (backup.band) {
        await tx
          .update(bands)
          .set({
            ...(backup.band.name ? { name: backup.band.name } : {}),
            ...(backup.band.logo !== undefined ? { logo: backup.band.logo } : {}),
            ...(backup.band.logoDark !== undefined ? { logoDark: backup.band.logoDark } : {}),
            ...(backup.band.logoBright !== undefined ? { logoBright: backup.band.logoBright } : {}),
          })
          .where(eq(bands.id, bandId))
      }

      await tx.delete(votes).where(eq(votes.bandId, bandId))
      await tx.delete(songs).where(eq(songs.bandId, bandId))
      await tx.delete(calendarEvents).where(eq(calendarEvents.bandId, bandId))
      await tx.delete(bandMembers).where(eq(bandMembers.bandId, bandId))

      if (memberMap.size > 0) {
        await tx.insert(bandMembers).values(
          Array.from(memberMap.entries()).map(([memberUserId, memberData]) => ({
            bandId,
            userId: memberUserId,
            role: memberData.role,
            sortOrder: memberData.sortOrder,
            isHidden: memberData.isHidden,
            beerCount: memberData.beerCount,
            ...(memberData.joinedAt ? { joinedAt: memberData.joinedAt } : {}),
          })),
        )
      }

      const songIdMap = new Map<number, number>()
      let insertedSongs = 0
      for (const songEntry of backup.songs) {
        const createdAt = parseDateOrNull(songEntry.createdAt)
        const [insertedSong] = await tx
          .insert(songs)
          .values({
            bandId,
            title: songEntry.title,
            artist: songEntry.artist,
            spotifyUrl: songEntry.spotifyUrl ?? null,
            youtubeUrl: songEntry.youtubeUrl ?? null,
            thumbnailUrl: songEntry.thumbnailUrl ?? null,
            lengthMs: songEntry.lengthMs ?? null,
            bpm: songEntry.bpm ?? null,
            notes: songEntry.notes ?? null,
            type: songEntry.type ?? 'song',
            pitch: songEntry.pitch ?? 0,
            isSetlist: songEntry.isSetlist ?? false,
            position: songEntry.position ?? 0,
            isPinned: songEntry.isPinned ?? false,
            addedBy: songEntry.addedBy && knownUserIdSet.has(songEntry.addedBy) ? songEntry.addedBy : null,
            ...(createdAt ? { createdAt } : {}),
          })
          .returning({ id: songs.id })
        songIdMap.set(songEntry.id, insertedSong.id)
        insertedSongs += 1
      }

      let insertedVotes = 0
      let skippedVotes = 0
      for (const voteEntry of dedupedVotes.values()) {
        const mappedSongId = songIdMap.get(voteEntry.songId)
        if (!mappedSongId || !knownUserIdSet.has(voteEntry.userId)) {
          skippedVotes += 1
          continue
        }

        const createdAt = parseDateOrNull(voteEntry.createdAt)
        await tx.insert(votes).values({
          bandId,
          songId: mappedSongId,
          userId: voteEntry.userId,
          score: voteEntry.score,
          comment: voteEntry.comment ?? null,
          ...(createdAt ? { createdAt } : {}),
        })
        insertedVotes += 1
      }

      let insertedEvents = 0
      for (const eventEntry of backup.calendarEvents) {
        const startTime = parseDateOrNull(eventEntry.startTime)
        const endTime = parseDateOrNull(eventEntry.endTime)
        if (!startTime || !endTime) continue

        const createdAt = parseDateOrNull(eventEntry.createdAt)
        await tx.insert(calendarEvents).values({
          bandId,
          title: eventEntry.title,
          description: eventEntry.description ?? null,
          startTime,
          endTime,
          type: eventEntry.type ?? 'rehearsal',
          userId: eventEntry.userId && knownUserIdSet.has(eventEntry.userId) ? eventEntry.userId : null,
          bierwartOverrideId:
            eventEntry.bierwartOverrideId && knownUserIdSet.has(eventEntry.bierwartOverrideId) ? eventEntry.bierwartOverrideId : null,
          isTentative: eventEntry.isTentative ?? false,
          ...(createdAt ? { createdAt } : {}),
        })
        insertedEvents += 1
      }

      return {
        members: memberMap.size,
        songs: insertedSongs,
        votes: insertedVotes,
        skippedVotes,
        calendarEvents: insertedEvents,
      }
    })

    return c.json({ ok: true, imported: importStats })
  } catch (error) {
    console.error('[admin.db.import] failed', error)
    return c.json({ error: 'JSON backup import failed' }, 400)
  }
})
