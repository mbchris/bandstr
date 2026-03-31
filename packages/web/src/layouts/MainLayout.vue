<template>
  <q-layout view="lHh Lpr lFf">
    <q-header bordered class="bg-transparent safe-area-top">
      <q-toolbar class="q-px-sm q-px-md-md">
        <q-toolbar-title>
          <router-link to="/" class="brand-link">
            <img :src="activeLogoSrc" alt="bandstr logo" class="brand-logo" />
          </router-link>
        </q-toolbar-title>

        <div class="row items-center q-gutter-xs q-gutter-sm-md no-wrap">
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

          <q-btn v-if="!isBillingRoute" flat round dense class="header-action-btn" icon="account_circle">
            <q-menu anchor="bottom right" self="top right">
              <q-list style="min-width: 260px">
                <q-item clickable v-close-popup @click="goDashboard">
                  <q-item-section>{{ t('nav.dashboard') }}</q-item-section>
                </q-item>
                <q-item-label header>{{ t('nav.allBands') }}</q-item-label>
                <q-item
                  v-for="band in authStore.bands"
                  :key="band.id"
                  clickable
                  v-close-popup
                  @click="selectBand(band.id)"
                >
                  <q-item-section>
                    <q-item-label>{{ band.name }}</q-item-label>
                    <q-item-label caption>{{ formatPlanLabel(band.plan, band.hasProPlan) }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <div class="column items-end q-gutter-xs">
                      <q-badge v-if="activeBandId === band.id" color="primary">{{ t('nav.active') }}</q-badge>
                      <q-badge outline color="secondary">{{ formatPlanLabel(band.plan, band.hasProPlan) }}</q-badge>
                    </div>
                  </q-item-section>
                </q-item>

                <q-separator />
                <q-item disable>
                  <q-item-section>
                    {{ t('nav.loggedInAs') }}: {{ activeUserName }} ({{ activeBandRole }})
                  </q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="goBilling">
                  <q-item-section>{{ t('nav.subscriptions') }}</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="router.push('/impress')">
                  <q-item-section>{{ t('nav.impress') }}</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="goDeleteAccount">
                  <q-item-section>{{ t('nav.deleteAccount') }}</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="handleLogout">
                  <q-item-section>{{ t('nav.signOut') }}</q-item-section>
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
      <div v-if="showTopNav" class="bottom-nav q-px-sm q-py-xs">
        <div class="row items-center no-wrap bottom-nav-scroll justify-center">
          <q-btn
            v-for="link in navLinks"
            :key="link.to"
            flat
            dense
            :to="link.to"
            class="bottom-nav-btn q-mr-xs"
            :class="{ 'bottom-nav-btn--active': isActiveRoute(link.to) }"
            :aria-label="link.label"
            :title="link.label"
          >
            <span class="bottom-nav-content">
              <img
                :src="isActiveRoute(link.to) ? link.iconActive : link.iconInactive"
                :alt="link.label"
                class="bottom-nav-icon"
              />
              <span class="bottom-nav-label">{{ link.label }}</span>
            </span>
          </q-btn>
        </div>
      </div>
    </q-footer>
  </q-layout>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../stores/auth'
import { useBandStore } from '../stores/band'
import { useI18n } from '../composables/useI18n'
import defaultLogoDark from '../assets/bandstr_rect_wh.webp'
import defaultLogoLight from '../assets/bandstr_rect_bl.webp'
import homeBl from '../assets/icons/home_bl.webp'
import homeWh from '../assets/icons/home_wh.webp'
import votingBl from '../assets/icons/voting_bl.webp'
import votingWh from '../assets/icons/voting_wh.webp'
import setlistBl from '../assets/icons/setlist_bl.webp'
import setlistWh from '../assets/icons/setlist_wh.webp'
import calendarBl from '../assets/icons/calendar_bl.webp'
import calendarWh from '../assets/icons/calendar_wh.webp'
import bendastandWh from '../assets/icons/bendastand_wh.webp'
import adminBl from '../assets/icons/admin_bl.webp'

const authStore = useAuthStore()
const bandStore = useBandStore()
const route = useRoute()
const router = useRouter()
const { t, locale, toggleLocale } = useI18n()
const $q = useQuasar()

const activeBandId = computed({
  get: () => authStore.activeBandId,
  set: (id) => {
    authStore.setActiveBand(id)
    bandStore.fetchMembers()
  },
})

const activeBandRole = computed(() => authStore.activeBand?.role ?? 'none')
const activeUserName = computed(() => authStore.user?.name ?? authStore.user?.email ?? 'Unknown user')

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
  const links = [
    { label: t('nav.home'), to: '/', iconInactive: homeBl, iconActive: homeWh },
    { label: t('nav.voting'), to: '/voting', iconInactive: votingBl, iconActive: votingWh },
    { label: t('nav.setlist'), to: '/setlist', iconInactive: setlistBl, iconActive: setlistWh },
    { label: t('nav.calendar'), to: '/calendar', iconInactive: calendarBl, iconActive: calendarWh },
  ]

  if (isAdmin.value) {
    links.push({ label: t('nav.admin'), to: '/admin', iconInactive: adminBl, iconActive: adminBl })
  }

  // links.push({ icon: 'payment', label: 'Billing', to: '/billing' })

  return links
})

const isBillingRoute = computed(() => route.path.startsWith('/billing'))
const showTopNav = computed(() => route.path !== '/dashboard' && !isBillingRoute.value)
const routerViewKey = computed(() => `${route.fullPath}::band-${authStore.activeBandId ?? 'none'}`)

function isActiveRoute(path: string) {
  return route.path === path
}

function toggleDarkMode() {
  $q.dark.set(!$q.dark.isActive)
}

function selectBand(id: number) {
  activeBandId.value = id
}

function formatPlanLabel(plan: string | null | undefined, hasProPlan?: boolean) {
  const normalized = (hasProPlan ? 'pro' : (plan ?? 'free')).toUpperCase()
  return `${normalized} plan`
}

function goDashboard() {
  router.push('/dashboard')
}

function goBilling() {
  router.push('/billing')
}

function goDeleteAccount() {
  router.push('/delete-account')
}

async function handleLogout() {
  const { authClient } = await import('../boot/auth')
  const apiBase = (process.env.API_URL || '').replace(/\/+$/, '').replace(/\/api$/, '')
  try {
    if (authStore.token) {
      let revoked = false

      const revokeRes = await fetch(`${apiBase}/api/mobile-auth/revoke-token`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.token}`,
        },
        credentials: 'omit',
      })
      if (revokeRes.ok) {
        revoked = true
      }

      // Keep Better Auth state/cookies in sync too (especially for web sessions).
      const signOutRes = await fetch(`${apiBase}/api/auth/sign-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        credentials: 'include',
      })
      if (signOutRes.ok) {
        revoked = true
      }

      if (!revoked) {
        throw new Error('Token revocation failed')
      }
    } else {
      await authClient.signOut()
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
  } catch {
    // Keep layout usable even if band refresh fails transiently.
  }
})
</script>

<style scoped>
.safe-area-top {
  padding-top: env(safe-area-inset-top, 0px);
}

.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.bottom-nav-footer {
  background: transparent;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

.bottom-nav {
  background: rgba(250, 251, 253, 0.96);
}

.bottom-nav-scroll {
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 2px;
}

.bottom-nav-scroll::-webkit-scrollbar {
  display: none;
}

.bottom-nav-btn {
  width: 76px;
  height: 78px;
  min-width: 76px;
  min-height: 78px;
  padding: 8px 6px;
  border-radius: 10px;
  border: 1px solid transparent;
}

.bottom-nav-btn--active {
  background: #111827;
  border-color: #111827;
}

.bottom-nav-icon {
  display: block;
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.bottom-nav-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  line-height: 1;
}

.bottom-nav-label {
  font-size: 0.62rem;
  font-weight: 600;
  color: #1f2937;
  text-transform: none;
  letter-spacing: 0;
}

.bottom-nav-btn--active .bottom-nav-label {
  color: #ffffff;
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

</style>
