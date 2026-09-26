import { createSign, createPrivateKey } from 'node:crypto'
import webpush from 'web-push'

type PushPayload = {
  token: string
  title: string
  body: string
  path: string
  query: string
}

type PushLogContext = {
  bandId?: number
  userId?: string
  notificationId?: number
}

type PushDeliveryResult = {
  provider: 'fcm' | 'apns' | 'web_push'
  ok: boolean
  status: number | null
  error: string | null
  responseBody: string | null
}

function previewToken(token: string): string {
  const trimmed = token.trim()
  if (trimmed.length <= 12) return trimmed
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function logPushDelivery(result: PushDeliveryResult, payload: PushPayload, context?: PushLogContext): void {
  const prefix = result.ok ? '[push-delivery] delivered' : '[push-delivery] failed'
  const parts = [
    `provider=${result.provider}`,
    `status=${result.status ?? 'none'}`,
    `token=${previewToken(payload.token)}`,
    `path=${payload.path}`,
  ]

  if (context?.bandId !== undefined) parts.push(`bandId=${context.bandId}`)
  if (context?.userId) parts.push(`userId=${context.userId}`)
  if (context?.notificationId !== undefined) parts.push(`notificationId=${context.notificationId}`)
  if (result.error) parts.push(`error=${JSON.stringify(result.error)}`)
  if (result.responseBody) parts.push(`response=${JSON.stringify(result.responseBody)}`)

  const message = `${prefix} ${parts.join(' ')}`
  if (result.ok) {
    console.info(message)
    return
  }

  console.error(message)
}

function encodeBase64Url(input: string): string {
  return Buffer.from(input).toString('base64url')
}

let cachedGoogleToken: { accessToken: string; expiresAt: number } | null = null

type GoogleServiceAccount = {
  client_email?: string
  private_key?: string
  project_id?: string
}

type FcmConfigState = {
  projectId: string
  clientEmail: string
  privateKey: string
  source:
    | 'FCM_SERVICE_ACCOUNT_JSON'
    | 'GOOGLE_APPLICATION_CREDENTIALS_JSON'
    | 'GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64'
    | 'FCM_SERVICE_ACCOUNT_EMAIL/FCM_SERVICE_ACCOUNT_PRIVATE_KEY'
    | 'none'
}

function parseGoogleServiceAccountFromEnv(): GoogleServiceAccount | null {
  const directJson = (process.env.FCM_SERVICE_ACCOUNT_JSON ?? '').trim()
  if (directJson) {
    try {
      return JSON.parse(directJson) as GoogleServiceAccount
    } catch {
      try {
        const decoded = Buffer.from(directJson, 'base64').toString('utf8')
        return JSON.parse(decoded) as GoogleServiceAccount
      } catch {
        return null
      }
    }
  }

  const googleCredsJson = (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ?? '').trim()
  if (googleCredsJson) {
    try {
      return JSON.parse(googleCredsJson) as GoogleServiceAccount
    } catch {
      return null
    }
  }

  const googleCredsJsonB64 = (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64 ?? '').trim()
  if (googleCredsJsonB64) {
    try {
      const decoded = Buffer.from(googleCredsJsonB64, 'base64').toString('utf8')
      return JSON.parse(decoded) as GoogleServiceAccount
    } catch {
      return null
    }
  }

  return null
}

function resolveFcmConfig(): FcmConfigState {
  const projectIdFromEnv = (process.env.FCM_PROJECT_ID ?? '').trim()
  const serviceAccountJson = (process.env.FCM_SERVICE_ACCOUNT_JSON ?? '').trim()
  const googleCredsJson = (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ?? '').trim()
  const googleCredsJsonB64 = (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64 ?? '').trim()
  const serviceAccount = parseGoogleServiceAccountFromEnv()

  let source: FcmConfigState['source'] = 'none'
  if (serviceAccountJson) source = 'FCM_SERVICE_ACCOUNT_JSON'
  else if (googleCredsJson) source = 'GOOGLE_APPLICATION_CREDENTIALS_JSON'
  else if (googleCredsJsonB64) source = 'GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64'
  else if ((process.env.FCM_SERVICE_ACCOUNT_EMAIL ?? '').trim() || (process.env.FCM_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').trim()) {
    source = 'FCM_SERVICE_ACCOUNT_EMAIL/FCM_SERVICE_ACCOUNT_PRIVATE_KEY'
  }

  let clientEmail = ''
  let privateKey = ''
  let projectId = projectIdFromEnv

  if (serviceAccount) {
    clientEmail = (serviceAccount.client_email ?? '').trim()
    privateKey = (serviceAccount.private_key ?? '').replace(/\\n/g, '\n').trim()
    if (!projectId) projectId = (serviceAccount.project_id ?? '').trim()
  } else {
    clientEmail = (process.env.FCM_SERVICE_ACCOUNT_EMAIL ?? '').trim()
    privateKey = (process.env.FCM_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n').trim()
  }

  return {
    projectId,
    clientEmail,
    privateKey,
    source,
  }
}

function describeMissingFcmConfig(): string {
  const config = resolveFcmConfig()
  const missing: string[] = []
  if (!config.projectId) missing.push('FCM_PROJECT_ID')
  if (!config.clientEmail) missing.push('service account client_email')
  if (!config.privateKey) missing.push('service account private_key')
  const source = config.source === 'none' ? 'no FCM credential source configured' : `credential source=${config.source}`
  return `Missing FCM configuration: ${missing.join(', ')} (${source})`
}

async function getGoogleAccessToken(): Promise<string | null> {
  const now = Date.now()
  if (cachedGoogleToken && cachedGoogleToken.expiresAt > now + 60_000) {
    return cachedGoogleToken.accessToken
  }

  const config = resolveFcmConfig()
  if (!config.clientEmail || !config.privateKey || !config.projectId) return null

  const iat = Math.floor(now / 1000)
  const exp = iat + 3600

  const header = encodeBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = encodeBase64Url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat,
      exp,
    }),
  )

  const unsigned = `${header}.${claims}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  signer.end()
  const signature = signer.sign(config.privateKey).toString('base64url')
  const assertion = `${unsigned}.${signature}`

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  })

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!tokenResponse.ok) {
    const errorBody = (await tokenResponse.text().catch(() => '')) || '(empty)'
    console.error(
      `[push-delivery] failed provider=fcm status=${tokenResponse.status} stage=oauth-token error=${JSON.stringify(errorBody)}`,
    )
    return null
  }

  const data = (await tokenResponse.json()) as { access_token?: string; expires_in?: number }
  if (!data.access_token) {
    console.error('[push-delivery] failed provider=fcm status=none stage=oauth-token error="Missing access_token in OAuth response"')
    return null
  }

  cachedGoogleToken = {
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  }

  return data.access_token
}

function resolveFcmProjectId(): string {
  return resolveFcmConfig().projectId
}

async function sendFcmPush(payload: PushPayload): Promise<PushDeliveryResult> {
  const accessToken = await getGoogleAccessToken()
  const projectId = resolveFcmProjectId()
  if (!accessToken || !projectId) {
    return {
      provider: 'fcm',
      ok: false,
      status: null,
      error: describeMissingFcmConfig(),
      responseBody: null,
    }
  }

  try {
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: payload.token,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: {
            path: payload.path,
            query: payload.query,
          },
          android: {
            priority: 'high',
            notification: {
              channel_id: 'default',
              click_action: 'FCM_PLUGIN_ACTIVITY',
            },
          },
        },
      }),
    })

    const responseBody = (await response.text().catch(() => '')) || null
    return {
      provider: 'fcm',
      ok: response.ok,
      status: response.status,
      error: response.ok ? null : `FCM request failed with HTTP ${response.status}`,
      responseBody,
    }
  } catch (error) {
    return {
      provider: 'fcm',
      ok: false,
      status: null,
      error: normalizeError(error),
      responseBody: null,
    }
  }
}

function createApnsJwt(): string | null {
  const teamId = (process.env.APNS_TEAM_ID ?? '').trim()
  const keyId = (process.env.APNS_KEY_ID ?? '').trim()
  const privateKeyRaw = (process.env.APNS_PRIVATE_KEY ?? '').replace(/\\n/g, '\n').trim()
  if (!teamId || !keyId || !privateKeyRaw) return null

  try {
    const key = createPrivateKey(privateKeyRaw)
    const header = encodeBase64Url(JSON.stringify({ alg: 'ES256', kid: keyId }))
    const claims = encodeBase64Url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }))
    const unsigned = `${header}.${claims}`
    const signer = createSign('sha256')
    signer.update(unsigned)
    signer.end()
    const signature = signer.sign(key).toString('base64url')
    return `${unsigned}.${signature}`
  } catch {
    return null
  }
}

async function sendApnsPush(payload: PushPayload): Promise<PushDeliveryResult> {
  const jwt = createApnsJwt()
  const bundleId = (process.env.APNS_BUNDLE_ID ?? 'org.capacitor.bandstr').trim()
  if (!jwt || !bundleId) {
    return {
      provider: 'apns',
      ok: false,
      status: null,
      error: 'Missing APNs JWT or bundle id',
      responseBody: null,
    }
  }

  const useSandbox = /^(1|true|yes|on)$/i.test((process.env.APNS_USE_SANDBOX ?? '').trim())
  const host = useSandbox ? 'api.sandbox.push.apple.com' : 'api.push.apple.com'

  try {
    const response = await fetch(`https://${host}/3/device/${encodeURIComponent(payload.token)}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${jwt}`,
        'apns-topic': bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        aps: {
          alert: {
            title: payload.title,
            body: payload.body,
          },
          sound: 'default',
        },
        path: payload.path,
        query: payload.query,
      }),
    })

    const responseBody = (await response.text().catch(() => '')) || null
    return {
      provider: 'apns',
      ok: response.ok,
      status: response.status,
      error: response.ok ? null : `APNs request failed with HTTP ${response.status}`,
      responseBody,
    }
  } catch (error) {
    return {
      provider: 'apns',
      ok: false,
      status: null,
      error: normalizeError(error),
      responseBody: null,
    }
  }
}

async function sendWebPush(payload: PushPayload): Promise<PushDeliveryResult> {
  const vapidPublicKey = (process.env.VAPID_PUBLIC_KEY ?? '').trim()
  const vapidPrivateKey = (process.env.VAPID_PRIVATE_KEY ?? '').trim()
  const vapidSubject = (process.env.VAPID_SUBJECT ?? 'mailto:admin@bandstr.com').trim()

  if (!vapidPublicKey || !vapidPrivateKey) {
    return {
      provider: 'web_push',
      ok: false,
      status: null,
      error: 'Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY',
      responseBody: null,
    }
  }

  let subscription: webpush.PushSubscription
  try {
    subscription = JSON.parse(payload.token)
  } catch {
    return {
      provider: 'web_push',
      ok: false,
      status: null,
      error: 'Invalid Web Push subscription token JSON',
      responseBody: null,
    }
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

  try {
    const response = await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        path: payload.path,
        query: payload.query,
      }),
    )

    return {
      provider: 'web_push',
      ok: response.statusCode >= 200 && response.statusCode < 300,
      status: response.statusCode,
      error: null,
      responseBody: response.body || null,
    }
  } catch (error: unknown) {
    const err = error as { statusCode?: number; body?: string }
    return {
      provider: 'web_push',
      ok: false,
      status: err.statusCode ?? null,
      error: normalizeError(error),
      responseBody: err.body ?? null,
    }
  }
}

export async function sendPushToDevice(args: {
  tokenType: 'fcm' | 'apns' | 'web_push'
  token: string
  title: string
  body: string
  path: string
  query: string
  context?: PushLogContext
}) {
  const payload: PushPayload = {
    token: args.token,
    title: args.title,
    body: args.body,
    path: args.path,
    query: args.query,
  }

  if (args.tokenType === 'fcm') {
    const result = await sendFcmPush(payload)
    logPushDelivery(result, payload, args.context)
    return result
  }

  if (args.tokenType === 'apns') {
    const result = await sendApnsPush(payload)
    logPushDelivery(result, payload, args.context)
    return result
  }

  const result = await sendWebPush(payload)
  logPushDelivery(result, payload, args.context)
  return result
}
