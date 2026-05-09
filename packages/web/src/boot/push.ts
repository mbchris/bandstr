import { boot } from 'quasar/wrappers'
import { Capacitor } from '@capacitor/core'
import { PushNotifications, type PushNotificationToken, type ActionPerformed } from '@capacitor/push-notifications'
import type { LocationQueryRaw } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const REGISTERED_TOKEN_KEY = 'bandstr-native-push-token'
const PENDING_PUSH_ROUTE_KEY = 'bandstr-pending-push-route'

type PendingPushRoute = {
  path: string
  query: Record<string, string>
}

function getApiBase(): string {
  return (process.env.API_URL ?? '').replace(/\/+$/, '').replace(/\/api$/, '')
}

function parseQueryString(input: string): Record<string, string> {
  const query: Record<string, string> = {}
  if (!input) return query
  const params = new URLSearchParams(input)
  params.forEach((value, key) => {
    query[key] = value
  })
  return query
}

function readStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function buildPushRoute(action: ActionPerformed): PendingPushRoute {
  const notification = action.notification as unknown as { data?: Record<string, unknown> } & Record<string, unknown>
  const data = (notification.data ?? {}) as Record<string, unknown>

  const path =
    readStringValue(data.path) ??
    readStringValue(notification.path) ??
    readStringValue(data.linkPath) ??
    '/'

  const queryRaw =
    readStringValue(data.query) ??
    readStringValue(notification.query) ??
    readStringValue(data.linkQuery) ??
    ''

  return {
    path,
    query: parseQueryString(queryRaw),
  }
}

function savePendingPushRoute(route: PendingPushRoute) {
  localStorage.setItem(PENDING_PUSH_ROUTE_KEY, JSON.stringify(route))
}

function loadPendingPushRoute(): PendingPushRoute | null {
  const raw = localStorage.getItem(PENDING_PUSH_ROUTE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as { path?: unknown; query?: unknown }
    return {
      path: readStringValue(parsed.path) ?? '/',
      query: typeof parsed.query === 'object' && parsed.query !== null ? (parsed.query as Record<string, string>) : {},
    }
  } catch {
    localStorage.removeItem(PENDING_PUSH_ROUTE_KEY)
    return null
  }
}

function clearPendingPushRoute() {
  localStorage.removeItem(PENDING_PUSH_ROUTE_KEY)
}

async function registerTokenOnApi(token: PushNotificationToken) {
  const authStore = useAuthStore()
  const base = getApiBase()
  const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'
  const tokenType = platform === 'ios' ? 'apns' : 'fcm'

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }

  if (authStore.token) {
    headers.Authorization = `Bearer ${authStore.token}`
  }

  const response = await fetch(`${base}/api/notifications/devices/register`, {
    method: 'POST',
    headers,
    credentials: authStore.token ? 'omit' : 'include',
    body: JSON.stringify({
      platform,
      tokenType,
      token: token.value,
    }),
  }).catch(() => null)

  if (!response || !response.ok) {
    return false
  }

  localStorage.setItem(REGISTERED_TOKEN_KEY, token.value)
  return true
}

function readAlreadyRegisteredToken() {
  return localStorage.getItem(REGISTERED_TOKEN_KEY)
}

export default boot(async ({ router }) => {
  if (!Capacitor.isNativePlatform()) return

  const authStore = useAuthStore()

  let pendingToken: PushNotificationToken | null = null
  let retryTimer: number | null = null

  const attemptRegistration = async () => {
    if (!pendingToken) return
    const alreadyRegistered = readAlreadyRegisteredToken()
    if (alreadyRegistered === pendingToken.value) {
      return
    }

    const ok = await registerTokenOnApi(pendingToken)
    if (ok) {
      pendingToken = null
      if (retryTimer !== null) {
        window.clearInterval(retryTimer)
        retryTimer = null
      }
    }
  }

  let pushNavigationInFlight = false

  const flushPendingPushRoute = async () => {
    if (pushNavigationInFlight) return

    const target = loadPendingPushRoute()
    if (!target) return

    pushNavigationInFlight = true
    try {
      await router.isReady()
      await authStore.loadSession()
      if (authStore.isAuthenticated) {
        await authStore.loadBands().catch(() => undefined)
      }

      const route: { path: string; query: LocationQueryRaw } = {
        path: target.path || '/',
        query: target.query,
      }

      console.info('[push-navigation] navigating', route)
      await router.replace(route)
      clearPendingPushRoute()
    } catch (error) {
      console.error('[push-navigation] failed', error)
    } finally {
      pushNavigationInFlight = false
    }
  }

  const onAction = async (action: ActionPerformed) => {
    const route = buildPushRoute(action)
    console.info('[push-navigation] received action', route)
    savePendingPushRoute(route)
    await flushPendingPushRoute()
  }

  await PushNotifications.requestPermissions().then((permission) => {
    if (permission.receive === 'granted') {
      void PushNotifications.register()
    }
  }).catch(() => undefined)

  await PushNotifications.removeAllListeners().catch(() => undefined)

  await PushNotifications.addListener('registration', (token) => {
    pendingToken = token
    void attemptRegistration()
    if (retryTimer === null) {
      retryTimer = window.setInterval(() => {
        if (!authStore.isAuthenticated && !authStore.token) return
        void attemptRegistration()
      }, 4000)
    }
  })

  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    void onAction(action)
  })

  await PushNotifications.addListener('registrationError', () => undefined)

  void flushPendingPushRoute()
})
