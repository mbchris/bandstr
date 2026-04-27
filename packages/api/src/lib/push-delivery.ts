import { createSign, createPrivateKey } from 'node:crypto'

type PushPayload = {
  token: string
  title: string
  body: string
  path: string
  query: string
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

function parseGoogleServiceAccountFromEnv(): GoogleServiceAccount | null {
  const directJson = (process.env.FCM_SERVICE_ACCOUNT_JSON ?? '').trim()
  if (directJson) {
    try {
      return JSON.parse(directJson) as GoogleServiceAccount
    } catch {
      return null
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

async function getGoogleAccessToken(): Promise<string | null> {
  const now = Date.now()
  if (cachedGoogleToken && cachedGoogleToken.expiresAt > now + 60_000) {
    return cachedGoogleToken.accessToken
  }

  const serviceAccount = parseGoogleServiceAccountFromEnv()
  const projectIdFromEnv = (process.env.FCM_PROJECT_ID ?? '').trim()

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

  if (!clientEmail || !privateKey || !projectId) return null

  const iat = Math.floor(now / 1000)
  const exp = iat + 3600

  const header = encodeBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = encodeBase64Url(
    JSON.stringify({
      iss: clientEmail,
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
  const signature = signer.sign(privateKey).toString('base64url')
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

  if (!tokenResponse.ok) return null

  const data = (await tokenResponse.json()) as { access_token?: string; expires_in?: number }
  if (!data.access_token) return null

  cachedGoogleToken = {
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  }

  return data.access_token
}

function resolveFcmProjectId(): string {
  const envProjectId = (process.env.FCM_PROJECT_ID ?? '').trim()
  if (envProjectId) return envProjectId

  const serviceAccount = parseGoogleServiceAccountFromEnv()
  return (serviceAccount?.project_id ?? '').trim()
}

async function sendFcmPush(payload: PushPayload): Promise<void> {
  const accessToken = await getGoogleAccessToken()
  const projectId = resolveFcmProjectId()
  if (!accessToken || !projectId) return

  await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
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
  }).catch(() => undefined)
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

async function sendApnsPush(payload: PushPayload): Promise<void> {
  const jwt = createApnsJwt()
  const bundleId = (process.env.APNS_BUNDLE_ID ?? 'org.capacitor.bandstr').trim()
  if (!jwt || !bundleId) return

  const useSandbox = /^(1|true|yes|on)$/i.test((process.env.APNS_USE_SANDBOX ?? '').trim())
  const host = useSandbox ? 'api.sandbox.push.apple.com' : 'api.push.apple.com'

  await fetch(`https://${host}/3/device/${encodeURIComponent(payload.token)}`, {
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
  }).catch(() => undefined)
}

export async function sendPushToDevice(args: {
  tokenType: 'fcm' | 'apns'
  token: string
  title: string
  body: string
  path: string
  query: string
}) {
  const payload: PushPayload = {
    token: args.token,
    title: args.title,
    body: args.body,
    path: args.path,
    query: args.query,
  }

  if (args.tokenType === 'fcm') {
    await sendFcmPush(payload)
    return
  }

  await sendApnsPush(payload)
}
