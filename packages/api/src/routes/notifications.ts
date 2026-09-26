import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant, type TenantEnv } from '../middleware/tenant.js'
import { notificationService } from '../services/notification.service.js'

export const notifications = new Hono<TenantEnv>()

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

const listQuerySchema = z.object({
  sinceId: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().positive().optional(),
})

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

notifications.get('/settings', requireAuth, async (c) => {
  const userId = c.get('user').id
  const settings = await notificationService.getSettings(userId)
  return c.json(settings)
})

notifications.put('/settings', requireAuth, zValidator('json', settingsUpdateSchema), async (c) => {
  const userId = c.get('user').id
  const updates = c.req.valid('json')
  const settings = await notificationService.updateSettings(userId, updates)
  return c.json(settings)
})

notifications.post('/devices/register', requireAuth, zValidator('json', registerDeviceSchema), async (c) => {
  const userId = c.get('user').id
  const payload = c.req.valid('json')
  await notificationService.registerDevice({
    userId,
    ...payload,
  })
  return c.json({ success: true })
})

notifications.post('/devices/unregister', requireAuth, zValidator('json', unregisterDeviceSchema), async (c) => {
  const userId = c.get('user').id
  const { token } = c.req.valid('json')
  await notificationService.unregisterDevice(userId, token)
  return c.json({ success: true })
})

notifications.use('*', requireAuth, requireTenant)

notifications.get('/', zValidator('query', listQuerySchema), async (c) => {
  const userId = c.get('user').id
  const bandId = c.get('bandId')
  const { sinceId, limit } = c.req.valid('query')

  const result = await notificationService.listNotifications({
    bandId,
    userId,
    sinceId,
    limit,
  })

  return c.json(result)
})

notifications.post('/:id/read', zValidator('param', idParamSchema), async (c) => {
  const userId = c.get('user').id
  const bandId = c.get('bandId')
  const { id } = c.req.valid('param')

  await notificationService.markAsRead(bandId, userId, id)
  return c.json({ success: true })
})

notifications.post('/read-all', async (c) => {
  const userId = c.get('user').id
  const bandId = c.get('bandId')

  await notificationService.markAllAsRead(bandId, userId)
  return c.json({ success: true })
})
