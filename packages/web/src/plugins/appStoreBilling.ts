import { Capacitor, registerPlugin } from '@capacitor/core'

export type BillingInterval = 'monthly' | 'yearly'

export type AppStoreBillingProduct = {
  productId: string
  title: string
  description: string
  offers: Array<{
    basePlanId: string | null
    offerId: string | null
    offerToken: string
    formattedPrice: string | null
    billingPeriod: string | null
  }>
}

export type AppStorePurchase = {
  orderId: string | null
  purchaseToken: string
  acknowledged: boolean
  purchaseState: number
  products: string[]
}

type AppStoreBillingPlugin = {
  initialize(): Promise<{ ready: boolean }>
  querySubscriptions(options: { productIds: string[] }): Promise<{ items: AppStoreBillingProduct[] }>
  purchaseSubscription(options: { productId: string }): Promise<{ purchase: AppStorePurchase }>
  restoreSubscriptions(): Promise<{ purchases: AppStorePurchase[] }>
  openAppStoreSubscriptions(): Promise<void>
}

const AppStoreBilling = registerPlugin<AppStoreBillingPlugin>('AppStoreBilling')

export function isIosNative() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
}

export async function initializeAppStoreBilling() {
  if (!isIosNative()) return { ready: false }
  return AppStoreBilling.initialize()
}

export async function queryAppStoreSubscriptions(productIds: string[]) {
  return AppStoreBilling.querySubscriptions({ productIds })
}

export async function purchaseAppStoreSubscription(productId: string) {
  return AppStoreBilling.purchaseSubscription({ productId })
}

export async function restoreAppStoreSubscriptions() {
  return AppStoreBilling.restoreSubscriptions()
}

export async function openAppStoreSubscriptions() {
  return AppStoreBilling.openAppStoreSubscriptions()
}
