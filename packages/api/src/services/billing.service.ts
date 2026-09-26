import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users } from '../db/schema/index.js'
import { getStripe, envPriceIdForPro } from '../lib/subscription/providers/stripe.js'
import type { BillingInterval } from '../lib/subscription/types.js'

export const PLANS = [
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
] as const

export const billingService = {
  getPlans() {
    return PLANS
  },

  async createCheckoutSession(params: {
    userId: string
    userEmail: string
    userName: string
    interval: BillingInterval
    successUrl: string
    cancelUrl: string
  }) {
    const stripe = getStripe()
    const { userId, userEmail, userName, interval, successUrl, cancelUrl } = params
    const priceId = envPriceIdForPro(interval)

    if (!priceId) {
      throw new Error(`No Stripe price configured for interval "${interval}"`)
    }

    const [user] = await db
      .select({ stripeCustomerId: users.stripeCustomerId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    let customerId = user?.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        name: userName,
        metadata: { userId },
      })
      customerId = customer.id
      await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, userId))
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId },
    })

    return session.url
  },

  async createPortalSession(userId: string, returnUrl: string) {
    const stripe = getStripe()
    const [user] = await db
      .select({ stripeCustomerId: users.stripeCustomerId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user?.stripeCustomerId) {
      return null
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    })

    return portal.url
  },
}
