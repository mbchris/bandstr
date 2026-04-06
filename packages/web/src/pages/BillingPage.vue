<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-sm q-mb-md">
      <div class="col">
        <div class="text-h5">Billing</div>
        <div class="text-caption text-grey-6">Current plan: <span class="text-weight-bold">{{ currentPlanLabel }}</span></div>
        <div v-if="isInheritedPro" class="text-caption text-positive">Pro access is inherited from an owner/admin user.</div>
        <div class="text-caption text-grey-6">Band pro access: <span class="text-weight-bold">{{ hasProPlan ? 'Enabled' : 'Disabled' }}</span></div>
        <div class="text-caption text-grey-6">Status: <span class="text-weight-bold">{{ statusLabel }}</span></div>
        <div v-if="subscriptionIntervalLabel" class="text-caption text-grey-6">Interval: {{ subscriptionIntervalLabel }}</div>
        <div v-if="renewalLabel" class="text-caption text-grey-6">{{ renewalLabel }}</div>
        <div v-if="providerHint" class="text-caption text-grey-5 q-mt-xs">{{ providerHint }}</div>
      </div>
      <div class="col-auto">
        <div class="column q-gutter-sm items-end">
          <q-btn
            outline
            color="primary"
            icon="manage_accounts"
            label="Manage subscription"
            :disable="!canManageBilling || loadingPortal || !canManageSubscription"
            :loading="loadingPortal"
            @click="openPortal"
          />
          <q-btn
            v-if="showRestoreButton"
            flat
            dense
            color="grey-6"
            icon="replay"
            label="Restore purchases"
            :loading="loadingRestore"
            @click="restorePurchases"
          />
        </div>
      </div>
    </div>

    <q-banner v-if="!canManageBilling" class="bg-grey-9 text-white q-mb-md rounded-borders">
      Only band admins or owners can change subscription plans.
    </q-banner>

    <div class="row q-col-gutter-md">
      <div v-for="plan in plans" :key="plan.id" class="col-12 col-md-4">
        <q-card bordered flat>
          <q-card-section>
            <div class="text-h6">{{ plan.name }}</div>
            <div class="text-subtitle1 q-mt-sm">{{ formatPlanPrice(plan) }}</div>
          </q-card-section>

          <q-separator />

          <q-card-section>
            <div class="text-caption text-grey-7 q-mb-xs">Limits</div>
            <div class="text-body2">Setlist songs: {{ formatLimit(plan.limits.setlistSongs) }}</div>
            <div class="text-body2">Members: {{ formatLimit(plan.limits.members) }}</div>

            <div class="text-caption text-grey-7 q-mt-md q-mb-xs">Includes</div>
            <div v-for="feature in plan.features" :key="feature" class="text-body2">- {{ feature }}</div>
          </q-card-section>

          <q-card-actions align="right" class="q-gutter-sm">
            <q-chip
              v-if="effectivePlanId === plan.id"
              color="primary"
              text-color="white"
              size="sm"
              icon="check"
              label="Current plan"
            />

            <template v-else-if="plan.id === 'pro'">
              <q-btn
                color="primary"
                size="sm"
                label="Choose monthly"
                :disable="!canManageBilling || loadingCheckout"
                :loading="loadingCheckout && selectedPlan === 'pro' && selectedInterval === 'monthly'"
                @click="startCheckout('monthly')"
              />
              <q-btn
                color="primary"
                size="sm"
                outline
                label="Choose yearly"
                :disable="!canManageBilling || loadingCheckout"
                :loading="loadingCheckout && selectedPlan === 'pro' && selectedInterval === 'yearly'"
                @click="startCheckout('yearly')"
              />
            </template>

            <q-btn
              v-else
              flat
              size="sm"
              :label="plan.id === 'pro-zero' ? 'Internal plan' : 'Included'"
              disable
            />
          </q-card-actions>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Notify } from 'quasar'
import { useRoute } from 'vue-router'
import { apiJson } from '../boot/api'
import { useAuthStore } from '../stores/auth'
import {
  initializePlayBilling,
  isAndroidNative,
  purchasePlaySubscription,
  queryPlaySubscriptions,
  restorePlaySubscriptions,
  type PlayBillingProduct,
} from '../plugins/playBilling'
import {
  initializeAppStoreBilling,
  isIosNative,
  purchaseAppStoreSubscription,
  queryAppStoreSubscriptions,
  restoreAppStoreSubscriptions,
  type AppStoreBillingProduct,
} from '../plugins/appStoreBilling'

type PlanId = 'free' | 'pro' | 'pro-zero'
type BillingInterval = 'monthly' | 'yearly'
type SubscriptionStatus = 'none' | 'active' | 'canceled' | 'past_due' | 'trialing' | 'grace_period' | 'on_hold' | 'paused'
type SubscriptionProviderId = 'stripe' | 'google_play' | 'app_store' | 'manual' | 'none'

type Plan = {
  id: PlanId
  name: string
  bookable: boolean
  prices: {
    monthly: number | null
    yearly: number | null
    currency: string
  }
  limits: {
    setlistSongs: number | null
    members: number | null
  }
  features: string[]
}

const authStore = useAuthStore()
const route = useRoute()

const plans = ref<Plan[]>([])
const currentPlan = ref<PlanId>('free')
const hasProPlan = ref(false)
const subscriptionStatus = ref<SubscriptionStatus>('none')
const subscriptionInterval = ref<BillingInterval | null>(null)
const currentPeriodEnd = ref<string | null>(null)
const cancelAtPeriodEnd = ref(false)
const subscriptionProvider = ref<SubscriptionProviderId>('none')
const managementUrl = ref<string | null>(null)

const loadingCheckout = ref(false)
const loadingPortal = ref(false)
const loadingRestore = ref(false)
const selectedPlan = ref<PlanId | null>(null)
const selectedInterval = ref<BillingInterval | null>(null)
const playReady = ref(false)
const playProducts = ref<Record<BillingInterval, PlayBillingProduct | null>>({ monthly: null, yearly: null })
const playProductIds = ref<Record<BillingInterval, string | null>>({ monthly: null, yearly: null })
const appStoreReady = ref(false)
const appStoreProducts = ref<Record<BillingInterval, AppStoreBillingProduct | null>>({ monthly: null, yearly: null })
const appStoreProductIds = ref<Record<BillingInterval, string | null>>({ monthly: null, yearly: null })

const canManageBilling = computed(() => {
  const role = authStore.activeBand?.role
  return role === 'owner' || role === 'admin'
})

const canManageSubscription = computed(() => {
  const p = subscriptionProvider.value
  return p === 'stripe' || p === 'google_play' || p === 'app_store'
})

const showRestoreButton = computed(() => {
  return (isAndroidNative() && playReady.value) || (isIosNative() && appStoreReady.value)
})

const effectivePlanId = computed<PlanId>(() => {
  if (hasProPlan.value && currentPlan.value === 'free') return 'pro'
  return currentPlan.value
})

const isInheritedPro = computed(() => currentPlan.value === 'free' && hasProPlan.value)

const currentPlanLabel = computed(() => {
  const plan = plans.value.find((p) => p.id === effectivePlanId.value)
  if (!plan) return effectivePlanId.value
  if (isInheritedPro.value) return `${plan.name} (inherited)`
  return plan.name
})

const statusLabel = computed(() => {
  const map: Record<SubscriptionStatus, string> = {
    none: 'No active subscription',
    active: 'Active',
    canceled: 'Canceled',
    past_due: 'Past due',
    trialing: 'Trialing',
    grace_period: 'Grace period — payment retry in progress',
    on_hold: 'On hold — update payment in Google Play',
    paused: 'Paused',
  }
  return map[subscriptionStatus.value]
})

const providerHint = computed(() => {
  const p = subscriptionProvider.value
  const s = subscriptionStatus.value
  if (p === 'google_play' && (s === 'active' || s === 'grace_period' || s === 'trialing')) {
    return 'Your subscription is managed through Google Play. Tap "Manage subscription" to change or cancel.'
  }
  if (p === 'app_store' && (s === 'active' || s === 'grace_period' || s === 'trialing')) {
    return 'Your subscription is managed through the App Store. Tap "Manage subscription" to change or cancel.'
  }
  if (p === 'google_play' && s === 'on_hold') {
    return 'Your subscription is on hold. Update your payment method in Google Play to restore access.'
  }
  return null
})

const renewalLabel = computed(() => {
  if (!currentPeriodEnd.value) return null
  const dateLabel = new Date(currentPeriodEnd.value).toLocaleDateString()
  if (cancelAtPeriodEnd.value) return `Cancels at period end (${dateLabel})`
  return `Renews on ${dateLabel}`
})

const subscriptionIntervalLabel = computed(() => {
  if (subscriptionInterval.value === 'monthly') return 'Monthly'
  if (subscriptionInterval.value === 'yearly') return 'Yearly'
  return null
})

function formatLimit(value: number | null) {
  return value === null ? 'Unlimited' : String(value)
}

function formatPlanPrice(plan: Plan) {
  if (plan.id === 'free') return '0 EUR'
  if (plan.id === 'pro-zero') return '0 EUR (internal)'

  // On Android: show locale-aware Play Store prices if available
  if (isAndroidNative() && playReady.value) {
    const monthlyPrice = playProducts.value.monthly?.offers[0]?.formattedPrice
    const yearlyPrice = playProducts.value.yearly?.offers[0]?.formattedPrice
    if (monthlyPrice || yearlyPrice) {
      const parts: string[] = []
      if (monthlyPrice) parts.push(`${monthlyPrice}/month`)
      if (yearlyPrice) parts.push(`${yearlyPrice}/year`)
      return parts.join(' or ')
    }
  }

  // On iOS: show locale-aware App Store prices if available
  if (isIosNative() && appStoreReady.value) {
    const monthlyPrice = appStoreProducts.value.monthly?.offers[0]?.formattedPrice
    const yearlyPrice = appStoreProducts.value.yearly?.offers[0]?.formattedPrice
    if (monthlyPrice || yearlyPrice) {
      const parts: string[] = []
      if (monthlyPrice) parts.push(`${monthlyPrice}/month`)
      if (yearlyPrice) parts.push(`${yearlyPrice}/year`)
      return parts.join(' or ')
    }
  }

  const monthly = plan.prices.monthly ?? 0
  const yearly = plan.prices.yearly ?? 0
  return `${monthly} ${plan.prices.currency}/month or ${yearly} ${plan.prices.currency}/year`
}

async function loadBilling() {
  try {
    const data = await apiJson<{
      currentPlan: PlanId
      hasProPlan: boolean
      subscriptionProvider: SubscriptionProviderId
      currentSubscription: {
        status: SubscriptionStatus
        interval: BillingInterval | null
        currentPeriodEnd: string | null
        cancelAtPeriodEnd: boolean
        managementUrl: string | null
      }
      android: {
        packageName: string | null
        proProducts: { monthly: string | null; yearly: string | null }
      }
      ios: {
        bundleId: string | null
        proProducts: { monthly: string | null; yearly: string | null }
      }
      plans: Plan[]
    }>('/billing/plans')

    currentPlan.value = data.currentPlan
    hasProPlan.value = data.hasProPlan
    subscriptionStatus.value = data.currentSubscription.status
    subscriptionInterval.value = data.currentSubscription.interval
    currentPeriodEnd.value = data.currentSubscription.currentPeriodEnd
    cancelAtPeriodEnd.value = data.currentSubscription.cancelAtPeriodEnd
    subscriptionProvider.value = data.subscriptionProvider
    managementUrl.value = data.currentSubscription.managementUrl
    plans.value = data.plans
    playProductIds.value = data.android.proProducts
    appStoreProductIds.value = data.ios.proProducts

    const memberships = await apiJson<typeof authStore.bands>('/bands')
    authStore.setBands(memberships)

    if (isAndroidNative()) {
      await loadPlayProducts()
    }
    if (isIosNative()) {
      await loadAppStoreProducts()
    }
  } catch (error) {
    Notify.create({
      type: 'negative',
      message: error instanceof Error ? error.message : 'Failed to load billing data',
    })
  }
}

async function loadPlayProducts() {
  try {
    const init = await initializePlayBilling()
    playReady.value = !!init.ready
    if (!playReady.value) return

    const ids = [playProductIds.value.monthly, playProductIds.value.yearly].filter(
      (id): id is string => !!id,
    )
    if (ids.length === 0) return

    const result = await queryPlaySubscriptions(ids)
    playProducts.value.monthly =
      result.items.find((item) => item.productId === playProductIds.value.monthly) ?? null
    playProducts.value.yearly =
      result.items.find((item) => item.productId === playProductIds.value.yearly) ?? null
  } catch (error) {
    Notify.create({
      type: 'warning',
      message: error instanceof Error ? error.message : 'Google Play Billing unavailable. Falling back to web checkout.',
    })
  }
}

async function loadAppStoreProducts() {
  try {
    const init = await initializeAppStoreBilling()
    appStoreReady.value = !!init.ready
    if (!appStoreReady.value) return

    const ids = [appStoreProductIds.value.monthly, appStoreProductIds.value.yearly].filter(
      (id): id is string => !!id,
    )
    if (ids.length === 0) return

    const result = await queryAppStoreSubscriptions(ids)
    appStoreProducts.value.monthly =
      result.items.find((item) => item.productId === appStoreProductIds.value.monthly) ?? null
    appStoreProducts.value.yearly =
      result.items.find((item) => item.productId === appStoreProductIds.value.yearly) ?? null
  } catch (error) {
    Notify.create({
      type: 'warning',
      message: error instanceof Error ? error.message : 'Apple In-App Purchases unavailable. Falling back to web checkout.',
    })
  }
}

async function startCheckout(interval: BillingInterval) {
  loadingCheckout.value = true
  selectedPlan.value = 'pro'
  selectedInterval.value = interval
  try {
    if (isAndroidNative() && playReady.value) {
      const product = playProducts.value[interval]
      if (!product) throw new Error(`Google Play product missing for ${interval}`)

      const offer = product.offers[0]
      const purchase = await purchasePlaySubscription(product.productId, offer?.offerToken)
      await apiJson('/billing/google-play/activate', {
        method: 'POST',
        body: JSON.stringify({
          productId: product.productId,
          purchaseToken: purchase.purchase.purchaseToken,
          orderId: purchase.purchase.orderId ?? undefined,
          interval,
        }),
      })
      Notify.create({ type: 'positive', message: 'Subscription activated via Google Play.' })
      await loadBilling()
      return
    }
    if (isIosNative() && appStoreReady.value) {
      const product = appStoreProducts.value[interval]
      if (!product) throw new Error(`Apple product missing for ${interval}`)

      const purchase = await purchaseAppStoreSubscription(product.productId)
      await apiJson('/billing/apple/activate', {
        method: 'POST',
        body: JSON.stringify({
          productId: product.productId,
          transactionId: purchase.purchase.orderId ?? undefined,
          originalTransactionId: purchase.purchase.purchaseToken,
          interval,
        }),
      })
      Notify.create({ type: 'positive', message: 'Subscription activated via Apple In-App Purchase.' })
      await loadBilling()
      return
    }

    const data = await apiJson<{ url: string }>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan: 'pro', interval }),
    })
    if (data.url) {
      window.location.href = data.url
      return
    }
    throw new Error('Checkout URL missing')
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to create checkout session'
    // Surface cross-provider 409 conflict with a clear message
    if (msg.includes('already has an active')) {
      Notify.create({ type: 'warning', message: msg })
    } else {
      Notify.create({ type: 'negative', message: msg })
    }
  } finally {
    loadingCheckout.value = false
    selectedPlan.value = null
    selectedInterval.value = null
  }
}

async function openPortal() {
  loadingPortal.value = true
  try {
    const provider = subscriptionProvider.value

    // Google Play / App Store: open the management deep-link
    if (provider === 'google_play' || provider === 'app_store') {
      const url = managementUrl.value
      if (url) {
        window.open(url, '_blank')
      } else {
        // Fallback to native plugin open
        if (provider === 'google_play' && isAndroidNative()) {
          const { openPlaySubscriptions } = await import('../plugins/playBilling')
          await openPlaySubscriptions()
        } else if (provider === 'app_store' && isIosNative()) {
          const { openAppStoreSubscriptions } = await import('../plugins/appStoreBilling')
          await openAppStoreSubscriptions()
        } else {
          throw new Error(`Manage your subscription in ${provider === 'google_play' ? 'Google Play' : 'the App Store'}.`)
        }
      }
      return
    }

    // Stripe: open the customer portal
    const data = await apiJson<{ url: string }>('/billing/portal')
    if (data.url) {
      window.location.href = data.url
      return
    }
    throw new Error('Portal URL missing')
  } catch (error) {
    Notify.create({
      type: 'negative',
      message: error instanceof Error ? error.message : 'Failed to open billing portal',
    })
  } finally {
    loadingPortal.value = false
  }
}

async function restorePurchases() {
  loadingRestore.value = true
  try {
    if (isAndroidNative() && playReady.value) {
      const result = await restorePlaySubscriptions()
      if (!result.purchases || result.purchases.length === 0) {
        Notify.create({ type: 'info', message: 'No purchases found to restore.' })
        return
      }
      const purchase = result.purchases[0]
      const productId = purchase.products?.[0] ?? playProductIds.value.monthly ?? ''
      await apiJson('/billing/google-play/restore', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          purchaseToken: purchase.purchaseToken,
        }),
      })
      Notify.create({ type: 'positive', message: 'Subscription restored successfully.' })
      await loadBilling()
      return
    }

    if (isIosNative() && appStoreReady.value) {
      const result = await restoreAppStoreSubscriptions()
      if (!result.purchases || result.purchases.length === 0) {
        Notify.create({ type: 'info', message: 'No purchases found to restore.' })
        return
      }
      const purchase = result.purchases[0]
      const productId = purchase.products?.[0] ?? appStoreProductIds.value.monthly ?? ''
      await apiJson('/billing/apple/activate', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          originalTransactionId: purchase.purchaseToken,
          transactionId: purchase.orderId ?? undefined,
        }),
      })
      Notify.create({ type: 'positive', message: 'Subscription restored successfully.' })
      await loadBilling()
      return
    }

    Notify.create({ type: 'info', message: 'Restore is only available on Android and iOS.' })
  } catch (error) {
    Notify.create({
      type: 'negative',
      message: error instanceof Error ? error.message : 'Failed to restore purchases',
    })
  } finally {
    loadingRestore.value = false
  }
}

onMounted(() => {
  if (route.query.checkout === 'success') {
    Notify.create({ type: 'positive', message: 'Checkout completed. Refreshing billing status.' })
  } else if (route.query.checkout === 'cancel') {
    Notify.create({ type: 'warning', message: 'Checkout was canceled.' })
  }
  loadBilling()
})
</script>
