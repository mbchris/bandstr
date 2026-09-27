<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { useRoute, useRouter } from 'vue-router'
import { authClient } from '../boot/auth'
import { useAuthStore } from '../stores/auth'
import { useI18n } from '../composables/useI18n'

const { t } = useI18n()

const processingToken = ref(!!((new URLSearchParams(window.location.search)).get('token') || window.location.hash.includes('token=')))
const loadingGoogle = ref(false)
const loadingGithub = ref(false)
const loadingEmailSignIn = ref(false)
const loadingEmailSignUp = ref(false)
const loadingPasswordReset = ref(false)
const error = ref<string | null>(null)
const info = ref<string | null>(null)
const testingAuth = ref(false)
const testingBands = ref(false)
const testingSession = ref(false)
const debugOutput = ref('')
const copyStatus = ref('')
const showDebugDialog = ref(false)
const isDebugMode = (process.env.DEBUG_MODE ?? '').toLowerCase() === 'true'
const debugModeRaw = process.env.DEBUG_MODE ?? '(unset)'
const isNative = Capacitor.isNativePlatform()
const platform = Capacitor.getPlatform()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const windowOrigin = window.location.origin
const windowHref = window.location.href
const userAgent = navigator.userAgent
const rawApiUrl = (process.env.API_URL ?? '').trim()
const debugApiUrlRaw = rawApiUrl || '(empty)'
const normalizedApiBase = (rawApiUrl || '').replace(/\/+$/, '').replace(/\/api$/, '')
const debugApiBase = normalizedApiBase || '(same-origin /api)'
const debugAuthUrl = normalizedApiBase ? `${normalizedApiBase}/api/auth` : '/api/auth'
const mobileCallbackUrlRaw = (process.env.MOBILE_CALLBACK_URL ?? '').trim()
const debugMobileCallbackUrlRaw = mobileCallbackUrlRaw || '(empty)'

const authMode = ref<'signin' | 'signup' | 'forgot'>('signin')
const signinEmail = ref('')
const signinPassword = ref('')
const signupName = ref('')
const signupEmail = ref('')
const signupPassword = ref('')
const forgotEmail = ref('')
const PENDING_SIGNUP_NAME_KEY_PREFIX = 'bandstr-pending-signup-name:'

const modeOptions = computed(() => [
  { label: t('login.modeEmailSignIn'), value: 'signin' },
  { label: t('login.modeSignUp'), value: 'signup' },
  { label: t('login.modeReset'), value: 'forgot' },
])

const requiredRule = (value: string) => (!!value && value.trim().length > 0) || t('login.required')
const emailRule = (value: string) => /.+@.+\..+/.test(value) || t('login.invalidEmail')
const minPasswordRule = (value: string) => value.length >= 8 || t('login.minPassword')

function normalizeNativeCallbackBase(url: string): string {
  const fallback = 'org.capacitor.bandstr://localhost/#/login'
  const input = url.trim()
  if (!input) return fallback

  if (input.includes('#')) return input

  if (/\/login\/?$/.test(input)) {
    return input.replace(/\/login\/?$/, '/#/login')
  }

  return `${input.replace(/\/+$/, '')}/#/login`
}

function appendQueryToHashRoute(url: string, key: string, value: string): string {
  const [base, hash = ''] = url.split('#', 2)
  const hashValue = hash || '/login'
  const joiner = hashValue.includes('?') ? '&' : '?'
  return `${base}#${hashValue}${joiner}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
}

const nativeCallbackUrl = normalizeNativeCallbackBase(mobileCallbackUrlRaw)
const nativeOauthStartUrlBase = normalizedApiBase ? `${normalizedApiBase}/api/mobile-auth/start` : ''

function sanitizeRedirectPath(value: unknown): string {
  if (typeof value !== 'string') return '/'
  const v = value.trim()
  if (!v.startsWith('/') || v.startsWith('//')) return '/'
  return v === '/login' ? '/' : v
}

function getParamFromCurrentHref(key: string): string {
  try {
    const current = new URL(window.location.href)
    const direct = current.searchParams.get(key)
    if (direct) return direct

    const hash = current.hash.startsWith('#') ? current.hash.slice(1) : current.hash
    const queryIndex = hash.indexOf('?')
    if (queryIndex >= 0) {
      const query = hash.slice(queryIndex + 1)
      const hashParams = new URLSearchParams(query)
      const value = hashParams.get(key)
      if (value) return value
    }
  } catch {
    // Ignore malformed URL and fallback to empty value.
  }

  return ''
}

const fallbackRedirectRaw = getParamFromCurrentHref('redirect')
const redirectPath = sanitizeRedirectPath(route.query.redirect || fallbackRedirectRaw)
const routeRedirectRaw =
  typeof route.query.redirect === 'string'
    ? route.query.redirect
    : (fallbackRedirectRaw || String(route.query.redirect ?? '(unset)'))
const routeTokenRaw = (typeof route.query.token === 'string' ? route.query.token : '') || getParamFromCurrentHref('token')
const routeMobileAuthRaw =
  (typeof route.query.mobileAuth === 'string' ? route.query.mobileAuth : '') ||
  getParamFromCurrentHref('mobileAuth') ||
  String(route.query.mobileAuth ?? '(unset)')
const routeErrorRaw =
  (typeof route.query.error === 'string' ? route.query.error : '') ||
  getParamFromCurrentHref('error') ||
  String(route.query.error ?? '(unset)')
const webCallbackUrl =
  redirectPath === '/'
    ? `${window.location.origin}/login`
    : `${window.location.origin}/login?redirect=${encodeURIComponent(redirectPath)}`
const nativeAppCallbackUrl = appendQueryToHashRoute(nativeCallbackUrl, 'redirect', redirectPath)
const nativeBridgeCallbackUrl = normalizedApiBase
  ? `${normalizedApiBase}/api/mobile-auth/complete?appCallbackURL=${encodeURIComponent(nativeAppCallbackUrl)}`
  : ''
const socialCallbackUrl = isNative
  ? nativeAppCallbackUrl
  : webCallbackUrl

function buildTestUrls(path: string): string[] {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const urls = new Set<string>()

  if (normalizedApiBase) {
    urls.add(`${normalizedApiBase}/api${normalizedPath}`)
  }
  urls.add(`/api${normalizedPath}`)

  return [...urls]
}

function authEndpoint(path: string): string {
  return `${normalizedApiBase}/api/auth${path}`
}

async function postAuth(path: string, body: Record<string, unknown>) {
  const response = await fetch(authEndpoint(path), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => ({}))) as {
    message?: string
    error?: { message?: string }
    token?: string | null
  }

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? payload?.message ?? `Auth request failed (${response.status})`)
  }

  return payload
}

function pendingSignupNameStorageKey(email: string): string {
  return `${PENDING_SIGNUP_NAME_KEY_PREFIX}${email.trim().toLowerCase()}`
}

function rememberPendingSignupName(email: string, name: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedName = name.trim()
  if (!normalizedEmail || !normalizedName) return
  localStorage.setItem(pendingSignupNameStorageKey(normalizedEmail), normalizedName)
}

function takePendingSignupName(email: string): string {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) return ''
  const key = pendingSignupNameStorageKey(normalizedEmail)
  const value = (localStorage.getItem(key) ?? '').trim()
  localStorage.removeItem(key)
  return value
}

async function ensureUserDisplayName(expectedName: string) {
  const normalizedExpected = expectedName.trim()
  if (!normalizedExpected || !authStore.user) return
  const currentName = authStore.user.name?.trim() ?? ''
  if (currentName === normalizedExpected) return

  await postAuth('/update-user', { name: normalizedExpected })
  await authStore.loadSession()
}

async function signInWithEmail() {
  error.value = null
  info.value = null
  loadingEmailSignIn.value = true
  try {
    const payload = await postAuth('/sign-in/email', {
      email: signinEmail.value.trim(),
      password: signinPassword.value,
      callbackURL: socialCallbackUrl,
    })
    if (typeof payload.token === 'string' && payload.token) {
      authStore.setToken(payload.token)
    }
    await authStore.loadSession()
    if (!authStore.isAuthenticated) {
      throw new Error(t('login.signInNoSession'))
    }
    const pendingName = takePendingSignupName(signinEmail.value)
    if (pendingName) {
      await ensureUserDisplayName(pendingName)
    }
    await router.replace({ path: redirectPath })
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : t('login.loginFailed')
  } finally {
    loadingEmailSignIn.value = false
  }
}

async function signUpWithEmail() {
  error.value = null
  info.value = null
  loadingEmailSignUp.value = true
  try {
    const desiredName = signupName.value.trim()
    const desiredEmail = signupEmail.value.trim()
    const payload = await postAuth('/sign-up/email', {
      name: desiredName,
      email: desiredEmail,
      password: signupPassword.value,
      callbackURL: `${window.location.origin}/login?verified=1`,
    })

    if (typeof payload.token === 'string' && payload.token) {
      authStore.setToken(payload.token)
      await authStore.loadSession()
      await ensureUserDisplayName(desiredName)
      takePendingSignupName(desiredEmail)
      await router.replace({ path: redirectPath })
      return
    }

    rememberPendingSignupName(desiredEmail, desiredName)
    info.value = t('login.accountCreatedVerify')
    authMode.value = 'signin'
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : t('login.signupFailed')
  } finally {
    loadingEmailSignUp.value = false
  }
}

async function requestPasswordReset() {
  error.value = null
  info.value = null
  loadingPasswordReset.value = true
  try {
    await postAuth('/request-password-reset', {
      email: forgotEmail.value.trim(),
      redirectTo: `${window.location.origin}/reset-password`,
    })
    info.value = t('login.resetIfExists')
    authMode.value = 'signin'
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : t('login.resetFailed')
  } finally {
    loadingPasswordReset.value = false
  }
}

async function loginGoogle() {
  loadingGoogle.value = true
  error.value = null
  info.value = null
  try {
    if (isNative) {
      await startNativeSocialLogin('google')
    } else {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL: socialCallbackUrl })
      if (result?.error) {
        throw new Error(result.error.message || t('login.loginFailed'))
      }
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : t('login.loginFailed')
  } finally {
    loadingGoogle.value = false
  }
}

async function loginGithub() {
  loadingGithub.value = true
  error.value = null
  info.value = null
  try {
    if (isNative) {
      await startNativeSocialLogin('github')
    } else {
      const result = await authClient.signIn.social({ provider: 'github', callbackURL: socialCallbackUrl })
      if (result?.error) {
        throw new Error(result.error.message || t('login.loginFailed'))
      }
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : t('login.loginFailed')
  } finally {
    loadingGithub.value = false
  }
}

async function startNativeSocialLogin(provider: 'google' | 'github') {
  if (!nativeOauthStartUrlBase || !nativeBridgeCallbackUrl) {
    throw new Error(t('login.nativeOauthRequiresApi'))
  }

  const startUrl =
    `${nativeOauthStartUrlBase}?provider=${encodeURIComponent(provider)}` +
    `&callbackURL=${encodeURIComponent(nativeBridgeCallbackUrl)}` +
    `&errorCallbackURL=${encodeURIComponent(socialCallbackUrl)}`

  if (isNative) {
    await Browser.open({ url: startUrl, presentationStyle: 'popover' })
    return
  }

  const popup = window.open(startUrl, '_blank', 'noopener,noreferrer')
  if (!popup) {
    window.location.href = startUrl
  }
}

async function runEndpointTest(label: string, path: string) {
  const started = Date.now()
  const urls = buildTestUrls(path)
  const errors: string[] = []

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      const text = await res.text()
      const preview = text.length > 500 ? `${text.slice(0, 500)}...` : text
      const acao = res.headers.get('access-control-allow-origin') ?? '(none)'
      const acac = res.headers.get('access-control-allow-credentials') ?? '(none)'
      const aceh = res.headers.get('access-control-expose-headers') ?? '(none)'
      const setAuthToken = res.headers.get('set-auth-token') ? 'present' : 'absent'
      debugOutput.value =
        `[${label}] OK\n` +
        `url=${url}\n` +
        `status=${res.status} ${res.statusText}\n` +
        `acao=${acao}\n` +
        `acac=${acac}\n` +
        `aceh=${aceh}\n` +
        `set_auth_token=${setAuthToken}\n` +
        `duration_ms=${Date.now() - started}\n` +
        `body=${preview || '(empty)'}`
      return
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      errors.push(`url=${url} error=${message}`)
    }
  }

  debugOutput.value =
    `[${label}] ERROR\n` +
    `duration_ms=${Date.now() - started}\n` +
    `window_origin=${window.location.origin}\n` +
    `api_url_raw=${debugApiUrlRaw}\n` +
    `${errors.join('\n') || 'No request attempts were made'}`
}

async function testAuthEndpoint() {
  testingAuth.value = true
  try {
    await runEndpointTest('Auth Test', '/auth/get-session')
  } finally {
    testingAuth.value = false
  }
}

async function testBandsEndpoint() {
  testingBands.value = true
  try {
    await runEndpointTest('Bands Test', '/bands')
  } finally {
    testingBands.value = false
  }
}

async function probeSessionAndCors() {
  testingSession.value = true
  const started = Date.now()
  try {
    const lines: string[] = []
    lines.push('[Session Probe]')
    lines.push(`window_origin=${window.location.origin}`)
    lines.push(`window_href=${window.location.href}`)
    lines.push(`route_redirect_raw=${routeRedirectRaw}`)
    lines.push(`redirect_path=${redirectPath}`)
    lines.push(`social_callback=${socialCallbackUrl}`)

    try {
      const result = await authClient.getSession()
      lines.push(`authClient.getSession.error=${result.error ? (result.error.message ?? 'unknown') : '(none)'}`)
      lines.push(`authClient.getSession.has_user=${result.data?.user ? 'yes' : 'no'}`)
      lines.push(`authClient.getSession.has_session=${result.data?.session ? 'yes' : 'no'}`)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      lines.push(`authClient.getSession.throw=${message}`)
    }

    const urls = buildTestUrls('/auth/get-session')
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })
        const text = await res.text()
        const preview = text.length > 220 ? `${text.slice(0, 220)}...` : text
        lines.push(`raw_get_session.url=${url}`)
        lines.push(`raw_get_session.status=${res.status}`)
        lines.push(`raw_get_session.acao=${res.headers.get('access-control-allow-origin') ?? '(none)'}`)
        lines.push(`raw_get_session.acac=${res.headers.get('access-control-allow-credentials') ?? '(none)'}`)
        lines.push(`raw_get_session.aceh=${res.headers.get('access-control-expose-headers') ?? '(none)'}`)
        lines.push(`raw_get_session.set_auth_token=${res.headers.get('set-auth-token') ? 'present' : 'absent'}`)
        lines.push(`raw_get_session.body=${preview || '(empty)'}`)
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        lines.push(`raw_get_session.url=${url}`)
        lines.push(`raw_get_session.error=${message}`)
      }
    }

    lines.push(`duration_ms=${Date.now() - started}`)
    debugOutput.value = lines.join('\n')
  } finally {
    testingSession.value = false
  }
}

async function copyDebugToClipboard() {
  const payload = [
    'Debug Info',
    `DEBUG_MODE=${debugModeRaw}`,
    `Native platform=${isNative}`,
    `Platform=${platform}`,
    `Window origin=${windowOrigin}`,
    `Window href=${windowHref}`,
    `Route redirect=${routeRedirectRaw}`,
    `Route token=${routeTokenRaw ? '(present)' : '(absent)'}`,
    `Route mobileAuth=${routeMobileAuthRaw}`,
    `Route error=${routeErrorRaw}`,
    `Redirect path=${redirectPath}`,
    `API_URL(raw)=${debugApiUrlRaw}`,
    `API base=${debugApiBase}`,
    `Auth URL=${debugAuthUrl}`,
    `MOBILE_CALLBACK_URL(raw)=${debugMobileCallbackUrlRaw}`,
    `Native app callback=${nativeAppCallbackUrl}`,
    `Native bridge callback=${nativeBridgeCallbackUrl || '(missing API_URL)'}`,
    `Web callback=${webCallbackUrl}`,
    `Social callback=${socialCallbackUrl}`,
    `User agent=${userAgent}`,
    '',
    'Debug Output',
    debugOutput.value || '(empty)',
  ].join('\n')

  try {
    await navigator.clipboard.writeText(payload)
    copyStatus.value = t('login.debugCopied')
  } catch {
    copyStatus.value = t('login.debugCopyFailed')
  }

  window.setTimeout(() => {
    copyStatus.value = ''
  }, 2200)
}

onMounted(async () => {
  if (route.query.verified === '1') {
    info.value = t('login.emailVerificationSucceeded')
  } else if (route.query.error && typeof route.query.error === 'string') {
    error.value = t('login.authenticationError', { error: route.query.error })
  }

  if (!routeTokenRaw) {
    processingToken.value = false
    return
  }

  processingToken.value = true
  try {
    authStore.setToken(routeTokenRaw)
    await authStore.loadSession()
    await Browser.close().catch(() => undefined)

    const query = { ...route.query }
    delete query.token
    await router.replace({ path: '/login', query })

    if (authStore.isAuthenticated) {
      await router.replace({ path: redirectPath })
    }
  } finally {
    processingToken.value = false
  }
})

watch(
  () => route.query.token,
  async (newToken) => {
    if (typeof newToken !== 'string' || !newToken) return

    authStore.setToken(newToken)
    await authStore.loadSession()
    await Browser.close().catch(() => undefined)

    const query = { ...route.query }
    delete query.token
    delete query.mobileAuth
    await router.replace({ path: '/login', query })

    if (authStore.isAuthenticated) {
      await router.replace({ path: sanitizeRedirectPath(route.query.redirect) })
    }
  },
)
</script>

<template>
  <div class="login-page-wrap">
    <div v-if="processingToken" class="column items-center justify-center q-pa-xl">
      <q-spinner-orbit color="white" size="56px" />
      <div class="text-grey-4 q-mt-md text-body2">{{ t('login.signingIn') }}</div>
    </div>

    <template v-else>
      <q-btn
        v-if="isDebugMode"
        class="debug-icon-btn"
        icon="bug_report"
        round
        dense
        flat
        color="grey-4"
        @click="showDebugDialog = true"
      />

      <q-btn-toggle
        v-model="authMode"
        spread
        unelevated
        class="q-mb-md auth-mode-toggle"
        toggle-color="primary"
        :options="modeOptions"
      />

      <q-form v-if="authMode === 'signin'" class="column q-gutter-sm q-mb-md" @submit.prevent="signInWithEmail">
        <q-input v-model="signinEmail" type="email" outlined dense autocomplete="email" :label="t('login.email')" :rules="[requiredRule, emailRule]" />
        <q-input
          v-model="signinPassword"
          type="password"
          outlined
          dense
          autocomplete="current-password"
          :label="t('login.password')"
          :rules="[requiredRule]"
        />
        <q-btn color="primary" :label="t('login.signInEmail')" type="submit" :loading="loadingEmailSignIn" />
      </q-form>

      <q-form v-if="authMode === 'signup'" class="column q-gutter-sm q-mb-md" @submit.prevent="signUpWithEmail">
        <q-input v-model="signupName" outlined dense autocomplete="name" :label="t('login.name')" :rules="[requiredRule]" />
        <q-input v-model="signupEmail" type="email" outlined dense autocomplete="email" :label="t('login.email')" :rules="[requiredRule, emailRule]" />
        <q-input
          v-model="signupPassword"
          type="password"
          outlined
          dense
          autocomplete="new-password"
          :label="t('login.password')"
          :rules="[requiredRule, minPasswordRule]"
        />
        <q-btn color="primary" :label="t('login.createAccount')" type="submit" :loading="loadingEmailSignUp" />
      </q-form>

      <q-form v-if="authMode === 'forgot'" class="column q-gutter-sm q-mb-md" @submit.prevent="requestPasswordReset">
        <q-input v-model="forgotEmail" type="email" outlined dense autocomplete="email" :label="t('login.email')" :rules="[requiredRule, emailRule]" />
        <q-btn color="primary" :label="t('login.sendResetLink')" type="submit" :loading="loadingPasswordReset" />
        <div class="text-caption text-grey-5">
          {{ t('login.resetLinkHint') }}
        </div>
      </q-form>

      <q-separator dark spaced />

      <q-btn
        color="white"
        text-color="dark"
        icon="img:https://www.google.com/favicon.ico"
        :label="t('login.google')"
        class="full-width q-mb-md auth-google-btn"
        unelevated
        size="md"
        :loading="loadingGoogle"
        @click="loginGoogle"
      />

      <q-btn
        color="dark"
        text-color="white"
        icon="img:https://github.com/favicon.ico"
        :label="t('login.github')"
        class="full-width q-btn-github"
        outline
        size="md"
        :loading="loadingGithub"
        @click="loginGithub"
      />

      <div class="row justify-between items-center q-mt-sm">
        <q-btn flat dense class="auth-link-btn" :label="t('login.forgotPassword')" @click="authMode = 'forgot'" />
        <q-btn flat dense class="auth-link-btn" :label="t('login.backToSignIn')" @click="authMode = 'signin'" />
      </div>

      <div v-if="error" class="q-mt-md text-negative text-center text-body2">
        {{ error }}
      </div>
      <div v-if="info" class="q-mt-md text-positive text-center text-body2">
        {{ info }}
      </div>
      <div v-if="copyStatus" class="q-mt-sm text-center text-caption">
        {{ copyStatus }}
      </div>

      <q-dialog v-if="isDebugMode" v-model="showDebugDialog">
        <q-card class="debug-card">
          <q-card-section class="row items-center q-pb-sm">
            <div class="text-subtitle1">Debug Info</div>
            <q-space />
            <q-btn dense flat icon="content_copy" label="Copy Debug" @click="copyDebugToClipboard" />
            <q-btn dense flat round icon="close" @click="showDebugDialog = false" />
          </q-card-section>
          <q-separator />
          <q-card-section class="debug-content text-caption">
            <div>DEBUG_MODE (raw): {{ debugModeRaw }}</div>
            <div>Native platform: {{ isNative }}</div>
            <div>Platform: {{ platform }}</div>
            <div>Window origin: {{ windowOrigin }}</div>
            <div>Window href: {{ windowHref }}</div>
            <div>Route redirect (raw): {{ routeRedirectRaw }}</div>
            <div>Route token (raw): {{ routeTokenRaw ? '(present)' : '(absent)' }}</div>
            <div>Route mobileAuth (raw): {{ routeMobileAuthRaw }}</div>
            <div>Route error (raw): {{ routeErrorRaw }}</div>
            <div>Redirect path (sanitized): {{ redirectPath }}</div>
            <div>API_URL (raw): {{ debugApiUrlRaw }}</div>
            <div>API base (effective): {{ debugApiBase }}</div>
            <div>Auth URL (effective): {{ debugAuthUrl }}</div>
            <div>MOBILE_CALLBACK_URL (raw): {{ debugMobileCallbackUrlRaw }}</div>
            <div>Native app callback (effective): {{ nativeAppCallbackUrl }}</div>
            <div>Native bridge callback (effective): {{ nativeBridgeCallbackUrl || '(missing API_URL)' }}</div>
            <div>Web callback (effective): {{ webCallbackUrl }}</div>
            <div>Social callback (effective): {{ socialCallbackUrl }}</div>
            <div>User agent: {{ userAgent }}</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <div class="row q-col-gutter-sm">
              <div class="col-12 col-sm-6">
                <q-btn
                  class="full-width"
                  color="primary"
                  outline
                  size="sm"
                  :loading="testingAuth"
                  label="Test Auth Endpoint"
                  @click="testAuthEndpoint"
                />
              </div>
              <div class="col-12 col-sm-6">
                <q-btn
                  class="full-width"
                  color="secondary"
                  outline
                  size="sm"
                  :loading="testingBands"
                  label="Test Bands Endpoint"
                  @click="testBandsEndpoint"
                />
              </div>
              <div class="col-12">
                <q-btn
                  class="full-width"
                  color="accent"
                  outline
                  size="sm"
                  :loading="testingSession"
                  label="Probe Session + CORS"
                  @click="probeSessionAndCors"
                />
              </div>
            </div>
          </q-card-section>
          <q-card-section v-if="debugOutput" class="q-pt-none">
            <div class="debug-output">
              {{ debugOutput }}
            </div>
          </q-card-section>
        </q-card>
      </q-dialog>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.login-page-wrap {
  position: relative;
  color: rgba(248, 250, 252, 0.96);
}

.login-page-wrap :deep(.q-field__label),
.login-page-wrap :deep(.q-field__native),
.login-page-wrap :deep(.q-field__input),
.login-page-wrap :deep(.q-field__marginal),
.login-page-wrap :deep(.q-toggle__label) {
  color: rgba(248, 250, 252, 0.96);
}

.login-page-wrap :deep(.q-field--outlined .q-field__control:before) {
  border-color: rgba(255, 255, 255, 0.26);
}

.login-page-wrap :deep(.q-field--outlined .q-field__control:hover:before),
.login-page-wrap :deep(.q-field--focused .q-field__control:after) {
  border-color: rgba(129, 140, 248, 0.9);
}

.login-page-wrap :deep(.q-field--outlined .q-field__control) {
  background: rgba(15, 23, 42, 0.28);
}

.login-page-wrap :deep(.q-field__native::placeholder),
.login-page-wrap :deep(.q-field__input::placeholder) {
  color: rgba(226, 232, 240, 0.62);
}

.auth-mode-toggle :deep(.q-btn) {
  min-height: 34px;
  color: rgba(226, 232, 240, 0.82);
}

.auth-mode-toggle :deep(.q-btn--active) {
  color: #fff;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.18);
}

.q-btn-github {
  border-color: rgba(255, 255, 255, 0.35);
}

.auth-google-btn :deep(.q-btn__content) {
  color: rgba(15, 23, 42, 0.92);
}

.auth-link-btn {
  color: rgba(226, 232, 240, 0.92);
}

.auth-link-btn:hover {
  color: #fff;
}

.debug-icon-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  z-index: 2;
}

.debug-card {
  width: min(92vw, 760px);
  max-height: 86vh;
}

.debug-content {
  white-space: pre-wrap;
  word-break: break-word;
}

.debug-output {
  white-space: pre-wrap;
  word-break: break-word;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.22);
}
</style>
