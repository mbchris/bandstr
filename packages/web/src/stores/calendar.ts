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
  gigSetlistId?: number | null
  gigSetlistTitle?: string | null
}

export type RehearsalMemberAttendance = {
  userId: string
  userName: string
  image?: string | null
  status: 'present' | 'absent' | 'open'
}

export type RehearsalAttendanceSummary = 'all_present' | 'has_absent' | 'pending'

export type RehearsalAttendanceInfo = {
  id: number
  title: string
  description?: string | null
  startTime: string
  endTime: string
  isTentative?: boolean
  myAttendance: 'present' | 'absent' | null
  memberAttendance: RehearsalMemberAttendance[]
  summary: RehearsalAttendanceSummary
}

export const useCalendarStore = defineStore('calendar', () => {
  const events = ref<CalendarEvent[]>([])
  const loading = ref(false)
  const attendanceMap = ref<Record<number, RehearsalAttendanceInfo>>({})
  const upcomingRehearsals = ref<RehearsalAttendanceInfo[]>([])
  const attendanceMembers = ref<Array<{ userId: string; userName: string; image?: string | null }>>([])
  const loadingAttendance = ref(false)

  async function fetchEvents() {
    loading.value = true
    try {
      events.value = await apiJson<CalendarEvent[]>('/calendar')
    } finally {
      loading.value = false
    }
  }

  async function fetchRehearsalAttendance() {
    loadingAttendance.value = true
    try {
      const data = await apiJson<{
        rehearsals: RehearsalAttendanceInfo[]
        members: Array<{ userId: string; userName: string; image?: string | null }>
      }>('/rehearsals/attendance')
      upcomingRehearsals.value = data.rehearsals || []
      attendanceMembers.value = data.members || []
      const map: Record<number, RehearsalAttendanceInfo> = {}
      for (const r of data.rehearsals || []) {
        map[r.id] = r
      }
      attendanceMap.value = map
    } catch {
      // non-fatal
    } finally {
      loadingAttendance.value = false
    }
  }

  async function setRehearsalAttendance(rehearsalId: number, status: 'present' | 'absent' | 'reset') {
    await apiJson(`/rehearsals/${rehearsalId}/attendance`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
    await fetchRehearsalAttendance()
  }

  async function createEvent(data: Partial<CalendarEvent>) {
    await apiJson('/calendar', { method: 'POST', body: JSON.stringify(data) })
    await fetchEvents()
    await fetchRehearsalAttendance()
  }

  async function updateEvent(id: number, data: Partial<CalendarEvent>) {
    await apiJson(`/calendar/${id}`, { method: 'PUT', body: JSON.stringify(data) })
    await fetchEvents()
    await fetchRehearsalAttendance()
  }

  async function deleteEvent(id: number) {
    await apiJson(`/calendar/${id}`, { method: 'DELETE' })
    events.value = events.value.filter((e) => e.id !== id)
    delete attendanceMap.value[id]
    upcomingRehearsals.value = upcomingRehearsals.value.filter((r) => r.id !== id)
  }

  return {
    events,
    loading,
    attendanceMap,
    upcomingRehearsals,
    attendanceMembers,
    loadingAttendance,
    fetchEvents,
    fetchRehearsalAttendance,
    setRehearsalAttendance,
    createEvent,
    updateEvent,
    deleteEvent,
  }
})
