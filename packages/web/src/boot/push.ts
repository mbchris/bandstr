import { boot } from 'quasar/wrappers'
import { Capacitor } from '@capacitor/core'
import { PushNotifications, type PushNotificationToken, type ActionPerformed } from '@capacitor/push-notifications'
import { useAuthStore } from '../stores/auth'

const REGISTERED_TOKEN_KEY = 'bandstr-native-push-token'

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

  const onAction = async (action: ActionPerformed) => {
    const data = (action.notification.data ?? {}) as Record<string, unknown>
    const path = typeof data.path === 'string' && data.path ? data.path : '/'
    const queryRaw = typeof data.query === 'string' ? data.query : ''
    const query = parseQueryString(queryRaw)

    await router.push({ path, query })
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
})
