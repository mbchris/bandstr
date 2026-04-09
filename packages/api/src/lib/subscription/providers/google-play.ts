import { createSign } from 'node:crypto'
import { z } from 'zod'
import type {
  SubscriptionProvider,
  NormalizedSubscription,
  WebhookBandUpdate,
  BillingInterval,
  SubscriptionStatus,
} from '../types.js'

// ─── Service account JWT + token exchange ────────────────────────────────────

interface TokenCache {
  accessToken: string
  expiresAt: number // ms since epoch
}

let tokenCache: TokenCache | null = null

function makeServiceAccountJwt(clientEmail: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  ).toString('base64url')
  const unsigned = `${header}.${payload}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  signer.end()
  return `${unsigned}.${signer.sign(privateKey, 'base64url')}`
}

async function fetchAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const now = Date.now()
  if (tokenCache && tokenCache.expiresAt > now + 5 * 60 * 1000) {
    return tokenCache.accessToken
  }

  const jwt = makeServiceAccountJwt(clientEmail, privateKey)
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Google service account token exchange failed (${resp.status}): ${text}`)
  }

  const data = (await resp.json()) as { access_token: string; expires_in: number }
  tokenCache = { accessToken: data.access_token, expiresAt: now + data.expires_in * 1000 }
  return data.access_token
}

// ─── Google Play Developer API ────────────────────────────────────────────────

// Relevant subset of the SubscriptionPurchaseV2 response
interface SubscriptionPurchaseV2 {
  subscriptionState: string
  linkedPurchaseToken?: string
  acknowledgementState?: string
  lineItems?: Array<{
    productId: string
    expiryTime?: string
    autoRenewingPlan?: { autoRenewEnabled: boolean }
  }>
}

async function fetchSubscriptionV2(
  packageName: string,
  purchaseToken: string,
  accessToken: string,
): Promise<SubscriptionPurchaseV2> {
  const encodedPackageName = encodeURIComponent(packageName)
  const encodedPurchaseToken = encodeURIComponent(purchaseToken)
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodedPackageName}/purchases/subscriptionsv2/tokens/${encodedPurchaseToken}`
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Google Play subscriptionsv2 GET failed (${resp.status}): ${text}`)
  }
  return resp.json() as Promise<SubscriptionPurchaseV2>
}

async function acknowledgeSubscription(
  packageName: string,
  subscriptionId: string,
  purchaseToken: string,
  accessToken: string,
): Promise<void> {
  const encodedPackageName = encodeURIComponent(packageName)
  const encodedSubscriptionId = encodeURIComponent(subscriptionId)
  const encodedPurchaseToken = encodeURIComponent(purchaseToken)
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodedPackageName}/purchases/subscriptions/${encodedSubscriptionId}/tokens/${encodedPurchaseToken}:acknowledge`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: '{}',
  })
  // 409 = already acknowledged — not an error
  if (!resp.ok && resp.status !== 409) {
    const text = await resp.text()
    throw new Error(`Google Play acknowledge failed (${resp.status}): ${text}`)
  }
}

// ─── State normalization ──────────────────────────────────────────────────────

function normalizeGplayState(subscriptionState: string): SubscriptionStatus {
  switch (subscriptionState) {
    case 'SUBSCRIPTION_STATE_ACTIVE': return 'active'
    case 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD': return 'grace_period'
    case 'SUBSCRIPTION_STATE_ON_HOLD': return 'on_hold'
    case 'SUBSCRIPTION_STATE_PAUSED': return 'paused'
    case 'SUBSCRIPTION_STATE_CANCELED': return 'canceled'
    case 'SUBSCRIPTION_STATE_EXPIRED': return 'canceled'
    default: return 'none'
  }
}

function intervalFromProductId(productId: string): BillingInterval {
  return process.env.GPLAY_PRODUCT_PRO_YEARLY && productId === process.env.GPLAY_PRODUCT_PRO_YEARLY
    ? 'yearly'
    : 'monthly'
}

function normalizeSubscription(sub: SubscriptionPurchaseV2, purchaseToken: string): NormalizedSubscription {
  const lineItem = sub.lineItems?.[0]
  const productId = lineItem?.productId ?? ''
  const expiryTime = lineItem?.expiryTime
  const autoRenew = lineItem?.autoRenewingPlan?.autoRenewEnabled ?? false

  return {
    plan: 'pro',
    status: normalizeGplayState(sub.subscriptionState),
    interval: productId ? intervalFromProductId(productId) : null,
    currentPeriodEnd: expiryTime ? new Date(expiryTime) : null,
    cancelAtPeriodEnd: !autoRenew,
    providerRef: purchaseToken,
  }
}

function resolveSubscriptionId(sub: SubscriptionPurchaseV2, fallbackProductId?: string): string | null {
  const lineItemProductId = sub.lineItems?.[0]?.productId?.trim()
  if (lineItemProductId) return lineItemProductId

  const fallback = fallbackProductId?.trim()
  return fallback ? fallback : null
}

// ─── RTDN / Pub/Sub notification schemas ─────────────────────────────────────

// Notification types that do not require a subscription state re-fetch
const IGNORABLE_NOTIFICATION_TYPES = new Set([
  8,  // SUBSCRIPTION_PRICE_CHANGE_CONFIRMED
  9,  // SUBSCRIPTION_DEFERRED
  11, // SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED
])

const PubSubEnvelopeSchema = z.object({
  message: z.object({
    data: z.string(),
    messageId: z.string().optional(),
    publishTime: z.string().optional(),
  }),
  subscription: z.string().optional(),
})

const DeveloperNotificationSchema = z.object({
  packageName: z.string(),
  subscriptionNotification: z
    .object({
      notificationType: z.number(),
      purchaseToken: z.string(),
      subscriptionId: z.string(),
    })
    .optional(),
  testNotification: z.object({ version: z.string() }).optional(),
  voidedPurchaseNotification: z.unknown().optional(),
})

// ─── Activate payload schema ──────────────────────────────────────────────────

const ActivatePayloadSchema = z.object({
  productId: z.string().min(1),
  purchaseToken: z.string().min(1),
  interval: z.enum(['monthly', 'yearly']).optional(),
})

// ─── Config ───────────────────────────────────────────────────────────────────

function getConfig() {
  const packageName = process.env.GPLAY_PACKAGE_NAME
  const serviceAccountJson = process.env.GPLAY_SERVICE_ACCOUNT_JSON
  if (!packageName || !serviceAccountJson) {
    throw new Error('Google Play is not configured (GPLAY_PACKAGE_NAME and GPLAY_SERVICE_ACCOUNT_JSON are required)')
  }
  let sa: { client_email: string; private_key: string }
  try {
    sa = JSON.parse(serviceAccountJson) as typeof sa
  } catch {
    throw new Error('GPLAY_SERVICE_ACCOUNT_JSON is not valid JSON')
  }
  if (!sa.client_email || !sa.private_key) {
    throw new Error('GPLAY_SERVICE_ACCOUNT_JSON is missing client_email or private_key')
  }
  return { packageName, clientEmail: sa.client_email, privateKey: sa.private_key }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

class GooglePlayProvider implements SubscriptionProvider {
  readonly id = 'google_play' as const

  async verifyPurchase(payload: unknown): Promise<NormalizedSubscription> {
    const { productId, purchaseToken } = ActivatePayloadSchema.parse(payload)
    const { packageName, clientEmail, privateKey } = getConfig()

    const accessToken = await fetchAccessToken(clientEmail, privateKey)
    const sub = await fetchSubscriptionV2(packageName, purchaseToken, accessToken)

    const acknowledgementSubscriptionId = resolveSubscriptionId(sub, productId)
    if (
      sub.subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE' &&
      sub.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' &&
      acknowledgementSubscriptionId
    ) {
      await acknowledgeSubscription(packageName, acknowledgementSubscriptionId, purchaseToken, accessToken)
    }

    return normalizeSubscription(sub, purchaseToken)
  }

  async restore(payload: unknown): Promise<NormalizedSubscription | null> {
    const { productId, purchaseToken } = ActivatePayloadSchema.parse(payload)
    const { packageName, clientEmail, privateKey } = getConfig()

    const accessToken = await fetchAccessToken(clientEmail, privateKey)
    const sub = await fetchSubscriptionV2(packageName, purchaseToken, accessToken)

    // Expired or canceled — nothing to restore
    if (
      sub.subscriptionState === 'SUBSCRIPTION_STATE_EXPIRED' ||
      sub.subscriptionState === 'SUBSCRIPTION_STATE_CANCELED'
    ) {
      return null
    }

    // Re-acknowledge if somehow pending (shouldn't happen on restore but be safe)
    const acknowledgementSubscriptionId = resolveSubscriptionId(sub, productId)
    if (sub.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' && acknowledgementSubscriptionId) {
      await acknowledgeSubscription(packageName, acknowledgementSubscriptionId, purchaseToken, accessToken)
    }

    return normalizeSubscription(sub, purchaseToken)
  }

  async handleWebhook(
    rawBody: string,
    _headers: Record<string, string>,
    query: Record<string, string>,
  ): Promise<WebhookBandUpdate | null> {
    // Verify push auth token (set in Pub/Sub push endpoint URL as ?token=SECRET)
    const expectedToken = process.env.GPLAY_RTDN_TOKEN
    if (expectedToken && query['token'] !== expectedToken) {
      throw new Error('Invalid RTDN push token')
    }

    const envelope = PubSubEnvelopeSchema.parse(JSON.parse(rawBody))
    const notificationRaw = Buffer.from(envelope.message.data, 'base64').toString('utf8')
    const notification = DeveloperNotificationSchema.parse(JSON.parse(notificationRaw))

    // Ignorable events
    if (notification.testNotification || notification.voidedPurchaseNotification) return null
    if (!notification.subscriptionNotification) return null

    const { notificationType, purchaseToken, subscriptionId } = notification.subscriptionNotification

    if (IGNORABLE_NOTIFICATION_TYPES.has(notificationType)) return null

    const { packageName, clientEmail, privateKey } = getConfig()
    const accessToken = await fetchAccessToken(clientEmail, privateKey)
    const sub = await fetchSubscriptionV2(packageName, purchaseToken, accessToken)

    const normalized = normalizeSubscription(sub, purchaseToken)

    if (
      normalized.status === 'active' &&
      sub.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'
    ) {
      await acknowledgeSubscription(packageName, subscriptionId, purchaseToken, accessToken)
    }

    return {
      providerRef: purchaseToken,
      // linkedPurchaseToken is the old token replaced by this one (renewals issue a new token)
      prevProviderRef: sub.linkedPurchaseToken ?? undefined,
      provider: 'google_play',
      subscription: normalized,
    }
  }

  getManagementUrl(_providerRef: string | null, interval: string | null): string | null {
    const packageName = process.env.GPLAY_PACKAGE_NAME
    if (!packageName) return null
    const productId =
      interval === 'yearly'
        ? (process.env.GPLAY_PRODUCT_PRO_YEARLY ?? process.env.GPLAY_PRODUCT_PRO_MONTHLY)
        : process.env.GPLAY_PRODUCT_PRO_MONTHLY
    if (!productId) return null
    return `https://play.google.com/store/account/subscriptions?sku=${productId}&package=${packageName}`
  }
}

export const googlePlayProvider = new GooglePlayProvider()
