import { stripeProvider } from './providers/stripe.js'
import { googlePlayProvider } from './providers/google-play.js'
import type { SubscriptionProvider, SubscriptionProviderId } from './types.js'

const providers: Partial<Record<SubscriptionProviderId, SubscriptionProvider>> = {
  stripe: stripeProvider,
  google_play: googlePlayProvider,
}

export function getProvider(id: SubscriptionProviderId): SubscriptionProvider {
  const p = providers[id]
  if (!p) throw new Error(`No subscription provider registered for '${id}'`)
  return p
}

export { stripeProvider, googlePlayProvider }
export type { SubscriptionProvider, SubscriptionProviderId }
