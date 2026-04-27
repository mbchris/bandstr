import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { and, desc, eq, gt, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { userNotificationSettings, userNotifications, userPushDevices } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant, type TenantEnv } from '../middleware/tenant.js'
import { flushDueBandNotifications } from '../lib/notifications.js'

export const notifications = new Hono<TenantEnv>()

const settingsUpdateSchema = z.object({
  notifyAbsence: z.boolean().optional(),
  notifyGig: z.boolean().optional(),
  notifyRehearsal: z.boolean().optional(),
  notifySongSuggestion: z.boolean().optional(),
})
const registerDeviceSchema = z.object({
  platform: z.enum(['android', 'ios']),
  tokenType: z.enum(['fcm', 'apns']),
  token: z.string().min(10),
})

const unregisterDeviceSchema = z.object({
  token: z.string().min(10),
})

function toSettingsResponse(row: typeof userNotificationSettings.$inferSelect | undefined, userId: string) {
  return {
    userId,
    notifyAbsence: row?.notifyAbsence ?? true,
    notifyGig: row?.notifyGig ?? true,
    notifyRehearsal: row?.notifyRehearsal ?? true,
    notifySongSuggestion: row?.notifySongSuggestion ?? true,
  }
}

notifications.get('/settings', requireAuth, async (c) => {
  const userId = c.get('user').id

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

    if (created) return c.json(toSettingsResponse(created, userId))

    const [insertedElsewhere] = await db
      .select()
      .from(userNotificationSettings)
      .where(eq(userNotificationSettings.userId, userId))
      .limit(1)

    return c.json(toSettingsResponse(insertedElsewhere, userId))
  }

  return c.json(toSettingsResponse(existing, userId))
})

notifications.put('/settings', requireAuth, zValidator('json', settingsUpdateSchema), async (c) => {
  const userId = c.get('user').id
  const updates = c.req.valid('json')
  const now = new Date()

  await db
    .insert(userNotificationSettings)
    .values({
      userId,
      ...updates,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userNotificationSettings.userId,
      set: {
        ...updates,
        updatedAt: now,
      },
    })

  const [row] = await db
    .select()
    .from(userNotificationSettings)
    .where(eq(userNotificationSettings.userId, userId))
    .limit(1)

  return c.json(toSettingsResponse(row, userId))
})

notifications.post('/devices/register', requireAuth, zValidator('json', registerDeviceSchema), async (c) => {
  const userId = c.get('user').id
  const payload = c.req.valid('json')
  const now = new Date()

  await db
    .insert(userPushDevices)
    .values({
      userId,
      platform: payload.platform,
      tokenType: payload.tokenType,
      token: payload.token,
      isEnabled: true,
      lastSeenAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userPushDevices.token,
      set: {
        userId,
        platform: payload.platform,
        tokenType: payload.tokenType,
        isEnabled: true,
        lastSeenAt: now,
        updatedAt: now,
      },
    })

  return c.json({ success: true })
})

notifications.post('/devices/unregister', requireAuth, zValidator('json', unregisterDeviceSchema), async (c) => {
  const userId = c.get('user').id
  const { token } = c.req.valid('json')

  await db
    .update(userPushDevices)
    .set({
      isEnabled: false,
      updatedAt: new Date(),
    })
    .where(and(eq(userPushDevices.userId, userId), eq(userPushDevices.token, token)))

  return c.json({ success: true })
})

notifications.use('*', requireAuth, requireTenant)

notifications.get('/', async (c) => {
  const userId = c.get('user').id
  const bandId = c.get('bandId')
  const sinceIdRaw = c.req.query('sinceId')
  const limitRaw = c.req.query('limit')
  const sinceId = sinceIdRaw ? Number(sinceIdRaw) : 0
  const limit = Math.max(1, Math.min(Number(limitRaw || 20), 50))

  await flushDueBandNotifications(bandId)

  const rows = await db
    .select()
    .from(userNotifications)
    .where(
      sinceId > 0
        ? and(
            eq(userNotifications.userId, userId),
            eq(userNotifications.bandId, bandId),
            gt(userNotifications.id, sinceId),
          )
        : and(eq(userNotifications.userId, userId), eq(userNotifications.bandId, bandId)),
    )
    .orderBy(desc(userNotifications.id))
    .limit(limit)

  const [unreadCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userNotifications)
    .where(
      and(
        eq(userNotifications.userId, userId),
        eq(userNotifications.bandId, bandId),
        eq(userNotifications.isRead, false),
      ),
    )

  return c.json({
    notifications: rows,
    unreadCount: unreadCountRow?.count ?? 0,
  })
})

notifications.post('/:id/read', async (c) => {
  const userId = c.get('user').id
  const bandId = c.get('bandId')
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ error: 'Invalid notification id' }, 400)

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

  return c.json({ success: true })
})

notifications.post('/read-all', async (c) => {
  const userId = c.get('user').id
  const bandId = c.get('bandId')

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

  return c.json({ success: true })
})
