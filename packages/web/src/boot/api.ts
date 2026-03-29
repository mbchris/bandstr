import { boot } from 'quasar/wrappers'
import { useAuthStore } from '../stores/auth'

/**
 * Thin fetch wrapper that auto-injects:
 * - Authorization: Bearer <token>
 * - X-Band-Id: <activeBandId>
 *
 * Usage: import { api } from 'src/boot/api'
 *        const data = await api('/songs').then(r => r.json())
 */
export const api = async (path: string, init: RequestInit = {}): Promise<Response> => {
  const authStore = useAuthStore()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  }

  if (authStore.token) {
    headers['Authorization'] = `Bearer ${authStore.token}`
  }

  if (authStore.activeBandId && !headers['X-Band-Id']) {
    headers['X-Band-Id'] = String(authStore.activeBandId)
  }

  const base = (process.env.API_URL ?? '').replace(/\/+$/, '').replace(/\/api$/, '')
  const res = await fetch(`${base}/api${path}`, { ...init, headers })

  if (res.status === 401) {
    authStore.clearSession()
    window.location.href = '/login'
  }

  return res
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await api(path, init)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error: string }).error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export default boot(() => {
  // Nothing to mount — api is a plain function, imported directly where needed
})
