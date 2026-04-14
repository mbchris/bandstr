import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, gte, lte } from 'drizzle-orm'
import { db } from '../db/index.js'
import { calendarEvents, rehearsalSongs, songs, users, bandMembers, rehearsalAttendance } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant, type TenantEnv } from '../middleware/tenant.js'

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
        eq(calendarEvents.type, 'rehearsal'),
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

  return c.json({
    nextRehearsal: {
      ...nextRehearsal,
      songs: rehearsalSongData,
      unavailabilities,
      myAttendance: attendance?.status ?? null,
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
    await db.insert(calendarEvents).values({
      bandId,
      title: `Absence: ${rehearsal.title}`,
      description: absenceMarker,
      startTime: dayStart,
      endTime: dayEnd,
      type: 'unavailability',
      userId,
      isTentative: false,
    })
  }

  return c.json({ success: true })
})
