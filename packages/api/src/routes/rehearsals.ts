import { Hono } from 'hono'
import { eq, and, gte, lte } from 'drizzle-orm'
import { db } from '../db/index.js'
import { calendarEvents, rehearsalSongs, songs, users, bandMembers } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant, type TenantEnv } from '../middleware/tenant.js'

export const rehearsals = new Hono<TenantEnv>()

rehearsals.use('*', requireAuth, requireTenant)

// GET /rehearsals/next
rehearsals.get('/next', async (c) => {
  const bandId = c.get('bandId')
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

  return c.json({
    nextRehearsal: { ...nextRehearsal, songs: rehearsalSongData, unavailabilities },
    upcomingGigs,
  })
})
