import Stripe from 'stripe'
import { normalizePlan } from '../../entitlements.js'
import type {
  SubscriptionProvider,
  NormalizedSubscription,
  WebhookBandUpdate,
  BillingInterval,
  PlanId,
  SubscriptionStatus,
} from '../types.js'

// ─── Stripe client ────────────────────────────────────────────────────────────

let stripeClient: Stripe | null = null

export function getStripe(): Stripe {
  if (stripeClient) return stripeClient
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not configured')
  stripeClient = new Stripe(secretKey)
  return stripeClient
}

// ─── Price / plan helpers ─────────────────────────────────────────────────────

export function envPriceIdForPro(interval: BillingInterval): string | undefined {
  if (interval === 'yearly') return process.env.STRIPE_PRICE_PRO_YEARLY
  return process.env.STRIPE_PRICE_PRO_MONTHLY ?? process.env.STRIPE_PRICE_PRO
}

function planFromPriceId(priceId?: string | null): { plan: PlanId; interval: BillingInterval | null } {
  if (!priceId) return { plan: 'free', interval: null }
  if (process.env.STRIPE_PRICE_PRO_YEARLY && priceId === process.env.STRIPE_PRICE_PRO_YEARLY)
    return { plan: 'pro', interval: 'yearly' }
  if (
    (process.env.STRIPE_PRICE_PRO_MONTHLY && priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) ||
    (process.env.STRIPE_PRICE_PRO && priceId === process.env.STRIPE_PRICE_PRO)
  )
    return { plan: 'pro', interval: 'monthly' }
  return { plan: 'free', interval: null }
}

function billingIntervalFromPrice(price?: Stripe.Price): BillingInterval | null {
  const recurring = price?.recurring?.interval
  if (recurring === 'year') return 'yearly'
  if (recurring === 'month') return 'monthly'
  return null
}

function normalizeStripeStatus(status?: string | null): SubscriptionStatus {
  if (status === 'active') return 'active'
  if (status === 'trialing') return 'trialing'
  if (status === 'past_due') return 'past_due'
  if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') return 'canceled'
  return 'none'
}

// ─── Provider ─────────────────────────────────────────────────────────────────

class StripeProvider implements SubscriptionProvider {
  readonly id = 'stripe' as const

  async verifyPurchase(_payload: unknown): Promise<NormalizedSubscription> {
    throw new Error('Stripe uses server-initiated checkout; verifyPurchase is not applicable')
  }

  async restore(_payload: unknown): Promise<NormalizedSubscription | null> {
    return null
  }

  getManagementUrl(_providerRef: string | null, _interval: string | null): string | null {
    // Stripe portal URL is generated dynamically via the /billing/portal endpoint
    return null
  }

  async handleWebhook(
    rawBody: string,
    headers: Record<string, string>,
    _query: Record<string, string>,
  ): Promise<WebhookBandUpdate | null> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured')

    const signature = headers['stripe-signature']
    if (!signature) throw new Error('Missing stripe-signature header')

    let event: Stripe.Event
    try {
      event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret)
    } catch {
      throw new Error('Invalid Stripe webhook signature')
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (typeof session.customer !== 'string' || session.mode !== 'subscription') return null
        const plan = normalizePlan((session.metadata?.plan as string | undefined) ?? 'free')
        const interval = (session.metadata?.interval as BillingInterval | undefined) ?? null
        return {
          stripeCustomerId: session.customer,
          provider: 'stripe',
          subscription: {
            plan,
            status: 'active',
            interval,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            providerRef: typeof session.subscription === 'string' ? session.subscription : null,
          },
        }
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        if (typeof sub.customer !== 'string') return null
        const priceId = sub.items.data[0]?.price?.id
        const currentPeriodEndUnix = (sub as { current_period_end?: number }).current_period_end
        const mapped = planFromPriceId(priceId)
        return {
          stripeCustomerId: sub.customer,
          provider: 'stripe',
          subscription: {
            plan: mapped.plan,
            status: normalizeStripeStatus(sub.status),
            interval: mapped.interval ?? billingIntervalFromPrice(sub.items.data[0]?.price),
            currentPeriodEnd: currentPeriodEndUnix ? new Date(currentPeriodEndUnix * 1000) : null,
            cancelAtPeriodEnd: !!sub.cancel_at_period_end,
            providerRef: sub.id,
          },
        }
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        if (typeof sub.customer !== 'string') return null
        const currentPeriodEndUnix = (sub as { current_period_end?: number }).current_period_end
        return {
          stripeCustomerId: sub.customer,
          provider: 'stripe',
          subscription: {
            plan: 'free',
            status: 'canceled',
            interval: null,
            currentPeriodEnd: currentPeriodEndUnix ? new Date(currentPeriodEndUnix * 1000) : null,
            cancelAtPeriodEnd: false,
            providerRef: null,
          },
        }
      }
      default:
        return null
    }
  }
}

export const stripeProvider = new StripeProvider()
