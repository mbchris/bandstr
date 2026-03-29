import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiJson } from '../boot/api'

export type CalendarEventType = 'rehearsal' | 'gig' | 'event' | 'unavailability'

export type CalendarEvent = {
  id: number
  bandId: number
  title: string
  description?: string | null
  startTime: string
  endTime: string
  type: CalendarEventType
  userId?: string | null
  bierwartOverrideId?: string | null
  isTentative: boolean
  ownerName?: string | null
}

export const useCalendarStore = defineStore('calendar', () => {
  const events = ref<CalendarEvent[]>([])
  const loading = ref(false)

  async function fetchEvents() {
    loading.value = true
    try {
      events.value = await apiJson<CalendarEvent[]>('/calendar')
    } finally {
      loading.value = false
    }
  }

  async function createEvent(data: Partial<CalendarEvent>) {
    await apiJson('/calendar', { method: 'POST', body: JSON.stringify(data) })
    await fetchEvents()
  }

  async function updateEvent(id: number, data: Partial<CalendarEvent>) {
    await apiJson(`/calendar/${id}`, { method: 'PUT', body: JSON.stringify(data) })
    await fetchEvents()
  }

  async function deleteEvent(id: number) {
    await apiJson(`/calendar/${id}`, { method: 'DELETE' })
    events.value = events.value.filter((e) => e.id !== id)
  }

  return { events, loading, fetchEvents, createEvent, updateEvent, deleteEvent }
})
