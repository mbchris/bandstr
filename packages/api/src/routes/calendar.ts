import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { calendarEvents, users } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant, type TenantEnv } from '../middleware/tenant.js'
import { queueBandNotification } from '../lib/notifications.js'

export const calendar = new Hono<TenantEnv>()

calendar.use('*', requireAuth, requireTenant)

// GET /calendar
calendar.get('/', async (c) => {
  const bandId = c.get('bandId')

  const events = await db
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

  return c.json(events)
})

const dateInputSchema = z.union([z.string().datetime(), z.number()]).transform((value) =>
  typeof value === 'number' ? new Date(value).toISOString() : value,
)

const eventBodySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startTime: dateInputSchema,
  endTime: dateInputSchema,
  type: z.enum(['rehearsal', 'gig', 'event', 'unavailability']).default('rehearsal'),
  userId: z.string().optional().nullable(),
  bierwartOverrideId: z.string().optional().nullable(),
  isTentative: z.boolean().default(false),
})

// POST /calendar
calendar.post('/', zValidator('json', eventBodySchema), async (c) => {
  const bandId = c.get('bandId')
  const actor = c.get('user')
  const body = c.req.valid('json')

  const [created] = await db
    .insert(calendarEvents)
    .values({
      bandId,
      title: body.title,
      description: body.description ?? null,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
      type: body.type,
      userId: body.userId ?? null,
      bierwartOverrideId: body.bierwartOverrideId ?? null,
      isTentative: body.isTentative,
    })
    .returning()

  if (body.type === 'gig') {
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
  } else if (body.type === 'rehearsal') {
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

  return c.json({ success: true }, 201)
})

// PUT /calendar/:id
calendar.put(
  '/:id',
  zValidator('json', eventBodySchema.partial().extend({ id: z.number().optional() })),
  async (c) => {
    const bandId = c.get('bandId')
    const actor = c.get('user')
    const id = Number(c.req.param('id'))
    const body = c.req.valid('json')

    if (!Number.isFinite(id) || id <= 0) {
      return c.json({ error: 'Invalid calendar id' }, 400)
    }

    const updates: Record<string, unknown> = {}
    if (body.title) updates.title = body.title
    if (body.description !== undefined) updates.description = body.description
    if (body.startTime) updates.startTime = new Date(body.startTime)
    if (body.endTime) updates.endTime = new Date(body.endTime)
    if (body.type) updates.type = body.type
    if (body.userId !== undefined) updates.userId = body.userId
    if (body.bierwartOverrideId !== undefined) updates.bierwartOverrideId = body.bierwartOverrideId
    if (body.isTentative !== undefined) updates.isTentative = body.isTentative

    const [existing] = await db
      .select({
        id: calendarEvents.id,
        title: calendarEvents.title,
        type: calendarEvents.type,
      })
      .from(calendarEvents)
      .where(and(eq(calendarEvents.id, id), eq(calendarEvents.bandId, bandId)))
      .limit(1)

    if (!existing) return c.json({ error: 'Calendar event not found' }, 404)

    const [updated] = await db
      .update(calendarEvents)
      .set(updates)
      .where(and(eq(calendarEvents.id, id), eq(calendarEvents.bandId, bandId)))
      .returning({
        id: calendarEvents.id,
        title: calendarEvents.title,
        type: calendarEvents.type,
      })

    const eventType = updated?.type ?? existing.type
    const eventTitle = updated?.title ?? existing.title
    if (eventType === 'gig') {
      await queueBandNotification({
        bandId,
        actorUserId: actor.id,
        eventType: 'gig',
        entityKey: `calendar:${id}`,
        title: 'Gig updated',
        message: `${actor.name} added/updated "${eventTitle}".`,
        linkPath: '/calendar',
        linkQuery: `eventId=${id}`,
      })
    } else if (eventType === 'rehearsal') {
      await queueBandNotification({
        bandId,
        actorUserId: actor.id,
        eventType: 'rehearsal',
        entityKey: `calendar:${id}`,
        title: 'Rehearsal updated',
        message: `${actor.name} added/updated "${eventTitle}".`,
        linkPath: '/',
        linkQuery: '',
      })
    }

    return c.json({ success: true })
  },
)

// DELETE /calendar/:id
calendar.delete('/:id', async (c) => {
  const bandId = c.get('bandId')
  const id = Number(c.req.param('id'))

  await db
    .delete(calendarEvents)
    .where(and(eq(calendarEvents.id, id), eq(calendarEvents.bandId, bandId)))

  return c.json({ success: true })
})
