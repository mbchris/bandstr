import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authClient } from '../boot/auth'

export type User = {
  id: string
  name: string
  email: string
  image?: string | null
}

export type BandMembership = {
  id: number
  name: string
  slug: string
  plan: string
  hasProPlan?: boolean
  subscriptionStatus?: 'none' | 'active' | 'canceled' | 'past_due' | 'trialing' | null
  subscriptionInterval?: 'monthly' | 'yearly' | null
  subscriptionCurrentPeriodEnd?: string | null
  subscriptionCancelAtPeriodEnd?: boolean
  role: string
  logo?: string | null
  logoDark?: string | null
  logoBright?: string | null
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('bandstr-token'))
  const activeBandId = ref<number | null>(
    localStorage.getItem('bandstr-band-id') ? Number(localStorage.getItem('bandstr-band-id')) : null,
  )
  const bands = ref<BandMembership[]>([])

  const isAuthenticated = computed(() => !!user.value)
  const activeBand = computed(() => bands.value.find((b) => b.id === activeBandId.value) ?? null)
  const apiBase = (process.env.API_URL ?? '').replace(/\/+$/, '').replace(/\/api$/, '')

  async function loadSessionFromBearer() {
    if (!token.value) return null

    const res = await fetch(`${apiBase}/api/auth/get-session`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token.value}`,
      },
      // Bearer auth should not be mixed with potentially stale cookie sessions.
      credentials: 'omit',
    })

    if (!res.ok) {
      return null
    }

    const data = (await res.json()) as { user?: User } | null
    return data?.user ?? null
  }

  async function loadBands() {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    }

    if (token.value) {
      headers.Authorization = `Bearer ${token.value}`
    }

    const res = await fetch(`${apiBase}/api/bands`, {
      method: 'GET',
      headers,
      // If a bearer token is present, avoid cookie/session ambiguity.
      credentials: token.value ? 'omit' : 'include',
    })

    if (!res.ok) {
      throw new Error(`Failed to load bands (${res.status})`)
    }

    const memberships = (await res.json()) as BandMembership[]
    setBands(memberships)
    return memberships
  }

  async function loadSession() {
    try {
      let resolvedUser: User | null = null

      if (token.value) {
        resolvedUser = await loadSessionFromBearer()
      }

      if (!resolvedUser) {
        const { data } = await authClient.getSession()
        if (data?.user) {
          resolvedUser = {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            image: data.user.image,
          }
        }
      }

      if (resolvedUser) {
        user.value = resolvedUser
      } else {
        user.value = null
        token.value = null
      }
    } catch {
      // Network or upstream API errors must not break initial navigation.
      clearSession()
    }
  }

  function setToken(t: string | null) {
    token.value = t
    if (t) {
      localStorage.setItem('bandstr-token', t)
    } else {
      localStorage.removeItem('bandstr-token')
    }
  }

  function setActiveBand(id: number | null) {
    activeBandId.value = id
    if (id) {
      localStorage.setItem('bandstr-band-id', String(id))
    } else {
      localStorage.removeItem('bandstr-band-id')
    }
  }

  function setBands(list: BandMembership[]) {
    bands.value = list
    // Auto-select if only one band or saved band no longer accessible
    if (list.length > 0 && !list.find((b) => b.id === activeBandId.value)) {
      setActiveBand(list[0].id)
    }
  }

  function setActiveBandLogos(payload: {
    logo?: string | null
    logoDark?: string | null
    logoBright?: string | null
  }) {
    const currentBand = bands.value.find((b) => b.id === activeBandId.value)
    if (currentBand) {
      if (payload.logo !== undefined) currentBand.logo = payload.logo
      if (payload.logoDark !== undefined) currentBand.logoDark = payload.logoDark
      if (payload.logoBright !== undefined) currentBand.logoBright = payload.logoBright
    }
  }

  function clearSession() {
    user.value = null
    token.value = null
    activeBandId.value = null
    bands.value = []
    localStorage.removeItem('bandstr-token')
    localStorage.removeItem('bandstr-band-id')
  }

  return {
    user,
    token,
    activeBandId,
    bands,
    isAuthenticated,
    activeBand,
    loadSession,
    loadBands,
    setToken,
    setActiveBand,
    setBands,
    setActiveBandLogos,
    clearSession,
  }
})
