import { and, asc, eq, inArray, lte } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  bandMembers,
  pendingNotifications,
  userNotificationSettings,
  userNotifications,
} from '../db/schema.js'

const NOTIFICATION_DEBOUNCE_MS = 20_000

export type NotificationEventType = 'absence' | 'gig' | 'rehearsal' | 'song_suggestion'

type QueueNotificationInput = {
  bandId: number
  actorUserId?: string | null
  eventType: NotificationEventType
  entityKey: string
  title: string
  message: string
  linkPath: string
  linkQuery?: string | null
}

type NotificationSettingsRow = {
  userId: string
  notifyAbsence: boolean
  notifyGig: boolean
  notifyRehearsal: boolean
  notifySongSuggestion: boolean
  createdAt: Date
  updatedAt: Date
}

function settingKeyForEvent(eventType: NotificationEventType): keyof Pick<
  NotificationSettingsRow,
  'notifyAbsence' | 'notifyGig' | 'notifyRehearsal' | 'notifySongSuggestion'
> {
  if (eventType === 'absence') return 'notifyAbsence'
  if (eventType === 'gig') return 'notifyGig'
  if (eventType === 'rehearsal') return 'notifyRehearsal'
  return 'notifySongSuggestion'
}

async function ensureSettingsRows(userIds: string[]) {
  if (userIds.length === 0) return
  await db
    .insert(userNotificationSettings)
    .values(userIds.map((userId) => ({ userId })))
    .onConflictDoNothing({ target: userNotificationSettings.userId })
}

export async function queueBandNotification(input: QueueNotificationInput) {
  const now = new Date()
  const dueAt = new Date(now.getTime() + NOTIFICATION_DEBOUNCE_MS)

  await db
    .insert(pendingNotifications)
    .values({
      bandId: input.bandId,
      eventType: input.eventType,
      entityKey: input.entityKey,
      actorUserId: input.actorUserId ?? null,
      title: input.title,
      message: input.message,
      linkPath: input.linkPath,
      linkQuery: input.linkQuery ?? null,
      dueAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [pendingNotifications.bandId, pendingNotifications.eventType, pendingNotifications.entityKey],
      set: {
        actorUserId: input.actorUserId ?? null,
        title: input.title,
        message: input.message,
        linkPath: input.linkPath,
        linkQuery: input.linkQuery ?? null,
        dueAt,
        updatedAt: now,
      },
    })
}

export async function flushDueBandNotifications(bandId: number) {
  const now = new Date()
  const dueRows = await db
    .select()
    .from(pendingNotifications)
    .where(and(eq(pendingNotifications.bandId, bandId), lte(pendingNotifications.dueAt, now)))
    .orderBy(asc(pendingNotifications.id))

  if (dueRows.length === 0) return

  const members = await db
    .select({ userId: bandMembers.userId })
    .from(bandMembers)
    .where(eq(bandMembers.bandId, bandId))

  const memberUserIds = Array.from(new Set(members.map((entry) => entry.userId)))
  if (memberUserIds.length === 0) {
    await db.delete(pendingNotifications).where(inArray(pendingNotifications.id, dueRows.map((row) => row.id)))
    return
  }

  await ensureSettingsRows(memberUserIds)

  const settingsRows = await db
    .select()
    .from(userNotificationSettings)
    .where(inArray(userNotificationSettings.userId, memberUserIds))

  const settingsByUserId = new Map(settingsRows.map((row) => [row.userId, row]))
  const notificationsToInsert: Array<{
    bandId: number
    userId: string
    eventType: string
    title: string
    message: string
    linkPath: string
    linkQuery: string | null
  }> = []

  for (const pending of dueRows) {
    const settingKey = settingKeyForEvent(pending.eventType as NotificationEventType)
    for (const userId of memberUserIds) {
      if (pending.actorUserId && pending.actorUserId === userId) continue
      const settings = settingsByUserId.get(userId)
      const isEnabled = settings ? Boolean(settings[settingKey]) : true
      if (!isEnabled) continue

      notificationsToInsert.push({
        bandId: pending.bandId,
        userId,
        eventType: pending.eventType,
        title: pending.title,
        message: pending.message,
        linkPath: pending.linkPath,
        linkQuery: pending.linkQuery ?? null,
      })
    }
  }

  if (notificationsToInsert.length > 0) {
    await db.insert(userNotifications).values(notificationsToInsert)
  }

  await db.delete(pendingNotifications).where(inArray(pendingNotifications.id, dueRows.map((row) => row.id)))
}
