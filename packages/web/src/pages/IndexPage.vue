<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useBandStore } from '../stores/band'
import { apiJson } from '../boot/api'
import MarkdownComponent from '../components/Markdown.vue'
import BeerRain from '../components/BeerRain.vue'
import { useI18n } from '../composables/useI18n'
import { getInitials } from '../utils/initials'

const $q = useQuasar()
const router = useRouter()
const authStore = useAuthStore()
const bandStore = useBandStore()
const { t, dateLocale } = useI18n()

type RehearsalData = { nextRehearsal: any | null; upcomingGigs: any[] }
type RehearsalTimeProposal = {
  id: number
  proposerUserId: string
  proposerName?: string | null
  proposedStartTime: string
  proposedEndTime: string
  comment?: string | null
  status: 'pending' | 'accepted' | 'rejected'
}

const rehearsalData = ref<RehearsalData | null>(null)
const saving = ref(false)
const beerLoading = ref(false)
const attendanceLoading = ref(false)
const beerRainActive = ref(false)
const personalNotes = ref<any[]>([])
const showPersonalNotesWidget = ref(false)
const rehearsalProposals = ref<RehearsalTimeProposal[]>([])
const showProposalDialog = ref(false)
const proposalLoading = ref(false)
const proposalForm = ref({
  startTime: '',
  endTime: '',
  comment: '',
})

const isAdmin = computed(() => {
  const band = authStore.activeBand
  return band && ['owner', 'admin'].includes(band.role)
})

const nextRehearsal = computed(() => rehearsalData.value?.nextRehearsal ?? null)
const upcomingGigs = computed(() => rehearsalData.value?.upcomingGigs ?? [])
const visibleMembers = computed(() => bandStore.members.filter((m) => !m.isHidden))

const bierwart = computed(() => {
  if (!nextRehearsal.value || visibleMembers.value.length === 0) return null
  const effectiveBierwartId = nextRehearsal.value.effectiveBierwartId || nextRehearsal.value.bierwartOverrideId
  if (effectiveBierwartId) {
    const m = visibleMembers.value.find((m) => m.id === effectiveBierwartId)
    if (m) return m
  }
  return visibleMembers.value[0]
})

const attendanceNamesLabel = computed(() => {
  const rows = nextRehearsal.value?.memberAttendance ?? []
  if (!rows.length) return ''
  return rows.map((row: any) => {
    const status =
      row.status === 'present'
        ? t('home.attendanceConfirmed')
        : row.status === 'absent'
          ? t('home.attendanceAbsent')
          : t('home.attendanceUnset')
    return `${row.userName}: ${status}`
  }).join(' | ')
})

const unavailabilityMessages = computed(() => {
  const rows = nextRehearsal.value?.unavailabilities ?? []
  return rows.map((row: any) => `${row.displayName || row.userName || row.title} ${t('home.unavailSingle')}`)
})

async function loadData() {
  try {
    rehearsalData.value = await apiJson<RehearsalData>('/rehearsals/next')
  } catch {
    rehearsalData.value = null
  }
  await Promise.all([bandStore.fetchMembers(), fetchPersonalNotes(), fetchRehearsalProposals()])
}

onMounted(loadData)

function formatDate(d: string | number) {
  return new Date(d).toLocaleDateString(dateLocale.value, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTime(d: string | number) {
  return new Date(d).toLocaleTimeString(dateLocale.value, { hour: '2-digit', minute: '2-digit' })
}

function formatForInput(d: string | number) {
  if (!d) return ''
  const date = new Date(d)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

async function fetchRehearsalProposals() {
  if (!nextRehearsal.value?.id) {
    rehearsalProposals.value = []
    return
  }
  try {
    rehearsalProposals.value = await apiJson<RehearsalTimeProposal[]>(`/rehearsals/${nextRehearsal.value.id}/time-proposals`)
  } catch {
    rehearsalProposals.value = []
  }
}

async function addBeer() {
  if (!bierwart.value || beerLoading.value) return
  beerLoading.value = true
  try {
    await apiJson(`/users/${bierwart.value.id}`, { method: 'PATCH', body: JSON.stringify({ beerCount: (bierwart.value.beerCount || 0) + 1 }) })
    beerRainActive.value = true
    await bandStore.fetchMembers()
    $q.notify({ message: t('admin.beerAdded'), icon: 'science', color: 'orange' })
  } catch (e: any) { $q.notify({ message: e?.message || 'Failed to update beer count', color: 'negative' }) }
  finally { beerLoading.value = false }
}

async function removeBeer() {
  if (!bierwart.value || beerLoading.value || (bierwart.value.beerCount || 0) <= 0) return
  beerLoading.value = true
  try {
    await apiJson(`/users/${bierwart.value.id}`, { method: 'PATCH', body: JSON.stringify({ beerCount: (bierwart.value.beerCount || 0) - 1 }) })
    await bandStore.fetchMembers()
  } catch (e: any) {
    $q.notify({ message: e?.message || 'Failed to update beer count', color: 'negative' })
  } finally { beerLoading.value = false }
}

async function fetchPersonalNotes() {
  try {
    personalNotes.value = await apiJson<any[]>('/songs/notes')
  } catch {
    personalNotes.value = []
  }
}

async function setAttendance(status: 'present' | 'absent' | 'reset') {
  if (!nextRehearsal.value) return
  attendanceLoading.value = true
  try {
    await apiJson(`/rehearsals/${nextRehearsal.value.id}/attendance`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
    await loadData()
  } catch (e: any) {
    $q.notify({ message: e?.message || t('home.failedAttendance'), color: 'negative' })
  } finally {
    attendanceLoading.value = false
  }
}

function openRehearsalProposalDialog() {
  if (!nextRehearsal.value) return
  proposalForm.value = {
    startTime: formatForInput(nextRehearsal.value.startTime),
    endTime: formatForInput(nextRehearsal.value.endTime || nextRehearsal.value.startTime),
    comment: '',
  }
  showProposalDialog.value = true
}

async function submitProposal() {
  if (!nextRehearsal.value) return
  proposalLoading.value = true
  try {
    await apiJson(`/rehearsals/${nextRehearsal.value.id}/time-proposals`, {
      method: 'POST',
      body: JSON.stringify({
        proposedStartTime: new Date(proposalForm.value.startTime).toISOString(),
        proposedEndTime: new Date(proposalForm.value.endTime).toISOString(),
        comment: proposalForm.value.comment || undefined,
      }),
    })
    showProposalDialog.value = false
    await fetchRehearsalProposals()
    $q.notify({ type: 'positive', message: t('home.proposalSubmitted') })
  } catch (error: any) {
    $q.notify({ type: 'negative', message: error?.message || t('home.failedProposalSubmit') })
  } finally {
    proposalLoading.value = false
  }
}

async function decideProposal(proposalId: number, decision: 'accepted' | 'rejected') {
  $q.dialog({
    title: decision === 'accepted' ? t('home.acceptProposal') : t('home.rejectProposal'),
    message: t('home.decisionCommentPrompt'),
    prompt: {
      model: '',
      type: 'text',
      isValid: () => true,
    },
    cancel: true,
  }).onOk(async (comment) => {
    try {
      await apiJson(`/rehearsals/time-proposals/${proposalId}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, comment: String(comment || '').trim() || undefined }),
      })
      await loadData()
      $q.notify({
        type: 'positive',
        message: decision === 'accepted' ? t('home.proposalAccepted') : t('home.proposalRejected'),
      })
    } catch (error: any) {
      $q.notify({ type: 'negative', message: error?.message || t('home.failedProposalDecision') })
    }
  })
}

function goToSetlist(songTitle?: string) {
  const query = songTitle ? { q: songTitle, list: 'user' } : { list: 'user' }
  router.push({ path: '/setlist', query })
}

function goToGigSetlist(gigSetlistId: number) {
  router.push({ path: '/setlist', query: { list: `gig:${gigSetlistId}` } })
}

function attendanceAvatarStyle(status: 'present' | 'absent' | 'open', index: number) {
  const borderColor = status === 'present' ? '#10b981' : status === 'absent' ? '#ef4444' : '#9ca3af'
  return {
    marginLeft: index === 0 ? '0px' : '-8px',
    border: `2px solid ${borderColor}`,
    boxSizing: 'border-box',
  }
}

const showRehearsalEdit = ref(false)
const editForm = ref({ title: '', startTime: '', endTime: '', description: '' })

function openRehearsalEdit() {
  if (!nextRehearsal.value) return
  const r = nextRehearsal.value
  editForm.value = { title: r.title, startTime: formatForInput(r.startTime), endTime: formatForInput(r.endTime || r.startTime), description: r.description || '' }
  showRehearsalEdit.value = true
}

async function saveRehearsal() {
  saving.value = true
  try {
    await apiJson(`/calendar/${nextRehearsal.value.id}`, { method: 'PUT', body: JSON.stringify({ title: editForm.value.title, description: editForm.value.description, startTime: new Date(editForm.value.startTime).toISOString(), endTime: new Date(editForm.value.endTime).toISOString() }) })
    await loadData()
    showRehearsalEdit.value = false
  } catch (e: any) { $q.notify({ message: 'Failed: ' + e.message, color: 'negative' }) }
  finally { saving.value = false }
}

const showGigEdit = ref(false)
const editedGigs = ref<any[]>([])
let originalGigIds: number[] = []

async function openGigEdit() {
  try {
    const events = await apiJson<any[]>('/calendar')
    const now = new Date()
    const gigs = events
      .filter((e) => e.type === 'gig')
      .filter((g) => new Date(g.endTime || g.startTime) >= now)
    editedGigs.value = gigs.map((g: any) => ({
      ...g,
      startTimeFormatted: formatForInput(g.startTime),
      endTimeFormatted: formatForInput(g.endTime || g.startTime),
    }))
    originalGigIds = gigs.map((g: any) => g.id)
  } catch {
    editedGigs.value = (upcomingGigs.value || []).map((g: any) => ({ ...g, startTimeFormatted: formatForInput(g.startTime), endTimeFormatted: formatForInput(g.endTime || g.startTime) }))
    originalGigIds = (upcomingGigs.value || []).map((g: any) => g.id)
  }
  showGigEdit.value = true
}

function addNewGig() {
  const future = new Date(Date.now() + 7 * 86400000)
  editedGigs.value.push({ title: 'New Gig', description: '', type: 'gig', startTimeFormatted: formatForInput(future.toISOString()), endTimeFormatted: formatForInput(new Date(future.getTime() + 7200000).toISOString()) })
}

async function saveGigs() {
  saving.value = true
  try {
    const keptIds = editedGigs.value.filter((g) => g.id).map((g) => g.id)
    for (const id of originalGigIds.filter((id: number) => !keptIds.includes(id))) {
      await apiJson(`/calendar/${id}`, { method: 'DELETE' })
    }
    for (const gig of editedGigs.value) {
      const body = { title: gig.title, description: gig.description, startTime: new Date(gig.startTimeFormatted).toISOString(), endTime: new Date(gig.endTimeFormatted).toISOString(), type: 'gig' }
      if (gig.id) await apiJson(`/calendar/${gig.id}`, { method: 'PUT', body: JSON.stringify(body) })
      else await apiJson('/calendar', { method: 'POST', body: JSON.stringify(body) })
    }
    await loadData()
    showGigEdit.value = false
  } catch (e: any) { $q.notify({ message: 'Failed: ' + e.message, color: 'negative' }) }
  finally { saving.value = false }
}

const showBierwartModal = ref(false)
function openBierwartModal() { showBierwartModal.value = true }

async function confirmBierwart(member: any) {
  if (!nextRehearsal.value) return
  $q.dialog({
    title: t('common.confirm'),
    message: `${t('home.confirmBierwartChange')} ${member.name}`,
    cancel: true,
  }).onOk(async () => {
    saving.value = true
    try {
      await apiJson(`/calendar/${nextRehearsal.value.id}`, { method: 'PUT', body: JSON.stringify({ bierwartOverrideId: member.id }) })
      await loadData()
      showBierwartModal.value = false
    } catch (e: any) { $q.notify({ message: 'Failed: ' + e.message, color: 'negative' }) }
    finally { saving.value = false }
  })
}
</script>

<template>
  <q-page padding>
    <div style="max-width: 1200px; margin: 0 auto">
      <div class="row q-col-gutter-lg">
        <div class="col-12 col-md-6">
        <q-card v-if="nextRehearsal" flat bordered>
          <q-card-section>
            <div class="row items-center justify-between">
              <div class="text-h6 text-primary">
                <q-icon name="music_note" class="q-mr-xs" />
                {{ t('home.nextRehearsal') }}
              </div>
              <q-btn v-if="isAdmin" flat round dense icon="edit" size="sm" @click="openRehearsalEdit" />
            </div>
            <div class="text-h5 text-weight-bold q-mt-sm">
              <q-icon name="calendar_today" class="q-mr-xs text-primary" />
              {{ formatDate(nextRehearsal.startTime) }}
            </div>
          </q-card-section>

          <q-card-section>
            <q-banner v-if="nextRehearsal.unavailabilities?.length" rounded class="bg-red-1 text-red q-mb-md">
              <template #avatar><q-icon name="warning" color="red" /></template>
              <div v-for="(entry, index) in unavailabilityMessages" :key="`${index}-${entry}`">{{ entry }}</div>
            </q-banner>

            <div class="text-h4 text-weight-black">{{ formatTime(nextRehearsal.startTime) }}</div>
            <markdown-component :content="nextRehearsal.description || t('rehearsal.generalPractice')" class="text-grey-6 q-mt-xs" />

            <q-separator class="q-my-md" />

            <div class="row items-center q-gutter-sm q-mb-sm">
              <q-badge v-if="nextRehearsal.myAttendance === 'present'" color="positive" icon="check_circle" :label="t('home.attendanceConfirmed')" />
              <q-badge v-else-if="nextRehearsal.myAttendance === 'absent'" color="negative" icon="event_busy" :label="t('home.attendanceAbsent')" />
              <q-badge v-else color="grey-7" icon="help_outline" :label="t('home.attendanceUnset')" />
            </div>

            <div class="row items-center q-gutter-sm q-mb-md">
              <q-btn
                flat
                dense
                icon="check"
                color="positive"
                :label="t('home.confirmAttendance')"
                :loading="attendanceLoading"
                @click="setAttendance('present')"
              />
              <q-btn
                flat
                dense
                icon="event_busy"
                color="negative"
                :label="t('home.markAbsent')"
                :loading="attendanceLoading"
                @click="setAttendance('absent')"
              />
              <q-btn
                flat
                dense
                icon="restart_alt"
                color="grey-8"
                :label="t('home.resetAttendance')"
                :loading="attendanceLoading"
                @click="setAttendance('reset')"
              />
              <q-btn
                flat
                dense
                icon="schedule"
                color="primary"
                :label="t('home.suggestRehearsalTime')"
                :disable="!nextRehearsal"
                @click="openRehearsalProposalDialog"
              />
            </div>

            <div v-if="nextRehearsal.memberAttendance?.length" class="option1-vote-row q-mb-md">
              <div class="avatar-stack bg-widget-surface rounded-borders q-px-sm q-py-xs">
                <q-avatar
                  v-for="(member, i) in nextRehearsal.memberAttendance"
                  :key="`attendance-${member.userId}`"
                  size="24px"
                  class="stack-avatar"
                  :style="attendanceAvatarStyle(member.status, i)"
                  color="grey-7"
                  text-color="white"
                >
                  <span>{{ getInitials(member.userName) }}</span>
                </q-avatar>
                <q-tooltip>{{ attendanceNamesLabel }}</q-tooltip>
              </div>
            </div>

            <div v-if="rehearsalProposals.length" class="q-mb-md">
              <div class="text-subtitle2 q-mb-sm">{{ t('home.rehearsalTimeProposals') }}</div>
              <q-list bordered separator dense>
                <q-item v-for="proposal in rehearsalProposals" :key="proposal.id">
                  <q-item-section>
                    <q-item-label>
                      {{ proposal.proposerName || t('home.unknownProposer') }}
                      ·
                      {{ formatDate(proposal.proposedStartTime) }} {{ formatTime(proposal.proposedStartTime) }}
                      -
                      {{ formatTime(proposal.proposedEndTime) }}
                    </q-item-label>
                    <q-item-label caption>
                      {{ proposal.comment || t('home.noProposalComment') }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <div class="column items-end q-gutter-xs">
                      <q-badge
                        :color="proposal.status === 'accepted' ? 'positive' : proposal.status === 'rejected' ? 'negative' : 'grey-7'"
                        :label="proposal.status"
                      />
                      <div v-if="proposal.status === 'pending'" class="row q-gutter-xs">
                        <q-btn
                          flat
                          dense
                          size="sm"
                          color="positive"
                          icon="check"
                          :label="t('home.acceptProposal')"
                          @click="decideProposal(proposal.id, 'accepted')"
                        />
                        <q-btn
                          flat
                          dense
                          size="sm"
                          color="negative"
                          icon="close"
                          :label="t('home.rejectProposal')"
                          @click="decideProposal(proposal.id, 'rejected')"
                        />
                      </div>
                    </div>
                  </q-item-section>
                </q-item>
              </q-list>
            </div>

            <div v-if="bierwart" class="row items-center q-gutter-md cursor-pointer q-pa-sm rounded-borders" @click="openBierwartModal">
              <q-avatar size="48px" color="orange-2">
                <span class="text-orange text-weight-bold">{{ getInitials(bierwart.name) }}</span>
              </q-avatar>
              <div class="col">
                <div class="text-overline text-orange" style="font-size: 10px">{{ t('home.onDuty') }}</div>
                <div class="text-subtitle1 text-weight-bold">{{ bierwart.name }}</div>
                <div class="text-caption text-grey">{{ t('home.hasDrinks') }}</div>
              </div>
              <div class="row items-center q-gutter-xs">
                <template v-if="authStore.isFreePlan">
                  <q-badge color="orange" :label="String(bierwart.beerCount || 0)" />
                  <q-chip dense color="orange" text-color="white" size="sm" icon="lock" label="PRO feature" class="q-ml-xs" />
                </template>
                <template v-else>
                  <q-btn flat round dense icon="remove_circle" color="orange" size="sm" :loading="beerLoading" @click.stop="removeBeer" />
                  <q-badge color="orange" :label="String(bierwart.beerCount || 0)" />
                  <q-btn flat round dense icon="add_circle" color="orange" size="sm" :loading="beerLoading" @click.stop="addBeer" />
                </template>
              </div>
              <q-btn flat round dense icon="edit" size="sm" color="grey-4" />
            </div>
          </q-card-section>
        </q-card>

        <q-card v-else flat bordered class="text-center q-pa-xl">
          <q-icon name="calendar_today" size="48px" color="grey-4" />
          <div class="text-grey q-mt-sm">{{ t('home.noRehearsal') }}</div>
          <q-btn flat color="primary" :label="t('home.scheduleOne')" to="/calendar" class="q-mt-md" />
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="row items-center justify-between">
              <div class="text-h6 text-red">
                <!-- <q-icon name="rocketLaunch" class="q-mr-xs" /> -->
                {{ t('home.upcomingGigs') }}
              </div>
              <q-btn v-if="isAdmin" flat round dense icon="edit" size="sm" @click="openGigEdit" />
            </div>
          </q-card-section>

          <q-card-section v-if="upcomingGigs?.length">
            <q-list separator>
              <q-item
                v-for="gig in upcomingGigs"
                :key="gig.id"
                class="gig-entry rounded-borders q-my-xs"
                :class="{ 'gig-clickable': gig.gigSetlistId }"
                :clickable="!!gig.gigSetlistId"
                @click="gig.gigSetlistId ? goToGigSetlist(gig.gigSetlistId) : null"
              >
                <q-item-section side>
                  <div class="text-center" style="min-width: 50px">
                    <div class="text-overline" style="font-size: 10px">{{ new Date(gig.startTime).toLocaleString(dateLocale, { month: 'short' }) }}</div>
                    <div class="text-h5 text-red">{{ new Date(gig.startTime).getDate() }}</div>
                    <div class="text-overline text-grey" style="font-size: 8px">{{ new Date(gig.startTime).toLocaleDateString(dateLocale, { weekday: 'short' }) }}</div>
                  </div>
                </q-item-section>
                <q-item-section>
                  <q-item-label class="text-weight-bold">
                    {{ gig.title }}
                    <q-badge v-if="gig.isTentative" color="grey" :label="t('calendar.tentative')" class="q-ml-xs" />
                  </q-item-label>
                  <q-item-label caption><markdown-component :content="gig.description" /></q-item-label>
                </q-item-section>
                <q-item-section v-if="gig.gigSetlistId" side>
                  <q-btn
                    outline
                    dense
                    color="primary"
                    icon="queue_music"
                    :label="t('home.openSetlist')"
                    size="sm"
                    class="q-px-sm"
                    @click.stop="goToGigSetlist(gig.gigSetlistId)"
                  >
                    <q-tooltip>{{ t('home.openSetlist') }}</q-tooltip>
                  </q-btn>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>

          <q-card-section v-else class="text-center text-grey q-pa-lg">{{ t('home.noGigs') }}</q-card-section>
        </q-card>
      </div>
    </div>

    <div class="row q-col-gutter-lg q-mt-md">
      <div class="col-12">
        <q-card flat bordered>
          <q-expansion-item
            v-model="showPersonalNotesWidget"
            icon="sticky_note_2"
            :label="t('home.personalNotesWidgetTitle')"
            :caption="t('home.personalNotesWidgetCaption', { count: personalNotes.length })"
            expand-separator
            dense-toggle
          >
            <q-card-section>
              <div v-if="!personalNotes.length" class="text-grey-6">{{ t('home.personalNotesEmpty') }}</div>
              <q-list v-else separator>
                <q-item v-for="note in personalNotes" :key="note.id" clickable @click="goToSetlist(note.songTitle)">
                  <q-item-section>
                    <q-item-label class="text-weight-medium">{{ note.songTitle }} <span v-if="note.songArtist" class="text-grey-7">- {{ note.songArtist }}</span></q-item-label>
                    <q-item-label caption><markdown-component :content="note.content" /></q-item-label>
                  </q-item-section>
                  <q-item-section side><q-icon name="open_in_new" color="primary" /></q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-expansion-item>
        </q-card>
      </div>
    </div>
  </div>

    <q-dialog v-model="showRehearsalEdit">
      <q-card style="min-width: 400px">
        <q-card-section class="row items-center">
          <div class="text-h6">{{ t('home.editRehearsal') }}</div>
          <q-space /><q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="editForm.title" :label="t('voting.songTitle')" outlined dense />
          <div class="row q-gutter-sm">
            <q-input v-model="editForm.startTime" :label="t('calendar.startTime')" type="datetime-local" outlined dense class="col" />
            <q-input v-model="editForm.endTime" :label="t('calendar.endTime')" type="datetime-local" outlined dense class="col" />
          </div>
          <q-input v-model="editForm.description" :label="t('calendar.description')" type="textarea" :rows="4" outlined dense />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.cancel')" v-close-popup />
          <q-btn color="primary" :label="t('common.save')" :loading="saving" @click="saveRehearsal" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showGigEdit" full-width>
      <q-card style="max-width: 800px">
        <q-card-section class="row items-center">
          <div class="text-h6">{{ t('home.manageGigs') }}</div>
          <q-space /><q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section style="max-height: 60vh; overflow-y: auto">
          <div v-for="(gig, i) in editedGigs" :key="i" class="q-pa-md q-mb-md rounded-borders bg-widget-surface">
            <div class="row items-center justify-between q-mb-sm">
              <span class="text-overline text-grey">{{ t('home.gigNumber') }} #{{ i + 1 }}</span>
              <q-btn flat round dense icon="delete" color="red" size="sm" @click="editedGigs.splice(i, 1)" />
            </div>
            <div class="q-gutter-sm">
              <q-input v-model="gig.title" :label="t('voting.songTitle')" outlined dense />
              <q-input v-model="gig.description" :label="t('calendar.description')" outlined dense />
              <div class="row q-gutter-sm">
                <q-input v-model="gig.startTimeFormatted" :label="t('calendar.startTime')" type="datetime-local" outlined dense class="col" />
                <q-input v-model="gig.endTimeFormatted" :label="t('calendar.endTime')" type="datetime-local" outlined dense class="col" />
              </div>
            </div>
          </div>
          <div v-if="!editedGigs.length" class="text-center text-grey q-pa-xl">{{ t('home.noGigsScheduled') }}</div>
        </q-card-section>
        <q-card-actions>
          <q-btn flat icon="add_circle" :label="t('home.addNewGig')" color="grey" @click="addNewGig" />
          <q-space />
          <q-btn flat :label="t('common.cancel')" v-close-popup />
          <q-btn color="primary" icon="check" :label="t('home.saveAll')" :loading="saving" @click="saveGigs" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showBierwartModal">
      <q-card style="min-width: 350px">
        <q-card-section class="row items-center">
          <q-icon name="science" color="orange" size="sm" class="q-mr-sm" />
          <div class="text-h6">{{ t('home.bierwartMgmt') }}</div>
          <q-space /><q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section>
          <q-list separator>
            <q-item v-for="member in visibleMembers" :key="member.id" clickable v-ripple :active="member.id === bierwart?.id" active-class="bg-orange-1" @click="confirmBierwart(member)">
              <q-item-section avatar>
                <q-avatar color="grey-3">
                  <span>{{ getInitials(member.name) }}</span>
                </q-avatar>
              </q-item-section>
              <q-item-section><q-item-label class="text-weight-bold">{{ member.name }}</q-item-label></q-item-section>
              <q-item-section side>
                <div class="row items-center q-gutter-xs">
                  <q-icon name="sports_bar" color="orange" size="xs" />
                  <span class="text-caption text-orange text-weight-bold">{{ member.beerCount ?? 0 }}</span>
                </div>
              </q-item-section>
              <q-item-section v-if="member.id === bierwart?.id" side><q-icon name="check_circle" color="orange" /></q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showProposalDialog">
      <q-card style="min-width: 420px">
        <q-card-section class="row items-center">
          <div class="text-h6">{{ t('home.suggestRehearsalTime') }}</div>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section class="q-gutter-sm">
          <q-input v-model="proposalForm.startTime" :label="t('calendar.startTime')" type="datetime-local" outlined dense />
          <q-input v-model="proposalForm.endTime" :label="t('calendar.endTime')" type="datetime-local" outlined dense />
          <q-input
            v-model="proposalForm.comment"
            type="textarea"
            autogrow
            outlined
            dense
            :label="t('home.proposalComment')"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.cancel')" v-close-popup />
          <q-btn color="primary" :label="t('common.save')" :loading="proposalLoading" @click="submitProposal" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <beer-rain :active="beerRainActive" @done="beerRainActive = false" />
  </q-page>
</template>

<style lang="scss" scoped>
.gig-entry {
  background: rgba(148, 163, 184, 0.12);
  border: 1px solid rgba(148, 163, 184, 0.28);
}

.gig-clickable {
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.gig-clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  border-color: var(--q-primary);
  background: rgba(25, 118, 210, 0.08);
}

:global(body.body--dark) .gig-clickable:hover {
  background: rgba(25, 118, 210, 0.15);
}

.option1-vote-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar-stack {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
}

.stack-avatar {
  transition: transform 0.15s ease;
}

.stack-avatar:hover {
  transform: translateY(-1px);
}

:global(body.body--dark) .gig-entry {
  background: rgba(39, 39, 42, 0.92);
  border-color: rgba(161, 161, 170, 0.34);
}

:global(body.body--dark) .gig-entry .q-item__label--caption {
  color: rgba(244, 244, 245, 0.88);
}
</style>
