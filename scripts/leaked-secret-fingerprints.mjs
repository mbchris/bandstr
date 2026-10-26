#!/usr/bin/env node
// Prints short SHA-256 fingerprints of the credentials leaked on 2026-10-26 (see
// docs/security/2026-10-26-credential-leak.md), compares them with the local .env, checks the Coolify API
// token, and prints the command to run in the API container to check the production env.
// Secret values are never printed. Fingerprints are truncated hashes of values that are already compromised.
//
// Usage: node scripts/leaked-secret-fingerprints.mjs [leaked-file ...]

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

const DEFAULT_LEAKED_ENV_FILES = ['.env.old', '.env.bak_before_template_sync', '.env.coolify20260926']
// Service-account key files and the env keys that carried the same key in production.
const LEAKED_KEY_FILES = {
  '.fourki-projects-firebase-adminsdk-fbsvc-114308485a.json': [
    'FCM_SERVICE_ACCOUNT_JSON',
    'GOOGLE_APPLICATION_CREDENTIALS_JSON',
    'GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64',
  ],
  '.tools/play-console-creds-temp.json': ['GPLAY_SERVICE_ACCOUNT_JSON'],
}

const SECRET_KEYS = [
  'DATABASE_URL', 'AUTH_SECRET', 'INTERNAL_ADMIN_TOKEN', 'GOOGLE_CLIENT_SECRET', 'GHUB_CLIENT_SECRET', 'APPLE_CLIENT_SECRET',
  'FCM_SERVICE_ACCOUNT_JSON', 'FCM_SERVICE_ACCOUNT_PRIVATE_KEY', 'GOOGLE_APPLICATION_CREDENTIALS_JSON',
  'GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64', 'GPLAY_SERVICE_ACCOUNT_JSON', 'GPLAY_RTDN_TOKEN', 'APNS_PRIVATE_KEY',
  'SUPPORT_GITHUB_TOKEN', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'AUTH_EMAIL_SMTP_PASSWORD', 'SMTP_PASSWORD',
  'AUTH_EMAIL_WEBHOOK_BEARER_TOKEN', 'VAPID_PRIVATE_KEY', 'COOLIFY_AUTH_TOKEN',
]

function stripQuotes(value) {
  const v = value.trim()
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) return v.slice(1, -1)
  return v
}

function parseEnvFile(path) {
  const out = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/)
    if (m) out[m[1]] = stripQuotes(m[2])
  }
  return out
}

function parseServiceAccount(value) {
  for (const candidate of [value, Buffer.from(value, 'base64').toString('utf8')]) {
    try {
      const parsed = JSON.parse(candidate)
      if (parsed && typeof parsed === 'object') return parsed
    } catch {
      // try next encoding
    }
  }
  return null
}

// Must match fingerprint() in packages/api/src/cli/verify-secrets.ts.
function fingerprint(key, rawValue) {
  const value = stripQuotes(rawValue ?? '')
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

// ── Collect leaked fingerprints ────────────────────────────────────────────────

const leaked = new Map() // key -> Set<fingerprint>
const add = (key, fp) => {
  if (!fp) return
  if (!leaked.has(key)) leaked.set(key, new Set())
  leaked.get(key).add(fp)
}

const envFiles = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_LEAKED_ENV_FILES
for (const file of envFiles) {
  const path = resolve(root, file)
  if (!existsSync(path)) continue
  const vars = parseEnvFile(path)
  for (const key of SECRET_KEYS) if (vars[key]) add(key, fingerprint(key, vars[key]))
  console.log(`read ${file}`)
}
for (const [file, keys] of Object.entries(LEAKED_KEY_FILES)) {
  const path = resolve(root, file)
  if (!existsSync(path)) continue
  const raw = readFileSync(path, 'utf8')
  for (const key of keys) add(key, fingerprint(key, raw))
  console.log(`read ${file}`)
}

if (!leaked.size) {
  console.error('No leaked files found on disk — pass their paths as arguments.')
  process.exit(1)
}

// ── Compare with local .env ────────────────────────────────────────────────────

const localEnvPath = resolve(root, '.env')
const local = existsSync(localEnvPath) ? parseEnvFile(localEnvPath) : {}
console.log('\n── Local .env vs leaked values ──')
for (const key of SECRET_KEYS) {
  const fps = leaked.get(key)
  if (!fps) continue
  const current = fingerprint(key, local[key] ?? '')
  const state = !current ? '–  not set locally' : fps.has(current) ? '✘  NOT ROTATED (still the leaked value)' : '✔  rotated'
  console.log(`${key.padEnd(44)} ${state}`)
}

// ── Coolify API token (only used from this machine / CI) ───────────────────────

const coolifyToken = stripQuotes(process.env.COOLIFY_AUTH_TOKEN ?? local.COOLIFY_AUTH_TOKEN ?? '')
const coolifyUrl = stripQuotes(process.env.COOLIFY_DEPLOY_URL ?? local.COOLIFY_DEPLOY_URL ?? '')
console.log('\n── Coolify API token ──')
if (!coolifyToken || !coolifyUrl) {
  console.log('–  COOLIFY_AUTH_TOKEN / COOLIFY_DEPLOY_URL not set in .env')
} else {
  try {
    const resp = await fetch(new URL('/api/v1/version', coolifyUrl), { headers: { authorization: `Bearer ${coolifyToken}` } })
    console.log(resp.ok ? `✔  accepted by ${new URL(coolifyUrl).host}` : `✘  rejected (${resp.status})`)
  } catch (error) {
    console.log(`!  Coolify not reachable: ${error.message}`)
  }
}

// ── Command for the API container ──────────────────────────────────────────────

const list = [...leaked].flatMap(([key, fps]) => [...fps].map((fp) => `${key}:${fp}`)).join(',')
console.log('\nRun this in the API container (Coolify → bandstr API → Terminal):\n')
console.log(`node /app/packages/api/dist/cli/verify-secrets.js --leaked "${list}"\n`)
