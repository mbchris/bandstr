import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant, type TenantEnv } from '../middleware/tenant.js'
import { calendarService } from '../services/calendar.service.js'

export const calendar = new Hono<TenantEnv>()

calendar.use('*', requireAuth, requireTenant)

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

const dateInputSchema = z
  .union([
    z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid datetime string' }),
    z.number(),
  ])
  .transform((value) => new Date(value).toISOString())

const eventTypeSchema = z.enum(['rehearsal', 'gig', 'event', 'unavailability'])

const eventBodySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  startTime: dateInputSchema,
  endTime: dateInputSchema,
  type: eventTypeSchema.default('rehearsal'),
  userId: z.string().optional().nullable(),
  bierwartOverrideId: z.string().optional().nullable(),
  isTentative: z.boolean().default(false),
  gigSetlistId: z.number().int().positive().optional().nullable(),
})

const updateEventBodySchema = z.object({
  id: z.number().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  startTime: dateInputSchema.optional(),
  endTime: dateInputSchema.optional(),
  type: eventTypeSchema.optional(),
  userId: z.string().optional().nullable(),
  bierwartOverrideId: z.string().optional().nullable(),
  isTentative: z.boolean().optional(),
  gigSetlistId: z.number().int().positive().optional().nullable(),
})

// GET /calendar
calendar.get('/', async (c) => {
  const bandId = c.get('bandId')
  const events = await calendarService.listEvents(bandId)
  return c.json(events)
})

// POST /calendar
calendar.post('/', zValidator('json', eventBodySchema), async (c) => {
  const bandId = c.get('bandId')
  const actor = c.get('user')
  const body = c.req.valid('json')

  await calendarService.createEvent({
    bandId,
    actor,
    data: body,
  })

  return c.json({ success: true }, 201)
})

// PUT /calendar/:id
calendar.put(
  '/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateEventBodySchema),
  async (c) => {
    const bandId = c.get('bandId')
    const actor = c.get('user')
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')

    const updated = await calendarService.updateEvent({
      bandId,
      id,
      actor,
      data: body,
    })

    if (!updated) return c.json({ error: 'Calendar event not found' }, 404)
    return c.json({ success: true })
  },
)

// DELETE /calendar/:id
calendar.delete('/:id', zValidator('param', idParamSchema), async (c) => {
  const bandId = c.get('bandId')
  const { id } = c.req.valid('param')

  await calendarService.deleteEvent(bandId, id)
  return c.json({ success: true })
})
