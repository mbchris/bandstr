import { Hono } from 'hono'
import type { Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { and, eq, or } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users, bandMembers } from '../db/schema.js'
import { requireAuth, type AuthEnv } from '../middleware/auth.js'
import { userEffectivePlan } from '../lib/entitlements.js'
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

export const billing = new Hono<AuthEnv>()

type PlanId = 'free' | 'pro'

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
      prices: { monthly: 1.99, yearly: 19.99, currency: 'EUR' },
      limits: { setlistSongs: null, members: null },
      features: [
        'all from free, plus',
        'Unlimited setlist size',
        'Unlimited band members',
        'Shared notes on songs',
        'Personal song notes',
        'Import/export for band data',
        'Bierwart with counter',
        'join multiple bands with one login',
      ],
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

async function resolveOptionalBandId(c: Context<AuthEnv>): Promise<number | null> {
  const rawBandId = c.req.header('X-Band-Id')?.trim()
  if (!rawBandId) return null

  const bandId = Number(rawBandId)
  if (!Number.isInteger(bandId) || bandId <= 0) return null

  const userId = c.get('user').id
  const [membership] = await db
    .select({ bandId: bandMembers.bandId })
    .from(bandMembers)
    .where(and(eq(bandMembers.userId, userId), eq(bandMembers.bandId, bandId)))
    .limit(1)

  if (!membership) return null
  return bandId
}

// ─── DB write helper ──────────────────────────────────────────────────────────

async function writeUserSubscription(
  userId: string,
  provider: SubscriptionProviderId,
  sub: NormalizedSubscription,
) {
  await db
    .update(users)
    .set({
      subscriptionPlan: sub.plan,
      subscriptionStatus: sub.status,
      subscriptionInterval: sub.interval,
      subscriptionCurrentPeriodEnd: sub.currentPeriodEnd,
      subscriptionCancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      subscriptionProvider: provider,
      subscriptionProviderRef: sub.providerRef,
    })
    .where(eq(users.id, userId))
}

async function applyWebhookUpdate(update: WebhookBandUpdate) {
  let userId: string | undefined

  if (update.stripeCustomerId) {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.stripeCustomerId, update.stripeCustomerId))
      .limit(1)
    userId = row?.id
  } else if (update.providerRef) {
    const conditions = [eq(users.subscriptionProviderRef, update.providerRef)]
    if (update.prevProviderRef) {
      conditions.push(eq(users.subscriptionProviderRef, update.prevProviderRef))
    }
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(or(...conditions))
      .limit(1)
    userId = row?.id
  }

  if (!userId) {
    console.warn('[billing] applyWebhookUpdate: user not found', {
      stripeCustomerId: update.stripeCustomerId,
      providerRef: update.providerRef,
    })
    return
  }

  await writeUserSubscription(userId, update.provider, update.subscription)
}

// ─── GET /plans ───────────────────────────────────────────────────────────────

billing.get('/plans', requireAuth, async (c) => {
  const userId = c.get('user').id
  const bandId = await resolveOptionalBandId(c)

  const [user] = await db
    .select({
      devProPlan: users.devProPlan,
      subscriptionPlan: users.subscriptionPlan,
      subscriptionStatus: users.subscriptionStatus,
      subscriptionInterval: users.subscriptionInterval,
      subscriptionCurrentPeriodEnd: users.subscriptionCurrentPeriodEnd,
      subscriptionCancelAtPeriodEnd: users.subscriptionCancelAtPeriodEnd,
      subscriptionProvider: users.subscriptionProvider,
      subscriptionProviderRef: users.subscriptionProviderRef,
      stripeCustomerId: users.stripeCustomerId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) return c.json({ error: 'User not found' }, 404)

  const effectivePlan = await userEffectivePlan(userId, bandId)
  const provider = (user.subscriptionProvider ?? 'none') as SubscriptionProviderId
  const interval = (user.subscriptionInterval as BillingInterval | null) ?? null
  const managementUrl =
    provider !== 'stripe' && provider !== 'none' && provider !== 'manual'
      ? getProvider(provider).getManagementUrl(user.subscriptionProviderRef ?? null, interval)
      : null

  return c.json({
    effectivePlan,
    userPlan: user.devProPlan ? 'pro' : (user.subscriptionPlan ?? 'free'),
    subscriptionProvider: provider,
    currentSubscription: {
      status: (user.subscriptionStatus ?? 'none') as SubscriptionStatus,
      interval,
      currentPeriodEnd: user.subscriptionCurrentPeriodEnd,
      cancelAtPeriodEnd: user.subscriptionCancelAtPeriodEnd,
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
  zValidator(
    'json',
    z.object({
      productId: z.string().min(1),
      purchaseToken: z.string().min(1),
      interval: z.enum(['monthly', 'yearly']).optional(),
    }),
  ),
  async (c) => {
    const userId = c.get('user').id
    const body = c.req.valid('json')

    const [user] = await db
      .select({ subscriptionProvider: users.subscriptionProvider, subscriptionStatus: users.subscriptionStatus })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (!user) return c.json({ error: 'User not found' }, 404)

    // Cross-provider guard: refuse if the user has an active subscription from a different store
    const currentProvider = (user.subscriptionProvider ?? 'none') as SubscriptionProviderId
    if (
      (currentProvider === 'stripe' || currentProvider === 'app_store') &&
      isActiveEntitlement((user.subscriptionStatus ?? 'none') as SubscriptionStatus)
    ) {
      return c.json(
        {
          error: `You already have an active ${currentProvider} subscription. Cancel it there first.`,
          provider: currentProvider,
        },
        409,
      )
    }

    try {
      const sub = await googlePlayProvider.verifyPurchase(body)
      await writeUserSubscription(userId, 'google_play', sub)
      return c.json({ ok: true })
    } catch (error) {
      console.error('[billing.google-play.activate] failed', error)
      const reason = error instanceof Error ? error.message : 'Unknown verification error'
      return c.json({ error: `Purchase verification failed: ${reason}` }, 400)
    }
  },
)

// ─── POST /google-play/restore ────────────────────────────────────────────────

billing.post(
  '/google-play/restore',
  requireAuth,
  zValidator(
    'json',
    z.object({
      productId: z.string().min(1),
      purchaseToken: z.string().min(1),
    }),
  ),
  async (c) => {
    const userId = c.get('user').id
    const body = c.req.valid('json')

    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
    if (!user) return c.json({ error: 'User not found' }, 404)

    try {
      const sub = await googlePlayProvider.restore(body)
      if (!sub) return c.json({ error: 'No active subscription found for this purchase token' }, 404)
      await writeUserSubscription(userId, 'google_play', sub)
      return c.json({ ok: true })
    } catch (error) {
      console.error('[billing.google-play.restore] failed', error)
      const reason = error instanceof Error ? error.message : 'Unknown restore error'
      return c.json({ error: `Restore failed: ${reason}` }, 400)
    }
  },
)

// ─── POST /apple/activate ─────────────────────────────────────────────────────

billing.post(
  '/apple/activate',
  requireAuth,
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
    const userId = c.get('user').id
    const { productId, originalTransactionId, interval } = c.req.valid('json')

    const [user] = await db
      .select({ subscriptionProvider: users.subscriptionProvider, subscriptionStatus: users.subscriptionStatus })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (!user) return c.json({ error: 'User not found' }, 404)

    const currentProvider = (user.subscriptionProvider ?? 'none') as SubscriptionProviderId
    if (
      (currentProvider === 'stripe' || currentProvider === 'google_play') &&
      isActiveEntitlement((user.subscriptionStatus ?? 'none') as SubscriptionStatus)
    ) {
      return c.json(
        {
          error: `You already have an active ${currentProvider} subscription. Cancel it there first.`,
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

    await writeUserSubscription(userId, 'app_store', {
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
  zValidator('json', z.object({ plan: z.literal('pro'), interval: z.enum(['monthly', 'yearly']) })),
  async (c) => {
    try {
      const stripe = getStripe()
      const userId = c.get('user').id
      const { plan, interval } = c.req.valid('json')

      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          stripeCustomerId: users.stripeCustomerId,
          subscriptionProvider: users.subscriptionProvider,
          subscriptionStatus: users.subscriptionStatus,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      if (!user) return c.json({ error: 'User not found' }, 404)

      // Cross-provider guard: refuse if already active via a store
      const currentProvider = (user.subscriptionProvider ?? 'none') as SubscriptionProviderId
      if (
        (currentProvider === 'google_play' || currentProvider === 'app_store') &&
        isActiveEntitlement((user.subscriptionStatus ?? 'none') as SubscriptionStatus)
      ) {
        return c.json(
          {
            error: `You are subscribed through ${currentProvider}. Cancel there first to switch to web billing.`,
            provider: currentProvider,
          },
          409,
        )
      }

      const priceId = envPriceIdForPro(interval)
      if (!priceId) {
        return c.json({ error: `Missing Stripe price configuration for plan "${plan}" (${interval})` }, 500)
      }

      let customerId = user.stripeCustomerId
      if (!customerId) {
        const customer = await stripe.customers.create({
          name: user.name,
          email: user.email,
          metadata: { userId: user.id },
        })
        customerId = customer.id
        await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, user.id))
      }

      const appUrl = appUrlFromRequest(c)
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/billing?checkout=success`,
        cancel_url: `${appUrl}/billing?checkout=cancel`,
        metadata: { userId: user.id, plan, interval },
      })

      return c.json({ url: session.url })
    } catch (error) {
      console.error('[billing.checkout] failed', error)
      return c.json({ error: 'Failed to create checkout session' }, 500)
    }
  },
)

// ─── GET /portal (Stripe, web only) ──────────────────────────────────────────

billing.get('/portal', requireAuth, async (c) => {
  try {
    const stripe = getStripe()
    const userId = c.get('user').id

    const [user] = await db
      .select({ stripeCustomerId: users.stripeCustomerId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (!user) return c.json({ error: 'User not found' }, 404)
    if (!user.stripeCustomerId) return c.json({ error: 'No Stripe customer found for this user' }, 400)

    const appUrl = appUrlFromRequest(c)
    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appUrl}/billing`,
    })

    return c.json({ url: portal.url })
  } catch (error) {
    console.error('[billing.portal] failed', error)
    return c.json({ error: 'Failed to create billing portal session' }, 500)
  }
})

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
