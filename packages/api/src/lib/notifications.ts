import { and, asc, eq, inArray, lte } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  bandMembers,
  pendingNotifications,
  userPushDevices,
  userNotificationSettings,
  userNotifications,
} from '../db/schema.js'
import { sendPushToDevice } from './push-delivery.js'

const NOTIFICATION_DEBOUNCE_MS = 20_000
const bandFlushTimers = new Map<number, ReturnType<typeof setTimeout>>()

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

  const existingTimer = bandFlushTimers.get(input.bandId)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }
  const timer = setTimeout(() => {
    void flushDueBandNotifications(input.bandId).finally(() => {
      bandFlushTimers.delete(input.bandId)
    })
  }, NOTIFICATION_DEBOUNCE_MS + 500)
  bandFlushTimers.set(input.bandId, timer)
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
    const insertedNotifications = await db
      .insert(userNotifications)
      .values(notificationsToInsert)
      .returning({
        id: userNotifications.id,
        bandId: userNotifications.bandId,
        userId: userNotifications.userId,
        title: userNotifications.title,
        message: userNotifications.message,
        linkPath: userNotifications.linkPath,
        linkQuery: userNotifications.linkQuery,
      })

    const recipientUserIds = Array.from(new Set(insertedNotifications.map((item) => item.userId)))
    const pushDevices = await db
      .select({
        userId: userPushDevices.userId,
        tokenType: userPushDevices.tokenType,
        token: userPushDevices.token,
      })
      .from(userPushDevices)
      .where(and(inArray(userPushDevices.userId, recipientUserIds), eq(userPushDevices.isEnabled, true)))

    const devicesByUserId = new Map<string, Array<{ tokenType: string; token: string }>>()
    for (const device of pushDevices) {
      const list = devicesByUserId.get(device.userId) ?? []
      list.push({ tokenType: device.tokenType, token: device.token })
      devicesByUserId.set(device.userId, list)
    }

    await Promise.all(
      insertedNotifications.map(async (notification) => {
        const devices = devicesByUserId.get(notification.userId) ?? []
        if (devices.length === 0) return
        await Promise.all(
          devices.map(async (device) => {
            const tokenType =
              device.tokenType === 'apns'
                ? 'apns'
                : device.tokenType === 'web_push'
                  ? 'web_push'
                  : 'fcm'
            await sendPushToDevice({
              tokenType,
              token: device.token,
              title: notification.title,
              body: notification.message,
              path: notification.linkPath,
              query: notification.linkQuery ?? '',
              context: {
                bandId: notification.bandId,
                userId: notification.userId,
                notificationId: notification.id,
              },
            })
          }),
        )
      }),
    )
  }

  await db.delete(pendingNotifications).where(inArray(pendingNotifications.id, dueRows.map((row) => row.id)))
}
