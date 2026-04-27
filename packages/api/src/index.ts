import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { auth, AUTH_BASE_PATH, authBaseUrl } from './lib/auth.js'
import { bands } from './routes/bands.js'
import { songs } from './routes/songs.js'
import { votes } from './routes/votes.js'
import { calendar } from './routes/calendar.js'
import { gigs } from './routes/gigs.js'
import { rehearsals } from './routes/rehearsals.js'
import { usersRouter as users } from './routes/users.js'
import { account } from './routes/account.js'
import { admin } from './routes/admin.js'
import { billing } from './routes/billing.js'
import { spotify } from './routes/spotify.js'
import { support } from './routes/support.js'
import { notifications } from './routes/notifications.js'
import { runMigrations } from './db/migrate.js'
import { db } from './db/index.js'
import { sessions } from './db/schema.js'
import { eq } from 'drizzle-orm'
import { readFileSync } from 'node:fs'
import { resolveBuildIdFromEnvironment } from './lib/build-id.js'

const app = new Hono()
type AuthRequest = Parameters<typeof auth.handler>[0]
type RequestLike = {
  url: string
  method: string
  headers: RequestInit['headers']
  body: RequestInit['body'] | null
}

const MOBILE_LOCAL_ORIGINS = ['capacitor://localhost', 'http://localhost', 'https://localhost']
const SUPPORTED_SOCIAL_PROVIDERS = new Set(['google', 'github'])

function getAllowedOrigins(): string[] {
  const configured = (process.env.CORS_ORIGINS ?? 'http://localhost:9000')
    .split(/[;,]/)
    .map((o) => o.trim())
    .filter(Boolean)

  return Array.from(new Set([...configured, ...MOBILE_LOCAL_ORIGINS]))
}

function cloneRequestWithPath(req: RequestLike, pathname: string): AuthRequest {
  const url = new URL(req.url)
  url.pathname = pathname
  const init: RequestInit & { duplex?: 'half' } = {
    method: req.method,
    headers: req.headers,
  }
  if (req.body !== null) {
    init.body = req.body
    init.duplex = 'half'
  }
  return new Request(url.toString(), init) as AuthRequest
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Global middleware
app.use('*', logger())
app.use(
  '*',
  cors({
    origin: (origin) => {
      const allowed = getAllowedOrigins()
      return allowed.includes(origin) ? origin : allowed[0]
    },
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization', 'X-Band-Id', 'X-Client-Build-Id', 'X-Client-Environment'],
  }),
)

function resolveVersion(): string {
  const envVersion = resolveBuildIdFromEnvironment()
  if (envVersion) {
    return envVersion
  }

  try {
    const fileVersion = readFileSync(new URL('./build-rev.txt', import.meta.url), 'utf8').trim()
    if (fileVersion) return fileVersion
  } catch {
    // Fall back to default if file is missing.
  }

  return 'dev'
}

// Health check
app.get('/health', (c) => c.json({ ok: true, version: resolveVersion() }))

// Native OAuth bootstrap:
// Start social sign-in from the system browser context so Better Auth state cookies
// are created and consumed in the same context (avoids state_mismatch).
app.get('/api/mobile-auth/start', (c) => {
  const provider = (c.req.query('provider') ?? '').trim().toLowerCase()
  if (!SUPPORTED_SOCIAL_PROVIDERS.has(provider)) {
    return c.text('Unsupported provider', 400)
  }

  const callbackURL = (c.req.query('callbackURL') ?? '').trim()
  if (!callbackURL) {
    return c.text('Missing callbackURL', 400)
  }

  const rawErrorCallbackURL = (c.req.query('errorCallbackURL') ?? '').trim()
  // Better Auth rejects non-HTTP(S) errorCallbackURLs (e.g. custom schemes like
  // org.capacitor.bandstr://). Use a server-side error bridge that redirects to the app.
  const errorBridgeURL = rawErrorCallbackURL
    ? `${authBaseUrl}/api/mobile-auth/error?appErrorURL=${encodeURIComponent(rawErrorCallbackURL)}`
    : callbackURL
  const formAction = `${authCanonical}/sign-in/social`

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>bandstr login</title>
  </head>
  <body>
    <noscript>JavaScript is required to continue login.</noscript>
    <script>
      (async () => {
        try {
          const res = await fetch(${JSON.stringify(formAction)}, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              provider: ${JSON.stringify(provider)},
              callbackURL: ${JSON.stringify(callbackURL)},
              errorCallbackURL: ${JSON.stringify(errorBridgeURL)},
              disableRedirect: true
            })
          });

          const payload = await res.json().catch(() => ({}));
          if (!res.ok || !payload || !payload.url) {
            throw new Error(payload?.message || 'Unable to start social login');
          }

          window.location.href = String(payload.url);
        } catch (err) {
          const target = ${JSON.stringify(rawErrorCallbackURL || callbackURL)};
          const msg = err instanceof Error ? err.message : String(err);
          window.location.href = target + (target.includes('?') ? '&' : '?') + 'error=' + encodeURIComponent(msg);
        }
      })();
    </script>
  </body>
</html>`

  return c.html(html)
})

// Serve an HTML page that redirects to a custom-scheme URL.
// HTTP 302 redirects to custom schemes are unreliable on mobile browsers (especially
// Firefox on Android). JS redirect + meta refresh + clickable link covers all cases.
function deepLinkRedirectPage(target: string, label: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta http-equiv="refresh" content="1;url=${escapeHtml(target)}" />
    <title>Returning to bandstr…</title>
  </head>
  <body>
    <p>Returning to the app…</p>
    <p><a href="${escapeHtml(target)}">Tap here if you are not redirected</a></p>
    <script>window.location.href = ${JSON.stringify(target)};</script>
  </body>
</html>`
}

// Native OAuth completion bridge:
// Better Auth callback lands here first (same browser context where auth cookie exists).
// We exchange session cookie -> bearer token and deep-link into the app with the token.
app.get('/api/mobile-auth/complete', async (c) => {
  const appCallbackURL = (c.req.query('appCallbackURL') ?? '').trim()
  if (!appCallbackURL) {
    return c.text('Missing appCallbackURL', 400)
  }

  try {
    const current = await auth.api.getSession({ headers: c.req.raw.headers })
    const sessionId = current?.session?.id
    if (!sessionId) {
      const target =
        `${appCallbackURL}${appCallbackURL.includes('?') ? '&' : '?'}error=missing_session` +
        '&mobileAuth=missing_session'
      console.warn('[mobile-auth/complete] missing session, redirecting to app callback')
      return c.html(deepLinkRedirectPage(target, 'missing_session'))
    }

    const row = await db.select({ token: sessions.token }).from(sessions).where(eq(sessions.id, sessionId)).limit(1)
    const token = row[0]?.token

    if (!token) {
      const target =
        `${appCallbackURL}${appCallbackURL.includes('?') ? '&' : '?'}error=missing_token` +
        '&mobileAuth=missing_token'
      console.warn('[mobile-auth/complete] missing token row for session, redirecting to app callback')
      return c.html(deepLinkRedirectPage(target, 'missing_token'))
    }

    const target =
      `${appCallbackURL}${appCallbackURL.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` +
      '&mobileAuth=ok'
    console.log('[mobile-auth/complete] token issued, redirecting to app callback')
    return c.html(deepLinkRedirectPage(target, 'token_issued'))
  } catch {
    const target =
      `${appCallbackURL}${appCallbackURL.includes('?') ? '&' : '?'}error=token_exchange_failed` +
      '&mobileAuth=token_exchange_failed'
    console.error('[mobile-auth/complete] token exchange failed, redirecting with error')
    return c.html(deepLinkRedirectPage(target, 'token_exchange_failed'))
  }
})

// Native OAuth error bridge:
// Better Auth redirects here on error (it requires an HTTPS errorCallbackURL).
// We forward the error to the native app via its custom-scheme URL.
app.get('/api/mobile-auth/error', (c) => {
  const appErrorURL = (c.req.query('appErrorURL') ?? '').trim()
  if (!appErrorURL) {
    return c.text('Missing appErrorURL', 400)
  }

  const url = new URL(c.req.url)
  // Forward all query params except appErrorURL to the app callback
  const params = new URLSearchParams()
  for (const [key, value] of url.searchParams.entries()) {
    if (key !== 'appErrorURL') {
      params.set(key, value)
    }
  }
  const qs = params.toString()
  const separator = appErrorURL.includes('?') ? '&' : '?'
  const target = qs ? `${appErrorURL}${separator}${qs}` : appErrorURL

  console.warn('[mobile-auth/error] redirecting error to app callback:', target)
  return c.html(deepLinkRedirectPage(target, 'auth_error'))
})

// Explicit bearer-token revocation endpoint used by app logout.
app.post('/api/mobile-auth/revoke-token', async (c) => {
  const authHeader = c.req.header('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : ''

  if (!token) {
    return c.json({ error: 'Missing bearer token' }, 400)
  }

  const [deleted] = await db
    .delete(sessions)
    .where(eq(sessions.token, token))
    .returning({ id: sessions.id })

  if (!deleted) {
    return c.json({ error: 'Session token not found' }, 404)
  }

  return c.json({ ok: true })
})

// Routes
const authMethods = ['GET', 'POST', 'OPTIONS']
const authCanonical = AUTH_BASE_PATH.replace(/\/+$/, '')
const authLegacyPaths = ['/auth', '/api/auth'].filter((p) => p !== authCanonical)

app.on(authMethods, authCanonical, (c) => auth.handler(c.req.raw as AuthRequest))
app.on(authMethods, `${authCanonical}/*`, (c) => auth.handler(c.req.raw as AuthRequest))

for (const legacyBase of authLegacyPaths) {
  app.on(authMethods, legacyBase, (c) => {
    return auth.handler(cloneRequestWithPath(c.req.raw, authCanonical))
  })
  app.on(authMethods, `${legacyBase}/*`, (c) => {
    const aliasPath = c.req.path.replace(new RegExp(`^${legacyBase}`), authCanonical)
    return auth.handler(cloneRequestWithPath(c.req.raw, aliasPath))
  })
}
app.route('/api/bands', bands)
app.route('/api/songs', songs)
app.route('/api/votes', votes)
app.route('/api/calendar', calendar)
app.route('/api/gigs', gigs)
app.route('/api/rehearsals', rehearsals)
app.route('/api/users', users)
app.route('/api/account', account)
app.route('/api/admin', admin)
app.route('/api/billing', billing)
app.route('/api/spotify', spotify)
app.route('/api/support', support)
app.route('/api/notifications', notifications)

const port = Number(process.env.PORT ?? 3001)

async function bootstrap() {
  await runMigrations()
  serve({ fetch: app.fetch, port }, () => {
    console.log(`bandstr API running on http://localhost:${port} (auth: ${authCanonical})`)
  })
}

void bootstrap().catch((error) => {
  console.error('API startup failed', error)
  process.exit(1)
})

export type AppType = typeof app
