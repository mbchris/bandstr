import { Hono } from 'hono'
import type { Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { bands, users } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant, type TenantEnv } from '../middleware/tenant.js'
import { requireRole } from '../middleware/rbac.js'
import { bandHasProPlan, normalizePlan } from '../lib/entitlements.js'

export const billing = new Hono<TenantEnv>()

type PlanId = 'free' | 'pro' | 'pro-zero'
type BillingInterval = 'monthly' | 'yearly'
type SubscriptionStatus = 'none' | 'active' | 'canceled' | 'past_due' | 'trialing'

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
    features: [
      'All pro features',
      'Internal-only plan',
    ],
  },
]

let stripeClient: Stripe | null = null

function getStripe(): Stripe {
  if (stripeClient) return stripeClient

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }

  stripeClient = new Stripe(secretKey)
  return stripeClient
}

function appUrlFromRequest(c: Context) {
  const explicit = process.env.APP_URL?.trim()
  if (explicit) return explicit

  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean)
  if (origins.length > 0) return origins[0]

  const originHeader = c.req.header('Origin')
  if (originHeader) return originHeader

  return 'http://localhost:9000'
}

function envPriceIdForPro(interval: BillingInterval) {
  if (interval === 'yearly') return process.env.STRIPE_PRICE_PRO_YEARLY
  return process.env.STRIPE_PRICE_PRO_MONTHLY ?? process.env.STRIPE_PRICE_PRO
}

function googlePlayProductIdForPro(interval: BillingInterval) {
  if (interval === 'yearly') return process.env.GPLAY_PRODUCT_PRO_YEARLY
  return process.env.GPLAY_PRODUCT_PRO_MONTHLY
}

function billingIntervalFromPrice(price?: Stripe.Price): BillingInterval | null {
  const recurring = price?.recurring?.interval
  if (recurring === 'year') return 'yearly'
  if (recurring === 'month') return 'monthly'
  return null
}

function planFromPriceId(priceId?: string | null): { plan: PlanId; interval: BillingInterval | null } {
  if (!priceId) return { plan: 'free', interval: null }
  if (process.env.STRIPE_PRICE_PRO_YEARLY && priceId === process.env.STRIPE_PRICE_PRO_YEARLY) {
    return { plan: 'pro', interval: 'yearly' }
  }
  if (
    (process.env.STRIPE_PRICE_PRO_MONTHLY && priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) ||
    (process.env.STRIPE_PRICE_PRO && priceId === process.env.STRIPE_PRICE_PRO)
  ) {
    return { plan: 'pro', interval: 'monthly' }
  }
  return { plan: 'free', interval: null }
}

function normalizeSubscriptionStatus(status?: string | null): SubscriptionStatus {
  if (status === 'active') return 'active'
  if (status === 'trialing') return 'trialing'
  if (status === 'past_due') return 'past_due'
  if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') return 'canceled'
  return 'none'
}

async function updateBandSubscriptionByCustomer(
  customerId: string,
  payload: {
    plan: PlanId
    status: SubscriptionStatus
    interval: BillingInterval | null
    currentPeriodEnd: Date | null
    stripeSubscriptionId: string | null
    cancelAtPeriodEnd: boolean
  },
) {
  const [band] = await db.select({ id: bands.id }).from(bands).where(eq(bands.stripeCustomerId, customerId)).limit(1)
  if (!band) return
  await db
    .update(bands)
    .set({
      plan: payload.plan,
      subscriptionStatus: payload.status,
      subscriptionInterval: payload.interval,
      subscriptionCurrentPeriodEnd: payload.currentPeriodEnd,
      stripeSubscriptionId: payload.stripeSubscriptionId,
      subscriptionCancelAtPeriodEnd: payload.cancelAtPeriodEnd,
    })
    .where(eq(bands.id, band.id))
}

billing.get('/plans', requireAuth, requireTenant, async (c) => {
  const bandId = c.get('bandId')
  const [band] = await db.select().from(bands).where(eq(bands.id, bandId)).limit(1)
  if (!band) return c.json({ error: 'Band not found' }, 404)

  return c.json({
    currentPlan: normalizePlan(band.plan),
    hasProPlan: await bandHasProPlan(bandId),
    currentSubscription: {
      status: normalizeSubscriptionStatus(band.subscriptionStatus),
      interval: (band.subscriptionInterval as BillingInterval | null) ?? null,
      currentPeriodEnd: band.subscriptionCurrentPeriodEnd,
      cancelAtPeriodEnd: band.subscriptionCancelAtPeriodEnd,
    },
    android: {
      packageName: process.env.GPLAY_PACKAGE_NAME ?? null,
      proProducts: {
        monthly: googlePlayProductIdForPro('monthly') ?? null,
        yearly: googlePlayProductIdForPro('yearly') ?? null,
      },
    },
    plans: PLANS,
  })
})

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
      orderId: z.string().optional(),
      interval: z.enum(['monthly', 'yearly']).optional(),
    }),
  ),
  async (c) => {
    const bandId = c.get('bandId')
    const { productId, purchaseToken, interval } = c.req.valid('json')
    const [band] = await db.select().from(bands).where(eq(bands.id, bandId)).limit(1)
    if (!band) return c.json({ error: 'Band not found' }, 404)

    const resolvedInterval: BillingInterval =
      interval ??
      (productId === googlePlayProductIdForPro('yearly') ? 'yearly' : 'monthly')

    const periodEnd = new Date()
    periodEnd.setMonth(periodEnd.getMonth() + (resolvedInterval === 'yearly' ? 12 : 1))

    await db
      .update(bands)
      .set({
        plan: 'pro',
        subscriptionStatus: 'active',
        subscriptionInterval: resolvedInterval,
        subscriptionCurrentPeriodEnd: periodEnd,
        stripeSubscriptionId: `gplay:${productId}:${purchaseToken.slice(0, 32)}`,
        subscriptionCancelAtPeriodEnd: false,
      })
      .where(eq(bands.id, band.id))

    return c.json({ ok: true })
  },
)

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
        metadata: {
          bandId: String(band.id),
          plan,
          interval,
        },
      })

      return c.json({ url: session.url })
    } catch (error) {
      console.error('[billing.checkout] failed', error)
      return c.json({ error: 'Failed to create checkout session' }, 500)
    }
  },
)

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

    await db
      .update(bands)
      .set({
        plan: 'pro-zero',
        subscriptionStatus: 'active',
        subscriptionInterval: null,
        subscriptionCurrentPeriodEnd: null,
        stripeSubscriptionId: null,
        subscriptionCancelAtPeriodEnd: false,
      })
      .where(eq(bands.id, bandId))

    return c.json({ ok: true })
  },
)

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

billing.post('/webhook', async (c) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return c.json({ error: 'STRIPE_WEBHOOK_SECRET is not configured' }, 500)
  }

  const signature = c.req.header('stripe-signature')
  if (!signature) {
    return c.json({ error: 'Missing stripe-signature header' }, 400)
  }

  let event: Stripe.Event
  try {
    const stripe = getStripe()
    const payload = await c.req.text()
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (error) {
    console.error('[billing.webhook] signature verification failed', error)
    return c.json({ error: 'Invalid webhook signature' }, 400)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (typeof session.customer === 'string' && session.mode === 'subscription') {
          const plan = normalizePlan((session.metadata?.plan as string | undefined) ?? 'free')
          const interval = (session.metadata?.interval as BillingInterval | undefined) ?? null
          await updateBandSubscriptionByCustomer(session.customer, {
            plan,
            status: 'active',
            interval,
            currentPeriodEnd: null,
            stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
            cancelAtPeriodEnd: false,
          })
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        if (typeof sub.customer === 'string') {
          const priceId = sub.items.data[0]?.price?.id
          const currentPeriodEndUnix = (sub as { current_period_end?: number }).current_period_end
          const mapped = planFromPriceId(priceId)
          await updateBandSubscriptionByCustomer(sub.customer, {
            plan: mapped.plan,
            status: normalizeSubscriptionStatus(sub.status),
            interval: mapped.interval ?? billingIntervalFromPrice(sub.items.data[0]?.price),
            currentPeriodEnd: currentPeriodEndUnix ? new Date(currentPeriodEndUnix * 1000) : null,
            stripeSubscriptionId: sub.id,
            cancelAtPeriodEnd: !!sub.cancel_at_period_end,
          })
        }
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        if (typeof sub.customer === 'string') {
          const currentPeriodEndUnix = (sub as { current_period_end?: number }).current_period_end
          await updateBandSubscriptionByCustomer(sub.customer, {
            plan: 'free',
            status: 'canceled',
            interval: null,
            currentPeriodEnd: currentPeriodEndUnix ? new Date(currentPeriodEndUnix * 1000) : null,
            stripeSubscriptionId: null,
            cancelAtPeriodEnd: false,
          })
        }
        break
      }
      default:
        break
    }
  } catch (error) {
    console.error('[billing.webhook] handler failed', error)
    return c.json({ error: 'Webhook handler error' }, 500)
  }

  return c.json({ received: true })
})
