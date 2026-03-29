import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: 'dashboard', component: () => import('../pages/DashboardPage.vue') },
      { path: '', component: () => import('../pages/IndexPage.vue') },
      { path: 'voting', component: () => import('../pages/VotingPage.vue') },
      { path: 'setlist', component: () => import('../pages/SetlistPage.vue') },
      { path: 'calendar', component: () => import('../pages/CalendarPage.vue') },
      { path: 'stand', component: () => import('../pages/StandPage.vue') },
      { path: 'admin', component: () => import('../pages/AdminPage.vue'), meta: { requiresAdmin: true } },
      { path: 'bands/manage', component: () => import('../pages/ManageBandsPage.vue') },
      { path: 'band/new', component: () => import('../pages/BandCreatePage.vue') },
      { path: 'billing', component: () => import('../pages/BillingPage.vue') },
    ],
  },
  {
    path: '/login',
    component: () => import('../layouts/AuthLayout.vue'),
    children: [
      { path: '', component: () => import('../pages/LoginPage.vue') },
    ],
  },
  {
    path: '/impress',
    component: () => import('../layouts/PublicLayout.vue'),
    children: [
      { path: '', component: () => import('../pages/ImpressPage.vue') },
    ],
  },
  {
    path: '/:catchAll(.*)*',
    component: () => import('../pages/ErrorNotFound.vue'),
  },
]

export default routes
