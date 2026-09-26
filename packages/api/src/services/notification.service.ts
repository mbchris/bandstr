import { and, desc, eq, gt, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  userNotificationSettings,
  userNotifications,
  userPushDevices,
} from '../db/schema/index.js'
import { flushDueBandNotifications } from '../lib/notifications.js'

function toSettingsResponse(row: typeof userNotificationSettings.$inferSelect | undefined, userId: string) {
  return {
    userId,
    notifyAbsence: row?.notifyAbsence ?? true,
    notifyGig: row?.notifyGig ?? true,
    notifyRehearsal: row?.notifyRehearsal ?? true,
    notifySongSuggestion: row?.notifySongSuggestion ?? true,
  }
}

export type UpdateSettingsInput = {
  notifyAbsence?: boolean
  notifyGig?: boolean
  notifyRehearsal?: boolean
  notifySongSuggestion?: boolean
}

export const notificationService = {
  async getSettings(userId: string) {
    const [existing] = await db
      .select()
      .from(userNotificationSettings)
      .where(eq(userNotificationSettings.userId, userId))
      .limit(1)

    if (!existing) {
      const [created] = await db
        .insert(userNotificationSettings)
        .values({ userId })
        .onConflictDoNothing({ target: userNotificationSettings.userId })
        .returning()

      if (created) return toSettingsResponse(created, userId)

      const [insertedElsewhere] = await db
        .select()
        .from(userNotificationSettings)
        .where(eq(userNotificationSettings.userId, userId))
        .limit(1)

      return toSettingsResponse(insertedElsewhere, userId)
    }

    return toSettingsResponse(existing, userId)
  },

  async updateSettings(userId: string, data: UpdateSettingsInput) {
    const [existing] = await db
      .select()
      .from(userNotificationSettings)
      .where(eq(userNotificationSettings.userId, userId))
      .limit(1)

    if (!existing) {
      const [created] = await db
        .insert(userNotificationSettings)
        .values({
          userId,
          notifyAbsence: data.notifyAbsence ?? true,
          notifyGig: data.notifyGig ?? true,
          notifyRehearsal: data.notifyRehearsal ?? true,
          notifySongSuggestion: data.notifySongSuggestion ?? true,
        })
        .onConflictDoNothing({ target: userNotificationSettings.userId })
        .returning()

      if (created) return toSettingsResponse(created, userId)
    }

    const [updated] = await db
      .update(userNotificationSettings)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(userNotificationSettings.userId, userId))
      .returning()

    return toSettingsResponse(updated, userId)
  },

  async listNotifications(params: {
    bandId: number
    userId: string
    sinceId?: number
    limit?: number
  }) {
    const { bandId, userId, sinceId, limit = 50 } = params

    await flushDueBandNotifications(bandId).catch((error) => {
      console.error('Failed to flush due notifications', error)
    })

    const safeLimit = Math.max(1, Math.min(limit, 100))

    const rows = await db
      .select({
        id: userNotifications.id,
        bandId: userNotifications.bandId,
        userId: userNotifications.userId,
        eventType: userNotifications.eventType,
        title: userNotifications.title,
        message: userNotifications.message,
        linkPath: userNotifications.linkPath,
        linkQuery: userNotifications.linkQuery,
        isRead: userNotifications.isRead,
        createdAt: userNotifications.createdAt,
        readAt: userNotifications.readAt,
      })
      .from(userNotifications)
      .where(
        and(
          eq(userNotifications.bandId, bandId),
          eq(userNotifications.userId, userId),
          sinceId ? gt(userNotifications.id, sinceId) : undefined,
        ),
      )
      .orderBy(desc(userNotifications.id))
      .limit(safeLimit)

    const [unreadCountRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userNotifications)
      .where(
        and(
          eq(userNotifications.bandId, bandId),
          eq(userNotifications.userId, userId),
          eq(userNotifications.isRead, false),
        ),
      )

    return {
      notifications: rows,
      unreadCount: unreadCountRow?.count ?? 0,
    }
  },

  async markAsRead(bandId: number, userId: string, id: number) {
    await db
      .update(userNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(userNotifications.id, id),
          eq(userNotifications.userId, userId),
          eq(userNotifications.bandId, bandId),
        ),
      )
    return { success: true }
  },

  async markAllAsRead(bandId: number, userId: string) {
    await db
      .update(userNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(userNotifications.userId, userId),
          eq(userNotifications.bandId, bandId),
          eq(userNotifications.isRead, false),
        ),
      )
    return { success: true }
  },

  async registerDevice(params: {
    userId: string
    platform: 'android' | 'ios'
    tokenType: 'fcm' | 'apns'
    token: string
  }) {
    const { userId, platform, tokenType, token } = params

    const [device] = await db
      .insert(userPushDevices)
      .values({
        userId,
        platform,
        tokenType,
        token,
        isEnabled: true,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userPushDevices.token,
        set: {
          userId,
          platform,
          tokenType,
          isEnabled: true,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning({
        id: userPushDevices.id,
        platform: userPushDevices.platform,
        tokenType: userPushDevices.tokenType,
        isEnabled: userPushDevices.isEnabled,
      })

    return device
  },

  async unregisterDevice(userId: string, token: string) {
    const [disabled] = await db
      .update(userPushDevices)
      .set({
        isEnabled: false,
        updatedAt: new Date(),
      })
      .where(and(eq(userPushDevices.userId, userId), eq(userPushDevices.token, token)))
      .returning({ id: userPushDevices.id })

    return Boolean(disabled)
  },
}
