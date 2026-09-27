import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth, type AuthEnv } from '../middleware/auth.js'
import { requireTenant } from '../middleware/tenant.js'
import { requireRole } from '../middleware/rbac.js'
import { bandService } from '../services/band.service.js'

export const bands = new Hono<AuthEnv>()

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

const inviteParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  inviteId: z.coerce.number().int().positive(),
})

const createBandSchema = z.object({
  name: z.string().min(1).max(100),
})

const updateBandSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  defaultRehearsalStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  defaultRehearsalEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  defaultGigStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  defaultGigEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
})

const joinBandSchema = z.object({
  code: z.string().trim().min(4).max(64),
})

// List bands the authenticated user belongs to
bands.get('/', requireAuth, async (c) => {
  const userId = c.get('user').id
  const enriched = await bandService.listBandsForUser(userId)
  return c.json(enriched)
})

// Create a new band
bands.post('/', requireAuth, zValidator('json', createBandSchema), async (c) => {
  const userId = c.get('user').id
  const { name } = c.req.valid('json')
  const result = await bandService.createBand({ userId, name })

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result.band, 201)
})

// Get band details (must be a member)
bands.get('/:id', requireAuth, zValidator('param', idParamSchema), requireTenant, async (c) => {
  const bandId = c.get('bandId')
  const band = await bandService.getBandDetails(bandId)
  if (!band) return c.json({ error: 'Not found' }, 404)
  return c.json(band)
})

// Update band (admin+)
bands.patch(
  '/:id',
  requireAuth,
  zValidator('param', idParamSchema),
  requireTenant,
  requireRole('admin'),
  zValidator('json', updateBandSchema),
  async (c) => {
    const bandId = c.get('bandId')
    const data = c.req.valid('json')
    const updated = await bandService.updateBand(bandId, data)
    if (!updated) return c.json({ error: 'Not found' }, 404)
    return c.json(updated)
  },
)

// Delete band (owner only)
bands.delete(
  '/:id',
  requireAuth,
  zValidator('param', idParamSchema),
  requireTenant,
  requireRole('owner'),
  async (c) => {
    const bandId = c.get('bandId')
    const result = await bandService.deleteBand(bandId)
    return c.json(result)
  },
)

// List band members
bands.get('/:id/members', requireAuth, zValidator('param', idParamSchema), requireTenant, async (c) => {
  const bandId = c.get('bandId')
  const members = await bandService.listMembers(bandId)
  return c.json(members)
})

// List invitation codes for the active band (admin+)
bands.get(
  '/:id/invite-codes',
  requireAuth,
  zValidator('param', idParamSchema),
  requireTenant,
  requireRole('admin'),
  async (c) => {
    const bandId = c.get('bandId')
    const inviteCodes = await bandService.listInviteCodes(bandId)
    return c.json(inviteCodes)
  },
)

// Create invitation code for active band (admin+)
bands.post(
  '/:id/invite-codes',
  requireAuth,
  zValidator('param', idParamSchema),
  requireTenant,
  requireRole('admin'),
  async (c) => {
    const bandId = c.get('bandId')
    const userId = c.get('user').id
    const invite = await bandService.createInviteCode(bandId, userId)
    if (!invite) return c.json({ error: 'Could not generate invitation code' }, 500)
    return c.json(invite, 201)
  },
)

// Invalidate invitation code (admin+)
bands.post(
  '/:id/invite-codes/:inviteId/invalidate',
  requireAuth,
  zValidator('param', inviteParamSchema),
  requireTenant,
  requireRole('admin'),
  async (c) => {
    const bandId = c.get('bandId')
    const userId = c.get('user').id
    const { inviteId } = c.req.valid('param')
    const updated = await bandService.invalidateInviteCode(bandId, inviteId, userId)
    if (!updated) {
      return c.json({ error: 'Invitation code not found, expired, or already inactive' }, 404)
    }
    return c.json(updated)
  },
)

// Join a band with a one-time invitation code
bands.post('/join', requireAuth, zValidator('json', joinBandSchema), async (c) => {
  const userId = c.get('user').id
  const { code } = c.req.valid('json')
  const result = await bandService.joinBand(userId, code)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result.band, 201)
})
