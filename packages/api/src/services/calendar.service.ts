import { and, eq, gte, lte } from 'drizzle-orm'
import { db } from '../db/index.js'
import { calendarEvents, rehearsalAttendance, users } from '../db/schema/index.js'
import { queueBandNotification } from '../lib/notifications.js'

export async function syncAbsenceAttendance(params: {
  bandId: number
  userId: string | null
  startTime: Date
  endTime: Date
}) {
  if (!params.userId) return

  const rehearsals = await db
    .select({ id: calendarEvents.id })
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.bandId, params.bandId),
        eq(calendarEvents.type, 'rehearsal'),
        gte(calendarEvents.startTime, params.startTime),
        lte(calendarEvents.endTime, params.endTime),
      ),
    )

  if (rehearsals.length === 0) return

  for (const rehearsal of rehearsals) {
    const existing = await db
      .select({ id: rehearsalAttendance.id })
      .from(rehearsalAttendance)
      .where(
        and(
          eq(rehearsalAttendance.bandId, params.bandId),
          eq(rehearsalAttendance.rehearsalId, rehearsal.id),
          eq(rehearsalAttendance.userId, params.userId),
        ),
      )
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(rehearsalAttendance)
        .set({ status: 'absent', updatedAt: new Date() })
        .where(eq(rehearsalAttendance.id, existing[0].id))
    } else {
      await db.insert(rehearsalAttendance).values({
        bandId: params.bandId,
        rehearsalId: rehearsal.id,
        userId: params.userId,
        status: 'absent',
      })
    }
  }
}

export type CreateCalendarEventInput = {
  title: string
  description?: string | null
  startTime: string
  endTime: string
  type: 'rehearsal' | 'gig' | 'event' | 'unavailability'
  userId?: string | null
  bierwartOverrideId?: string | null
  isTentative?: boolean
}

export type UpdateCalendarEventInput = Partial<CreateCalendarEventInput> & { id?: number }

export const calendarService = {
  async listEvents(bandId: number) {
    return db
      .select({
        id: calendarEvents.id,
        title: calendarEvents.title,
        description: calendarEvents.description,
        startTime: calendarEvents.startTime,
        endTime: calendarEvents.endTime,
        type: calendarEvents.type,
        userId: calendarEvents.userId,
        bierwartOverrideId: calendarEvents.bierwartOverrideId,
        isTentative: calendarEvents.isTentative,
        ownerName: users.name,
      })
      .from(calendarEvents)
      .leftJoin(users, eq(calendarEvents.userId, users.id))
      .where(eq(calendarEvents.bandId, bandId))
  },

  async getEvent(bandId: number, id: number) {
    const [event] = await db
      .select({
        id: calendarEvents.id,
        title: calendarEvents.title,
        description: calendarEvents.description,
        startTime: calendarEvents.startTime,
        endTime: calendarEvents.endTime,
        type: calendarEvents.type,
        userId: calendarEvents.userId,
        bierwartOverrideId: calendarEvents.bierwartOverrideId,
        isTentative: calendarEvents.isTentative,
        ownerName: users.name,
      })
      .from(calendarEvents)
      .leftJoin(users, eq(calendarEvents.userId, users.id))
      .where(and(eq(calendarEvents.id, id), eq(calendarEvents.bandId, bandId)))
      .limit(1)

    return event ?? null
  },

  async createEvent(params: {
    bandId: number
    actor: { id: string; name: string }
    data: CreateCalendarEventInput
  }) {
    const { bandId, actor, data } = params
    const startTime = new Date(data.startTime)
    const endTime = new Date(data.endTime)
    const userId = data.userId ?? (data.type === 'unavailability' ? actor.id : null)

    const [created] = await db
      .insert(calendarEvents)
      .values({
        bandId,
        title: data.title,
        description: data.description,
        startTime,
        endTime,
        type: data.type,
        userId,
        bierwartOverrideId: data.bierwartOverrideId,
        isTentative: data.isTentative ?? false,
      })
      .returning()

    if (data.type === 'unavailability') {
      await syncAbsenceAttendance({ bandId, userId, startTime, endTime })
    }

    if (data.type === 'gig') {
      await queueBandNotification({
        bandId,
        actorUserId: actor.id,
        eventType: 'gig',
        entityKey: `calendar:${created.id}`,
        title: 'Gig updated',
        message: `${actor.name} added/updated "${created.title}".`,
        linkPath: '/calendar',
        linkQuery: `eventId=${created.id}`,
      })
    } else if (data.type === 'rehearsal') {
      await queueBandNotification({
        bandId,
        actorUserId: actor.id,
        eventType: 'rehearsal',
        entityKey: `calendar:${created.id}`,
        title: 'Rehearsal updated',
        message: `${actor.name} added/updated "${created.title}".`,
        linkPath: '/',
        linkQuery: '',
      })
    }

    return created
  },

  async updateEvent(params: {
    bandId: number
    id: number
    actor: { id: string; name: string }
    data: UpdateCalendarEventInput
  }) {
    const { bandId, id, actor, data } = params

    const [existing] = await db
      .select()
      .from(calendarEvents)
      .where(and(eq(calendarEvents.id, id), eq(calendarEvents.bandId, bandId)))
      .limit(1)

    if (!existing) return null

    const startTime = data.startTime ? new Date(data.startTime) : existing.startTime
    const endTime = data.endTime ? new Date(data.endTime) : existing.endTime
    const eventType = data.type ?? existing.type
    const nextUserId =
      data.userId !== undefined
        ? data.userId
        : eventType === 'unavailability' && !existing.userId
          ? actor.id
          : existing.userId

    const [updated] = await db
      .update(calendarEvents)
      .set({
        title: data.title ?? existing.title,
        description: data.description !== undefined ? data.description : existing.description,
        startTime,
        endTime,
        type: eventType,
        userId: nextUserId,
        bierwartOverrideId:
          data.bierwartOverrideId !== undefined ? data.bierwartOverrideId : existing.bierwartOverrideId,
        isTentative: data.isTentative !== undefined ? data.isTentative : existing.isTentative,
      })
      .where(and(eq(calendarEvents.id, id), eq(calendarEvents.bandId, bandId)))
      .returning()

    if (eventType === 'unavailability') {
      await syncAbsenceAttendance({ bandId, userId: nextUserId, startTime, endTime })
    }

    return updated
  },

  async deleteEvent(bandId: number, id: number) {
    const [existing] = await db
      .select({ id: calendarEvents.id })
      .from(calendarEvents)
      .where(and(eq(calendarEvents.id, id), eq(calendarEvents.bandId, bandId)))
      .limit(1)

    if (!existing) return null

    await db.delete(calendarEvents).where(and(eq(calendarEvents.id, id), eq(calendarEvents.bandId, bandId)))
    return { success: true }
  },
}
