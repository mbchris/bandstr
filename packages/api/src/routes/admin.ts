import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant, type TenantEnv } from '../middleware/tenant.js'
import { requireRole } from '../middleware/rbac.js'
import { db, pool } from '../db/index.js'
import { bands, bandMembers, songs, votes, calendarEvents } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { bandHasProPlan } from '../lib/entitlements.js'

export const admin = new Hono<TenantEnv>()

admin.use('*', requireAuth, requireTenant, requireRole('admin'))

async function ensureProBandOrThrow(bandId: number) {
  const [band] = await db.select({ id: bands.id }).from(bands).where(eq(bands.id, bandId)).limit(1)
  if (!band) return { ok: false as const, status: 404, message: 'Band not found' }
  const hasProPlan = await bandHasProPlan(bandId)
  if (!hasProPlan) {
    return {
      ok: false as const,
      status: 403,
      message: 'Import/export features are available on pro plans only.',
    }
  }
  return { ok: true as const }
}

// GET /admin/status
admin.get('/status', async (c) => {
  return c.json({
    ok: true,
    database: 'postgresql',
    env: {
      googleOAuth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      githubOAuth: !!(process.env.GHUB_CLIENT_ID && process.env.GHUB_CLIENT_SECRET),
      stripe: !!process.env.STRIPE_SECRET_KEY,
    },
  })
})

// GET /admin/db/export — export band data as JSON
admin.get('/db/export', async (c) => {
  const bandId = c.get('bandId')
  const entitlement = await ensureProBandOrThrow(bandId)
  if (!entitlement.ok) return c.json({ error: entitlement.message }, entitlement.status as 403 | 404)

  const [bandData, members, songsData, votesData, events] = await Promise.all([
    db.select().from(bands).where(eq(bands.id, bandId)).limit(1),
    db.select().from(bandMembers).where(eq(bandMembers.bandId, bandId)),
    db.select().from(songs).where(eq(songs.bandId, bandId)),
    db.select().from(votes).where(eq(votes.bandId, bandId)),
    db.select().from(calendarEvents).where(eq(calendarEvents.bandId, bandId)),
  ])

  c.header('Content-Type', 'application/json; charset=utf-8')
  c.header('Content-Disposition', 'attachment; filename="bandstr-backup.json"')

  return c.json({
    exportedAt: new Date().toISOString(),
    band: bandData[0],
    members,
    songs: songsData,
    votes: votesData,
    calendarEvents: events,
  })
})

const updateLogoSchema = z.object({
  logoDataUrl: z.string().min(1),
})

const MAX_LOGO_BYTES = 150 * 1024

function getDataUrlBytes(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex === -1) return 0
  const base64 = dataUrl.slice(commaIndex + 1)
  const padding = (base64.match(/=+$/)?.[0].length ?? 0)
  return Math.floor((base64.length * 3) / 4) - padding
}

// GET /admin/logo
admin.get('/logo', async (c) => {
  const bandId = c.get('bandId')
  const [band] = await db.select({ logo: bands.logo }).from(bands).where(eq(bands.id, bandId)).limit(1)
  return c.json({ logo: band?.logo ?? null })
})

// PUT /admin/logo
admin.put('/logo', zValidator('json', updateLogoSchema), async (c) => {
  const bandId = c.get('bandId')
  const { logoDataUrl } = c.req.valid('json')

  if (!logoDataUrl.startsWith('data:image/webp;base64,')) {
    return c.json({ error: 'Logo must be a WEBP data URL' }, 400)
  }

  const bytes = getDataUrlBytes(logoDataUrl)
  if (bytes > MAX_LOGO_BYTES) {
    return c.json({ error: 'Logo exceeds 150KB limit' }, 400)
  }

  const [updated] = await db
    .update(bands)
    .set({ logo: logoDataUrl })
    .where(eq(bands.id, bandId))
    .returning({ logo: bands.logo })

  return c.json({ logo: updated?.logo ?? null })
})

// DELETE /admin/logo
admin.delete('/logo', async (c) => {
  const bandId = c.get('bandId')
  await db.update(bands).set({ logo: null }).where(eq(bands.id, bandId))
  return c.json({ ok: true })
})

// GET /admin/calendar/export — export only calendar events as JSON
admin.get('/calendar/export', async (c) => {
  const bandId = c.get('bandId')
  const entitlement = await ensureProBandOrThrow(bandId)
  if (!entitlement.ok) return c.json({ error: entitlement.message }, entitlement.status as 403 | 404)
  const events = await db.select().from(calendarEvents).where(eq(calendarEvents.bandId, bandId))

  c.header('Content-Type', 'application/json; charset=utf-8')
  c.header('Content-Disposition', 'attachment; filename="calendar_export.json"')

  return c.json(events)
})

// POST /admin/db/import — execute SQL dump content
admin.post('/db/import', async (c) => {
  const bandId = c.get('bandId')
  const entitlement = await ensureProBandOrThrow(bandId)
  if (!entitlement.ok) return c.json({ error: entitlement.message }, entitlement.status as 403 | 404)

  const form = await c.req.formData().catch(() => null)
  const uploaded = form?.get('file')
  if (!(uploaded instanceof File)) {
    return c.json({ error: 'No SQL file uploaded' }, 400)
  }

  const filename = uploaded.name.toLowerCase()
  if (!filename.endsWith('.sql')) {
    return c.json({ error: 'Only .sql imports are supported' }, 400)
  }

  const sqlText = await uploaded.text()
  if (!sqlText.trim()) {
    return c.json({ error: 'SQL file is empty' }, 400)
  }

  try {
    await pool.query(sqlText)
    return c.json({ ok: true })
  } catch (error) {
    console.error('[admin.db.import] failed', error)
    return c.json({ error: 'SQL import failed' }, 400)
  }
})
