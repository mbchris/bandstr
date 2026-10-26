import { createHash, createSign } from 'node:crypto'
import http2 from 'node:http2'
import { pool } from '../db/index.js'
import { createApnsJwt, resolveFcmConfig } from '../lib/push-delivery.js'

// Verifies that every credential rotated after the 2026-10-26 leak is accepted by the service that issued it.
// Each live check makes a harmless request (fake auth code, fake device/purchase token, read-only call) and
// interprets the error: "client OK, request invalid" means the credential works.
// See docs/security/2026-10-26-credential-leak.md.

type Status = 'ok' | 'fail' | 'warn' | 'skip'
type CheckResult = { status: Status; detail: string }
type Check = { name: string; run: () => Promise<CheckResult> }

const ok = (detail: string): CheckResult => ({ status: 'ok', detail })
const fail = (detail: string): CheckResult => ({ status: 'fail', detail })
const warn = (detail: string): CheckResult => ({ status: 'warn', detail })
const skip = (detail: string): CheckResult => ({ status: 'skip', detail })

function env(key: string): string {
  let value = (process.env[key] ?? '').trim()
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    value = value.slice(1, -1)
  }
  return value
}

function hasWhitespaceIssue(key: string): boolean {
  const raw = process.env[key] ?? ''
  return raw !== raw.trim() || /^["'].*["']$/s.test(raw.trim())
}

function shortBody(text: string): string {
  return text.replace(/\s+/g, ' ').slice(0, 160)
}

async function readJson(resp: Response): Promise<Record<string, unknown>> {
  const text = await resp.text()
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return { raw: shortBody(text) }
  }
}

// ─── Leaked-value fingerprints ────────────────────────────────────────────────
// Must match fingerprint() in scripts/leaked-secret-fingerprints.mjs.

function parseServiceAccount(value: string): { private_key_id?: string } | null {
  for (const candidate of [value, Buffer.from(value, 'base64').toString('utf8')]) {
    try {
      const parsed = JSON.parse(candidate) as unknown
      if (parsed && typeof parsed === 'object') return parsed as { private_key_id?: string }
    } catch {
      // try next encoding
    }
  }
  return null
}

function fingerprint(key: string, rawValue: string): string | null {
  let value = rawValue.trim()
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    value = value.slice(1, -1)
  }
  if (!value) return null

  let material = value
  if (key === 'DATABASE_URL') {
    try {
      material = decodeURIComponent(new URL(value).password)
    } catch {
      // fall back to the full value
    }
  } else if (key.endsWith('_JSON') || key.endsWith('_JSON_BASE64')) {
    const sa = parseServiceAccount(value)
    if (sa?.private_key_id) material = `private_key_id:${sa.private_key_id}`
  } else if (key.endsWith('PRIVATE_KEY')) {
    material = value.replace(/\\n/g, '').replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '')
  }
  if (!material) return null
  return createHash('sha256').update(material).digest('hex').slice(0, 12)
}

function parseLeakedFingerprints(arg: string | undefined): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  if (!arg) return map
  for (const pair of arg.split(',')) {
    const [key, fp] = pair.split(':').map((s) => s.trim())
    if (!key || !fp) continue
    if (!map.has(key)) map.set(key, new Set())
    map.get(key)!.add(fp)
  }
  return map
}

// ─── Google service-account helper ────────────────────────────────────────────

async function serviceAccountToken(clientEmail: string, privateKey: string, scope: string): Promise<{ token: string | null; error: string | null }> {
  const iat = Math.floor(Date.now() / 1000)
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({ iss: clientEmail, scope, aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 600 })}`
  let signature: string
  try {
    const signer = createSign('RSA-SHA256')
    signer.update(unsigned)
    signature = signer.sign(privateKey.replace(/\\n/g, '\n')).toString('base64url')
  } catch (error) {
    return { token: null, error: `private key unusable: ${error instanceof Error ? error.message : String(error)}` }
  }
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  })
  const data = await readJson(resp)
  if (!resp.ok || typeof data.access_token !== 'string') {
    // invalid_grant + "Invalid JWT Signature" = key deleted/disabled
    return { token: null, error: `token exchange ${resp.status}: ${data.error ?? ''} ${data.error_description ?? data.raw ?? ''}`.trim() }
  }
  return { token: data.access_token, error: null }
}

// ─── Checks ───────────────────────────────────────────────────────────────────

const apiBase = `http://127.0.0.1:${env('PORT') || '3001'}`

const checks: Check[] = [
  {
    name: 'DATABASE_URL',
    async run() {
      if (!env('DATABASE_URL')) return fail('not set')
      try {
        const { rows } = await pool.query<{ user: string; db: string }>('select current_user as user, current_database() as db')
        const host = new URL(env('DATABASE_URL')).hostname
        const note = ['localhost', '127.0.0.1', '::1'].includes(host) ? ' (loopback: password may not be checked)' : ''
        return ok(`connected as ${rows[0].user} to ${rows[0].db} via ${host}${note}`)
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error))
      }
    },
  },
  {
    name: 'AUTH_SECRET',
    async run() {
      const value = env('AUTH_SECRET')
      if (!value) return fail('not set')
      if (value.length < 32) return fail(`only ${value.length} chars (need >= 32)`)
      return ok(`${value.length} chars`)
    },
  },
  {
    name: 'INTERNAL_ADMIN_TOKEN',
    async run() {
      const value = env('INTERNAL_ADMIN_TOKEN')
      if (!value) return fail('not set')
      // Nonexistent user + enabled=false: accepted token → 404, rejected token → 403. Changes nothing.
      const call = (token: string) =>
        fetch(`${apiBase}/api/billing/internal/assign-user-pro`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-internal-admin-token': token },
          body: JSON.stringify({ userId: '__verify_secrets_nonexistent__', enabled: false }),
        })
      try {
        const right = await call(value)
        const wrong = await call(`${value}-wrong`)
        if (right.status === 404 && wrong.status === 403) return ok(`running API accepts it (${value.length} chars)`)
        if (right.status === 403) return fail('running API rejects the token from this env — API not redeployed since the change?')
        return warn(`unexpected statuses: correct=${right.status} wrong=${wrong.status}`)
      } catch (error) {
        return warn(`API not reachable at ${apiBase}: ${error instanceof Error ? error.message : String(error)}`)
      }
    },
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    async run() {
      const clientId = env('GOOGLE_CLIENT_ID')
      const secret = env('GOOGLE_CLIENT_SECRET')
      if (!clientId || !secret) return skip('GOOGLE_CLIENT_ID/SECRET not set')
      const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: 'verify-secrets-invalid-code',
          client_id: clientId,
          client_secret: secret,
          redirect_uri: `${env('API_URL') || 'https://example.invalid'}/api/auth/callback/google`,
        }),
      })
      const data = await readJson(resp)
      if (data.error === 'invalid_grant') return ok('client authenticated (fake code rejected as expected)')
      if (data.error === 'invalid_client' || data.error === 'unauthorized_client') return fail(`${data.error}: wrong or disabled secret`)
      return warn(`unexpected response ${resp.status}: ${JSON.stringify(data).slice(0, 160)}`)
    },
  },
  {
    name: 'GHUB_CLIENT_SECRET',
    async run() {
      const clientId = env('GHUB_CLIENT_ID')
      const secret = env('GHUB_CLIENT_SECRET')
      if (!clientId || !secret) return skip('GHUB_CLIENT_ID/SECRET not set')
      const resp = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: secret, code: 'verify-secrets-invalid-code' }),
      })
      const data = await readJson(resp)
      if (data.error === 'bad_verification_code') return ok('client authenticated (fake code rejected as expected)')
      if (data.error === 'incorrect_client_credentials') return fail('incorrect_client_credentials: wrong or revoked secret')
      return warn(`unexpected response ${resp.status}: ${JSON.stringify(data).slice(0, 160)}`)
    },
  },
  {
    name: 'APPLE_CLIENT_SECRET',
    async run() {
      const clientId = env('APPLE_CLIENT_ID')
      const secret = env('APPLE_CLIENT_SECRET')
      if (!clientId || !secret) return skip('APPLE_CLIENT_ID/SECRET not set')
      let expiry = ''
      try {
        const payload = JSON.parse(Buffer.from(secret.split('.')[1] ?? '', 'base64url').toString('utf8')) as { exp?: number }
        if (payload.exp) {
          const days = Math.floor((payload.exp * 1000 - Date.now()) / 86_400_000)
          if (days < 0) return fail(`client secret JWT expired ${-days} days ago`)
          expiry = `, JWT expires in ${days} days`
        }
      } catch {
        return fail('not a JWT')
      }
      const resp = await fetch('https://appleid.apple.com/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', code: 'verify-secrets-invalid-code', client_id: clientId, client_secret: secret }),
      })
      const data = await readJson(resp)
      if (data.error === 'invalid_grant') return ok(`client authenticated${expiry}`)
      if (data.error === 'invalid_client') return fail(`invalid_client: secret JWT signed with a revoked/wrong key${expiry}`)
      return warn(`unexpected response ${resp.status}: ${JSON.stringify(data).slice(0, 160)}`)
    },
  },
  {
    name: 'FCM service account',
    async run() {
      const config = resolveFcmConfig()
      if (config.source === 'none') return skip('no FCM credentials set')
      if (!config.clientEmail || !config.privateKey || !config.projectId) return fail(`incomplete config from ${config.source}`)
      const { token, error } = await serviceAccountToken(config.clientEmail, config.privateKey, 'https://www.googleapis.com/auth/firebase.messaging')
      if (!token) return fail(`${config.clientEmail}: ${error}`)
      // validate_only with a fake device token: 400 INVALID_ARGUMENT means auth + permission are fine.
      const resp = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/messages:send`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ validate_only: true, message: { token: 'verify-secrets-fake-device-token', notification: { title: 'x' } } }),
      })
      if (resp.status === 400) return ok(`${config.clientEmail} can send to project ${config.projectId} (source ${config.source})`)
      if (resp.status === 401 || resp.status === 403) return fail(`token works but FCM refused (${resp.status}): ${shortBody(await resp.text())}`)
      return warn(`unexpected FCM status ${resp.status}: ${shortBody(await resp.text())}`)
    },
  },
  {
    name: 'GPLAY_SERVICE_ACCOUNT_JSON',
    async run() {
      const raw = env('GPLAY_SERVICE_ACCOUNT_JSON')
      const packageName = env('GPLAY_PACKAGE_NAME')
      if (!raw) return skip('not set')
      const sa = parseServiceAccount(raw) as { client_email?: string; private_key?: string } | null
      if (!sa?.client_email || !sa.private_key) return fail('not valid service-account JSON')
      try {
        JSON.parse(raw)
      } catch {
        return fail('value is base64 — the Google Play provider only accepts raw JSON (purchase verification would fail)')
      }
      const { token, error } = await serviceAccountToken(sa.client_email, sa.private_key, 'https://www.googleapis.com/auth/androidpublisher')
      if (!token) return fail(`${sa.client_email}: ${error}`)
      if (!packageName) return warn('token OK, but GPLAY_PACKAGE_NAME not set — Play API access not tested')
      // Fake purchase token: 400/404/410 means the account may query this app's purchases.
      const resp = await fetch(
        `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/verify-secrets-fake-token`,
        { headers: { authorization: `Bearer ${token}` } },
      )
      if ([400, 404, 410].includes(resp.status)) return ok(`${sa.client_email} can query purchases of ${packageName}`)
      if (resp.status === 401 || resp.status === 403) {
        return fail(`key works, but ${sa.client_email} lacks Play Console permission "View financial data" / "Manage orders and subscriptions" (${resp.status})`)
      }
      return warn(`unexpected Play API status ${resp.status}: ${shortBody(await resp.text())}`)
    },
  },
  {
    name: 'GPLAY_RTDN_TOKEN',
    async run() {
      const value = env('GPLAY_RTDN_TOKEN')
      if (!value) return warn('not set — RTDN webhook accepts unauthenticated pushes')
      // Test notification is ignored by the handler after the token check.
      const data = Buffer.from(JSON.stringify({ packageName: env('GPLAY_PACKAGE_NAME') || 'x', testNotification: { version: '1.0' } })).toString('base64')
      const call = (token: string) =>
        fetch(`${apiBase}/api/billing/webhook/google_play?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message: { data, messageId: 'verify-secrets' } }),
        })
      try {
        const right = await call(value)
        const wrong = await call(`${value}-wrong`)
        if (right.ok && wrong.status === 401) return ok('running API accepts it — make sure the Pub/Sub push URL uses the new token too')
        if (right.status === 401) return fail('running API rejects the token from this env — API not redeployed since the change?')
        return warn(`unexpected statuses: correct=${right.status} wrong=${wrong.status}`)
      } catch (error) {
        return warn(`API not reachable at ${apiBase}: ${error instanceof Error ? error.message : String(error)}`)
      }
    },
  },
  {
    name: 'APNS_PRIVATE_KEY',
    async run() {
      if (!env('APNS_KEY_ID') || !env('APNS_PRIVATE_KEY')) return skip('APNs not configured')
      const { jwt, error } = createApnsJwt()
      if (!jwt) return fail(`cannot sign APNs JWT: ${error}`)
      const useSandbox = /^(1|true|yes|on)$/i.test(env('APNS_USE_SANDBOX'))
      const bundleId = env('APNS_BUNDLE_ID') || env('APPLE_BUNDLE_ID')
      // All-zero device token: 400 BadDeviceToken means Apple accepted the provider token.
      const post = (host: string) => new Promise<{ status: number; body: string }>((resolve, reject) => {
        const session = http2.connect(`https://${host}`)
        session.on('error', reject)
        const req = session.request({
          ':method': 'POST',
          ':path': `/3/device/${'0'.repeat(64)}`,
          authorization: `bearer ${jwt}`,
          'apns-topic': bundleId,
          'apns-push-type': 'alert',
          'content-type': 'application/json',
        })
        let status = 0
        let body = ''
        req.on('response', (headers) => { status = Number(headers[':status']) })
        req.on('data', (chunk: Buffer) => { body += chunk.toString() })
        req.on('end', () => { session.close(); resolve({ status, body }) })
        req.on('error', (err) => { session.destroy(); reject(err) })
        req.end(JSON.stringify({ aps: { alert: 'verify-secrets' } }))
      })
      const reasonOf = (body: string) => { try { return (JSON.parse(body) as { reason?: string }).reason ?? body } catch { return body } }
      let host = useSandbox ? 'api.sandbox.push.apple.com' : 'api.push.apple.com'
      let { status, body } = await post(host)
      let reason = reasonOf(body)
      let note = ''
      if (status === 403 && reason === 'BadEnvironmentKeyInToken') {
        // push-delivery retries the other gateway in this case, so do the same
        note = ` (only valid for this gateway — APNS_USE_SANDBOX=${useSandbox} points at the other one; push-delivery falls back automatically)`
        host = useSandbox ? 'api.push.apple.com' : 'api.sandbox.push.apple.com'
        ;({ status, body } = await post(host))
        reason = reasonOf(body)
      }
      if (status === 400 && reason === 'BadDeviceToken') return ok(`key ${env('APNS_KEY_ID')} accepted by ${host}${note}`)
      if (status === 403) return fail(`${reason} — key ${env('APNS_KEY_ID')} revoked, wrong team, or wrong key id`)
      return warn(`unexpected APNs response ${status}: ${reason}`)
    },
  },
  {
    name: 'SUPPORT_GITHUB_TOKEN',
    async run() {
      const value = env('SUPPORT_GITHUB_TOKEN')
      if (!value) return skip('not set')
      const match = env('SUPPORT_GITHUB_ISSUES_URL').match(/github\.com\/([^/]+)\/([^/]+)/)
      const url = match ? `https://api.github.com/repos/${match[1]}/${match[2]}` : 'https://api.github.com/rate_limit'
      const resp = await fetch(url, { headers: { authorization: `Bearer ${value}`, 'user-agent': 'bandstr-verify-secrets' } })
      if (resp.ok) return ok(match ? `can read ${match[1]}/${match[2]}` : 'token valid')
      if (resp.status === 401) return fail('401: token invalid or revoked')
      return fail(`${resp.status}: ${shortBody(await resp.text())}`)
    },
  },
  {
    name: 'STRIPE_SECRET_KEY',
    async run() {
      const value = env('STRIPE_SECRET_KEY')
      if (!value) return skip('not set')
      const resp = await fetch('https://api.stripe.com/v1/balance', { headers: { authorization: `Bearer ${value}` } })
      const mode = value.startsWith('sk_live_') || value.startsWith('rk_live_') ? 'live' : 'test'
      if (resp.ok) return ok(`${mode} key valid`)
      return fail(`${resp.status}: key invalid or rolled`)
    },
  },
]

const SECRET_KEYS = [
  'DATABASE_URL', 'AUTH_SECRET', 'INTERNAL_ADMIN_TOKEN', 'GOOGLE_CLIENT_SECRET', 'GHUB_CLIENT_SECRET', 'APPLE_CLIENT_SECRET',
  'FCM_SERVICE_ACCOUNT_JSON', 'FCM_SERVICE_ACCOUNT_PRIVATE_KEY', 'GOOGLE_APPLICATION_CREDENTIALS_JSON',
  'GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64', 'GPLAY_SERVICE_ACCOUNT_JSON', 'GPLAY_RTDN_TOKEN', 'APNS_PRIVATE_KEY',
  'SUPPORT_GITHUB_TOKEN', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'AUTH_EMAIL_SMTP_PASSWORD', 'SMTP_PASSWORD',
  'AUTH_EMAIL_WEBHOOK_BEARER_TOKEN', 'VAPID_PRIVATE_KEY',
]

function printHelp(): void {
  console.log(`
bandstr secret verification:
node /app/packages/api/dist/cli/verify-secrets.js [--leaked "<KEY:fingerprint,...>"]

Tests every configured credential against its issuing service with harmless requests
(fake auth codes / device tokens / purchase tokens). Secret values are never printed.

Options:
  --leaked <list>   Fingerprints of the leaked values, as printed by
                    scripts/leaked-secret-fingerprints.mjs on your machine.
                    Any env value matching one is reported as NOT ROTATED.
  --fingerprints    Only print fingerprints of the current values.

Exit code is 1 if any check fails.
`)
}

const ICON: Record<Status, string> = { ok: '✔', fail: '✘', warn: '!', skip: '–' }

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h') || args[0] === 'help') {
    printHelp()
    return
  }

  if (args.includes('--fingerprints')) {
    for (const key of SECRET_KEYS) {
      const fp = fingerprint(key, process.env[key] ?? '')
      if (fp) console.log(`${key.padEnd(44)} ${fp}`)
    }
    return
  }

  const leakedIdx = args.indexOf('--leaked')
  const leaked = parseLeakedFingerprints(leakedIdx >= 0 ? args[leakedIdx + 1] : undefined)

  let failures = 0
  const print = (name: string, result: CheckResult) => {
    if (result.status === 'fail') failures += 1
    console.log(`${ICON[result.status]} ${name.padEnd(44)} ${result.detail}`)
  }

  console.log('── Live checks ──')
  for (const check of checks) {
    let result: CheckResult
    try {
      result = await check.run()
    } catch (error) {
      result = fail(`check crashed: ${error instanceof Error ? error.message : String(error)}`)
    }
    print(check.name, result)
  }

  const whitespace = SECRET_KEYS.concat('GOOGLE_CLIENT_ID', 'GHUB_CLIENT_ID', 'APNS_KEY_ID').filter((key) => process.env[key] && hasWhitespaceIssue(key))
  if (whitespace.length) print('Formatting', warn(`surrounding whitespace/quotes in: ${whitespace.join(', ')}`))

  if (leaked.size) {
    console.log('\n── Rotation (compared with leaked values) ──')
    for (const key of SECRET_KEYS) {
      const leakedFps = leaked.get(key)
      if (!leakedFps) continue
      const current = fingerprint(key, process.env[key] ?? '')
      if (!current) print(key, skip('not set here'))
      else if (leakedFps.has(current)) print(key, fail('NOT ROTATED — still the leaked value'))
      else print(key, ok('differs from leaked value'))
    }
  } else {
    console.log('\n(no --leaked list given: rotation not compared; run scripts/leaked-secret-fingerprints.mjs locally)')
  }

  await pool.end().catch(() => undefined)
  process.exitCode = failures ? 1 : 0
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
