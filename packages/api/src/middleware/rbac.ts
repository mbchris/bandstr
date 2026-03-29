import type { Context, Next } from 'hono'
import { createMiddleware } from 'hono/factory'
import type { TenantEnv } from './tenant.js'

type Role = 'member' | 'admin' | 'owner'

const ROLE_RANK: Record<Role, number> = {
  member: 0,
  admin: 1,
  owner: 2,
}

/**
 * Require at least the given role within the current band.
 * Must run after requireAuth + requireTenant.
 */
export const requireRole = (minRole: Role) =>
  createMiddleware<TenantEnv>(async (c: Context, next: Next) => {
    const role = c.get('bandRole') as Role
    if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
      return c.json({ error: `Forbidden: requires ${minRole} role` }, 403)
    }
    await next()
  })
