import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, asc, desc, gte, lt, lte, or, sql, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  calendarEvents,
  rehearsalSongs,
  songs,
  users,
  bandMembers,
  rehearsalAttendance,
  rehearsalTimeProposals,
  gigSetlists,
} from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant, type TenantEnv } from '../middleware/tenant.js'
import { queueBandNotification } from '../lib/notifications.js'

export const rehearsals = new Hono<TenantEnv>()
const ATTENDANCE_ABSENCE_MARKER_PREFIX = '[bandstr:rehearsal-absence]'

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

const proposalParamSchema = z.object({
  proposalId: z.coerce.number().int().positive(),
})

async function getEffectiveBierwartId(
  bandId: number,
  rehearsal: { id: number; startTime: Date; bierwartOverrideId: string | null },
) {
  if (rehearsal.bierwartOverrideId) return rehearsal.bierwartOverrideId

  const [previousOverride] = await db
    .select({ bierwartOverrideId: calendarEvents.bierwartOverrideId })
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.bandId, bandId),
        eq(calendarEvents.type, 'rehearsal'),
        sql`${calendarEvents.bierwartOverrideId} is not null`,
        or(
          lt(calendarEvents.startTime, rehearsal.startTime),
          and(eq(calendarEvents.startTime, rehearsal.startTime), lte(calendarEvents.id, rehearsal.id)),
        ),
      ),
    )
    .orderBy(desc(calendarEvents.startTime), desc(calendarEvents.id))
    .limit(1)

  if (previousOverride?.bierwartOverrideId) return previousOverride.bierwartOverrideId

  const [firstVisibleMember] = await db
    .select({ userId: users.id })
    .from(bandMembers)
    .innerJoin(users, eq(bandMembers.userId, users.id))
    .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.isHidden, false)))
    .orderBy(asc(bandMembers.sortOrder), asc(users.name))
    .limit(1)

  return firstVisibleMember?.userId ?? null
}

rehearsals.use('*', requireAuth, requireTenant)

// GET /rehearsals/next
rehearsals.get('/next', async (c) => {
  const bandId = c.get('bandId')
  const userId = c.get('user').id
  const now = new Date()

  const [nextRehearsal] = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        sql`lower(${calendarEvents.type}) = 'rehearsal'`,
        eq(calendarEvents.bandId, bandId),
        gte(calendarEvents.startTime, now),
      ),
    )
    .orderBy(calendarEvents.startTime)
    .limit(1)

  const upcomingGigs = await db
    .select({
      id: calendarEvents.id,
      bandId: calendarEvents.bandId,
      title: calendarEvents.title,
      description: calendarEvents.description,
      startTime: calendarEvents.startTime,
      endTime: calendarEvents.endTime,
      type: calendarEvents.type,
      userId: calendarEvents.userId,
      bierwartOverrideId: calendarEvents.bierwartOverrideId,
      isTentative: calendarEvents.isTentative,
      createdAt: calendarEvents.createdAt,
      gigSetlistId: gigSetlists.id,
      gigSetlistTitle: gigSetlists.title,
    })
    .from(calendarEvents)
    .leftJoin(
      gigSetlists,
      and(
        eq(calendarEvents.id, gigSetlists.calendarEventId),
        eq(calendarEvents.bandId, gigSetlists.bandId),
      ),
    )
    .where(
      and(
        eq(calendarEvents.type, 'gig'),
        eq(calendarEvents.bandId, bandId),
        gte(calendarEvents.startTime, now),
      ),
    )
    .orderBy(calendarEvents.startTime)
    .limit(3)

  if (!nextRehearsal) {
    return c.json({ nextRehearsal: null, upcomingGigs })
  }

  const dayStart = new Date(nextRehearsal.startTime)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  const effectiveBierwartId = await getEffectiveBierwartId(bandId, nextRehearsal)

  // Unavailabilities for that day.
  const unavailabilities = await db
    .select({
      id: calendarEvents.id,
      title: calendarEvents.title,
      description: calendarEvents.description,
      startTime: calendarEvents.startTime,
      endTime: calendarEvents.endTime,
      userId: calendarEvents.userId,
      userName: users.name,
      isHidden: bandMembers.isHidden,
    })
    .from(calendarEvents)
    .leftJoin(users, eq(calendarEvents.userId, users.id))
    .leftJoin(
      bandMembers,
      and(eq(bandMembers.userId, users.id), eq(bandMembers.bandId, bandId)),
    )
    .where(
      and(
        eq(calendarEvents.type, 'unavailability'),
        eq(calendarEvents.bandId, bandId),
        lte(calendarEvents.startTime, dayEnd),
        gte(calendarEvents.endTime, dayStart),
      ),
    )

  const rehearsalSongData = await db
    .select({
      id: songs.id,
      title: songs.title,
      artist: songs.artist,
      spotifyUrl: songs.spotifyUrl,
      youtubeUrl: songs.youtubeUrl,
      notes: songs.notes,
    })
    .from(rehearsalSongs)
    .innerJoin(songs, eq(rehearsalSongs.songId, songs.id))
    .where(
      and(eq(rehearsalSongs.rehearsalId, nextRehearsal.id), eq(rehearsalSongs.bandId, bandId)),
    )

  const [attendance] = await db
    .select({ status: rehearsalAttendance.status })
    .from(rehearsalAttendance)
    .where(
      and(
        eq(rehearsalAttendance.bandId, bandId),
        eq(rehearsalAttendance.rehearsalId, nextRehearsal.id),
        eq(rehearsalAttendance.userId, userId),
      ),
    )
    .limit(1)

  const members = await db
    .select({
      userId: users.id,
      userName: users.name,
      image: users.image,
    })
    .from(bandMembers)
    .innerJoin(users, eq(bandMembers.userId, users.id))
    .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.isHidden, false)))

  const attendanceRows = await db
    .select({
      userId: rehearsalAttendance.userId,
      status: rehearsalAttendance.status,
    })
    .from(rehearsalAttendance)
    .where(
      and(
        eq(rehearsalAttendance.bandId, bandId),
        eq(rehearsalAttendance.rehearsalId, nextRehearsal.id),
      ),
    )

  const statusByUser = new Map<string, 'present' | 'absent'>()
  for (const row of attendanceRows) {
    if (row.status === 'present' || row.status === 'absent') {
      statusByUser.set(row.userId, row.status)
    }
  }
  for (const row of unavailabilities) {
    if (row.userId) statusByUser.set(row.userId, 'absent')
  }

  const memberAttendance = members.map((member) => ({
    userId: member.userId,
    userName: member.userName,
    image: member.image,
    status: statusByUser.get(member.userId) ?? 'open',
  }))

  return c.json({
    nextRehearsal: {
      ...nextRehearsal,
      effectiveBierwartId,
      songs: rehearsalSongData,
      unavailabilities: unavailabilities
        .filter((entry) => entry.isHidden !== true)
        .map(({ isHidden, ...entry }) => ({
          ...entry,
          displayName: entry.userName || entry.title,
        })),
      myAttendance: attendance?.status ?? null,
      memberAttendance,
    },
    upcomingGigs,
  })
})

// GET /rehearsals/attendance — attendance overview for all upcoming rehearsals
rehearsals.get('/attendance', async (c) => {
  const bandId = c.get('bandId')
  const currentUserId = c.get('user').id
  const now = new Date()
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const upcomingRehearsals = await db
    .select({
      id: calendarEvents.id,
      title: calendarEvents.title,
      description: calendarEvents.description,
      startTime: calendarEvents.startTime,
      endTime: calendarEvents.endTime,
      isTentative: calendarEvents.isTentative,
    })
    .from(calendarEvents)
    .where(
      and(
        sql`lower(${calendarEvents.type}) = 'rehearsal'`,
        eq(calendarEvents.bandId, bandId),
        gte(calendarEvents.startTime, cutoff),
      ),
    )
    .orderBy(asc(calendarEvents.startTime))
    .limit(50)

  const members = await db
    .select({
      userId: users.id,
      userName: users.name,
      image: users.image,
    })
    .from(bandMembers)
    .innerJoin(users, eq(bandMembers.userId, users.id))
    .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.isHidden, false)))

  if (upcomingRehearsals.length === 0) {
    return c.json({ rehearsals: [], members })
  }

  const rehearsalIds = upcomingRehearsals.map((r) => r.id)

  const attendanceRows = await db
    .select({
      rehearsalId: rehearsalAttendance.rehearsalId,
      userId: rehearsalAttendance.userId,
      status: rehearsalAttendance.status,
    })
    .from(rehearsalAttendance)
    .where(
      and(
        eq(rehearsalAttendance.bandId, bandId),
        inArray(rehearsalAttendance.rehearsalId, rehearsalIds),
      ),
    )

  const unavailabilities = await db
    .select({
      userId: calendarEvents.userId,
      startTime: calendarEvents.startTime,
      endTime: calendarEvents.endTime,
    })
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.bandId, bandId),
        sql`lower(${calendarEvents.type}) = 'unavailability'`,
        gte(calendarEvents.endTime, cutoff),
      ),
    )

  const rehearsalsWithAttendance = upcomingRehearsals.map((rehearsal) => {
    const rStart = new Date(rehearsal.startTime)
    const rEnd = new Date(rehearsal.endTime)

    const thisAttendance = attendanceRows.filter((a) => a.rehearsalId === rehearsal.id)
    const statusByUser = new Map<string, 'present' | 'absent'>()
    for (const a of thisAttendance) {
      if (a.status === 'present' || a.status === 'absent') {
        statusByUser.set(a.userId, a.status)
      }
    }

    for (const u of unavailabilities) {
      if (u.userId) {
        const uStart = new Date(u.startTime)
        const uEnd = new Date(u.endTime)
        if (uStart <= rEnd && uEnd >= rStart) {
          statusByUser.set(u.userId, 'absent')
        }
      }
    }

    const memberAttendance = members.map((m) => ({
      userId: m.userId,
      userName: m.userName,
      image: m.image,
      status: statusByUser.get(m.userId) ?? 'open',
    }))

    const myAttendance = statusByUser.get(currentUserId) ?? null

    let summary: 'all_present' | 'has_absent' | 'pending' = 'pending'
    if (memberAttendance.some((m) => m.status === 'absent')) {
      summary = 'has_absent'
    } else if (memberAttendance.length > 0 && memberAttendance.every((m) => m.status === 'present')) {
      summary = 'all_present'
    }

    return {
      ...rehearsal,
      memberAttendance,
      myAttendance,
      summary,
    }
  })

  return c.json({
    rehearsals: rehearsalsWithAttendance,
    members,
  })
})

// GET /rehearsals/:id/attendance — single rehearsal attendance
rehearsals.get('/:id/attendance', zValidator('param', idParamSchema), async (c) => {
  const bandId = c.get('bandId')
  const currentUserId = c.get('user').id
  const { id: rehearsalId } = c.req.valid('param')

  const [rehearsal] = await db
    .select({
      id: calendarEvents.id,
      title: calendarEvents.title,
      description: calendarEvents.description,
      startTime: calendarEvents.startTime,
      endTime: calendarEvents.endTime,
      isTentative: calendarEvents.isTentative,
    })
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.id, rehearsalId),
        eq(calendarEvents.bandId, bandId),
        sql`lower(${calendarEvents.type}) = 'rehearsal'`,
      ),
    )
    .limit(1)

  if (!rehearsal) return c.json({ error: 'Rehearsal not found' }, 404)

  const members = await db
    .select({
      userId: users.id,
      userName: users.name,
      image: users.image,
    })
    .from(bandMembers)
    .innerJoin(users, eq(bandMembers.userId, users.id))
    .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.isHidden, false)))

  const attendanceRows = await db
    .select({
      userId: rehearsalAttendance.userId,
      status: rehearsalAttendance.status,
    })
    .from(rehearsalAttendance)
    .where(
      and(
        eq(rehearsalAttendance.bandId, bandId),
        eq(rehearsalAttendance.rehearsalId, rehearsalId),
      ),
    )

  const rStart = new Date(rehearsal.startTime)
  const rEnd = new Date(rehearsal.endTime)

  const unavailabilities = await db
    .select({
      userId: calendarEvents.userId,
      startTime: calendarEvents.startTime,
      endTime: calendarEvents.endTime,
    })
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.bandId, bandId),
        sql`lower(${calendarEvents.type}) = 'unavailability'`,
        lte(calendarEvents.startTime, rEnd),
        gte(calendarEvents.endTime, rStart),
      ),
    )

  const statusByUser = new Map<string, 'present' | 'absent'>()
  for (const a of attendanceRows) {
    if (a.status === 'present' || a.status === 'absent') {
      statusByUser.set(a.userId, a.status)
    }
  }
  for (const u of unavailabilities) {
    if (u.userId) {
      statusByUser.set(u.userId, 'absent')
    }
  }

  const memberAttendance = members.map((m) => ({
    userId: m.userId,
    userName: m.userName,
    image: m.image,
    status: statusByUser.get(m.userId) ?? 'open',
  }))

  const myAttendance = statusByUser.get(currentUserId) ?? null

  let summary: 'all_present' | 'has_absent' | 'pending' = 'pending'
  if (memberAttendance.some((m) => m.status === 'absent')) {
    summary = 'has_absent'
  } else if (memberAttendance.length > 0 && memberAttendance.every((m) => m.status === 'present')) {
    summary = 'all_present'
  }

  return c.json({
    rehearsalId,
    memberAttendance,
    myAttendance,
    summary,
    members,
  })
})

const attendanceSchema = z.object({
  status: z.enum(['present', 'absent', 'reset']),
})

// PUT /rehearsals/:id/attendance
rehearsals.put(
  '/:id/attendance',
  zValidator('param', idParamSchema),
  zValidator('json', attendanceSchema),
  async (c) => {
    const bandId = c.get('bandId')
    const userId = c.get('user').id
    const userName = c.get('user').name
    const { id: rehearsalId } = c.req.valid('param')
    const { status } = c.req.valid('json')

    const [rehearsal] = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.id, rehearsalId),
          eq(calendarEvents.bandId, bandId),
          eq(calendarEvents.type, 'rehearsal'),
        ),
      )
      .limit(1)

    if (!rehearsal) return c.json({ error: 'Rehearsal not found' }, 404)

    const dayStart = new Date(rehearsal.startTime)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)
    const absenceMarker = `${ATTENDANCE_ABSENCE_MARKER_PREFIX}:${rehearsal.id}`

    await db
      .delete(calendarEvents)
      .where(
        and(
          eq(calendarEvents.bandId, bandId),
          eq(calendarEvents.type, 'unavailability'),
          eq(calendarEvents.userId, userId),
          eq(calendarEvents.description, absenceMarker),
        ),
      )

    if (status === 'reset') {
      await db
        .delete(rehearsalAttendance)
        .where(
          and(
            eq(rehearsalAttendance.bandId, bandId),
            eq(rehearsalAttendance.rehearsalId, rehearsalId),
            eq(rehearsalAttendance.userId, userId),
          ),
        )

      return c.json({ success: true })
    }

    const existing = await db
      .select({ id: rehearsalAttendance.id })
      .from(rehearsalAttendance)
      .where(
        and(
          eq(rehearsalAttendance.bandId, bandId),
          eq(rehearsalAttendance.rehearsalId, rehearsalId),
          eq(rehearsalAttendance.userId, userId),
        ),
      )
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(rehearsalAttendance)
        .set({ status, updatedAt: new Date() })
        .where(eq(rehearsalAttendance.id, existing[0].id))
    } else {
      await db.insert(rehearsalAttendance).values({
        bandId,
        rehearsalId,
        userId,
        status,
      })
    }

    if (status === 'absent') {
      const [absenceEvent] = await db
        .insert(calendarEvents)
        .values({
          bandId,
          title: `Absence: ${rehearsal.title}`,
          description: absenceMarker,
          startTime: dayStart,
          endTime: dayEnd,
          type: 'unavailability',
          userId,
          isTentative: false,
        })
        .returning({ id: calendarEvents.id })

      await queueBandNotification({
        bandId,
        actorUserId: userId,
        eventType: 'absence',
        entityKey: `calendar:${absenceEvent.id}`,
        title: 'New absence',
        message: `${userName} marked an absence for "${rehearsal.title}".`,
        linkPath: '/calendar',
        linkQuery: `eventId=${absenceEvent.id}`,
      })
    }

    return c.json({ success: true })
  },
)

const createProposalSchema = z.object({
  proposedStartTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid datetime string' }),
  proposedEndTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid datetime string' }),
  comment: z.string().max(5000).optional(),
})

const decisionSchema = z.object({
  decision: z.enum(['accepted', 'rejected']),
  comment: z.string().max(5000).optional(),
})

rehearsals.get('/:id/time-proposals', zValidator('param', idParamSchema), async (c) => {
  const bandId = c.get('bandId')
  const { id: rehearsalId } = c.req.valid('param')

  const rows = await db
    .select({
      id: rehearsalTimeProposals.id,
      rehearsalId: rehearsalTimeProposals.rehearsalId,
      proposerUserId: rehearsalTimeProposals.proposerUserId,
      proposerName: users.name,
      proposedStartTime: rehearsalTimeProposals.proposedStartTime,
      proposedEndTime: rehearsalTimeProposals.proposedEndTime,
      comment: rehearsalTimeProposals.comment,
      status: rehearsalTimeProposals.status,
      decidedByUserId: rehearsalTimeProposals.decidedByUserId,
      decisionComment: rehearsalTimeProposals.decisionComment,
      createdAt: rehearsalTimeProposals.createdAt,
      updatedAt: rehearsalTimeProposals.updatedAt,
    })
    .from(rehearsalTimeProposals)
    .leftJoin(users, eq(rehearsalTimeProposals.proposerUserId, users.id))
    .where(and(eq(rehearsalTimeProposals.bandId, bandId), eq(rehearsalTimeProposals.rehearsalId, rehearsalId)))
    .orderBy(asc(rehearsalTimeProposals.createdAt))

  return c.json(rows)
})

rehearsals.post(
  '/:id/time-proposals',
  zValidator('param', idParamSchema),
  zValidator('json', createProposalSchema),
  async (c) => {
    const bandId = c.get('bandId')
    const proposerUserId = c.get('user').id
    const { id: rehearsalId } = c.req.valid('param')
    const payload = c.req.valid('json')

    const [rehearsal] = await db
      .select({ id: calendarEvents.id, type: calendarEvents.type })
      .from(calendarEvents)
      .where(and(eq(calendarEvents.id, rehearsalId), eq(calendarEvents.bandId, bandId)))
      .limit(1)

    if (!rehearsal || rehearsal.type !== 'rehearsal') return c.json({ error: 'Rehearsal not found' }, 404)

    const [created] = await db
      .insert(rehearsalTimeProposals)
      .values({
        bandId,
        rehearsalId,
        proposerUserId,
        proposedStartTime: new Date(payload.proposedStartTime),
        proposedEndTime: new Date(payload.proposedEndTime),
        comment: payload.comment ?? null,
        status: 'pending',
      })
      .returning()

    return c.json(created, 201)
  },
)

rehearsals.post(
  '/time-proposals/:proposalId/decision',
  zValidator('param', proposalParamSchema),
  zValidator('json', decisionSchema),
  async (c) => {
    const bandId = c.get('bandId')
    const deciderUserId = c.get('user').id
    const { proposalId } = c.req.valid('param')
    const payload = c.req.valid('json')

    const [proposal] = await db
      .select()
      .from(rehearsalTimeProposals)
      .where(and(eq(rehearsalTimeProposals.id, proposalId), eq(rehearsalTimeProposals.bandId, bandId)))
      .limit(1)

    if (!proposal) return c.json({ error: 'Proposal not found' }, 404)
    if (proposal.status !== 'pending') return c.json({ error: 'Proposal already decided' }, 400)

    const now = new Date()

    const [updated] = await db
      .update(rehearsalTimeProposals)
      .set({
        status: payload.decision,
        decidedByUserId: deciderUserId,
        decisionComment: payload.comment ?? null,
        updatedAt: now,
      })
      .where(eq(rehearsalTimeProposals.id, proposalId))
      .returning()

    if (payload.decision === 'accepted') {
      await db
        .update(calendarEvents)
        .set({
          startTime: proposal.proposedStartTime,
          endTime: proposal.proposedEndTime,
        })
        .where(and(eq(calendarEvents.id, proposal.rehearsalId), eq(calendarEvents.bandId, bandId)))
    }

    return c.json(updated)
  },
)
