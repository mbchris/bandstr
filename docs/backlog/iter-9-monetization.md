# Iteration 9 — Monetization

- [x] Introduce subscription plan model for bands: `free`, `pro`, `pro-zero`.
- [x] Add billing interval support for `pro`: monthly and yearly.
- [x] Integrate payment checkout flow for `pro` plan upgrades.
- [x] Implement subscription status sync (active, canceled, past_due, trialing if used).
- [x] Add webhook handling to keep subscription state in sync with billing provider.
- [x] Keep `pro-zero` as internal-only (not available in public checkout UI/API).
- [x] Add admin/dev-only endpoint or workflow to assign `pro-zero`.
- [x] Enforce free-plan song limit (max 15 setlist songs) on API level.
- [x] Enforce free-plan member limit (max 5 members) on API level.
- [x] Keep free-plan features usable: voting, calendar, availabilities, bierwart, gig setlists.
- [x] Gate shared notes on songs as pro-only (API and UI).
- [x] Gate personal notes on songs as pro-only (API and UI).
- [x] Gate import/export functionality as pro-only (API and UI).
- [x] Update Billing page to show current plan, limits, renewal/cancel info, and upgrade CTA.
- [x] Update Dashboard subscription card to reflect live plan and status.
- [x] Implement downgrade behavior: preserve existing data, block creating items above limit.
- [x] Add clear user-facing messages when limits are reached.
- [ ] Add tests for plan enforcement and subscription transitions.

## Multi-provider refactor (mobile-first)

bandstr ships primarily as Android (iter-10) and iOS (iter-11) via Capacitor, with the web view as a secondary surface. Apple and Google require their own billing for digital subscriptions sold inside their apps, so the Stripe-only model from the items above must be generalized. Stripe is retained only as a web fallback.

### SubscriptionProvider pattern

- [ ] Define a `SubscriptionProvider` interface in `packages/api/src/lib/subscription/` with a stable contract:
  - `id: 'stripe' | 'google_play' | 'app_store' | 'manual'`
  - `startCheckout(bandId, plan, interval, ctx) → { url?, productId?, ... }` (provider decides whether checkout is server-initiated like Stripe or client-initiated like IAP)
  - `verifyPurchase(bandId, payload) → NormalizedSubscription` (called from the activate endpoint after a native purchase)
  - `handleWebhook(req) → NormalizedSubscription | null` (Stripe webhook, Google RTDN, Apple ASSN — all funnel through here)
  - `getManagementUrl(band) → string | null` (deep-link users to the right cancel/manage surface)
  - `restore(bandId, payload) → NormalizedSubscription | null` (mobile "restore purchases")
- [ ] Introduce `NormalizedSubscription` type: `{ plan, status, interval, currentPeriodEnd, cancelAtPeriodEnd, providerRef }` — every provider maps into this, the rest of the app only reads normalized fields.
- [ ] Move the Stripe code in `packages/api/src/routes/billing.ts` into `providers/stripe.ts` behind the interface. Keep wire format identical so existing web checkout keeps working.
- [ ] Register providers in a map; route `/billing/checkout`, `/billing/activate`, `/billing/restore`, `/billing/webhook/:provider` to the right impl based on provider id.

### Data model changes

- [ ] Add `subscription_provider` column to `bands` (enum: `stripe | google_play | app_store | manual | none`).
- [ ] Add `subscription_provider_ref` (text) — generic provider-side id: Stripe subscription id, Google Play `purchaseToken`, Apple `originalTransactionId`. Replaces the current `gplay:` / `apple:` prefix overloading of `stripe_subscription_id`.
- [ ] Keep `stripe_customer_id` for Stripe-specific customer linking.
- [ ] Migration: backfill `subscription_provider` from existing rows (infer from `stripe_subscription_id` prefix for pre-existing mobile activations) and null out the overloaded values.
- [ ] Enforce one provider per band: a band's active subscription belongs to exactly one provider; cross-provider switches require cancel-first in the origin store.

### Platform-aware checkout routing (web UI)

- [ ] In the Billing page, detect runtime via `Capacitor.getPlatform()`: `android → google_play`, `ios → app_store`, `web → stripe`.
- [ ] Upgrade CTA invokes the provider-appropriate flow:
  - Stripe: existing redirect to hosted checkout.
  - Google Play: trigger native billing plugin, then POST purchase token to `/billing/activate` (provider=google_play).
  - Apple (later): StoreKit purchase, then POST to `/billing/activate` (provider=app_store).
- [ ] Manage-subscription button uses `getManagementUrl`: Stripe portal for web subs, deep-link to Play subscription center (`https://play.google.com/store/account/subscriptions?sku=...&package=...`) for Play subs, App Store subscription settings for Apple subs.
- [ ] Hide the management button for `manual` (pro-zero) subscriptions.
- [ ] Show the user's subscription provider on the Billing page so they know where to manage/cancel.

### Google Play implementation (initial)

- [ ] Replace the current trust-the-client `/billing/google-play/activate` with real server-side verification using the Google Play Developer API (`purchases.subscriptionsv2.get`) — verify package name, product id, purchase state, expiry, and auto-renew status.
- [ ] Add service-account credentials env vars: `GPLAY_SERVICE_ACCOUNT_JSON` (or path) with `androidpublisher` scope.
- [ ] Acknowledge the purchase via `purchases.subscriptions.acknowledge` within 3 days, or Google auto-refunds.
- [ ] On verified activation: write `subscription_provider='google_play'`, `subscription_provider_ref=<purchaseToken>`, plan=`pro`, status=`active`, period end from the API response.
- [ ] Add Real-Time Developer Notifications (RTDN) consumer: Pub/Sub subscription → HTTPS push endpoint `/billing/webhook/google_play` → verify JWT → re-fetch subscription state via API → normalize → update band. Handle notification types: `SUBSCRIPTION_PURCHASED`, `RENEWED`, `IN_GRACE_PERIOD`, `ON_HOLD`, `CANCELED`, `EXPIRED`, `REVOKED`, `PAUSED`, `RESTARTED`, `PRICE_CHANGE_CONFIRMED`.
- [ ] Extend status enum: add `grace_period`, `on_hold`, `paused` to `SubscriptionStatus` and update entitlement checks (`grace_period` still counts as entitled, `on_hold` does not).
- [ ] Implement `/billing/restore` for Google Play: client sends current purchase token, server re-verifies and rebinds entitlement to the band. Required for users reinstalling the app or switching devices.
- [ ] Add env vars: `GPLAY_PACKAGE_NAME`, `GPLAY_PRODUCT_PRO_MONTHLY`, `GPLAY_PRODUCT_PRO_YEARLY`, `GPLAY_PUBSUB_VERIFICATION_TOKEN` (or OIDC audience for push auth).
- [ ] Document in Play Console: create base plan + offer for `pro_monthly` and `pro_yearly` matching the Stripe prices; note that Google controls local pricing per region.

### Apple App Store adaptations (later, iter-11)

- [ ] Add `providers/app_store.ts` mirroring the Google Play shape.
- [ ] Server-side verification via App Store Server API (`GET /inApps/v1/subscriptions/{transactionId}`) with signed JWT using an App Store Connect API key.
- [ ] App Store Server Notifications v2 endpoint at `/billing/webhook/app_store`: verify signed payload, decode `signedTransactionInfo` and `signedRenewalInfo`, normalize. Notification types to handle: `SUBSCRIBED`, `DID_RENEW`, `DID_FAIL_TO_RENEW`, `GRACE_PERIOD_EXPIRED`, `EXPIRED`, `REVOKE`, `REFUND`, `PRICE_INCREASE`.
- [ ] Store `originalTransactionId` as `subscription_provider_ref` — stable across renewals, unlike per-renewal `transactionId`.
- [ ] Restore purchases uses StoreKit's native restore, then POSTs transactions to `/billing/restore`.
- [ ] Env vars: `APPLE_BUNDLE_ID`, `APPLE_PRODUCT_PRO_MONTHLY`, `APPLE_PRODUCT_PRO_YEARLY`, `APPLE_ISSUER_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`.

### Follow-ups

- [ ] Remove the `gplay:`/`apple:` string prefix hack in `stripe_subscription_id` once migration has run.
- [ ] Tests: per-provider verification fixtures, webhook/RTDN payload replay, restore flow, cross-provider guard (cannot upgrade via Play when an active Stripe sub exists and vice versa).
- [ ] Observability: log `(provider, status, band_id)` on every state transition; add a dashboard panel per provider.

