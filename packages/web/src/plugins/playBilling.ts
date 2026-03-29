import { Capacitor, registerPlugin } from '@capacitor/core'

export type BillingInterval = 'monthly' | 'yearly'

export type PlayBillingOffer = {
  basePlanId: string | null
  offerId: string | null
  offerToken: string
  formattedPrice: string | null
  billingPeriod: string | null
}

export type PlayBillingProduct = {
  productId: string
  title: string
  description: string
  offers: PlayBillingOffer[]
}

export type PlayPurchase = {
  orderId: string | null
  purchaseToken: string
  acknowledged: boolean
  purchaseState: number
  products: string[]
}

type PlayBillingPlugin = {
  initialize(): Promise<{ ready: boolean }>
  querySubscriptions(options: { productIds: string[] }): Promise<{ items: PlayBillingProduct[] }>
  purchaseSubscription(options: { productId: string; offerToken?: string }): Promise<{ purchase: PlayPurchase }>
  restoreSubscriptions(): Promise<{ purchases: PlayPurchase[] }>
  openPlaySubscriptions(): Promise<void>
}

const PlayBilling = registerPlugin<PlayBillingPlugin>('PlayBilling')

export function isAndroidNative() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

export async function initializePlayBilling() {
  if (!isAndroidNative()) return { ready: false }
  return PlayBilling.initialize()
}

export async function queryPlaySubscriptions(productIds: string[]) {
  return PlayBilling.querySubscriptions({ productIds })
}

export async function purchasePlaySubscription(productId: string, offerToken?: string) {
  return PlayBilling.purchaseSubscription({ productId, offerToken })
}

export async function restorePlaySubscriptions() {
  return PlayBilling.restoreSubscriptions()
}

export async function openPlaySubscriptions() {
  return PlayBilling.openPlaySubscriptions()
}
