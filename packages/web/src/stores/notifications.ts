import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiJson } from '../boot/api'

export type NotificationSettings = {
  userId: string
  notifyAbsence: boolean
  notifyGig: boolean
  notifyRehearsal: boolean
  notifySongSuggestion: boolean
}

export type AppNotification = {
  id: number
  bandId: number
  userId: string
  eventType: 'absence' | 'gig' | 'rehearsal' | 'song_suggestion'
  title: string
  message: string
  linkPath: string
  linkQuery?: string | null
  isRead: boolean
  createdAt: string
  readAt?: string | null
}

type NotificationListResponse = {
  notifications: AppNotification[]
  unreadCount: number
}

export const useNotificationsStore = defineStore('notifications', () => {
  const settings = ref<NotificationSettings | null>(null)
  const items = ref<AppNotification[]>([])
  const unreadCount = ref(0)
  const lastSeenId = ref(0)

  const hasUnread = computed(() => unreadCount.value > 0)

  async function fetchSettings() {
    settings.value = await apiJson<NotificationSettings>('/notifications/settings')
    return settings.value
  }

  async function updateSettings(patch: Partial<NotificationSettings>) {
    settings.value = await apiJson<NotificationSettings>('/notifications/settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    })
    return settings.value
  }

  async function fetchRecent(limit = 20) {
    const data = await apiJson<NotificationListResponse>(`/notifications?limit=${Math.max(1, Math.min(limit, 50))}`)
    items.value = data.notifications
    unreadCount.value = data.unreadCount
    const maxId = data.notifications.reduce((max, row) => Math.max(max, row.id), 0)
    if (maxId > lastSeenId.value) lastSeenId.value = maxId
    return data.notifications
  }

  async function pollNew() {
    const data = await apiJson<NotificationListResponse>(`/notifications?sinceId=${lastSeenId.value}&limit=50`)
    unreadCount.value = data.unreadCount

    if (data.notifications.length === 0) return [] as AppNotification[]

    // API returns DESC; re-sort for chronological toast display.
    const ascending = [...data.notifications].sort((a, b) => a.id - b.id)
    const maxId = ascending[ascending.length - 1]?.id ?? lastSeenId.value
    if (maxId > lastSeenId.value) lastSeenId.value = maxId

    const known = new Set(items.value.map((item) => item.id))
    const fresh = ascending.filter((item) => !known.has(item.id))

    if (fresh.length > 0) {
      items.value = [...fresh.reverse(), ...items.value].slice(0, 50)
    }

    return fresh
  }

  async function markRead(id: number) {
    await apiJson(`/notifications/${id}/read`, { method: 'POST' })
    const item = items.value.find((row) => row.id === id)
    if (item && !item.isRead) {
      item.isRead = true
      item.readAt = new Date().toISOString()
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
  }

  async function markAllRead() {
    await apiJson('/notifications/read-all', { method: 'POST' })
    items.value = items.value.map((item) => ({ ...item, isRead: true, readAt: item.readAt ?? new Date().toISOString() }))
    unreadCount.value = 0
  }

  function resetForBand() {
    items.value = []
    unreadCount.value = 0
    lastSeenId.value = 0
  }

  return {
    settings,
    items,
    unreadCount,
    hasUnread,
    fetchSettings,
    updateSettings,
    fetchRecent,
    pollNew,
    markRead,
    markAllRead,
    resetForBand,
  }
})
