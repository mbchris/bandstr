import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, asc, gte, lte, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { calendarEvents, rehearsalSongs, songs, users, bandMembers, rehearsalAttendance, rehearsalTimeProposals } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant, type TenantEnv } from '../middleware/tenant.js'
import { queueBandNotification } from '../lib/notifications.js'

export const rehearsals = new Hono<TenantEnv>()
const ATTENDANCE_ABSENCE_MARKER_PREFIX = '[bandstr:rehearsal-absence]'

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
    .select()
    .from(calendarEvents)
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

  // Unavailabilities from non-hidden members for that day
  const unavailabilities = await db
    .select({
      id: calendarEvents.id,
      title: calendarEvents.title,
      userId: calendarEvents.userId,
      userName: users.name,
    })
    .from(calendarEvents)
    .innerJoin(users, eq(calendarEvents.userId, users.id))
    .innerJoin(
      bandMembers,
      and(eq(bandMembers.userId, users.id), eq(bandMembers.bandId, bandId)),
    )
    .where(
      and(
        eq(calendarEvents.type, 'unavailability'),
        eq(calendarEvents.bandId, bandId),
        eq(bandMembers.isHidden, false),
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
      songs: rehearsalSongData,
      unavailabilities,
      myAttendance: attendance?.status ?? null,
      memberAttendance,
    },
    upcomingGigs,
  })
})

const attendanceSchema = z.object({
  status: z.enum(['present', 'absent', 'reset']),
})

// PUT /rehearsals/:id/attendance
rehearsals.put('/:id/attendance', zValidator('json', attendanceSchema), async (c) => {
  const bandId = c.get('bandId')
  const userId = c.get('user').id
  const userName = c.get('user').name
  const rehearsalId = Number(c.req.param('id'))
  if (!Number.isFinite(rehearsalId) || rehearsalId <= 0) return c.json({ error: 'Invalid rehearsal id' }, 400)
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
    const [absenceEvent] = await db.insert(calendarEvents).values({
      bandId,
      title: `Absence: ${rehearsal.title}`,
      description: absenceMarker,
      startTime: dayStart,
      endTime: dayEnd,
      type: 'unavailability',
      userId,
      isTentative: false,
    }).returning({ id: calendarEvents.id })

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
})

const createProposalSchema = z.object({
  proposedStartTime: z.string().datetime(),
  proposedEndTime: z.string().datetime(),
  comment: z.string().max(5000).optional(),
})

const decisionSchema = z.object({
  decision: z.enum(['accepted', 'rejected']),
  comment: z.string().max(5000).optional(),
})

rehearsals.get('/:id/time-proposals', async (c) => {
  const bandId = c.get('bandId')
  const rehearsalId = Number(c.req.param('id'))
  if (!Number.isFinite(rehearsalId) || rehearsalId <= 0) return c.json({ error: 'Invalid rehearsal id' }, 400)

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

rehearsals.post('/:id/time-proposals', zValidator('json', createProposalSchema), async (c) => {
  const bandId = c.get('bandId')
  const proposerUserId = c.get('user').id
  const rehearsalId = Number(c.req.param('id'))
  if (!Number.isFinite(rehearsalId) || rehearsalId <= 0) return c.json({ error: 'Invalid rehearsal id' }, 400)
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
})

rehearsals.post('/time-proposals/:proposalId/decision', zValidator('json', decisionSchema), async (c) => {
  const bandId = c.get('bandId')
  const deciderUserId = c.get('user').id
  const proposalId = Number(c.req.param('proposalId'))
  if (!Number.isFinite(proposalId) || proposalId <= 0) return c.json({ error: 'Invalid proposal id' }, 400)
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
})
