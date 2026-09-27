<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar, copyToClipboard } from 'quasar'
import { useAuthStore } from '../stores/auth'
import { useBandStore } from '../stores/band'
import { useNotificationsStore, type AppNotification } from '../stores/notifications'
import { useI18n } from '../composables/useI18n'
import defaultLogoDark from '../assets/bandstr_rect_wh.webp'
import defaultLogoLight from '../assets/bandstr_rect_bl.webp'
import {
  Home,
  ThumbsUp,
  ListMusic,
  Calendar,
  Settings,
} from 'lucide-vue-next'

const authStore = useAuthStore()
const bandStore = useBandStore()
const notificationsStore = useNotificationsStore()
const route = useRoute()
const router = useRouter()
const { t, locale, toggleLocale } = useI18n()
const $q = useQuasar()
const POLL_INTERVAL_MS = 10_000
let pollTimer: number | null = null

const activeBandId = computed({
  get: () => authStore.activeBandId,
  set: (id) => {
    authStore.setActiveBand(id)
    bandStore.fetchMembers()
  },
})

const activeBandRole = computed(() => authStore.activeBand?.role ?? 'none')
const hasActiveBand = computed(() => Boolean(authStore.activeBand))
const effectivePlanLabel = computed(() => {
  const p = authStore.effectivePlan
  if (p === 'pro') return 'bandstr pro'
  if (p === 'plus') return 'bandstr plus'
  return 'bandstr free'
})
const activeUserName = computed(() => authStore.user?.name ?? authStore.user?.email ?? 'Unknown user')
const activeUserEmail = computed(() => authStore.user?.email ?? '')
const truncatedActiveUserName = computed(() => {
  const name = activeUserName.value
  if (name.length <= 32) return name
  return `${name.slice(0, 32)}...`
})

const activeLogoSrc = computed(() => {
  const band = authStore.activeBand
  if ($q.dark.isActive) {
    return band?.logoDark ?? band?.logo ?? band?.logoBright ?? defaultLogoDark
  }
  return band?.logoBright ?? band?.logo ?? band?.logoDark ?? defaultLogoLight
})

const isAdmin = computed(() => {
  const band = authStore.activeBand
  return !!(band && ['owner', 'admin'].includes(band.role))
})

const navLinks = computed(() => {
  if (!hasActiveBand.value) {
    return []
  }

  const links = [
    { id: 'home', label: t('nav.home'), to: '/', icon: Home, activeIcon: Home },
    { id: 'voting', label: t('nav.voting'), to: '/voting', icon: ThumbsUp, activeIcon: ThumbsUp },
    { id: 'setlist', label: t('nav.setlist'), to: '/setlist', icon: ListMusic, activeIcon: ListMusic },
    { id: 'calendar', label: t('nav.calendar'), to: '/calendar', icon: Calendar, activeIcon: Calendar },
  ]

  if (isAdmin.value) {
    links.push({ id: 'admin', label: t('nav.admin'), to: '/admin', icon: Settings, activeIcon: Settings })
  }

  return links
})

const isBillingRoute = computed(() => route.path.startsWith('/billing'))
const showTopNav = computed(() => hasActiveBand.value && route.path !== '/dashboard' && !isBillingRoute.value)
const routerViewKey = computed(() => `${route.fullPath}::band-${authStore.activeBandId ?? 'none'}`)

function isActiveRoute(path: string) {
  return route.path === path
}

function toggleDarkMode() {
  $q.dark.set(!$q.dark.isActive)
}

async function copyWebAppLink() {
  try {
    await copyToClipboard('https://bandstr.apps.4ki.app')
    $q.notify({
      type: 'positive',
      message: t('dashboard.linkCopied') || 'Link copied to clipboard',
      timeout: 2000,
    })
  } catch (err) {
    console.error(err)
  }
}

function selectBand(id: number) {
  activeBandId.value = id
}


function goDashboard() {
  router.push('/dashboard')
}

function goSupport() {
  router.push('/support')
}

function parseLinkQuery(raw: string | null | undefined) {
  const result: Record<string, string> = {}
  if (!raw) return result
  const params = new URLSearchParams(raw)
  params.forEach((value, key) => {
    result[key] = value
  })
  return result
}

async function openNotification(item: AppNotification) {
  if (!item.isRead) {
    await notificationsStore.markRead(item.id).catch(() => undefined)
  }

  await router.push({
    path: item.linkPath || '/',
    query: parseLinkQuery(item.linkQuery),
  })
}

async function markAllNotificationsRead() {
  await notificationsStore.markAllRead().catch(() => undefined)
}

async function refreshNotifications() {
  if (!authStore.activeBandId) return
  try {
    const newItems = await notificationsStore.pollNew()
    for (const item of newItems) {
      $q.notify({
        type: 'info',
        classes: 'bandstr-notify',
        message: item.title,
        caption: item.message,
        timeout: 6500,
        actions: [
          {
            label: t('nav.openNotification'),
            color: 'white',
            handler: () => {
              void openNotification(item)
            },
          },
        ],
      })
    }
  } catch {
    // Ignore transient polling errors.
  }
}

function startNotificationPolling() {
  if (pollTimer !== null) window.clearInterval(pollTimer)
  pollTimer = window.setInterval(() => {
    void refreshNotifications()
  }, POLL_INTERVAL_MS)
}

async function handleLogout() {
  const { authClient } = await import('../boot/auth')
  const apiBase = (process.env.API_URL || '').replace(/\/+$/, '').replace(/\/api$/, '')
  const registeredPushToken = localStorage.getItem('bandstr-native-push-token')
  try {
    // Always attempt cookie-session sign out first.
    await authClient.signOut().catch(() => undefined)

    const signOutRes = await fetch(`${apiBase}/api/auth/sign-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: '{}',
    }).catch(() => null)

    if (signOutRes && !signOutRes.ok && signOutRes.status !== 401) {
      throw new Error(`Sign-out failed (${signOutRes.status})`)
    }

    if (authStore.token) {
      const revokeRes = await fetch(`${apiBase}/api/mobile-auth/revoke-token`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.token}`,
        },
        credentials: 'omit',
      })
      if (!revokeRes.ok && revokeRes.status !== 404) {
        throw new Error(`Token revocation failed (${revokeRes.status})`)
      }
    }

    if (registeredPushToken) {
      await fetch(`${apiBase}/api/notifications/devices/unregister`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}),
        },
        credentials: authStore.token ? 'omit' : 'include',
        body: JSON.stringify({ token: registeredPushToken }),
      }).catch(() => undefined)
      localStorage.removeItem('bandstr-native-push-token')
    }
  } catch {
    $q.notify({
      type: 'negative',
      message: 'Logout failed. Please try again.',
    })
    return
  }
  authStore.clearSession()
  window.location.href = '/login'
}

onMounted(async () => {
  try {
    await authStore.loadBands()
    if (authStore.activeBandId) {
      await notificationsStore.fetchRecent()
      await refreshNotifications()
    }
    startNotificationPolling()
  } catch {
    // Keep layout usable even if band refresh fails transiently.
  }
})

watch(
  () => authStore.activeBandId,
  async () => {
    notificationsStore.resetForBand()
    if (!authStore.activeBandId) return
    await notificationsStore.fetchRecent().catch(() => undefined)
    await refreshNotifications()
  },
)

onBeforeUnmount(() => {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<template>
  <q-layout view="lHh Lpr lFf">
    <q-header
      bordered
    >
      <q-toolbar class="q-px-sm q-px-md-md">
        <q-toolbar-title>
          <router-link to="/" class="brand-link">
            <img :src="activeLogoSrc" alt="bandstr logo" class="brand-logo" />
          </router-link>
        </q-toolbar-title>

        <div class="row items-center q-gutter-xs q-gutter-sm-md no-wrap">
          <q-btn flat round dense class="header-action-btn" icon="notifications">
            <q-badge
              v-if="notificationsStore.unreadCount > 0"
              floating
              rounded
              color="negative"
              :label="String(Math.min(notificationsStore.unreadCount, 99))"
            />
            <q-menu anchor="bottom right" self="top right">
              <q-list style="min-width: 320px; max-width: 92vw">
                <q-item>
                  <q-item-section>
                    <q-item-label class="text-weight-bold">{{ t('nav.notifications') }}</q-item-label>
                    <q-item-label caption>{{ t('nav.notificationsUnread', { count: notificationsStore.unreadCount }) }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-btn
                      flat
                      dense
                      size="sm"
                      icon="done_all"
                      :label="t('nav.markAllRead')"
                      :disable="notificationsStore.unreadCount === 0"
                      @click="markAllNotificationsRead"
                    />
                  </q-item-section>
                </q-item>
                <q-separator />
                <q-item v-if="notificationsStore.items.length === 0" dense>
                  <q-item-section>
                    <q-item-label caption>{{ t('nav.noNotifications') }}</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item
                  v-for="item in notificationsStore.items.slice(0, 8)"
                  :key="item.id"
                  clickable
                  v-close-popup
                  @click="openNotification(item)"
                >
                  <q-item-section>
                    <q-item-label class="text-weight-medium">{{ item.title }}</q-item-label>
                    <q-item-label caption lines="2">{{ item.message }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-badge v-if="!item.isRead" color="primary" rounded />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>

          <q-btn
            flat
            round
            dense
            class="header-action-btn"
            :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'"
            @click="toggleDarkMode"
            :title="$q.dark.isActive ? 'Switch to light mode' : 'Switch to dark mode'"
          />

          <q-btn
            flat
            dense
            class="text-weight-bold header-action-btn"
            :label="locale === 'en' ? 'DE' : 'EN'"
            @click="toggleLocale"
          />

          <q-btn flat round dense class="header-action-btn" icon="account_circle">
            <q-menu anchor="bottom right" self="top right">
              <q-list style="min-width: 260px">
                <q-item clickable v-close-popup @click="goDashboard">
                  <q-item-section>{{ t('nav.dashboard') }}</q-item-section>
                </q-item>
                <q-separator />
                <div class="q-px-md q-py-xs text-caption text-grey-7" style="font-size: 11px; line-height: 1.35;">
                  {{ t('dashboard.shareWebAppPCPreLink') }}<a href="https://bandstr.apps.4ki.app" target="_blank" class="text-primary text-weight-medium" style="text-decoration: underline;">{{ t('dashboard.shareWebAppPCLinkText') }}</a>{{ t('dashboard.shareWebAppPCPostLink') }}
                  <q-btn flat round dense size="xs" icon="content_copy" color="grey-7" @click="copyWebAppLink" style="display: inline-flex; vertical-align: middle; margin-left: 4px;">
                    <q-tooltip>{{ t('dashboard.copyTooltip') }}</q-tooltip>
                  </q-btn>
                </div>
                <q-separator />
                <template v-for="band in authStore.bands" :key="band.id">
                  <q-item
                    clickable
                    v-close-popup
                    class="band-menu-item"
                    @click="selectBand(band.id)"
                  >
                    <q-item-section>
                      <q-item-label>{{ band.name }}</q-item-label>
                      <q-item-label v-if="activeBandId === band.id" caption class="text-primary text-weight-medium">
                        {{ t('nav.active') }}
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                  <q-separator />
                </template>

                <q-separator />
                <q-item clickable v-close-popup @click="router.push('/billing')">
                  <q-item-section>
                    <q-item-label>{{ t('nav.billing') }}</q-item-label>
                    <q-item-label caption class="text-primary text-weight-medium">{{ effectivePlanLabel }}</q-item-label>
                  </q-item-section>
                </q-item>
                <q-separator />
                <q-item clickable v-close-popup @click="goSupport">
                  <q-item-section>{{ t('nav.support') }}</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="router.push('/impress')">
                  <q-item-section>{{ t('nav.impress') }}</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="router.push('/delete-account')">
                  <q-item-section avatar>
                    <q-icon name="delete_forever" />
                  </q-item-section>
                  <q-item-section>{{ t('nav.deleteAccount') }}</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="handleLogout">
                  <q-item-section>{{ t('nav.signOut') }}</q-item-section>
                </q-item>
                <q-separator class="account-menu-separator" />
                <q-item disable>
                  <q-item-section>
                    <q-item-label>{{ t('nav.loggedInAs') }}: {{ truncatedActiveUserName }}</q-item-label>
                    <q-item-label caption>{{ activeUserEmail }} ({{ activeBandRole }})</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view :key="routerViewKey" />
    </q-page-container>

    <q-footer bordered class="bottom-nav-footer safe-area-bottom">
      <nav v-if="showTopNav" class="bandstr-bottom-nav">
        <div class="row items-center no-wrap nav-items-row justify-center">
          <button
            v-for="link in navLinks"
            :key="link.to"
            type="button"
            class="nav-item"
            :class="{ active: isActiveRoute(link.to) }"
            :aria-label="link.label"
            :title="link.label"
            @click="router.push(link.to)"
          >
            <div class="icon-container">
              <component
                :is="isActiveRoute(link.to) ? link.activeIcon : link.icon"
                class="tab-icon"
                :size="22"
                :stroke-width="isActiveRoute(link.to) ? 2.3 : 1.8"
              />
            </div>
            <span class="tab-label">{{ link.label }}</span>
          </button>
        </div>
      </nav>
    </q-footer>
  </q-layout>
</template>

<style lang="scss" scoped>
:global(.q-header) {
  background: #ffffff !important;
  background: var(--surface) !important;
  background-color: #ffffff !important;
  background-color: var(--surface) !important;
  color: var(--text) !important;
  border-bottom: 1px solid var(--border) !important;
}

.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.bottom-nav-footer {
  background: rgba(250, 251, 253, 0.92) !important;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

.bandstr-bottom-nav {
  padding: 6px 12px 6px;
  max-width: 560px;
  margin: 0 auto;
}

.nav-items-row {
  display: flex;
  justify-content: space-around;
  align-items: center;
  gap: 8px;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-width: 56px;
  max-width: 88px;
  height: 52px;
  padding: 4px 6px;
  border: none;
  background: transparent;
  color: #6b7280;
  border-radius: 12px;
  cursor: pointer;
  transition: all 160ms cubic-bezier(0.4, 0, 0.2, 1);
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;

  &:hover {
    color: #4b5563;
  }

  .icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 28px;
    border-radius: 14px;
    transition: all 160ms ease;
  }

  .tab-icon {
    display: block;
    color: inherit;
    transition: transform 160ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .tab-label {
    font-size: 0.72rem;
    font-weight: 500;
    line-height: 1.2;
    margin-top: 2px;
    color: inherit;
    letter-spacing: -0.01em;
    text-transform: none;
    transition: all 160ms ease;
  }

  &.active {
    color: #6366f1;

    .icon-container {
      background: rgba(99, 102, 241, 0.10);
    }

    .tab-icon {
      transform: translateY(-1px);
    }

    .tab-label {
      font-weight: 600;
      color: #6366f1;
    }
  }
}

:global(body.body--dark) {
  .bottom-nav-footer {
    background: rgba(24, 24, 27, 0.92) !important;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .nav-item {
    color: #a1a1aa;

    &:hover {
      color: #d4d4d8;
    }

    &.active {
      color: #818cf8;

      .icon-container {
        background: rgba(99, 102, 241, 0.20);
      }

      .tab-label {
        color: #818cf8;
      }
    }
  }
}

.brand-link {
  display: inline-flex;
  align-items: center;
}

.brand-logo {
  display: block;
  width: auto;
  height: 34px;
  max-width: 190px;
  object-fit: contain;
}

.band-menu-item {
  padding-left: 16px;
}

.account-menu-separator {
  opacity: 1;
}

@media (max-width: 430px) {
  .bandstr-bottom-nav {
    padding: 4px 6px 4px;
  }

  .nav-items-row {
    gap: 4px;
  }

  .nav-item {
    min-width: 48px;
    height: 48px;
    padding: 3px 2px;

    .icon-container {
      width: 28px;
      height: 24px;
    }

    .tab-label {
      font-size: 0.65rem;
    }
  }
}
</style>


