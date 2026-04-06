<template>
  <q-page padding>
    <div style="max-width: 1200px; margin: 0 auto">
      <q-card flat bordered>
        <q-card-section>
          <div class="row items-center justify-between">
            <div class="text-h5 text-weight-bold">{{ t('nav.calendar') }}</div>
            <q-btn flat dense :label="t('calendar.today')" @click="goToToday" />
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
                    class="event-chip text-caption ellipsis"
                    :class="eventClass(event)"
                    @click.stop="editEvent(event)"
                  >
                    {{ event.title }}
                    <span v-if="event.isTentative" class="q-ml-xs">?</span>
                  </div>
                </template>
                <div v-if="getEvents(dayData.year, dayData.month, dayData.day).length > 3" class="text-caption text-grey" style="font-size: 9px">
                  {{ t('calendar.more', { n: getEvents(dayData.year, dayData.month, dayData.day).length - 3 }) }}
                </div>
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Event Create/Edit Dialog -->
    <q-dialog v-model="showEventModal">
      <q-card style="min-width: 450px">
        <q-card-section class="row items-center">
          <div class="text-h6">{{ editingEvent ? t('calendar.editEvent') : t('calendar.createEvent') }}</div>
          <q-space /><q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section class="q-gutter-md">
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

          <div class="row q-gutter-sm">
            <q-input v-model="form.startTime" :label="t('calendar.startTime')" type="datetime-local" outlined dense class="col" />
            <q-input v-model="form.endTime" :label="t('calendar.endTime')" type="datetime-local" outlined dense class="col" />
          </div>

          <q-input v-model="form.description" :label="t('calendar.description')" :placeholder="t('calendar.descPlaceholder')" type="textarea" outlined dense autogrow />

          <q-toggle v-model="form.isTentative" :label="t('calendar.tentativeLabel')" />
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
    <q-dialog v-model="showDayViewModal">
      <q-card v-if="selectedDayData" style="min-width: 400px">
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
            </q-item-section>
            <q-item-section side>
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
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useCalendarStore, type CalendarEvent } from '../stores/calendar'
import { useBandStore } from '../stores/band'
import { useI18n } from '../composables/useI18n'

const $q = useQuasar()
const calendarStore = useCalendarStore()
const bandStore = useBandStore()
const { t, tv } = useI18n()

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
})

function openModal(year: number, month: number, day: number) {
  editingEvent.value = null
  const start = new Date(year, month, day, 18, 0)
  const end = new Date(year, month, day, 20, 0)
  form.value = { title: '', description: '', type: 'rehearsal', userId: null, startTime: toDatetimeLocal(start), endTime: toDatetimeLocal(end), isTentative: false }
  showEventModal.value = true
}

function editEvent(event: CalendarEvent) {
  editingEvent.value = event
  form.value = {
    title: event.title,
    description: event.description || '',
    type: event.type,
    userId: event.userId || null,
    startTime: toDatetimeLocal(new Date(event.startTime)),
    endTime: toDatetimeLocal(new Date(event.endTime)),
    isTentative: event.isTentative || false,
  }
  showEventModal.value = true
}

async function saveEvent() {
  isSaving.value = true
  try {
    const payload = {
      ...form.value,
      startTime: new Date(form.value.startTime).toISOString(),
      endTime: new Date(form.value.endTime).toISOString(),
    }
    if (editingEvent.value) {
      await calendarStore.updateEvent(editingEvent.value.id, payload as any)
    } else {
      await calendarStore.createEvent(payload as any)
    }
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

function openEditFromDayView(event: CalendarEvent) {
  showDayViewModal.value = false
  editEvent(event)
}

onMounted(() => {
  calendarStore.fetchEvents()
  bandStore.fetchMembers()
})
</script>

<style scoped>
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
</style>
