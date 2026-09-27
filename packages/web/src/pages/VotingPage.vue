<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../stores/auth'
import { useSongsStore, type Song } from '../stores/songs'
import { useBandStore, type BandMember } from '../stores/band'
import { apiJson } from '../boot/api'
import { useI18n } from '../composables/useI18n'
import { exportXlsx } from '../utils/export'
import { getInitials } from '../utils/initials'

const $q = useQuasar()
const authStore = useAuthStore()
const songsStore = useSongsStore()
const bandStore = useBandStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const searchQuery = ref('')
const draggingIndex = ref<number | null>(null)
const votingFilter = ref('all')
const votingSort = ref('default')

const filterOptions = computed(() => [
  { label: t('voting.filterAll'), value: 'all' },
  { label: t('voting.filterVoted'), value: 'voted' },
  { label: t('voting.filterNotVoted'), value: 'not_voted' },
])

const sortOptions = computed(() => [
  { label: t('voting.sortDefault'), value: 'default' },
  { label: t('voting.sortRecentlyAdded'), value: 'recently_added' },
  { label: t('voting.sortHighestVote'), value: 'highest_vote' },
  { label: t('voting.sortLowestVote'), value: 'lowest_vote' },
  { label: t('voting.sortAlphabetic'), value: 'alphabetic' },
])

const FREE_SETLIST_LIMIT = 15
const FREE_POOL_LIMIT = 10

const isAdmin = computed(() => {
  const band = authStore.activeBand
  return band && ['owner', 'admin'].includes(band.role)
})

const masterSetlistSongCount = computed(() =>
  songsStore.songs.filter((s) => s.isSetlist && s.type === 'song').length,
)
const atSetlistLimit = computed(() => authStore.isFreePlan && masterSetlistSongCount.value >= FREE_SETLIST_LIMIT)
const poolSongCount = computed(() =>
  songsStore.songs.filter((s) => s.type !== 'pause' && s.type !== 'tuning' && !s.isSetlist && !s.isArchived).length,
)
const atPoolLimit = computed(() => authStore.isFreePlan && poolSongCount.value >= FREE_POOL_LIMIT)

const visibleMembers = computed(() => bandStore.members.filter((m) => !m.isHidden))
const currentUserId = computed(() => authStore.user?.id || '')

const currentTab = ref<'active' | 'archived'>('active')

const activeSongsCount = computed(() =>
  songsStore.songs.filter((s) => s.type !== 'pause' && s.type !== 'tuning' && !s.isSetlist && !s.isArchived).length,
)

const archivedSongsCount = computed(() =>
  songsStore.songs.filter((s) => s.type !== 'pause' && s.type !== 'tuning' && !s.isSetlist && s.isArchived).length,
)

const totalMembersCount = computed(() => visibleMembers.value.length)

function isFullyVoted(song: Song): boolean {
  return totalMembersCount.value > 0 && (song.voteCount ?? 0) >= totalMembersCount.value
}

const rankMap = computed(() => {
  const map = new Map<number, number>()
  const fullyVoted = songsStore.songs
    .filter((s) => s.type !== 'pause' && s.type !== 'tuning' && !s.isSetlist && !s.isArchived && isFullyVoted(s))
    .sort((a, b) => {
      const avgA = a.voteAverage ?? 0
      const avgB = b.voteAverage ?? 0
      if (avgA !== avgB) return avgB - avgA
      const countA = a.voteCount ?? 0
      const countB = b.voteCount ?? 0
      if (countA !== countB) return countB - countA
      return a.position - b.position
    })
  fullyVoted.forEach((song, idx) => {
    map.set(song.id, idx + 1)
  })
  return map
})

const filteredSongs = computed(() => {
  let list = songsStore.songs.filter((s) => {
    if (s.type === 'pause' || s.type === 'tuning' || s.isSetlist) return false
    return currentTab.value === 'archived' ? !!s.isArchived : !s.isArchived
  })
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q))
  }
  if (votingFilter.value === 'voted') {
    list = list.filter((s) => s.hasVoted !== -1)
  } else if (votingFilter.value === 'not_voted') {
    list = list.filter((s) => s.hasVoted === -1)
  }
  list = [...list].sort((a, b) => {
    if (votingSort.value === 'default') {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return a.position - b.position
    } else if (votingSort.value === 'recently_added') {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      if (timeA !== timeB) return timeB - timeA
      return a.position - b.position
    } else if (votingSort.value === 'highest_vote') {
      const fullA = isFullyVoted(a)
      const fullB = isFullyVoted(b)
      if (fullA && !fullB) return -1
      if (!fullA && fullB) return 1
      const avgA = a.voteAverage ?? 0
      const avgB = b.voteAverage ?? 0
      if (avgA !== avgB) return avgB - avgA
      const countA = a.voteCount ?? 0
      const countB = b.voteCount ?? 0
      if (countA !== countB) return countB - countA
      return a.position - b.position
    } else if (votingSort.value === 'lowest_vote') {
      const fullA = isFullyVoted(a)
      const fullB = isFullyVoted(b)
      if (fullA && !fullB) return -1
      if (!fullA && fullB) return 1
      const avgA = a.voteAverage ?? 0
      const avgB = b.voteAverage ?? 0
      if (avgA !== avgB) return avgA - avgB
      const countA = a.voteCount ?? 0
      const countB = b.voteCount ?? 0
      if (countA !== countB) return countB - countA
      return a.position - b.position
    } else if (votingSort.value === 'alphabetic') {
      const titleA = a.title.toLowerCase()
      const titleB = b.title.toLowerCase()
      if (titleA !== titleB) return titleA.localeCompare(titleB)
      return a.position - b.position
    }
    return 0
  })
  return list
})

function canEdit(song: Song) { return isAdmin.value || authStore.user?.id === song.addedBy }
function canDelete(song: Song) { return isAdmin.value || authStore.user?.id === song.addedBy }

function voteScore(song: Song, userId: string): number | null {
  const vote = song.allVotes?.find((v) => v.userId === userId)
  return vote?.score ?? null
}

function voteBorderColor(score: number | null): string {
  if (score === null) return '#9e9e9e'
  const clampedScore = Math.max(0, Math.min(3, score))
  const hue = (clampedScore / 3) * 120
  return `hsl(${hue} 80% 42%)`
}

function stackedAvatarStyle(song: Song, userId: string, index: number) {
  return {
    left: `${index * 16}px`,
    zIndex: 30 - index,
    borderColor: voteBorderColor(voteScore(song, userId)),
  }
}

function detailsAvatarStyle(song: Song | null, userId: string) {
  return {
    borderColor: voteBorderColor(song ? voteScore(song, userId) : null),
  }
}

function votedMembers(song: Song): BandMember[] {
  const votedIds = new Set(song.allVotes.map((entry) => entry.userId))
  return visibleMembers.value.filter((member) => votedIds.has(member.id))
}

function votedNamesLabel(song: Song): string {
  const names = votedMembers(song)
    .map((member) => member.name?.trim())
    .filter((name): name is string => Boolean(name))

  if (!names.length) return t('voting.nobodyVoted')
  if (names.length === 1) return t('voting.oneVoted', { name: names[0] })
  if (names.length === 2) return t('voting.twoVoted', { first: names[0], second: names[1] })
  return t('voting.manyVoted', { names: names.slice(0, -1).join(', '), last: names[names.length - 1] })
}

// Voting
async function toggleVote(song: Song, score: number) {
  try {
    const remove = song.hasVoted === score
    await apiJson('/votes', { method: 'POST', body: JSON.stringify({ songId: song.id, score: remove ? undefined : score, remove }) })
    await songsStore.fetchSongs()
  } catch (e: any) { $q.notify({ message: e.message || t('voting.failedVote'), color: 'negative' }) }
}

const showVotePicker = ref(false)
const voteSong = ref<Song | null>(null)
const showDetailsDialog = ref(false)
const detailsSong = ref<Song | null>(null)

function openVotePicker(song: Song) {
  if (!currentUserId.value) return
  voteSong.value = song
  showVotePicker.value = true
}

async function selectOwnVote(score: number) {
  if (!voteSong.value) return
  await toggleVote(voteSong.value, score)
  showVotePicker.value = false
}

function openDetailsDialog(song: Song) {
  detailsSong.value = song
  showDetailsDialog.value = true
}

function openSongFromQuery() {
  const rawSongId = route.query.songId
  const songId = typeof rawSongId === 'string' ? Number(rawSongId) : NaN
  if (!Number.isFinite(songId) || songId <= 0) return
  const song = songsStore.songs.find((entry) => entry.id === songId)
  if (!song) return
  openDetailsDialog(song)
  const nextQuery = { ...route.query }
  delete nextQuery.songId
  void router.replace({ path: route.path, query: nextQuery })
}

async function togglePin(song: Song) {
  try {
    await songsStore.updateSong(song.id, { isPinned: !song.isPinned } as any)
    await songsStore.fetchSongs()
  } catch { /* ignore */ }
}

async function reorderSongs(items: Song[]) {
  await songsStore.reorderSongs(items.map((s, i) => ({ id: s.id, position: i })))
}

function onDragStart(index: number) {
  if (currentTab.value !== 'active' || searchQuery.value || votingSort.value !== 'default') return
  draggingIndex.value = index
}

async function onDrop(index: number) {
  if (currentTab.value !== 'active' || searchQuery.value || votingSort.value !== 'default') return
  if (draggingIndex.value === null || draggingIndex.value === index) return
  const items = [...filteredSongs.value]
  const [moved] = items.splice(draggingIndex.value, 1)
  items.splice(index, 0, moved)
  draggingIndex.value = null
  await reorderSongs(items)
}

function onDragEnd() {
  draggingIndex.value = null
}

async function onSwipeRight(song: Song, reset: () => void) {
  if (currentTab.value === 'archived') {
    try {
      await songsStore.updateSong(song.id, { isArchived: false } as any)
      await songsStore.fetchSongs()
      $q.notify({ message: t('voting.songReactivated'), color: 'positive' })
    } catch {
      $q.notify({ message: t('common.error'), color: 'negative' })
    } finally {
      reset()
    }
    return
  }

  if (atSetlistLimit.value) {
    $q.notify({
      message: t('voting.proSetlistLimitTooltip', { limit: FREE_SETLIST_LIMIT }),
      color: 'warning',
    })
    reset()
    return
  }

  try {
    await songsStore.updateSong(song.id, { isSetlist: true } as any)
    await songsStore.fetchSongs()
    $q.notify({
      message: t('voting.songAccepted'),
      color: 'positive',
    })
  } catch {
    $q.notify({ message: t('voting.failedTransfer'), color: 'negative' })
  } finally {
    reset()
  }
}

async function onSwipeLeft(song: Song, reset: () => void) {
  if (currentTab.value !== 'active') {
    reset()
    return
  }

  try {
    await songsStore.updateSong(song.id, { isArchived: true } as any)
    await songsStore.fetchSongs()
    $q.notify({ message: t('voting.songArchived'), color: 'positive' })
  } catch {
    $q.notify({ message: t('common.error'), color: 'negative' })
  } finally {
    reset()
  }
}

async function archiveSong(song: Song) {
  $q.dialog({
    title: t('voting.archiveSong'),
    message: t('voting.confirmArchive', { title: song.title, artist: song.artist }),
    cancel: true,
  }).onOk(async () => {
    try {
      await songsStore.updateSong(song.id, { isArchived: true } as any)
      await songsStore.fetchSongs()
      $q.notify({ message: t('voting.songArchived'), color: 'positive' })
    } catch {
      $q.notify({ message: t('common.error'), color: 'negative' })
    }
  })
}

async function reactivateSong(song: Song) {
  try {
    await songsStore.updateSong(song.id, { isArchived: false } as any)
    await songsStore.fetchSongs()
    $q.notify({ message: t('voting.songReactivated'), color: 'positive' })
  } catch {
    $q.notify({ message: t('common.error'), color: 'negative' })
  }
}

async function deleteSong(song: Song) {
  $q.dialog({ title: t('common.delete'), message: t('voting.failedDelete', { title: song.title }), cancel: true }).onOk(async () => {
    await songsStore.deleteSong(song.id)
  })
}

// Song modal
const showSongModal = ref(false)
const submitting = ref(false)
const modalSongLengthInput = ref('')
const modalSong = ref({
  id: null as number | null,
  title: '',
  artist: '',
  spotifyUrl: '',
  youtubeUrl: '',
  notes: '',
  lengthMs: null as number | null,
  pitch: 0,
})
const lookingUp = ref(false)
const lookupError = ref('')

function openAddModal() {
  modalSong.value = { id: null, title: '', artist: '', spotifyUrl: '', youtubeUrl: '', notes: '', lengthMs: null, pitch: 0 }
  modalSongLengthInput.value = ''
  lookupError.value = ''
  showSongModal.value = true
}

function openEditModal(song: Song) {
  modalSong.value = {
    id: song.id,
    title: song.title,
    artist: song.artist,
    spotifyUrl: song.spotifyUrl || '',
    youtubeUrl: song.youtubeUrl || '',
    notes: song.notes || '',
    lengthMs: song.lengthMs ?? null,
    pitch: song.pitch ?? 0,
  }
  modalSongLengthInput.value = formatLengthInput(song.lengthMs ?? null)
  lookupError.value = ''
  showSongModal.value = true
}

async function lookupSpotify(force = true) {
  const url = modalSong.value.spotifyUrl
  if (!url?.includes('spotify.com')) return
  if (!force && modalSong.value.title && modalSong.value.artist) return
  lookingUp.value = true
  lookupError.value = ''
  try {
    const data = await apiJson<any>(`/songs/lookup?url=${encodeURIComponent(url)}`)
    if (data?.title && (force || !modalSong.value.title)) modalSong.value.title = data.title
    if (data?.artist && (force || !modalSong.value.artist)) modalSong.value.artist = data.artist
    if (typeof data?.lengthMs === 'number') {
      modalSong.value.lengthMs = data.lengthMs
      modalSongLengthInput.value = formatLengthInput(data.lengthMs)
    }
  } catch { lookupError.value = t('voting.lookupFailed') }
  finally { lookingUp.value = false }
}

function onSpotifyPaste() { setTimeout(() => lookupSpotify(false), 100) }

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

async function submitSong() {
  submitting.value = true
  try {
    const parsedLengthMs = parseLengthToMs(modalSongLengthInput.value)
    const payload = {
      title: modalSong.value.title,
      artist: modalSong.value.artist,
      spotifyUrl: modalSong.value.spotifyUrl || undefined,
      youtubeUrl: modalSong.value.youtubeUrl || undefined,
      notes: modalSong.value.notes || undefined,
      lengthMs: parsedLengthMs ?? modalSong.value.lengthMs ?? undefined,
      pitch: modalSong.value.pitch ?? 0,
    }

    if (modalSong.value.id) {
      await songsStore.updateSong(modalSong.value.id, payload as any)
    } else {
      await songsStore.createSong(payload as any)
    }
    showSongModal.value = false
    await songsStore.fetchSongs()
  } catch (e: any) { $q.notify({ message: e.message || t('voting.failedAdd'), color: 'negative' }) }
  finally { submitting.value = false }
}

function parseLengthToMs(input: string): number | null {
  const value = input.trim()
  if (!value) return null
  const match = value.match(/^(\d{1,3}):([0-5]\d)$/)
  if (!match) return null
  const minutes = Number(match[1])
  const seconds = Number(match[2])
  return (minutes * 60 + seconds) * 1000
}

function formatLengthInput(ms: number | null): string {
  if (typeof ms !== 'number' || ms < 0) return ''
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function normalizeVotingLengthInput() {
  const ms = parseLengthToMs(modalSongLengthInput.value)
  if (ms !== null) {
    modalSongLengthInput.value = formatLengthInput(ms)
  }
}

// Transfer
const showTransferModal = ref(false)
const songToTransfer = ref<Song | null>(null)

function openTransferModal(song: Song) { songToTransfer.value = song; showTransferModal.value = true }

async function transferToSetlist() {
  if (!songToTransfer.value) return
  try {
    await songsStore.updateSong(songToTransfer.value.id, { isSetlist: true } as any)
    showTransferModal.value = false
    await songsStore.fetchSongs()
  } catch { $q.notify({ message: t('voting.failedTransfer'), color: 'negative' }) }
}

// Export
function handleExport() {
  // Dynamically import xlsx for Excel export
  import('xlsx').then(async ({ utils }) => {
    const data = filteredSongs.value.map((s) => {
      const row: any = {
        Title: s.title,
        Artist: s.artist,
        Status: s.isArchived ? 'Archived' : 'Active',
        Rank: rankMap.value.get(s.id) ?? '-',
        Average: isFullyVoted(s) ? Number(s.voteAverage || 0).toFixed(1) : '-',
        Votes: `${s.voteCount ?? 0}/${totalMembersCount.value}`,
      }
      visibleMembers.value.forEach((m) => { row[m.name] = voteScore(s, m.id) ?? '-' })
      return row
    })
    const ws = utils.json_to_sheet(data)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Voting')
    try {
      await exportXlsx(wb, `bandstr_voting_${new Date().toISOString().split('T')[0]}.xlsx`)
    } catch {
      $q.notify({ message: 'Failed to export Excel file.', color: 'negative' })
    }
  })
}

onMounted(() => {
  void Promise.all([songsStore.fetchSongs(), bandStore.fetchMembers()]).then(() => {
    openSongFromQuery()
  })
})

watch(
  () => songsStore.songs.length,
  () => {
    openSongFromQuery()
  },
)
</script>

<template>
  <q-page padding>
    <div style="max-width: 1200px; margin: 0 auto">
      <q-card flat bordered>
        <q-card-section>
          <div class="row items-center justify-between">
            <div class="text-h5 text-weight-bold">{{ t('voting.heading') }}</div>
            <div class="row q-gutter-sm items-center">
              <q-btn flat round icon="download" @click="handleExport" />
              <span v-if="authStore.isFreePlan" class="text-caption text-grey-6">
                {{ poolSongCount }}/{{ FREE_POOL_LIMIT }}
              </span>
              <q-btn
                round
                :color="atPoolLimit ? 'grey' : 'primary'"
                icon="add"
                class="round-add-btn"
                :disable="atPoolLimit"
                @click="openAddModal"
              >
                <q-tooltip v-if="atPoolLimit">
                  {{ t('voting.proPoolLimitTooltip', { limit: FREE_POOL_LIMIT }) }}
                </q-tooltip>
              </q-btn>
            </div>
          </div>
        </q-card-section>

        <q-card-section class="q-pt-none q-pb-none">
          <q-tabs
            v-model="currentTab"
            dense
            align="left"
            class="text-grey-7"
            active-color="primary"
            indicator-color="primary"
          >
            <q-tab name="active" :label="t('voting.activeTab')">
              <q-badge color="primary" floating rounded>{{ activeSongsCount }}</q-badge>
            </q-tab>
            <q-tab name="archived" :label="t('voting.archiveTab')">
              <q-badge color="grey-7" floating rounded>{{ archivedSongsCount }}</q-badge>
            </q-tab>
          </q-tabs>
          <q-separator />
        </q-card-section>

        <q-card-section>
          <div class="row q-col-gutter-sm q-mb-md">
            <div class="col-12 col-sm-6">
              <q-input v-model="searchQuery" dense outlined :placeholder="t('voting.filterSongs')" clearable>
                <template #prepend><q-icon name="search" /></template>
              </q-input>
            </div>
            <div class="col-12 col-sm-3">
              <q-select
                v-model="votingFilter"
                dense
                outlined
                emit-value
                map-options
                :options="filterOptions"
                :label="t('voting.filterLabel')"
              />
            </div>
            <div class="col-12 col-sm-3">
              <q-select
                v-model="votingSort"
                dense
                outlined
                emit-value
                map-options
                :options="sortOptions"
                :label="t('voting.sortLabel')"
              />
            </div>
          </div>

          <q-list v-if="filteredSongs.length" separator>
            <q-slide-item
              v-for="(song, index) in filteredSongs"
              :key="song.id"
              class="voting-slide-item"
              left-color="positive"
              right-color="negative"
              @left="({ reset }) => onSwipeRight(song, reset)"
              @right="({ reset }) => onSwipeLeft(song, reset)"
            >
              <template #left>
                <div class="row items-center q-gutter-xs">
                  <q-icon :name="currentTab === 'active' ? 'check' : 'unarchive'" size="28px" />
                </div>
              </template>
              <template #right>
                <div v-if="currentTab === 'active'" class="row items-center q-gutter-xs">
                  <q-icon name="archive" size="28px" />
                </div>
              </template>

              <q-item
                class="q-pa-sm song-item"
                :draggable="currentTab === 'active' && !searchQuery && votingSort === 'default'"
                @dragstart="onDragStart(index)"
                @dragover.prevent
                @drop="onDrop(index)"
                @dragend="onDragEnd"
              >
                <q-item-section side class="song-order-controls">
                  <div class="column items-center q-gutter-xs">
                    <q-icon v-if="currentTab === 'active' && !searchQuery && votingSort === 'default'" name="drag_indicator" size="sm" color="grey-6" class="cursor-grab" />
                    <q-btn flat round dense :icon="song.isPinned ? 'bookmark' : 'bookmark_border'" :color="song.isPinned ? 'primary' : 'grey'" size="sm" @click="togglePin(song)" />
                  </div>
                </q-item-section>

                <!-- Thumbnail -->
                <q-item-section side class="song-order-thumb">
                  <div v-if="song.pitch !== 0" class="text-caption text-center text-weight-bold q-mb-xs">
                    Pitch {{ song.pitch > 0 ? '+' : '' }}{{ song.pitch }}
                  </div>
                  <a v-if="song.spotifyUrl && song.thumbnailUrl" :href="song.spotifyUrl" target="_blank">
                    <q-avatar rounded size="48px"><img :src="song.thumbnailUrl" /></q-avatar>
                  </a>
                  <q-avatar v-else rounded size="48px" color="grey-3"><q-icon name="music_note" color="grey" /></q-avatar>
                </q-item-section>

                <!-- Info -->
                <q-item-section class="song-order-info">
                  <q-item-label class="text-weight-bold">
                    {{ song.title }}
                    <q-icon v-if="song.notes" name="info" color="grey" size="xs" class="cursor-pointer">
                      <q-tooltip>{{ song.notes }}</q-tooltip>
                    </q-icon>
                  </q-item-label>
                  <q-item-label caption>{{ song.artist }}</q-item-label>
                  <div class="row q-gutter-xs q-mt-xs">
                    <a v-if="song.spotifyUrl" :href="song.spotifyUrl" target="_blank" class="text-green text-caption text-weight-bold" style="text-decoration:none">{{ t('voting.spotifyLabel') }}</a>
                    <a v-if="song.youtubeUrl" :href="song.youtubeUrl" target="_blank" class="text-red text-caption text-weight-bold" style="text-decoration:none">{{ t('voting.youtubeLabel') }}</a>
                  </div>
                  <div v-if="song.lengthMs" class="text-caption text-grey-7 q-mt-xs">
                    {{ t('voting.lengthLabel') }}: {{ formatDuration(song.lengthMs) }}
                  </div>
                  <div class="option1-vote-row q-mt-sm">
                    <div class="avatar-stack bg-widget-surface rounded-borders q-px-sm q-py-xs">
                      <q-avatar
                        v-for="(member, i) in votedMembers(song)"
                        :key="`${song.id}-voted-${member.id}`"
                        size="24px"
                        class="stack-avatar"
                        :style="stackedAvatarStyle(song, member.id, i)"
                        color="primary"
                        text-color="white"
                      >
                        <span>{{ getInitials(member.name) }}</span>
                      </q-avatar>
                      <span v-if="!votedMembers(song).length" class="text-caption text-grey-6 q-pr-xs">{{ t('voting.noVotesYet') }}</span>
                      <q-tooltip>{{ votedNamesLabel(song) }}</q-tooltip>
                    </div>
                    <div class="row items-center q-gutter-xs option1-actions">
                      <template v-if="isFullyVoted(song)">
                        <q-badge v-if="rankMap.has(song.id)" color="secondary" class="text-weight-bold">
                          {{ t('voting.rank', { rank: rankMap.get(song.id) }) }}
                        </q-badge>
                        <q-badge outline color="primary">
                          {{ t('voting.avg') }} {{ Number(song.voteAverage || 0).toFixed(1) }}
                        </q-badge>
                        <q-badge outline color="grey-7">{{ song.voteCount }} {{ t('voting.votes') }}</q-badge>
                      </template>
                      <template v-else>
                        <q-badge outline color="amber-9" class="text-weight-medium">
                          {{ t('voting.pendingVotes', { count: song.voteCount || 0, total: totalMembersCount }) }}
                        </q-badge>
                      </template>
                      <q-btn dense flat icon="how_to_vote" @click="openVotePicker(song)">
                        <q-tooltip>{{ t('voting.selfVoteHint') }}</q-tooltip>
                      </q-btn>
                      <q-btn dense flat icon="visibility" @click="openDetailsDialog(song)">
                        <q-tooltip>{{ t('voting.details') }}</q-tooltip>
                      </q-btn>
                    </div>
                  </div>
                </q-item-section>

                <!-- Actions -->
                <q-item-section side class="song-order-actions">
                  <div class="column q-gutter-xs song-actions">
                    <q-btn v-if="!song.isSetlist" flat round dense icon="arrow_forward" :color="atSetlistLimit ? 'grey-4' : 'grey'" size="sm" :disable="atSetlistLimit" @click="openTransferModal(song)">
                      <q-tooltip>{{ atSetlistLimit ? t('voting.proSetlistLimitTooltip', { limit: FREE_SETLIST_LIMIT }) : t('voting.sendToSetlist') }}</q-tooltip>
                    </q-btn>
                    <q-btn v-if="currentTab === 'active'" flat round dense icon="archive" color="grey-7" size="sm" @click="archiveSong(song)">
                      <q-tooltip>{{ t('voting.archiveSong') }}</q-tooltip>
                    </q-btn>
                    <q-btn v-else flat round dense icon="unarchive" color="primary" size="sm" @click="reactivateSong(song)">
                      <q-tooltip>{{ t('voting.reactivateSong') }}</q-tooltip>
                    </q-btn>
                    <q-btn v-if="canEdit(song)" flat round dense icon="edit" size="sm" @click="openEditModal(song)" />
                    <q-btn v-if="canDelete(song)" flat round dense icon="delete" color="red" size="sm" @click="deleteSong(song)" />
                  </div>
                </q-item-section>
              </q-item>
            </q-slide-item>
          </q-list>

          <q-banner v-else rounded class="bg-widget-surface">{{ t('voting.noSongs') }}</q-banner>
        </q-card-section>
      </q-card>
    </div>

    <!-- Add/Edit Song Dialog -->
    <q-dialog v-model="showSongModal">
      <q-card style="min-width: 450px">
        <q-card-section class="row items-center">
          <div class="text-h6">{{ modalSong.id ? t('voting.editSong') : t('voting.suggestNew') }}</div>
          <q-space /><q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <div class="row q-gutter-sm">
            <q-input v-model="modalSong.spotifyUrl" :label="t('voting.spotifyUrl')" outlined dense class="col" @paste="onSpotifyPaste" />
            <q-btn color="green" icon="search" :loading="lookingUp" :disable="!modalSong.spotifyUrl" @click="lookupSpotify(true)">{{ t('voting.spotifyLookup') }}</q-btn>
          </div>
          <div v-if="lookupError" class="text-red text-caption">{{ lookupError }}</div>
          <q-input v-model="modalSong.title" :label="t('voting.songTitle')" outlined dense />
          <q-input v-model="modalSong.artist" :label="t('voting.artist')" outlined dense />
          <q-input
            v-model="modalSongLengthInput"
            :label="t('voting.lengthInputLabel')"
            :hint="t('voting.lengthInputHint')"
            outlined
            dense
            @blur="normalizeVotingLengthInput"
          />
          <q-input v-model="modalSong.youtubeUrl" :label="t('voting.youtubeUrl')" outlined dense />
          <div class="row items-center q-gutter-md">
            <span class="text-caption">{{ t('voting.pitchLabel') }}</span>
            <q-slider v-model="modalSong.pitch" :min="-5" :max="5" :step="1" snap label class="col" :disable="authStore.isFreePlan" />
            <q-badge color="grey-8" class="text-body2">
              {{ modalSong.pitch > 0 ? '+' : '' }}{{ modalSong.pitch }}
            </q-badge>
            <q-badge v-if="authStore.isFreePlan" color="orange" :label="t('voting.proFeature')" />
          </div>
          <div v-if="authStore.isFreePlan" class="row items-center q-gutter-sm">
            <q-input v-model="modalSong.notes" :label="t('setlist.notes')" type="textarea" outlined dense autogrow disable class="col" />
            <q-badge color="orange" :label="t('voting.proFeature')" />
          </div>
          <q-input v-else v-model="modalSong.notes" :label="t('setlist.notes')" type="textarea" outlined dense autogrow />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.cancel')" v-close-popup />
          <q-btn color="primary" :label="modalSong.id ? t('voting.updateBtn') : t('voting.suggestSong')" :loading="submitting" @click="submitSong" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Transfer Dialog -->
    <q-dialog v-model="showTransferModal">
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">{{ t('voting.sendToSetlist') }}</div>
        </q-card-section>
        <q-card-section v-if="songToTransfer">
          <p>{{ t('voting.confirmTransfer', { title: songToTransfer.title, artist: songToTransfer.artist }) }}</p>
          <p class="text-caption text-grey">{{ t('voting.currentScore', { score: Number(songToTransfer.voteAverage || 0).toFixed(1) }) }}</p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.cancel')" v-close-popup />
          <q-btn color="primary" :label="t('voting.confirmBtn')" @click="transferToSetlist" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Vote Picker -->
    <q-dialog v-model="showVotePicker">
      <q-card class="vote-picker-card">
        <q-card-section class="row items-center">
          <div class="text-h6">{{ t('voting.chooseYourVote') }}</div>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-separator />
        <q-list separator>
          <q-item clickable v-ripple @click="selectOwnVote(0)">
            <q-item-section>{{ t('voting.voteOptionVeto') }}</q-item-section>
          </q-item>
          <q-item clickable v-ripple @click="selectOwnVote(1)">
            <q-item-section>{{ t('voting.voteOptionOk') }}</q-item-section>
          </q-item>
          <q-item clickable v-ripple @click="selectOwnVote(2)">
            <q-item-section>{{ t('voting.voteOptionGood') }}</q-item-section>
          </q-item>
          <q-item clickable v-ripple @click="selectOwnVote(3)">
            <q-item-section>{{ t('voting.voteOptionGreat') }}</q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </q-dialog>

    <!-- Vote Details -->
    <q-dialog v-model="showDetailsDialog">
      <q-card style="min-width: 360px; max-width: 96vw">
        <q-card-section class="row items-center">
          <div class="text-h6">{{ t('voting.details') }}</div>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-separator />
        <q-card-section v-if="detailsSong">
          <div class="text-subtitle2">{{ detailsSong.title }} - {{ detailsSong.artist }}</div>
          <div class="text-caption text-grey-7 q-mt-xs">{{ t('voting.avg') }}: {{ Number(detailsSong.voteAverage || 0).toFixed(1) }} | {{ t('voting.votes') }}: {{ detailsSong.voteCount }}</div>
          <q-list class="q-mt-sm" dense bordered separator>
            <q-item v-for="member in visibleMembers" :key="`d-${detailsSong.id}-${member.id}`">
              <q-item-section avatar>
                <q-avatar
                  size="24px"
                  color="grey-7"
                  text-color="white"
                  class="details-avatar"
                  :style="detailsAvatarStyle(detailsSong, member.id)"
                >
                  <span>{{ getInitials(member.name) }}</span>
                </q-avatar>
              </q-item-section>
              <q-item-section>{{ member.name }}</q-item-section>
              <q-item-section side>
                <q-badge :color="voteScore(detailsSong, member.id) === null ? 'grey-6' : 'primary'">
                  {{ voteScore(detailsSong, member.id) === null ? '-' : voteScore(detailsSong, member.id) }}
                </q-badge>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style lang="scss" scoped>
.option1-vote-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.avatar-stack {
  position: relative;
  min-height: 24px;
  min-width: 116px;
}

.stack-avatar {
  position: absolute;
  border-width: 4px;
  border-style: solid;
}

.details-avatar {
  border-width: 3px;
  border-style: solid;
}

.option1-actions {
  margin-left: auto;
}

@media (max-width: 768px) {
  .song-item {
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 8px 0;
  }

  .song-order-info {
    min-width: 0;
    flex: 1 1 0;
  }

  .song-order-actions {
    width: 100%;
    order: 10;
  }

  .song-actions {
    flex-direction: row;
  }

  .option1-actions {
    margin-left: 0;
  }
}

.vote-picker-card {
  min-width: 280px;
}

.round-add-btn {
  width: 42px;
  height: 42px;
  min-width: 42px;
  min-height: 42px;
  border-radius: 9999px;
}

.cursor-grab {
  cursor: grab;
}

.voting-slide-item {
  border-bottom: 1px solid var(--q-separator-color, rgba(0, 0, 0, 0.12));

  :deep(.q-slide-item__content) {
    background: var(--surface);
  }
}
</style>
