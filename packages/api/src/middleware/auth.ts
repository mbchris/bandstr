import type { Context, Next } from 'hono'
import { createMiddleware } from 'hono/factory'
import { auth } from '../lib/auth.js'

export type AuthUser = {
  id: string
  name: string
  email: string
  image?: string | null
}

export type AuthEnv = {
  Variables: {
    user: AuthUser
  }
}

/**
 * Require a valid session. Reads from cookie or Authorization: Bearer <token>.
 * Injects `user` into Hono context.
 */
export const requireAuth = createMiddleware<AuthEnv>(async (c: Context, next: Next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })

  if (!session?.user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  c.set('user', {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  })

  await next()
})
