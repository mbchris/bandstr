import { boot } from 'quasar/wrappers'
import { createAuthClient } from 'better-auth/vue'

const apiBase = (process.env.API_URL ?? '').replace(/\/+$/, '').replace(/\/api$/, '')

export const authClient = createAuthClient({
  baseURL: apiBase,
  basePath: '/api/auth',
})

export default boot(() => {
  // authClient is used directly in stores/auth.ts and components
})
