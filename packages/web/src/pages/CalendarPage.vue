<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useCalendarStore, type CalendarEvent } from '../stores/calendar'
import { useBandStore } from '../stores/band'
import { useAuthStore } from '../stores/auth'
import { useI18n } from '../composables/useI18n'
import { usePlatform } from '../composables/usePlatform'
import { apiJson } from '../boot/api'

const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const calendarStore = useCalendarStore()
const bandStore = useBandStore()
const authStore = useAuthStore()
const { t, tv } = useI18n()
const { isIos, isAndroid, pIcon } = usePlatform()

type GigSetlistOption = {
  id: number
  title: string
  calendarEventId?: number | null
  isArchived?: boolean
}

const availableGigSetlists = ref<GigSetlistOption[]>([])

async function fetchGigSetlists() {
  try {
    availableGigSetlists.value = await apiJson<GigSetlistOption[]>('/gigs')
  } catch {
    availableGigSetlists.value = []
  }
}

type GigSetlistSelectOption = {
  id: number | null
  title: string
  label: string
  value: number | null
}

const gigSetlistOptions = computed<GigSetlistSelectOption[]>(() => [
  { id: null, title: `➕ ${t('calendar.newGigSetlist')}`, label: `➕ ${t('calendar.newGigSetlist')}`, value: null },
  ...availableGigSetlists.value
    .filter((g) => !g.isArchived)
    .map((g) => ({
      id: g.id,
      title: g.title,
      label: g.title,
      value: g.id,
    })),
])

const filteredGigSetlistOptions = ref<GigSetlistSelectOption[]>([])

watch(
  gigSetlistOptions,
  (options) => {
    filteredGigSetlistOptions.value = options
  },
  { immediate: true },
)

function filterGigSetlists(val: string, update: (callback: () => void) => void) {
  update(() => {
    if (!val) {
      filteredGigSetlistOptions.value = gigSetlistOptions.value
    } else {
      const needle = val.toLowerCase()
      filteredGigSetlistOptions.value = gigSetlistOptions.value.filter((opt) =>
        opt.title.toLowerCase().includes(needle) || opt.label.toLowerCase().includes(needle),
      )
    }
  })
}

function resolveGigSetlistTitle(event: CalendarEvent): string {
  if (event.gigSetlistTitle) return event.gigSetlistTitle
  if (event.gigSetlistId) {
    const match = availableGigSetlists.value.find(
      (opt) => opt.id === event.gigSetlistId,
    )
    if (match && match.title) {
      return match.title
    }
  }
  return ''
}

function goToGigSetlist(gigSetlistId: number) {
  showEventModal.value = false
  void router.push({ path: '/setlist', query: { list: `gig:${gigSetlistId}` } })
}

const dayHeaders = computed(() => (tv('calendar.days') as string[]) || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
const typeOptions = computed(() => [
  { label: t('calendar.typeRehearsal'), value: 'rehearsal' },
  { label: t('calendar.typeGig'), value: 'gig' },
  { label: t('calendar.typeEvent'), value: 'event' },
  { label: t('calendar.typeUnavail'), value: 'unavailability' },
])

const ownerOptions = computed(() => [
  { label: t('calendar.ownerAll'), value: null },
  ...bandStore.members.filter((m) => !m.isHidden).map((u) => ({ label: u.name, value: u.id })),
])

const repeatOptions = computed(() => [
  { label: t('calendar.repeatNone'), value: 'none' },
  { label: t('calendar.repeatWeekly'), value: 'weekly' },
  { label: t('calendar.repeatBiweekly'), value: 'biweekly' },
  { label: t('calendar.repeatMonthly'), value: 'monthly' },
])

const repeatCountOptions = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
  label: String(n),
  value: n,
}))

// Calendar state
const currentDate = ref(new Date())
const currentYear = computed(() => currentDate.value.getFullYear())
const currentMonth = computed(() => currentDate.value.getMonth())
const monthName = computed(() => new Date(currentYear.value, currentMonth.value, 1).toLocaleString(undefined, { month: 'long' }))

const allDays = computed(() => {
  const days: Array<{ day: number; month: number; year: number; isCurrentMonth: boolean }> = []
  const year = currentYear.value
  const month = currentMonth.value
  const startDay = new Date(year, month, 1).getDay()
  const mondayFirstStartDay = (startDay + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Previous month padding
  const prevMonthDate = new Date(year, month, 0)
  const daysInPrevMonth = prevMonthDate.getDate()
  for (let i = 0; i < mondayFirstStartDay; i++) {
    days.push({ day: daysInPrevMonth - mondayFirstStartDay + i + 1, month: prevMonthDate.getMonth(), year: prevMonthDate.getFullYear(), isCurrentMonth: false })
  }

  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, month, year, isCurrentMonth: true })
  }

  // Next month padding (fill to 42 cells = 6 weeks)
  const nextMonthDate = new Date(year, month + 1, 1)
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    days.push({ day: i, month: nextMonthDate.getMonth(), year: nextMonthDate.getFullYear(), isCurrentMonth: false })
  }

  return days
})

function isToday(year: number, month: number, day: number) {
  const t = new Date()
  return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day
}

function prevMonth() { currentDate.value = new Date(currentYear.value, currentMonth.value - 1, 1) }
function nextMonth() { currentDate.value = new Date(currentYear.value, currentMonth.value + 1, 1) }
function goToToday() { currentDate.value = new Date() }

function getEvents(year: number, month: number, day: number) {
  const dayStart = new Date(year, month, day, 0, 0, 0, 0).getTime()
  const dayEnd = new Date(year, month, day, 23, 59, 59, 999).getTime()
  return calendarStore.events.filter((e) => {
    const eventStart = new Date(e.startTime).getTime()
    const eventEnd = new Date(e.endTime || e.startTime).getTime()
    return eventStart <= dayEnd && eventEnd >= dayStart
  })
}

function eventClass(event: CalendarEvent) {
  const base: Record<string, string> = { rehearsal: 'bg-blue-2 text-blue-9', gig: 'bg-orange-2 text-orange-9', event: 'bg-green-2 text-green-9', unavailability: 'bg-grey-3 text-grey-8' }
  return base[event.type] || 'bg-grey-3'
}

function eventDotColor(event: CalendarEvent) {
  const map: Record<string, string> = { rehearsal: 'primary', gig: 'orange', event: 'green', unavailability: 'grey' }
  return map[event.type] || 'grey'
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function toDatetimeLocal(date: Date) {
  const tzOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16)
}

// Event modal
const showEventModal = ref(false)
const editingEvent = ref<CalendarEvent | null>(null)
const isSaving = ref(false)
const form = ref({
  title: '',
  description: '',
  type: 'rehearsal',
  userId: null as string | null,
  startTime: '',
  endTime: '',
  isTentative: false,
  gigSetlistId: null as number | null,
  repeat: 'none' as 'none' | 'weekly' | 'biweekly' | 'monthly',
  repeatCount: 1,
})

function applyTimeDefaults(startTimeStr: string, endTimeStr: string) {
  const [startH, startM] = startTimeStr.split(':').map(Number)
  const [endH, endM] = endTimeStr.split(':').map(Number)
  const currentDate = form.value.startTime ? new Date(form.value.startTime) : new Date()
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const day = currentDate.getDate()
  const start = new Date(year, month, day, startH, startM)
  const end = new Date(year, month, day, endH, endM)
  if (end.getTime() <= start.getTime()) {
    end.setDate(end.getDate() + 1)
  }
  form.value.startTime = toDatetimeLocal(start)
  form.value.endTime = toDatetimeLocal(end)
}

function openModal(year: number, month: number, day: number) {
  editingEvent.value = null
  const rStart = authStore.activeBand?.defaultRehearsalStartTime || '20:00'
  const rEnd = authStore.activeBand?.defaultRehearsalEndTime || '23:00'
  const [startH, startM] = rStart.split(':').map(Number)
  const [endH, endM] = rEnd.split(':').map(Number)
  const start = new Date(year, month, day, startH, startM)
  const end = new Date(year, month, day, endH, endM)
  if (end.getTime() <= start.getTime()) {
    end.setDate(end.getDate() + 1)
  }
  form.value = {
    title: '',
    description: '',
    type: 'rehearsal',
    userId: null,
    startTime: toDatetimeLocal(start),
    endTime: toDatetimeLocal(end),
    isTentative: false,
    gigSetlistId: null,
    repeat: 'none',
    repeatCount: 1,
  }
  void fetchGigSetlists()
  showEventModal.value = true
}

function openCreateEventModal() {
  const today = new Date()
  openModal(today.getFullYear(), today.getMonth(), today.getDate())
}

async function editEvent(event: CalendarEvent) {
  editingEvent.value = event
  await fetchGigSetlists()
  form.value = {
    title: event.title,
    description: event.description || '',
    type: event.type,
    userId: event.userId || null,
    startTime: toDatetimeLocal(new Date(event.startTime)),
    endTime: toDatetimeLocal(new Date(event.endTime)),
    isTentative: event.isTentative || false,
    gigSetlistId: event.gigSetlistId ?? null,
    repeat: 'none',
    repeatCount: 1,
  }
  showEventModal.value = true
}

watch(
  () => form.value.type,
  (type) => {
    if (type === 'unavailability' && !form.value.userId) {
      form.value.userId = authStore.user?.id ?? null
    }
    if (type === 'gig') {
      void fetchGigSetlists()
      if (editingEvent.value?.type === 'gig' && editingEvent.value.gigSetlistId) {
        form.value.gigSetlistId = editingEvent.value.gigSetlistId
      }
    }
    if (!editingEvent.value) {
      if (type === 'gig') {
        const gStart = authStore.activeBand?.defaultGigStartTime || '20:00'
        const gEnd = authStore.activeBand?.defaultGigEndTime || '23:00'
        applyTimeDefaults(gStart, gEnd)
      } else if (type === 'rehearsal') {
        const rStart = authStore.activeBand?.defaultRehearsalStartTime || '20:00'
        const rEnd = authStore.activeBand?.defaultRehearsalEndTime || '23:00'
        applyTimeDefaults(rStart, rEnd)
      }
    }
  },
)

function calculateNextEventDates(
  baseStart: Date,
  baseEnd: Date,
  repeat: 'weekly' | 'biweekly' | 'monthly',
  index: number,
): { start: Date; end: Date } {
  const durationMs = baseEnd.getTime() - baseStart.getTime()
  const nextStart = new Date(baseStart)

  if (repeat === 'weekly') {
    nextStart.setDate(nextStart.getDate() + 7 * index)
  } else if (repeat === 'biweekly') {
    nextStart.setDate(nextStart.getDate() + 14 * index)
  } else if (repeat === 'monthly') {
    const targetMonth = baseStart.getMonth() + index
    nextStart.setMonth(targetMonth)
  }

  const nextEnd = new Date(nextStart.getTime() + durationMs)
  return { start: nextStart, end: nextEnd }
}

async function saveEvent() {
  isSaving.value = true
  try {
    const baseStartTime = new Date(form.value.startTime)
    const baseEndTime = new Date(form.value.endTime)
    const basePayload = {
      title: form.value.title,
      description: form.value.description,
      type: form.value.type,
      userId: form.value.userId,
      isTentative: form.value.isTentative,
      gigSetlistId: form.value.type === 'gig' ? form.value.gigSetlistId : null,
    }

    if (editingEvent.value) {
      await calendarStore.updateEvent(editingEvent.value.id, {
        ...basePayload,
        startTime: baseStartTime.toISOString(),
        endTime: baseEndTime.toISOString(),
      } as any)
    } else {
      const occurrences: Array<{ start: Date; end: Date }> = [
        { start: baseStartTime, end: baseEndTime },
      ]

      if (form.value.repeat && form.value.repeat !== 'none') {
        const count = Math.min(Math.max(Number(form.value.repeatCount) || 1, 1), 8)
        for (let i = 1; i <= count; i++) {
          occurrences.push(
            calculateNextEventDates(baseStartTime, baseEndTime, form.value.repeat, i),
          )
        }
      }

      await Promise.all(
        occurrences.map((occ) =>
          calendarStore.createEvent({
            ...basePayload,
            startTime: occ.start.toISOString(),
            endTime: occ.end.toISOString(),
          } as any),
        ),
      )
    }
    void fetchGigSetlists()
    showEventModal.value = false
  } catch { $q.notify({ message: t('calendar.failedSave'), color: 'negative' }) }
  finally { isSaving.value = false }
}

async function handleDeleteEvent() {
  if (!editingEvent.value) return
  $q.dialog({ title: t('common.delete'), message: t('calendar.confirmDelete'), cancel: true }).onOk(async () => {
    try {
      await calendarStore.deleteEvent(editingEvent.value!.id)
      showEventModal.value = false
    } catch { $q.notify({ message: t('calendar.failedDelete'), color: 'negative' }) }
  })
}

function exportIcal(event: CalendarEvent) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//bandstr//EN', 'BEGIN:VEVENT',
    `DTSTART:${new Date(event.startTime).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTEND:${new Date(event.endTime).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `SUMMARY:${event.title}`,
    event.description ? `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}` : '',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean)
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.title.replace(/\s+/g, '_')}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

// Day view modal
const showDayViewModal = ref(false)
const selectedDayData = ref<{ year: number; month: number; day: number } | null>(null)

const selectedDayEvents = computed(() => {
  if (!selectedDayData.value) return []
  return getEvents(selectedDayData.value.year, selectedDayData.value.month, selectedDayData.value.day)
})

function handleDayClick(dayData: { year: number; month: number; day: number }) {
  selectedDayData.value = dayData
  const dayEvents = getEvents(dayData.year, dayData.month, dayData.day)
  if (dayEvents.length > 0) {
    showDayViewModal.value = true
  } else {
    openModal(dayData.year, dayData.month, dayData.day)
  }
}

function openCreateFromDayView() {
  showDayViewModal.value = false
  if (selectedDayData.value) openModal(selectedDayData.value.year, selectedDayData.value.month, selectedDayData.value.day)
}

async function openEditFromDayView(event: CalendarEvent) {
  showDayViewModal.value = false
  await editEvent(event)
}

function openEventFromQuery() {
  const rawEventId = route.query.eventId
  const eventId = typeof rawEventId === 'string' ? Number(rawEventId) : NaN
  if (!Number.isFinite(eventId) || eventId <= 0) return
  const event = calendarStore.events.find((entry) => entry.id === eventId)
  if (!event) return
  editEvent(event)
  const nextQuery = { ...route.query }
  delete nextQuery.eventId
  void router.replace({ path: route.path, query: nextQuery })
}

const isSavingAttendance = ref(false)
const showOverviewModal = ref(false)

function getAttendanceSummary(rehearsalId: number) {
  return calendarStore.attendanceMap[rehearsalId]?.summary
}

function getAttendanceTooltip(rehearsalId: number) {
  const info = calendarStore.attendanceMap[rehearsalId]
  if (!info) return ''
  if (info.summary === 'all_present') return t('calendar.allPresent')
  if (info.summary === 'has_absent') return t('calendar.hasAbsent')
  return t('calendar.pendingAttendance')
}

const currentEditingAttendance = computed(() => {
  if (!editingEvent.value || editingEvent.value.type !== 'rehearsal') return null
  return calendarStore.attendanceMap[editingEvent.value.id] ?? null
})

const currentEditingMyAttendance = computed(() => {
  return currentEditingAttendance.value?.myAttendance ?? null
})

const groupedAttendancePresent = computed(() => {
  return (currentEditingAttendance.value?.memberAttendance ?? []).filter((m) => m.status === 'present')
})

const groupedAttendanceAbsent = computed(() => {
  return (currentEditingAttendance.value?.memberAttendance ?? []).filter((m) => m.status === 'absent')
})

const groupedAttendanceOpen = computed(() => {
  return (currentEditingAttendance.value?.memberAttendance ?? []).filter((m) => m.status !== 'present' && m.status !== 'absent')
})

async function updateAttendanceForCurrentEvent(status: 'present' | 'absent' | 'reset') {
  if (!editingEvent.value) return
  isSavingAttendance.value = true
  try {
    await calendarStore.setRehearsalAttendance(editingEvent.value.id, status)
  } catch {
    $q.notify({ message: t('home.failedAttendance'), color: 'negative' })
  } finally {
    isSavingAttendance.value = false
  }
}

function isCurrentUser(userId: string) {
  return authStore.user?.id === userId
}

function getMemberStatus(rehearsal: any, userId: string) {
  const row = rehearsal.memberAttendance?.find((m: any) => m.userId === userId)
  return row?.status ?? 'open'
}

async function toggleMyStatusInOverview(rehearsal: any) {
  const current = rehearsal.myAttendance
  const next = current === 'present' ? 'absent' : current === 'absent' ? 'reset' : 'present'
  try {
    await calendarStore.setRehearsalAttendance(rehearsal.id, next)
  } catch {
    $q.notify({ message: t('home.failedAttendance'), color: 'negative' })
  }
}

function formatOverviewDate(dateStr: string) {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: '2-digit' })
  } catch {
    return dateStr
  }
}

function openRehearsalFromOverview(rehearsal: any) {
  const ev = calendarStore.events.find((e) => e.id === rehearsal.id)
  if (ev) {
    showOverviewModal.value = false
    editEvent(ev)
  }
}

onMounted(() => {
  void Promise.all([
    calendarStore.fetchEvents(),
    calendarStore.fetchRehearsalAttendance(),
    bandStore.fetchMembers(),
    fetchGigSetlists(),
    authStore.fetchActiveBandDetails(),
  ]).then(() => {
    openEventFromQuery()
  })
})

watch(
  () => calendarStore.events.length,
  () => {
    openEventFromQuery()
  },
)
</script>

<template>
  <q-page padding>
    <div style="max-width: 1200px; margin: 0 auto">
      <q-card flat bordered>
        <q-card-section>
          <div class="row items-center justify-between">
            <div class="text-h5 text-weight-bold">{{ t('nav.calendar') }}</div>
            <div class="row items-center q-gutter-sm">
              <q-btn
                v-if="isIos"
                flat
                no-caps
                color="primary"
                :icon="pIcon('add')"
                :label="t('calendar.createEvent')"
                class="q-px-sm text-weight-medium"
                @click="openCreateEventModal"
              />
              <q-btn
                v-else-if="!isAndroid"
                color="primary"
                dense
                unelevated
                icon="add"
                :label="t('calendar.createEvent')"
                class="q-px-sm"
                @click="openCreateEventModal"
              />
              <q-btn
                outline
                dense
                color="primary"
                icon="checklist"
                :label="t('calendar.rehearsalOverview')"
                class="q-px-sm"
                @click="showOverviewModal = true"
              />
              <q-btn flat dense :label="t('calendar.today')" @click="goToToday" />
            </div>
          </div>
        </q-card-section>

        <q-card-section>
          <!-- Month navigation -->
          <div class="row items-center justify-center q-mb-lg q-gutter-md">
            <q-btn flat round icon="chevron_left" @click="prevMonth" />
            <div class="text-h6 text-center" style="min-width: 200px">{{ monthName }} {{ currentYear }}</div>
            <q-btn flat round icon="chevron_right" @click="nextMonth" />
          </div>

          <!-- Calendar grid -->
          <div class="calendar-grid">
            <!-- Day headers -->
            <div v-for="d in dayHeaders" :key="d" class="text-center text-caption text-weight-bold text-grey q-pb-sm">{{ d }}</div>

            <!-- Day cells -->
            <div
              v-for="dayData in allDays"
              :key="dayData.year + '-' + dayData.month + '-' + dayData.day"
              class="calendar-cell q-pa-xs cursor-pointer"
              :class="{ 'opacity-40': !dayData.isCurrentMonth }"
              @click="handleDayClick(dayData)"
            >
              <div class="text-caption text-weight-medium" :class="{ 'text-primary text-weight-black': isToday(dayData.year, dayData.month, dayData.day) }">
                {{ dayData.day }}
              </div>
              <div class="column q-gutter-xs q-mt-xs" style="overflow: hidden; max-height: 60px">
                <template v-for="(event, eIdx) in getEvents(dayData.year, dayData.month, dayData.day)" :key="event.id">
                  <div
                    v-if="eIdx < 3"
                    class="event-chip text-caption ellipsis row items-center no-wrap"
                    :class="eventClass(event)"
                    @click.stop="editEvent(event)"
                  >
                    <span
                      v-if="event.type === 'rehearsal' && getAttendanceSummary(event.id)"
                      class="attendance-status-dot q-mr-xs"
                      :class="`dot-${getAttendanceSummary(event.id)}`"
                      :title="getAttendanceTooltip(event.id)"
                    />
                    <span class="ellipsis col">{{ event.title }}</span>
                    <span v-if="event.isTentative" class="q-ml-xs">?</span>
                  </div>
                </template>
                <div v-if="getEvents(dayData.year, dayData.month, dayData.day).length > 3" class="text-caption text-grey" style="font-size: 10px">
                  {{ t('calendar.more', { n: getEvents(dayData.year, dayData.month, dayData.day).length - 3 }) }}
                </div>
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Event Create/Edit Dialog -->
    <q-dialog v-model="showEventModal" :position="isIos ? 'bottom' : 'top'">
      <q-card style="width: 90vw; max-width: 315px; margin-top: 84px; max-height: calc(100vh - 104px); display: flex; flex-direction: column;">
        <div v-if="isIos" class="ios-sheet-grabber" />
        <q-card-section class="row items-center">
          <div class="text-h6">{{ editingEvent ? t('calendar.editEvent') : t('calendar.createEvent') }}</div>
          <q-space /><q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section class="q-gutter-md scroll col">
          <q-input v-model="form.title" :label="t('common.title')" outlined dense autofocus />

          <div class="row q-gutter-sm">
            <q-select
              v-model="form.type"
              :options="typeOptions"
              emit-value
              map-options
              outlined
              dense
              :label="t('calendar.typeLabel')"
              class="col"
            />
            <q-select
              v-model="form.userId"
              :options="ownerOptions"
              emit-value
              map-options
              outlined
              dense
              :label="t('calendar.ownerLabel')"
              class="col"
            />
          </div>

          <div v-if="form.type === 'gig'" class="q-mt-sm">
            <q-select
              v-model="form.gigSetlistId"
              :options="filteredGigSetlistOptions"
              option-value="id"
              option-label="title"
              use-input
              input-debounce="0"
              @filter="filterGigSetlists"
              emit-value
              map-options
              outlined
              dense
              clearable
              :label="t('calendar.gigSetlistLabel')"
            >
              <template #no-option>
                <q-item>
                  <q-item-section class="text-grey">
                    {{ t('common.noResults') }}
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <div v-if="editingEvent && editingEvent.type === 'gig' && editingEvent.gigSetlistId" class="row justify-end q-mt-xs">
              <q-btn
                flat
                dense
                size="sm"
                color="primary"
                icon="queue_music"
                :label="t('calendar.openSetlist')"
                @click="goToGigSetlist(editingEvent.gigSetlistId)"
              />
            </div>
          </div>

          <div class="row q-gutter-sm">
            <q-input v-model="form.startTime" :label="t('calendar.startTime')" type="datetime-local" outlined dense class="col" />
            <q-input v-model="form.endTime" :label="t('calendar.endTime')" type="datetime-local" outlined dense class="col" />
          </div>

          <div v-if="!editingEvent" class="row q-gutter-sm items-center">
            <q-select
              v-model="form.repeat"
              :options="repeatOptions"
              emit-value
              map-options
              outlined
              dense
              :label="t('calendar.repeatLabel')"
              class="col"
            />
            <q-select
              v-if="form.repeat !== 'none'"
              v-model="form.repeatCount"
              :options="repeatCountOptions"
              emit-value
              map-options
              outlined
              dense
              :label="t('calendar.repeatCountLabel')"
              class="col-4"
            />
          </div>

          <q-input v-model="form.description" :label="t('calendar.description')" :placeholder="t('calendar.descPlaceholder')" type="textarea" :rows="4" outlined dense />

          <q-toggle v-model="form.isTentative" :label="t('calendar.tentativeLabel')" />

          <template v-if="editingEvent && editingEvent.type === 'rehearsal'">
            <q-separator class="q-my-sm" />
            <div>
              <div class="row items-center justify-between q-mb-sm">
                <div class="text-subtitle2 text-weight-bold">{{ t('calendar.attendanceTitle') }}</div>
                <q-badge
                  v-if="currentEditingAttendance?.summary === 'all_present'"
                  color="positive"
                  icon="check_circle"
                  :label="t('calendar.allPresent')"
                />
                <q-badge
                  v-else-if="currentEditingAttendance?.summary === 'has_absent'"
                  color="negative"
                  icon="cancel"
                  :label="t('calendar.hasAbsent')"
                />
                <q-badge
                  v-else
                  color="amber-9"
                  icon="help_outline"
                  :label="t('calendar.pendingAttendance')"
                />
              </div>

              <!-- Own attendance controls -->
              <div class="row items-center q-gutter-sm q-mb-sm">
                <q-btn
                  flat
                  dense
                  icon="check"
                  :color="currentEditingMyAttendance === 'present' ? 'positive' : 'grey-7'"
                  :class="{ 'bg-green-1 text-weight-bold': currentEditingMyAttendance === 'present' }"
                  :label="t('home.confirmAttendance')"
                  :loading="isSavingAttendance"
                  @click="updateAttendanceForCurrentEvent('present')"
                />
                <q-btn
                  flat
                  dense
                  icon="event_busy"
                  :color="currentEditingMyAttendance === 'absent' ? 'negative' : 'grey-7'"
                  :class="{ 'bg-red-1 text-weight-bold': currentEditingMyAttendance === 'absent' }"
                  :label="t('home.markAbsent')"
                  :loading="isSavingAttendance"
                  @click="updateAttendanceForCurrentEvent('absent')"
                />
                <q-btn
                  flat
                  dense
                  icon="restart_alt"
                  color="grey-8"
                  :label="t('home.resetAttendance')"
                  :loading="isSavingAttendance"
                  @click="updateAttendanceForCurrentEvent('reset')"
                />
              </div>

              <!-- Member attendance grouped chips -->
              <div v-if="currentEditingAttendance?.memberAttendance?.length" class="column q-gutter-xs q-mt-xs">
                <div v-if="groupedAttendancePresent.length" class="row items-center">
                  <q-chip
                    dense
                    color="green-1"
                    text-color="positive"
                    icon="check_circle"
                  >
                    {{ groupedAttendancePresent.map((m) => m.userName).join(', ') }}
                  </q-chip>
                </div>
                <div v-if="groupedAttendanceAbsent.length" class="row items-center">
                  <q-chip
                    dense
                    color="red-1"
                    text-color="negative"
                    icon="cancel"
                  >
                    {{ groupedAttendanceAbsent.map((m) => m.userName).join(', ') }}
                  </q-chip>
                </div>
                <div v-if="groupedAttendanceOpen.length" class="row items-center">
                  <q-chip
                    dense
                    color="grey-2"
                    text-color="grey-8"
                    icon="help_outline"
                  >
                    {{ groupedAttendanceOpen.map((m) => m.userName).join(', ') }}
                  </q-chip>
                </div>
              </div>
            </div>
          </template>
        </q-card-section>
        <q-card-actions class="row justify-between">
          <div class="row q-gutter-sm">
            <q-btn v-if="editingEvent" flat icon="delete" color="red" :label="t('common.delete')" @click="handleDeleteEvent" />
            <q-btn v-if="editingEvent" flat icon="download" :label="t('calendar.exportIcal')" @click="exportIcal(editingEvent)" />
          </div>
          <div class="row q-gutter-sm">
            <q-btn flat :label="t('common.cancel')" v-close-popup />
            <q-btn color="primary" :label="t('common.save')" :loading="isSaving" @click="saveEvent" />
          </div>
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Day View Dialog -->
    <q-dialog v-model="showDayViewModal" :position="isIos ? 'bottom' : 'standard'">
      <q-card v-if="selectedDayData" style="width: 90vw; max-width: 400px">
        <div v-if="isIos" class="ios-sheet-grabber" />
        <q-card-section>
          <div class="text-overline text-grey">
            {{ new Date(selectedDayData.year, selectedDayData.month, selectedDayData.day).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) }}
          </div>
          <div class="text-h5 text-weight-black">
            {{ new Date(selectedDayData.year, selectedDayData.month, selectedDayData.day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric' }) }}
          </div>
        </q-card-section>

        <q-list v-if="selectedDayEvents.length" separator>
          <q-item v-for="event in selectedDayEvents" :key="event.id" clickable @click="openEditFromDayView(event)">
            <q-item-section side>
              <q-badge :color="eventDotColor(event)" rounded />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-bold">
                {{ event.title }}
                <q-badge v-if="event.isTentative" color="grey" outline class="q-ml-xs">?</q-badge>
              </q-item-label>
              <q-item-label caption>
                <q-icon name="schedule" size="xs" class="q-mr-xs" />
                {{ formatTime(event.startTime) }}
                <template v-if="event.endTime"> — {{ formatTime(event.endTime) }}</template>
              </q-item-label>
              <q-item-label
                v-if="event.type === 'gig' && resolveGigSetlistTitle(event)"
                caption
                class="text-primary row items-center q-mt-xs"
              >
                <q-icon name="queue_music" size="xs" class="q-mr-xs" />
                <span>{{ resolveGigSetlistTitle(event) }}</span>
              </q-item-label>
            </q-item-section>
            <q-item-section side class="row items-center q-gutter-xs">
              <q-badge
                v-if="event.type === 'rehearsal' && getAttendanceSummary(event.id) === 'all_present'"
                color="positive"
                icon="check_circle"
                :label="t('calendar.allPresent')"
              />
              <q-badge
                v-else-if="event.type === 'rehearsal' && getAttendanceSummary(event.id) === 'has_absent'"
                color="negative"
                icon="cancel"
                :label="t('calendar.hasAbsent')"
              />
              <q-badge
                v-else-if="event.type === 'rehearsal'"
                color="amber-9"
                icon="help_outline"
                :label="t('calendar.pendingAttendance')"
              />
              <q-icon name="chevron_right" color="grey" />
            </q-item-section>
          </q-item>
        </q-list>
        <q-card-section v-else class="text-center text-grey q-pa-lg">
          <q-icon name="event" size="48px" class="q-mb-sm" style="opacity: 0.2" />
          <div>{{ t('calendar.noEventsDay') }}</div>
        </q-card-section>

        <q-card-actions>
          <q-btn class="full-width" color="primary" icon="add" :label="t('calendar.createEvent')" @click="openCreateFromDayView" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Rehearsal Overview Dialog -->
    <q-dialog v-model="showOverviewModal">
      <q-card style="min-width: 680px; max-width: 95vw">
        <q-card-section class="row items-center justify-between">
          <div class="text-h6 row items-center q-gutter-sm">
            <q-icon name="checklist" color="primary" />
            <span>{{ t('calendar.rehearsalOverview') }}</span>
          </div>
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section class="q-pa-none">
          <div v-if="calendarStore.loadingAttendance" class="text-center q-pa-md">
            <q-spinner color="primary" size="2em" />
          </div>
          <div v-else-if="!calendarStore.upcomingRehearsals.length" class="text-center text-grey q-pa-lg">
            {{ t('calendar.noUpcomingRehearsals') }}
          </div>
          <div v-else class="q-table__container q-table--horizontal-separator" style="overflow-x: auto">
            <table class="q-table q-table--dense full-width">
              <thead>
                <tr>
                  <th class="text-left q-px-sm">{{ t('calendar.tableDate') }}</th>
                  <th class="text-left q-px-sm">{{ t('calendar.tableRehearsal') }}</th>
                  <th v-for="member in calendarStore.attendanceMembers" :key="member.userId" class="text-center q-px-xs">
                    {{ member.userName }}
                  </th>
                  <th class="text-center q-px-sm">{{ t('calendar.tableStatus') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="r in calendarStore.upcomingRehearsals"
                  :key="r.id"
                  class="cursor-pointer rehearsal-matrix-row"
                  @click="openRehearsalFromOverview(r)"
                >
                  <td class="text-weight-bold q-px-sm">
                    {{ formatOverviewDate(r.startTime) }}
                  </td>
                  <td class="q-px-sm">
                    <span class="text-weight-medium">{{ r.title }}</span>
                    <div class="text-caption text-grey">{{ formatTime(r.startTime) }} - {{ formatTime(r.endTime) }}</div>
                  </td>
                  <td
                    v-for="member in calendarStore.attendanceMembers"
                    :key="member.userId"
                    class="text-center q-px-xs"
                    @click.stop="isCurrentUser(member.userId) ? toggleMyStatusInOverview(r) : null"
                    :class="{ 'cursor-pointer own-status-cell': isCurrentUser(member.userId) }"
                  >
                    <q-badge
                      v-if="getMemberStatus(r, member.userId) === 'present'"
                      color="positive"
                      icon="check"
                      rounded
                    >
                      <q-tooltip>{{ member.userName }}: {{ t('home.attendanceConfirmed') }}</q-tooltip>
                    </q-badge>
                    <q-badge
                      v-else-if="getMemberStatus(r, member.userId) === 'absent'"
                      color="negative"
                      icon="close"
                      rounded
                    >
                      <q-tooltip>{{ member.userName }}: {{ t('home.attendanceAbsent') }}</q-tooltip>
                    </q-badge>
                    <q-badge
                      v-else
                      color="grey-6"
                      label="?"
                      rounded
                    >
                      <q-tooltip>{{ member.userName }}: {{ t('home.attendanceUnset') }}</q-tooltip>
                    </q-badge>
                  </td>
                  <td class="text-center q-px-sm">
                    <q-badge
                      v-if="r.summary === 'all_present'"
                      color="positive"
                      :label="t('calendar.allPresent')"
                    />
                    <q-badge
                      v-else-if="r.summary === 'has_absent'"
                      color="negative"
                      :label="t('calendar.hasAbsent')"
                    />
                    <q-badge
                      v-else
                      color="amber-9"
                      :label="t('calendar.pendingAttendance')"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.close')" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Android Floating Action Button (FAB) -->
    <q-page-sticky
      v-if="isAndroid"
      position="bottom-right"
      :offset="[18, 76]"
      style="z-index: 1000"
    >
      <q-btn
        fab
        icon="add"
        color="primary"
        @click="openCreateEventModal"
      />
    </q-page-sticky>
  </q-page>
</template>

<style lang="scss" scoped>
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  width: 100%;
  gap: 2px;
}
.calendar-cell {
  width: 100%;
  min-width: 0;
  min-height: 80px;
  box-sizing: border-box;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 4px;
  transition: background-color 0.2s;
}
.calendar-cell:hover {
  background-color: rgba(0, 0, 0, 0.03);
}
.event-chip {
  display: block;
  width: 100%;
  max-width: 100%;
  font-size: 10px;
  line-height: 1.2;
  padding: 1px 4px;
  border-radius: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.attendance-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;

  &.dot-all_present {
    background-color: #10b981;
    box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.3);
  }
  &.dot-has_absent {
    background-color: #ef4444;
    box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.3);
  }
  &.dot-pending {
    background-color: #f59e0b;
    box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.3);
  }
}

.rehearsal-matrix-row:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

.own-status-cell {
  transition: background-color 0.15s;
}

.own-status-cell:hover {
  background-color: rgba(0, 0, 0, 0.08);
}
</style>
