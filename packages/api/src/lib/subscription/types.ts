import type { PlanId } from '../entitlements.js'

export type { PlanId }

export type SubscriptionProviderId = 'stripe' | 'google_play' | 'app_store' | 'manual' | 'none'
export type BillingInterval = 'monthly' | 'yearly'
export type SubscriptionStatus =
  | 'none'
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'trialing'
  | 'grace_period'
  | 'on_hold'
  | 'paused'

/** `grace_period` still grants access; `on_hold`, `paused`, `canceled`, `none` do not. */
export function isActiveEntitlement(status: SubscriptionStatus): boolean {
  return status === 'active' || status === 'trialing' || status === 'grace_period'
}

export interface NormalizedSubscription {
  plan: PlanId
  status: SubscriptionStatus
  interval: BillingInterval | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  /** Provider-specific identifier: Stripe subscription id, Google Play purchaseToken, Apple originalTransactionId */
  providerRef: string | null
}

export interface WebhookBandUpdate {
  /** Stripe: look up band by stripeCustomerId */
  stripeCustomerId?: string
  /** Google Play / Apple: look up band by subscriptionProviderRef */
  providerRef?: string
  /** Google Play renewal: the old purchaseToken that was replaced (fallback lookup) */
  prevProviderRef?: string
  provider: SubscriptionProviderId
  subscription: NormalizedSubscription
}

export interface SubscriptionProvider {
  readonly id: SubscriptionProviderId
  /** Server-side verification after a native purchase. Returns normalized subscription state. */
  verifyPurchase(payload: unknown): Promise<NormalizedSubscription>
  /** Handle webhook / RTDN push. Returns update to apply, or null if event is ignorable. */
  handleWebhook(
    rawBody: string,
    headers: Record<string, string>,
    query: Record<string, string>,
  ): Promise<WebhookBandUpdate | null>
  /** Restore entitlement after app reinstall / new device. Returns null if subscription is expired. */
  restore(payload: unknown): Promise<NormalizedSubscription | null>
  /**
   * Static deep-link for the user to manage their subscription in the store.
   * Returns null for Stripe (portal URL is generated dynamically via /billing/portal).
   */
  getManagementUrl(providerRef: string | null, interval: string | null): string | null
}
