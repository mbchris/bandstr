#!/usr/bin/env node
// App Store Connect API helper for bandstr iOS release signing.
//
// Uses the App Store Connect API key (AuthKey_<KEY_ID>.p8) to manage signing
// assets without Xcode's GUI or an Apple ID login.
//
// Commands:
//   create-signing --out-dir DIR
//       Creates a new Apple Distribution certificate (private key generated
//       locally, never sent to Apple), packs it into a password-protected .p12
//       and creates an App Store provisioning profile for APPLE_BUNDLE_ID.
//       Writes: distribution.p12, appstore.mobileprovision, signing.json
//   next-build-number
//       Prints the highest uploaded CFBundleVersion for the app + 1.
//
// Env: APPSTORE_CONNECT_API_KEY_ID, APPSTORE_CONNECT_ISSUER_ID,
//      APPSTORE_CONNECT_API_KEY_PATH, APPLE_BUNDLE_ID

import { createPrivateKey, randomBytes, sign } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const API = 'https://api.appstoreconnect.apple.com/v1'
// macOS LibreSSL writes PKCS#12 files that `security import` understands
// (OpenSSL 3 defaults to AES-based p12s that the keychain rejects).
const OPENSSL = '/usr/bin/openssl'

function env(name) {
  const value = (process.env[name] ?? '').trim()
  if (!value) {
    console.error(`Error: ${name} is not set.`)
    process.exit(1)
  }
  return value
}

function b64url(input) {
  return Buffer.from(input).toString('base64url')
}

function makeToken() {
  const keyId = env('APPSTORE_CONNECT_API_KEY_ID')
  const issuer = env('APPSTORE_CONNECT_ISSUER_ID')
  const key = createPrivateKey(readFileSync(env('APPSTORE_CONNECT_API_KEY_PATH')))
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ iss: issuer, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' }))
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' })
  return `${header}.${payload}.${b64url(signature)}`
}

const token = makeToken()

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const json = text ? JSON.parse(text) : {}
  if (!res.ok) {
    const detail = (json.errors ?? []).map((e) => `${e.title}: ${e.detail}`).join('; ') || text
    throw new Error(`${method} ${path} failed (${res.status}): ${detail}`)
  }
  return json
}

async function findBundleId(identifier) {
  const res = await api('GET', `/bundleIds?filter[identifier]=${encodeURIComponent(identifier)}&limit=200`)
  const match = res.data.find((b) => b.attributes.identifier === identifier)
  if (!match) throw new Error(`Bundle ID '${identifier}' is not registered in the developer portal.`)
  return match
}

async function ensureCapability(bundleId, capabilityType) {
  const caps = await api('GET', `/bundleIds/${bundleId}/bundleIdCapabilities`)
  const hasCap = caps.data?.some((c) => c.attributes?.capabilityType === capabilityType)
  if (hasCap) {
    console.log(`Capability '${capabilityType}' is already enabled.`)
    return
  }
  console.log(`Enabling capability '${capabilityType}' on bundle ID ...`)
  await api('POST', '/bundleIdCapabilities', {
    data: {
      type: 'bundleIdCapabilities',
      attributes: { capabilityType },
      relationships: {
        bundleId: { data: { type: 'bundleIds', id: bundleId } },
      },
    },
  })
  console.log(`Capability '${capabilityType}' enabled successfully.`)
}

async function createSigning(outDir) {
  const bundleIdentifier = env('APPLE_BUNDLE_ID')
  mkdirSync(outDir, { recursive: true })
  const bundle = await findBundleId(bundleIdentifier)
  await ensureCapability(bundle.id, 'PUSH_NOTIFICATIONS')

  const keyPem = join(outDir, 'distribution.key.pem')
  const csrPem = join(outDir, 'distribution.csr.pem')
  const certDer = join(outDir, 'distribution.cer')
  const certPem = join(outDir, 'distribution.cert.pem')
  const p12Path = join(outDir, 'distribution.p12')
  const profilePath = join(outDir, 'appstore.mobileprovision')

  execFileSync(OPENSSL, ['genrsa', '-out', keyPem, '2048'], { stdio: 'ignore' })
  execFileSync(OPENSSL, ['req', '-new', '-key', keyPem, '-out', csrPem, '-subj', '/CN=bandstr distribution/C=DE'], { stdio: 'ignore' })

  console.log('Creating Apple Distribution certificate ...')
  const cert = await api('POST', '/certificates', {
    data: {
      type: 'certificates',
      attributes: { certificateType: 'DISTRIBUTION', csrContent: readFileSync(csrPem, 'utf8') },
    },
  })
  const certAttrs = cert.data.attributes
  writeFileSync(certDer, Buffer.from(certAttrs.certificateContent, 'base64'))
  execFileSync(OPENSSL, ['x509', '-inform', 'DER', '-in', certDer, '-out', certPem])

  const p12Password = randomBytes(24).toString('base64url')
  execFileSync(OPENSSL, [
    'pkcs12', '-export',
    '-inkey', keyPem, '-in', certPem,
    '-name', certAttrs.name ?? 'Apple Distribution',
    '-out', p12Path, '-passout', `pass:${p12Password}`,
  ])
  const sha1 = execFileSync(OPENSSL, ['x509', '-in', certPem, '-noout', '-fingerprint', '-sha1'], { encoding: 'utf8' })
    .split('=')[1].replace(/:/g, '').trim()

  const profileName = `bandstr App Store ${new Date().toISOString().slice(0, 10)} ${cert.data.id.slice(0, 6)}`
  console.log(`Creating App Store provisioning profile '${profileName}' ...`)
  const profile = await api('POST', '/profiles', {
    data: {
      type: 'profiles',
      attributes: { name: profileName, profileType: 'IOS_APP_STORE' },
      relationships: {
        bundleId: { data: { type: 'bundleIds', id: bundle.id } },
        certificates: { data: [{ type: 'certificates', id: cert.data.id }] },
      },
    },
  })
  const profileAttrs = profile.data.attributes
  writeFileSync(profilePath, Buffer.from(profileAttrs.profileContent, 'base64'))

  const meta = {
    bundleId: bundleIdentifier,
    certificateId: cert.data.id,
    certificateName: certAttrs.name,
    certificateSha1: sha1,
    certificateExpires: certAttrs.expirationDate,
    profileId: profile.data.id,
    profileName,
    profileUuid: profileAttrs.uuid,
    profileExpires: profileAttrs.expirationDate,
    p12Password,
  }
  writeFileSync(join(outDir, 'signing.json'), JSON.stringify(meta, null, 2), { mode: 0o600 })
  console.log(`Certificate ${sha1} (expires ${certAttrs.expirationDate})`)
  console.log(`Profile ${profileAttrs.uuid} (expires ${profileAttrs.expirationDate})`)
}

async function renewProfile(certId, outDir) {
  const bundleIdentifier = env('APPLE_BUNDLE_ID')
  mkdirSync(outDir, { recursive: true })
  const bundle = await findBundleId(bundleIdentifier)
  await ensureCapability(bundle.id, 'PUSH_NOTIFICATIONS')

  const profilePath = join(outDir, 'appstore.mobileprovision')
  const profileName = `bandstr App Store ${new Date().toISOString().slice(0, 10)} ${certId.slice(0, 6)}`
  console.log(`Creating App Store provisioning profile '${profileName}' with Push Notifications ...`)
  const profile = await api('POST', '/profiles', {
    data: {
      type: 'profiles',
      attributes: { name: profileName, profileType: 'IOS_APP_STORE' },
      relationships: {
        bundleId: { data: { type: 'bundleIds', id: bundle.id } },
        certificates: { data: [{ type: 'certificates', id: certId }] },
      },
    },
  })
  const profileAttrs = profile.data.attributes
  writeFileSync(profilePath, Buffer.from(profileAttrs.profileContent, 'base64'))

  const meta = {
    bundleId: bundleIdentifier,
    certificateId: certId,
    profileId: profile.data.id,
    profileName,
    profileUuid: profileAttrs.uuid,
    profileExpires: profileAttrs.expirationDate,
  }
  writeFileSync(join(outDir, 'profile.json'), JSON.stringify(meta, null, 2), { mode: 0o600 })
  console.log(`Profile ${profileAttrs.uuid} created (expires ${profileAttrs.expirationDate})`)
}

async function checkBundle() {
  const bundleIdentifier = env('APPLE_BUNDLE_ID')
  const bundle = await findBundleId(bundleIdentifier)
  console.log(`Bundle ID: ${bundle.attributes.identifier} (ID: ${bundle.id})`)
  const caps = await api('GET', `/bundleIds/${bundle.id}/bundleIdCapabilities`)
  const capList = caps.data?.map((c) => c.attributes?.capabilityType).join(', ') || 'none'
  console.log(`Enabled capabilities: ${capList}`)
}

async function nextBuildNumber() {
  const bundleIdentifier = env('APPLE_BUNDLE_ID')
  const apps = await api('GET', `/apps?filter[bundleId]=${encodeURIComponent(bundleIdentifier)}`)
  const app = apps.data.find((a) => a.attributes.bundleId === bundleIdentifier)
  if (!app) throw new Error(`No App Store Connect app found for '${bundleIdentifier}'.`)
  const builds = await api('GET', `/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=50`)
  const highest = builds.data.reduce((max, b) => Math.max(max, Number.parseInt(b.attributes.version, 10) || 0), 0)
  console.log(highest + 1)
}

const [command, ...args] = process.argv.slice(2)
try {
  if (command === 'create-signing') {
    const idx = args.indexOf('--out-dir')
    if (idx === -1 || !args[idx + 1]) throw new Error('Usage: asc-signing.mjs create-signing --out-dir DIR')
    await createSigning(args[idx + 1])
  } else if (command === 'renew-profile') {
    const certIdx = args.indexOf('--cert-id')
    const outIdx = args.indexOf('--out-dir')
    if (certIdx === -1 || !args[certIdx + 1] || outIdx === -1 || !args[outIdx + 1]) {
      throw new Error('Usage: asc-signing.mjs renew-profile --cert-id CERT_ID --out-dir DIR')
    }
    await renewProfile(args[certIdx + 1], args[outIdx + 1])
  } else if (command === 'check-bundle') {
    await checkBundle()
  } else if (command === 'next-build-number') {
    await nextBuildNumber()
  } else {
    throw new Error('Usage: asc-signing.mjs create-signing --out-dir DIR | renew-profile --cert-id ID --out-dir DIR | check-bundle | next-build-number')
  }
} catch (err) {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
}
