import type { Context, Next } from 'hono'
import { createMiddleware } from 'hono/factory'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { bandMembers, bands } from '../db/schema.js'
import type { AuthEnv } from './auth.js'

export type TenantEnv = AuthEnv & {
  Variables: AuthEnv['Variables'] & {
    bandId: number
    bandRole: string // 'owner' | 'admin' | 'member'
  }
}

/**
 * Extract X-Band-Id header, validate that the authenticated user
 * is a member of that band, and inject bandId + bandRole into context.
 *
 * Must run after requireAuth.
 */
export const requireTenant = createMiddleware<TenantEnv>(async (c: Context, next: Next) => {
  const rawBandId = c.req.header('X-Band-Id')
  if (!rawBandId) {
    return c.json({ error: 'Missing X-Band-Id header' }, 400)
  }

  const bandId = Number(rawBandId)
  if (!Number.isInteger(bandId) || bandId <= 0) {
    return c.json({ error: 'Invalid X-Band-Id' }, 400)
  }

  const userId = c.get('user').id

  const membership = await db
    .select({ role: bandMembers.role })
    .from(bandMembers)
    .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.userId, userId)))
    .limit(1)

  if (membership.length === 0) {
    return c.json({ error: 'Forbidden: not a member of this band' }, 403)
  }

  c.set('bandId', bandId)
  c.set('bandRole', membership[0].role)

  await next()
})
