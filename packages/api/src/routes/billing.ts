import { Hono } from 'hono'
import type { Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, or } from 'drizzle-orm'
import { db } from '../db/index.js'
import { bands, users } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant, type TenantEnv } from '../middleware/tenant.js'
import { requireRole } from '../middleware/rbac.js'
import { bandHasProPlan, normalizePlan } from '../lib/entitlements.js'
import { stripeProvider, googlePlayProvider, getProvider } from '../lib/subscription/registry.js'
import { getStripe, envPriceIdForPro } from '../lib/subscription/providers/stripe.js'
import {
  isActiveEntitlement,
  type NormalizedSubscription,
  type SubscriptionProviderId,
  type SubscriptionStatus,
  type BillingInterval,
  type WebhookBandUpdate,
} from '../lib/subscription/types.js'

export const billing = new Hono<TenantEnv>()

type PlanId = 'free' | 'pro' | 'pro-zero'

const PLANS: Array<{
  id: PlanId
  name: string
  bookable: boolean
  prices: { monthly: number | null; yearly: number | null; currency: string }
  limits: { setlistSongs: number | null; members: number | null }
  features: string[]
}> = [
  {
    id: 'free',
    name: 'bandstr free',
    bookable: true,
    prices: { monthly: 0, yearly: 0, currency: 'EUR' },
    limits: { setlistSongs: 15, members: 5 },
    features: [
      'Song voting',
      'Setlist management (up to 15 songs)',
      'Gig setlist management',
      'Bierwart',
      'Calendar',
      'Band member availabilities',
    ],
  },
  {
    id: 'pro',
    name: 'bandstr pro',
    bookable: true,
    prices: { monthly: 2.99, yearly: 29, currency: 'EUR' },
    limits: { setlistSongs: null, members: null },
    features: [
      'Unlimited setlist size',
      'Unlimited band members',
      'Shared notes on songs',
      'Personal song notes',
      'Import/export for band data',
    ],
  },
  {
    id: 'pro-zero',
    name: 'bandstr pro-zero',
    bookable: false,
    prices: { monthly: 0, yearly: 0, currency: 'EUR' },
    limits: { setlistSongs: null, members: null },
    features: ['All pro features', 'Internal-only plan'],
  },
]

function appUrlFromRequest(c: Context) {
  const explicit = process.env.APP_URL?.trim()
  if (explicit) return explicit
  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean)
  if (origins.length > 0) return origins[0]
  const originHeader = c.req.header('Origin')
  if (originHeader) return originHeader
  return 'http://localhost:9000'
}

// ─── DB write helper ──────────────────────────────────────────────────────────

async function writeBandSubscription(
  bandId: number,
  provider: SubscriptionProviderId,
  sub: NormalizedSubscription,
) {
  await db
    .update(bands)
    .set({
      plan: sub.plan,
      subscriptionStatus: sub.status,
      subscriptionInterval: sub.interval,
      subscriptionCurrentPeriodEnd: sub.currentPeriodEnd,
      subscriptionCancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      subscriptionProvider: provider,
      subscriptionProviderRef: sub.providerRef,
      // Keep stripeSubscriptionId in sync for Stripe; clear it for other providers
      stripeSubscriptionId: provider === 'stripe' ? sub.providerRef : null,
    })
    .where(eq(bands.id, bandId))
}

async function applyWebhookUpdate(update: WebhookBandUpdate) {
  let bandId: number | undefined

  if (update.stripeCustomerId) {
    const [row] = await db
      .select({ id: bands.id })
      .from(bands)
      .where(eq(bands.stripeCustomerId, update.stripeCustomerId))
      .limit(1)
    bandId = row?.id
  } else if (update.providerRef) {
    const conditions = [eq(bands.subscriptionProviderRef, update.providerRef)]
    if (update.prevProviderRef) {
      conditions.push(eq(bands.subscriptionProviderRef, update.prevProviderRef))
    }
    const [row] = await db
      .select({ id: bands.id })
      .from(bands)
      .where(or(...conditions))
      .limit(1)
    bandId = row?.id
  }

  if (!bandId) {
    console.warn('[billing] applyWebhookUpdate: band not found', {
      stripeCustomerId: update.stripeCustomerId,
      providerRef: update.providerRef,
    })
    return
  }

  await writeBandSubscription(bandId, update.provider, update.subscription)
}

// ─── GET /plans ───────────────────────────────────────────────────────────────

billing.get('/plans', requireAuth, requireTenant, async (c) => {
  const bandId = c.get('bandId')
  const [band] = await db.select().from(bands).where(eq(bands.id, bandId)).limit(1)
  if (!band) return c.json({ error: 'Band not found' }, 404)

  const provider = (band.subscriptionProvider ?? 'none') as SubscriptionProviderId
  const interval = (band.subscriptionInterval as BillingInterval | null) ?? null
  const managementUrl =
    provider !== 'stripe' && provider !== 'none' && provider !== 'manual'
      ? getProvider(provider).getManagementUrl(band.subscriptionProviderRef ?? null, interval)
      : null // Stripe portal generated dynamically via /billing/portal

  return c.json({
    currentPlan: normalizePlan(band.plan),
    hasProPlan: await bandHasProPlan(bandId),
    subscriptionProvider: provider,
    currentSubscription: {
      status: (band.subscriptionStatus ?? 'none') as SubscriptionStatus,
      interval,
      currentPeriodEnd: band.subscriptionCurrentPeriodEnd,
      cancelAtPeriodEnd: band.subscriptionCancelAtPeriodEnd,
      managementUrl,
    },
    android: {
      packageName: process.env.GPLAY_PACKAGE_NAME ?? null,
      proProducts: {
        monthly: process.env.GPLAY_PRODUCT_PRO_MONTHLY ?? null,
        yearly: process.env.GPLAY_PRODUCT_PRO_YEARLY ?? null,
      },
    },
    ios: {
      bundleId: process.env.APPLE_BUNDLE_ID ?? null,
      proProducts: {
        monthly: process.env.APPLE_PRODUCT_PRO_MONTHLY ?? null,
        yearly: process.env.APPLE_PRODUCT_PRO_YEARLY ?? null,
      },
    },
    plans: PLANS,
  })
})

// ─── POST /google-play/activate ───────────────────────────────────────────────

billing.post(
  '/google-play/activate',
  requireAuth,
  requireTenant,
  requireRole('admin'),
  zValidator(
    'json',
    z.object({
      productId: z.string().min(1),
      purchaseToken: z.string().min(1),
      interval: z.enum(['monthly', 'yearly']).optional(),
    }),
  ),
  async (c) => {
    const bandId = c.get('bandId')
    const body = c.req.valid('json')

    const [band] = await db.select().from(bands).where(eq(bands.id, bandId)).limit(1)
    if (!band) return c.json({ error: 'Band not found' }, 404)

    // Cross-provider guard: refuse if the band has an active subscription from a different store
    const currentProvider = (band.subscriptionProvider ?? 'none') as SubscriptionProviderId
    if (
      (currentProvider === 'stripe' || currentProvider === 'app_store') &&
      isActiveEntitlement((band.subscriptionStatus ?? 'none') as SubscriptionStatus)
    ) {
      return c.json(
        {
          error: `This band already has an active ${currentProvider} subscription. Cancel it there first.`,
          provider: currentProvider,
        },
        409,
      )
    }

    try {
      const sub = await googlePlayProvider.verifyPurchase(body)
      await writeBandSubscription(bandId, 'google_play', sub)
      return c.json({ ok: true })
    } catch (error) {
      console.error('[billing.google-play.activate] failed', error)
      return c.json({ error: 'Purchase verification failed' }, 400)
    }
  },
)

// ─── POST /google-play/restore ────────────────────────────────────────────────

billing.post(
  '/google-play/restore',
  requireAuth,
  requireTenant,
  requireRole('admin'),
  zValidator(
    'json',
    z.object({
      productId: z.string().min(1),
      purchaseToken: z.string().min(1),
    }),
  ),
  async (c) => {
    const bandId = c.get('bandId')
    const body = c.req.valid('json')

    const [band] = await db.select().from(bands).where(eq(bands.id, bandId)).limit(1)
    if (!band) return c.json({ error: 'Band not found' }, 404)

    try {
      const sub = await googlePlayProvider.restore(body)
      if (!sub) return c.json({ error: 'No active subscription found for this purchase token' }, 404)
      await writeBandSubscription(bandId, 'google_play', sub)
      return c.json({ ok: true })
    } catch (error) {
      console.error('[billing.google-play.restore] failed', error)
      return c.json({ error: 'Restore failed' }, 400)
    }
  },
)

// ─── POST /apple/activate (stub — full impl in iter-11) ───────────────────────

billing.post(
  '/apple/activate',
  requireAuth,
  requireTenant,
  requireRole('admin'),
  zValidator(
    'json',
    z.object({
      productId: z.string().min(1),
      originalTransactionId: z.string().min(1),
      transactionId: z.string().optional(),
      interval: z.enum(['monthly', 'yearly']).optional(),
    }),
  ),
  async (c) => {
    // TODO iter-11: replace with real App Store Server API verification
    const bandId = c.get('bandId')
    const { productId, originalTransactionId, interval } = c.req.valid('json')

    const [band] = await db.select().from(bands).where(eq(bands.id, bandId)).limit(1)
    if (!band) return c.json({ error: 'Band not found' }, 404)

    const currentProvider = (band.subscriptionProvider ?? 'none') as SubscriptionProviderId
    if (
      (currentProvider === 'stripe' || currentProvider === 'google_play') &&
      isActiveEntitlement((band.subscriptionStatus ?? 'none') as SubscriptionStatus)
    ) {
      return c.json(
        {
          error: `This band already has an active ${currentProvider} subscription. Cancel it there first.`,
          provider: currentProvider,
        },
        409,
      )
    }

    const yearlyProductId = process.env.APPLE_PRODUCT_PRO_YEARLY
    const resolvedInterval: BillingInterval =
      interval ?? (yearlyProductId && productId === yearlyProductId ? 'yearly' : 'monthly')

    const periodEnd = new Date()
    periodEnd.setMonth(periodEnd.getMonth() + (resolvedInterval === 'yearly' ? 12 : 1))

    await writeBandSubscription(bandId, 'app_store', {
      plan: 'pro',
      status: 'active',
      interval: resolvedInterval,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      providerRef: originalTransactionId,
    })

    return c.json({ ok: true })
  },
)

// ─── POST /checkout (Stripe, web only) ───────────────────────────────────────

billing.post(
  '/checkout',
  requireAuth,
  requireTenant,
  requireRole('admin'),
  zValidator('json', z.object({ plan: z.literal('pro'), interval: z.enum(['monthly', 'yearly']) })),
  async (c) => {
    try {
      const stripe = getStripe()
      const bandId = c.get('bandId')
      const { plan, interval } = c.req.valid('json')

      const [band] = await db.select().from(bands).where(eq(bands.id, bandId)).limit(1)
      if (!band) return c.json({ error: 'Band not found' }, 404)

      // Cross-provider guard: refuse if already active via a store
      const currentProvider = (band.subscriptionProvider ?? 'none') as SubscriptionProviderId
      if (
        (currentProvider === 'google_play' || currentProvider === 'app_store') &&
        isActiveEntitlement((band.subscriptionStatus ?? 'none') as SubscriptionStatus)
      ) {
        return c.json(
          {
            error: `This band is subscribed through ${currentProvider}. Cancel there first to switch to web billing.`,
            provider: currentProvider,
          },
          409,
        )
      }

      const priceId = envPriceIdForPro(interval)
      if (!priceId) {
        return c.json({ error: `Missing Stripe price configuration for plan "${plan}" (${interval})` }, 500)
      }

      let customerId = band.stripeCustomerId
      if (!customerId) {
        const customer = await stripe.customers.create({
          name: band.name,
          metadata: { bandId: String(band.id) },
        })
        customerId = customer.id
        await db.update(bands).set({ stripeCustomerId: customerId }).where(eq(bands.id, band.id))
      }

      const appUrl = appUrlFromRequest(c)
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/billing?checkout=success`,
        cancel_url: `${appUrl}/billing?checkout=cancel`,
        metadata: { bandId: String(band.id), plan, interval },
      })

      return c.json({ url: session.url })
    } catch (error) {
      console.error('[billing.checkout] failed', error)
      return c.json({ error: 'Failed to create checkout session' }, 500)
    }
  },
)

// ─── GET /portal (Stripe, web only) ──────────────────────────────────────────

billing.get('/portal', requireAuth, requireTenant, requireRole('admin'), async (c) => {
  try {
    const stripe = getStripe()
    const bandId = c.get('bandId')
    const [band] = await db.select().from(bands).where(eq(bands.id, bandId)).limit(1)
    if (!band) return c.json({ error: 'Band not found' }, 404)
    if (!band.stripeCustomerId) return c.json({ error: 'No Stripe customer found for this band' }, 400)

    const appUrl = appUrlFromRequest(c)
    const portal = await stripe.billingPortal.sessions.create({
      customer: band.stripeCustomerId,
      return_url: `${appUrl}/billing`,
    })

    return c.json({ url: portal.url })
  } catch (error) {
    console.error('[billing.portal] failed', error)
    return c.json({ error: 'Failed to create billing portal session' }, 500)
  }
})

// ─── POST /internal/assign-pro-zero ──────────────────────────────────────────

billing.post(
  '/internal/assign-pro-zero',
  zValidator('json', z.object({ bandId: z.number().int().positive() })),
  async (c) => {
    const token = c.req.header('x-internal-admin-token')
    if (!token || token !== process.env.INTERNAL_ADMIN_TOKEN) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const { bandId } = c.req.valid('json')
    const [band] = await db.select().from(bands).where(eq(bands.id, bandId)).limit(1)
    if (!band) return c.json({ error: 'Band not found' }, 404)

    await writeBandSubscription(bandId, 'manual', {
      plan: 'pro-zero',
      status: 'active',
      interval: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      providerRef: null,
    })

    return c.json({ ok: true })
  },
)

// ─── POST /internal/assign-user-pro ──────────────────────────────────────────

billing.post(
  '/internal/assign-user-pro',
  zValidator(
    'json',
    z.object({
      userId: z.string().min(1),
      enabled: z.boolean().default(true),
    }),
  ),
  async (c) => {
    const token = c.req.header('x-internal-admin-token')
    if (!token || token !== process.env.INTERNAL_ADMIN_TOKEN) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const { userId, enabled } = c.req.valid('json')
    const [updated] = await db
      .update(users)
      .set({
        devProPlan: enabled,
        devProPlanAssignedAt: enabled ? new Date() : null,
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        devProPlan: users.devProPlan,
        devProPlanAssignedAt: users.devProPlanAssignedAt,
      })

    if (!updated) return c.json({ error: 'User not found' }, 404)
    return c.json({ ok: true, user: updated })
  },
)

// ─── POST /webhook (Stripe) ───────────────────────────────────────────────────

billing.post('/webhook', async (c) => {
  const rawBody = await c.req.text()
  const headers = { 'stripe-signature': c.req.header('stripe-signature') ?? '' }

  let update: WebhookBandUpdate | null
  try {
    update = await stripeProvider.handleWebhook(rawBody, headers, {})
  } catch (error) {
    console.error('[billing.webhook.stripe] failed', error)
    const msg = error instanceof Error ? error.message : 'Webhook error'
    const status = msg.includes('signature') || msg.includes('configured') ? 400 : 500
    return c.json({ error: msg }, status)
  }

  if (update) {
    try {
      await applyWebhookUpdate(update)
    } catch (error) {
      console.error('[billing.webhook.stripe] DB update failed', error)
      return c.json({ error: 'Webhook handler error' }, 500)
    }
  }

  return c.json({ received: true })
})

// ─── POST /webhook/google_play (RTDN via Pub/Sub push) ───────────────────────

billing.post('/webhook/google_play', async (c) => {
  const rawBody = await c.req.text()
  const query = c.req.query()

  let update: WebhookBandUpdate | null
  try {
    update = await googlePlayProvider.handleWebhook(rawBody, {}, query)
  } catch (error) {
    console.error('[billing.webhook.google_play] failed', error)
    const msg = error instanceof Error ? error.message : 'Webhook error'
    if (msg.includes('Invalid RTDN push token')) return c.json({ error: msg }, 401)
    return c.json({ error: msg }, 500)
  }

  if (update) {
    try {
      await applyWebhookUpdate(update)
    } catch (error) {
      console.error('[billing.webhook.google_play] DB update failed', error)
      return c.json({ error: 'Webhook handler error' }, 500)
    }
  }

  // Pub/Sub requires 2xx to acknowledge delivery; any non-2xx causes a retry
  return c.json({ received: true })
})
