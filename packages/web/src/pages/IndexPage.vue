<template>
  <q-page padding>
    <div class="row q-col-gutter-lg" style="max-width: 1200px; margin: 0 auto">
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
              {{ nextRehearsal.unavailabilities.map((u: any) => u.userName).join(', ') }}
              {{ nextRehearsal.unavailabilities.length === 1 ? t('home.unavailSingle') : t('home.unavailMulti') }}
            </q-banner>

            <div class="text-h4 text-weight-black">{{ formatTime(nextRehearsal.startTime) }}</div>
            <markdown-component :content="nextRehearsal.description || t('rehearsal.generalPractice')" class="text-grey-6 q-mt-xs" />

            <q-separator class="q-my-md" />

            <div v-if="bierwart" class="row items-center q-gutter-md cursor-pointer q-pa-sm rounded-borders" @click="openBierwartModal">
              <q-avatar size="48px" color="orange-2">
                <img v-if="bierwart.image" :src="bierwart.image" />
                <span v-else class="text-orange text-weight-bold">{{ bierwart.name?.charAt(0) }}</span>
              </q-avatar>
              <div class="col">
                <div class="text-overline text-orange" style="font-size: 10px">{{ t('home.onDuty') }}</div>
                <div class="text-subtitle1 text-weight-bold">{{ bierwart.name }}</div>
                <div class="text-caption text-grey">{{ t('home.hasDrinks') }}</div>
              </div>
              <div class="row items-center q-gutter-xs">
                <q-btn flat round dense icon="remove_circle" color="orange" size="sm" :loading="beerLoading" @click.stop="removeBeer" />
                <q-badge color="orange" :label="String(bierwart.beerCount || 0)" />
                <q-btn flat round dense icon="add_circle" color="orange" size="sm" :loading="beerLoading" @click.stop="addBeer" />
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
              <q-item v-for="gig in upcomingGigs" :key="gig.id" class="gig-entry rounded-borders q-my-xs">
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
              </q-item>
            </q-list>
          </q-card-section>

          <q-card-section v-else class="text-center text-grey q-pa-lg">{{ t('home.noGigs') }}</q-card-section>
        </q-card>
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
          <q-input v-model="editForm.description" :label="t('calendar.description')" type="textarea" outlined dense autogrow />
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
                  <img v-if="member.image" :src="member.image" />
                  <span v-else>{{ member.name?.charAt(0) }}</span>
                </q-avatar>
              </q-item-section>
              <q-item-section><q-item-label class="text-weight-bold">{{ member.name }}</q-item-label></q-item-section>
              <q-item-section v-if="member.id === bierwart?.id" side><q-icon name="check_circle" color="orange" /></q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </q-dialog>

    <beer-rain :active="beerRainActive" @done="beerRainActive = false" />
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../stores/auth'
import { useBandStore } from '../stores/band'
import { apiJson } from '../boot/api'
import MarkdownComponent from '../components/Markdown.vue'
import BeerRain from '../components/BeerRain.vue'
import { useI18n } from '../composables/useI18n'

const $q = useQuasar()
const authStore = useAuthStore()
const bandStore = useBandStore()
const { t, dateLocale } = useI18n()

type RehearsalData = { nextRehearsal: any | null; upcomingGigs: any[] }

const rehearsalData = ref<RehearsalData | null>(null)
const saving = ref(false)
const beerLoading = ref(false)
const beerRainActive = ref(false)

const isAdmin = computed(() => {
  const band = authStore.activeBand
  return band && ['owner', 'admin'].includes(band.role)
})

const nextRehearsal = computed(() => rehearsalData.value?.nextRehearsal ?? null)
const upcomingGigs = computed(() => rehearsalData.value?.upcomingGigs ?? [])
const visibleMembers = computed(() => bandStore.members.filter((m) => !m.isHidden))

const bierwart = computed(() => {
  if (!nextRehearsal.value || visibleMembers.value.length === 0) return null
  const overrideId = nextRehearsal.value.bierwartOverrideId
  if (overrideId) {
    const m = visibleMembers.value.find((m) => m.id === overrideId)
    if (m) return m
  }
  const idx = (nextRehearsal.value.id - 1) % visibleMembers.value.length
  return visibleMembers.value[idx]
})

async function loadData() {
  try {
    rehearsalData.value = await apiJson<RehearsalData>('/rehearsals/next')
  } catch {
    rehearsalData.value = null
  }
  bandStore.fetchMembers()
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

function openGigEdit() {
  editedGigs.value = (upcomingGigs.value || []).map((g: any) => ({ ...g, startTimeFormatted: formatForInput(g.startTime), endTimeFormatted: formatForInput(g.endTime || g.startTime) }))
  showGigEdit.value = true
}

function addNewGig() {
  const future = new Date(Date.now() + 7 * 86400000)
  editedGigs.value.push({ title: 'New Gig', description: '', type: 'gig', startTimeFormatted: formatForInput(future.toISOString()), endTimeFormatted: formatForInput(new Date(future.getTime() + 7200000).toISOString()) })
}

async function saveGigs() {
  saving.value = true
  try {
    const origIds = (upcomingGigs.value || []).map((g: any) => g.id)
    const keptIds = editedGigs.value.filter((g) => g.id).map((g) => g.id)
    for (const id of origIds.filter((id: number) => !keptIds.includes(id))) {
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
  saving.value = true
  try {
    await apiJson(`/calendar/${nextRehearsal.value.id}`, { method: 'PUT', body: JSON.stringify({ bierwartOverrideId: member.id }) })
    await loadData()
    showBierwartModal.value = false
  } catch (e: any) { $q.notify({ message: 'Failed: ' + e.message, color: 'negative' }) }
  finally { saving.value = false }
}
</script>

<style scoped>
.gig-entry {
  background: rgba(148, 163, 184, 0.12);
  border: 1px solid rgba(148, 163, 184, 0.28);
}

:global(body.body--dark) .gig-entry {
  background: rgba(39, 39, 42, 0.92);
  border-color: rgba(161, 161, 170, 0.34);
}

:global(body.body--dark) .gig-entry .q-item__label--caption {
  color: rgba(244, 244, 245, 0.88);
}
</style>
