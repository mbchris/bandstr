import { route } from 'quasar/wrappers'
import { createRouter, createMemoryHistory, createWebHistory, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import routes from './routes'

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function isNativeLikeRuntime() {
  const w = window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }
  try {
    if (typeof w.Capacitor?.isNativePlatform === 'function') {
      return w.Capacitor.isNativePlatform()
    }
  } catch {
    // Ignore runtime bridge issues and fall back to origin heuristic.
  }
  return window.location.origin === 'https://localhost'
}

export default route(function (/* { store, ssrContext } */) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : process.env.VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory

  const router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    history: createHistory(process.env.VUE_ROUTER_BASE),
  })

  router.onError(() => {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  })

  router.beforeEach(async (to) => {
    const auth = useAuthStore()
    const ensureBandsLoaded = async () => {
      if (auth.bands.length > 0) return
      await auth.loadBands()
      if (isNativeLikeRuntime() && auth.bands.length <= 1) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          await delay(300)
          await auth.loadBands()
          if (auth.bands.length > 1) break
        }
      }
    }

    if (to.meta.requiresAuth && !auth.isAuthenticated) {
      // Try to restore session from cookie/token
      await auth.loadSession()
      if (!auth.isAuthenticated) {
        return { path: '/login', query: { redirect: to.fullPath } }
      }
    }

    if (to.meta.requiresAuth) {
      try {
        await ensureBandsLoaded()
      } catch {
        auth.clearSession()
        return { path: '/login', query: { redirect: to.fullPath } }
      }
    }

    if (to.meta.requiresAdmin) {
      const activeBand = auth.activeBand
      if (!activeBand || !['owner', 'admin'].includes(activeBand.role)) {
        return { path: '/' }
      }
    }

    if (to.meta.requiresBand && !auth.activeBand) {
      return {
        path: '/bands/manage',
        query: {
          needBand: '1',
          redirect: to.fullPath,
        },
      }
    }

    if (to.meta.requiresAuth && to.path === '/' && localStorage.getItem('bandstr-dashboard-seen') !== '1') {
      localStorage.setItem('bandstr-dashboard-seen', '1')
      return { path: '/dashboard' }
    }

    // Redirect already-authenticated users away from /login.
    // For OAuth deep-link returns we may not have in-memory auth state yet,
    // so hydrate session once before deciding.
    if (to.path === '/login') {
      if (!auth.isAuthenticated) {
        await auth.loadSession()
        // On mobile, cookie propagation from browser -> WebView can lag briefly.
        if (!auth.isAuthenticated && isNativeLikeRuntime()) {
          for (let attempt = 0; attempt < 6 && !auth.isAuthenticated; attempt += 1) {
            await delay(300)
            await auth.loadSession()
          }
        }
      }
      if (auth.isAuthenticated) {
        const redirectTarget = typeof to.query.redirect === 'string' ? to.query.redirect : '/'
        return { path: redirectTarget }
      }
    }
  })

  return router
})
