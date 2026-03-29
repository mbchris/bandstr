import { Hono } from 'hono'
import { auth as betterAuth } from '../lib/auth.js'

// Better Auth handles all /api/auth/* requests
export const auth = new Hono().on(['POST', 'GET'], '/*', (c) => {
  return betterAuth.handler(c.req.raw)
})
