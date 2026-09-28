<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { useSongsStore, type Song } from '../stores/songs'
import { useAuthStore } from '../stores/auth'
import { apiJson } from '../boot/api'
import Markdown from '../components/Markdown.vue'
import SegmentedControl from '../components/SegmentedControl.vue'
import { useI18n } from '../composables/useI18n'
import { usePlatform } from '../composables/usePlatform'
import { exportXlsx, exportPdf, exportDocx, isShareCancellation, formatTotalDuration, type SetlistExportColumn, type SetlistExportData, type SetlistExportItem } from '../utils/export'

const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const songsStore = useSongsStore()
const authStore = useAuthStore()
const { t } = useI18n()
const { isIos, isAndroid, pIcon } = usePlatform()

function goToHome() {
  router.push({ path: '/' })
}

const searchQuery = ref('')
const selectedTagFilters = ref<string[]>([])
const draggingIndex = ref<number | null>(null)
const selectedSetlistMode = ref<'master' | 'user'>('master')
const selectedListOption = ref<string>('master')

type GigSetlist = {
  id: number
  bandId: number
  title: string
  location?: string | null
  gigDate?: string | null
  gigTime?: string | null
  notes?: string | null
  calendarEventId?: number | null
  calendarEventTitle?: string | null
  startTime?: string | null
  endTime?: string | null
  isTentative?: boolean | null
}

type CalendarGigOption = {
  id: number
  title: string
  startTime: string
}

type EditableGigMeta = {
  id: number
  title: string
  calendarEventId: number | null
  location: string
  gigDate: string
  gigTime: string
  notes: string
}

// Gig selection
const selectedGigId = ref<number | null>(null)
const gigs = ref<GigSetlist[]>([])
const calendarGigs = ref<CalendarGigOption[]>([])
const selectedGigMeta = ref<EditableGigMeta | null>(null)
const gigSongs = ref<Song[]>([])
const userSetlistSongs = ref<Song[]>([])
const personalNotes = ref<any[]>([])

const listOptions = computed(() => [
  { label: t('setlist.masterSetlist'), value: 'master' },
  { label: `${t('setlist.newGigSetlist')}...`, value: 'new_gig' },
  { label: t('setlist.userSetlist'), value: 'user' },
  ...gigs.value.map((g) => {
    let dateStr = ''
    if (g.startTime) {
      try { dateStr = new Date(g.startTime).toISOString().split('T')[0] } catch {}
    }
    const calendarLabel = g.calendarEventTitle && g.calendarEventTitle !== g.title ? ` · ${g.calendarEventTitle}` : ''
    return { label: dateStr ? `${dateStr} ${g.title}${calendarLabel}` : `${g.title}${calendarLabel}`, value: `gig:${g.id}` }
  }),
])

const filteredListOptions = ref<Array<{ label: string; value: string }>>([])

watch(
  listOptions,
  (options) => {
    filteredListOptions.value = options
  },
  { immediate: true },
)

function filterListOptions(val: string, update: (callback: () => void) => void) {
  update(() => {
    if (!val) {
      filteredListOptions.value = listOptions.value
    } else {
      const needle = val.toLowerCase()
      filteredListOptions.value = listOptions.value.filter((opt) =>
        opt.label.toLowerCase().includes(needle),
      )
    }
  })
}

const calendarGigLinkOptions = computed(() => [
  { label: t('setlist.unlinked'), value: null },
  ...calendarGigs.value.map((gig) => {
    let dateStr = ''
    try { dateStr = new Date(gig.startTime).toISOString().split('T')[0] } catch {}
    return { label: dateStr ? `${dateStr} ${gig.title}` : gig.title, value: gig.id }
  }),
])

const filteredCalendarGigLinkOptions = ref<Array<{ label: string; value: number | null }>>([])

function filterCalendarGigOptions(val: string, update: (callback: () => void) => void) {
  update(() => {
    if (!val) {
      filteredCalendarGigLinkOptions.value = calendarGigLinkOptions.value
    } else {
      const needle = val.toLowerCase()
      filteredCalendarGigLinkOptions.value = calendarGigLinkOptions.value.filter((opt) =>
        opt.label.toLowerCase().includes(needle),
      )
    }
  })
}

const currentTab = ref<'active' | 'archived'>('active')

const activeSetlistSongsCount = computed(() =>
  songsStore.songs.filter((s) => s.isSetlist && s.type === 'song' && !s.isArchived).length,
)
const archivedSetlistSongsCount = computed(() =>
  songsStore.songs.filter((s) => s.isSetlist && s.type === 'song' && s.isArchived).length,
)

const setlistTabOptions = computed(() => [
  { label: t('setlist.activeTab'), value: 'active', badge: activeSetlistSongsCount.value, badgeColor: 'primary' },
  { label: t('setlist.archiveTab'), value: 'archived', badge: archivedSetlistSongsCount.value, badgeColor: 'grey-7' },
])

// Active song list depends on gig selection
const activeSongs = computed(() => {
  if (selectedGigId.value) return gigSongs.value
  if (selectedSetlistMode.value === 'user') return userSetlistSongs.value
  if (currentTab.value === 'archived') {
    return songsStore.songs.filter((s) => s.isSetlist && s.type === 'song' && s.isArchived)
  }
  return songsStore.songs.filter((s) => s.isSetlist && (s.type !== 'song' || !s.isArchived))
})

const filteredSongs = computed(() => {
  let list = [...activeSongs.value]

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter((s) => {
      const tagMatch = (s.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
      return s.title.toLowerCase().includes(q) || (s.artist && s.artist.toLowerCase().includes(q)) || tagMatch
    })
  }

  if (!selectedGigId.value && selectedTagFilters.value.length) {
    const selectedLower = selectedTagFilters.value.map((tag) => tag.toLowerCase())
    list = list.filter((s) => {
      const songTags = (s.tags ?? []).map((tag) => tag.toLowerCase())
      return selectedLower.every((selected) => songTags.includes(selected))
    })
  }

  list.sort((a, b) => {
    const aPinned = isPinnedItem(a)
    const bPinned = isPinnedItem(b)
    if (aPinned && !bPinned) return -1
    if (!aPinned && bPinned) return 1
    return getItemPosition(a) - getItemPosition(b)
  })

  return list
})

function getItemKey(item: Song) {
  if (selectedGigId.value) {
    const gigSongId = (item as Song & { gigSongId?: number }).gigSongId
    return `gig-${gigSongId ?? item.id}`
  }
  if (selectedSetlistMode.value === 'user') return `user-${item.id}`
  return `song-${item.id}`
}

const FREE_SETLIST_LIMIT = 15

const songCount = computed(() => activeSongs.value.filter((s) => s.type === 'song').length)
const masterSetlistSongCount = computed(() => activeSetlistSongsCount.value)
const userSetlistSongIds = computed(() => new Set(userSetlistSongs.value.map((s) => s.id)))
const availableTagOptions = computed(() => {
  const uniqueTags = new Set<string>()
  for (const song of songsStore.songs) {
    if (!song.isSetlist || song.type !== 'song') continue
    for (const tag of song.tags ?? []) {
      const normalized = tag.trim()
      if (normalized) uniqueTags.add(normalized)
    }
  }
  return Array.from(uniqueTags).sort((a, b) => a.localeCompare(b))
})
const atSetlistLimit = computed(() => authStore.isFreePlan && masterSetlistSongCount.value >= FREE_SETLIST_LIMIT)
const totalDurationMs = computed(() =>
  activeSongs.value
    .filter((s) => s.type === 'song' && typeof s.lengthMs === 'number')
    .reduce((sum, s) => sum + (s.lengthMs ?? 0), 0),
)

const isAdmin = computed(() => {
  const band = authStore.activeBand
  return Boolean(band && ['owner', 'admin'].includes(band.role))
})

function canModifySong(item: Song) {
  return isAdmin.value || authStore.user?.id === item.addedBy
}

const masterSetlistItems = computed(() =>
  songsStore.songs
    .filter((s) => s.isSetlist && !s.isArchived)
    .sort((a, b) => a.position - b.position),
)

// Master songs for user setlist picker
const masterSongOptions = computed(() =>
  songsStore.songs
    .filter((s) => s.type === 'song' && s.isSetlist && !s.isArchived)
    .map((s) => ({ label: `${s.title} - ${s.artist}`, value: s.id }))
)
const availableUserSetlistSongOptions = computed(() =>
  masterSongOptions.value.filter((opt) => !userSetlistSongIds.value.has(opt.value)),
)

function getPersonalNote(songId: number) {
  const note = personalNotes.value.find((n: any) => n.songId === songId)
  return note ? note.content : ''
}

function getItemPosition(item: Song) {
  if (!selectedGigId.value && selectedSetlistMode.value === 'user') return item.userSetlistPosition ?? item.position
  return item.position
}

function isPinnedItem(item: Song) {
  if (!selectedGigId.value && selectedSetlistMode.value === 'user') return Boolean(item.userSetlistPinned)
  return Boolean(item.isPinned)
}

function isInUserSetlist(songId: number) {
  return userSetlistSongIds.value.has(songId)
}

function getYouTubeId(url: string | null | undefined) {
  if (!url) return null
  let match = url.match(/v=([a-zA-Z0-9_-]+)/)
  if (match) return match[1]
  match = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/)
  if (match) return match[1]
  return null
}

// Data fetching
async function fetchGigs() {
  try {
    const list = await apiJson<GigSetlist[]>('/gigs')
    const validCalendarIds = new Set(calendarGigs.value.map((g) => g.id))
    gigs.value = list.map((g) => {
      if (g.calendarEventId && calendarGigs.value.length > 0 && !validCalendarIds.has(g.calendarEventId)) {
        return {
          ...g,
          calendarEventId: null,
          calendarEventTitle: null,
          startTime: null,
          endTime: null,
        }
      }
      return g
    })
  } catch {
    gigs.value = []
  }
}

async function fetchCalendarGigs() {
  try {
    const events = await apiJson<Array<{ id: number; title: string; type: string; startTime: string }>>('/calendar')
    calendarGigs.value = events
      .filter((event) => event.type === 'gig')
      .map((event) => ({ id: event.id, title: event.title, startTime: event.startTime }))
      .sort((a, b) => {
        const left = new Date(a.startTime).getTime()
        const right = new Date(b.startTime).getTime()
        return left - right
      })

    // Remove invalid calendar links if any remain
    const validCalendarIds = new Set(calendarGigs.value.map((g) => g.id))
    for (const g of gigs.value) {
      if (g.calendarEventId && !validCalendarIds.has(g.calendarEventId)) {
        g.calendarEventId = null
        g.calendarEventTitle = null
        g.startTime = null
        g.endTime = null
      }
    }
    if (selectedGigMeta.value?.calendarEventId && !validCalendarIds.has(selectedGigMeta.value.calendarEventId)) {
      selectedGigMeta.value.calendarEventId = null
    }
  } catch {
    calendarGigs.value = []
  }
}

async function fetchGigSongs(gigId: number) {
  try { gigSongs.value = await apiJson<Song[]>(`/gigs/${gigId}/songs`) } catch { gigSongs.value = [] }
}

async function fetchUserSetlistSongs() {
  try { userSetlistSongs.value = await apiJson<Song[]>('/songs/user-setlist') } catch { userSetlistSongs.value = [] }
}

async function fetchPersonalNotes() {
  try { personalNotes.value = await apiJson<any[]>('/songs/notes') } catch { personalNotes.value = [] }
}

async function refreshAll() {
  const promises: Promise<void>[] = [songsStore.fetchSongs(), fetchPersonalNotes(), fetchUserSetlistSongs()]
  if (selectedGigId.value) promises.push(fetchGigSongs(selectedGigId.value))
  await Promise.all(promises)
}

watch(selectedListOption, async (newVal, oldVal) => {
  if (newVal === 'new_gig') {
    await createGigSetlist(oldVal)
    return
  }
  selectedTagFilters.value = []
  currentTab.value = 'active'
  if (newVal === 'user') {
    selectedSetlistMode.value = 'user'
    selectedGigId.value = null
    return
  }
  if (newVal === 'master') {
    selectedSetlistMode.value = 'master'
    selectedGigId.value = null
    return
  }

  if (newVal && newVal.startsWith('gig:')) {
    selectedSetlistMode.value = 'master'
    const id = Number(newVal.slice(4))
    selectedGigId.value = Number.isFinite(id) && id > 0 ? id : null
    if (selectedGigId.value) fetchGigSongs(selectedGigId.value)
  }
})

function mapGigToMeta(gig: GigSetlist): EditableGigMeta {
  let defaultDate = gig.gigDate || ''
  let defaultTime = gig.gigTime || ''
  if (!defaultDate && gig.startTime) {
    try {
      const dt = new Date(gig.startTime)
      defaultDate = dt.toISOString().split('T')[0]
      defaultTime = dt.toTimeString().slice(0, 5)
    } catch {}
  }
  return {
    id: gig.id,
    title: gig.title,
    calendarEventId: gig.calendarEventId ?? null,
    location: gig.location || '',
    gigDate: defaultDate,
    gigTime: defaultTime,
    notes: gig.notes || '',
  }
}

watch(selectedGigId, (gigId) => {
  if (!gigId) {
    selectedGigMeta.value = null
    return
  }
  const gig = gigs.value.find((entry) => entry.id === gigId)
  selectedGigMeta.value = gig ? mapGigToMeta(gig) : null
})

watch(gigs, () => {
  if (!selectedGigId.value) return
  const gig = gigs.value.find((entry) => entry.id === selectedGigId.value)
  if (!gig) return
  selectedGigMeta.value = mapGigToMeta(gig)
})

watch(
  () => route.query.list,
  (raw) => {
    if (typeof raw === 'string' && (raw === 'master' || raw === 'user' || raw.startsWith('gig:'))) {
      if (selectedListOption.value !== raw) {
        selectedListOption.value = raw
      }
    }
  },
)

async function createGigSetlist(fallbackOption?: string) {
  isSaving.value = true
  try {
    const created = await apiJson<{ id: number }>('/gigs', {
      method: 'POST',
      body: JSON.stringify({ title: t('setlist.defaultGigSetlistTitle') }),
    })
    await fetchGigs()
    selectedListOption.value = `gig:${created.id}`
  } catch {
    $q.notify({ message: t('setlist.failedAdd'), color: 'negative' })
    selectedListOption.value = fallbackOption && fallbackOption !== 'new_gig' ? fallbackOption : 'master'
  } finally {
    isSaving.value = false
  }
}

async function duplicateGigSetlist() {
  if (!selectedGigMeta.value) return
  isSaving.value = true
  try {
    const duplicated = await apiJson<GigSetlist>(`/gigs/${selectedGigMeta.value.id}/duplicate`, {
      method: 'POST',
    })
    await fetchGigs()
    selectedListOption.value = `gig:${duplicated.id}`
    $q.notify({ message: t('setlist.duplicatedSuccess'), color: 'positive' })
  } catch {
    $q.notify({ message: t('common.error'), color: 'negative' })
  } finally {
    isSaving.value = false
  }
}

async function saveGigMeta() {
  if (!selectedGigMeta.value) return
  const newCalendarEventId = selectedGigMeta.value.calendarEventId

  if (newCalendarEventId) {
    const conflictingGig = gigs.value.find(
      (g) => g.calendarEventId === newCalendarEventId && g.id !== selectedGigMeta.value!.id
    )
    if (conflictingGig) {
      $q.dialog({
        title: t('common.warning'),
        message: t('setlist.calendarGigLinkConflict', { title: conflictingGig.title }),
        cancel: true,
        persistent: true,
      }).onOk(async () => {
        await executeSaveGigMeta()
      })
      return
    }
  }

  await executeSaveGigMeta()
}

async function executeSaveGigMeta() {
  if (!selectedGigMeta.value) return
  isSaving.value = true
  try {
    await apiJson(`/gigs/${selectedGigMeta.value.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: selectedGigMeta.value.title,
        calendarEventId: selectedGigMeta.value.calendarEventId,
        location: selectedGigMeta.value.location || null,
        gigDate: selectedGigMeta.value.gigDate || null,
        gigTime: selectedGigMeta.value.gigTime || null,
        notes: selectedGigMeta.value.notes || null,
      }),
    })
    await fetchGigs()
    $q.notify({ message: t('common.saved'), color: 'positive' })
  } catch {
    $q.notify({ message: t('setlist.failedSave'), color: 'negative' })
  } finally {
    isSaving.value = false
  }
}

async function deleteGigSetlist() {
  if (!selectedGigMeta.value) return
  $q.dialog({
    title: t('common.delete'),
    message: t('setlist.deleteGigSetlistConfirm', { title: selectedGigMeta.value.title }),
    cancel: true,
  }).onOk(async () => {
    isSaving.value = true
    try {
      await apiJson(`/gigs/${selectedGigMeta.value!.id}`, { method: 'DELETE' })
      await fetchGigs()
      selectedListOption.value = 'master'
    } catch {
      $q.notify({ message: t('setlist.failedRemove'), color: 'negative' })
    } finally {
      isSaving.value = false
    }
  })
}

// Reorder
async function reorderItems(items: Song[]) {
  if (selectedGigId.value) {
    const hasMissingGigSongId = items.some((itm) => typeof (itm as Song & { gigSongId?: number }).gigSongId !== 'number')
    if (hasMissingGigSongId) {
      $q.notify({ message: t('setlist.failedReorder'), color: 'negative' })
      await refreshAll()
      return
    }
  }

  try {
    if (selectedGigId.value) {
      const updates = items.map((itm, idx) => ({
        id: (itm as Song & { gigSongId: number }).gigSongId,
        position: idx,
      }))
      await apiJson(`/gigs/${selectedGigId.value}/songs/reorder`, {
        method: 'POST',
        body: JSON.stringify({ order: updates }),
      })
      await fetchGigSongs(selectedGigId.value)
    } else if (selectedSetlistMode.value === 'user') {
      const updates = items.map((itm, idx) => ({ songId: itm.id, position: idx }))
      await apiJson('/songs/user-setlist/reorder', {
        method: 'POST',
        body: JSON.stringify({ order: updates }),
      })
      await fetchUserSetlistSongs()
    } else {
      const updates = items.map((itm, idx) => ({ id: itm.id, position: idx }))
      await songsStore.reorderSongs(updates)
    }
  } catch {
    $q.notify({ message: t('setlist.failedReorder'), color: 'negative' })
    await refreshAll()
  }
}

function onDragStart(index: number, event: DragEvent) {
  if (searchQuery.value) return
  if (!selectedGigId.value && selectedSetlistMode.value === 'master' && currentTab.value === 'archived') return
  draggingIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.dropEffect = 'move'
  }
}

async function onDrop(index: number) {
  if (searchQuery.value) return
  if (!selectedGigId.value && selectedSetlistMode.value === 'master' && currentTab.value === 'archived') return
  if (draggingIndex.value === null || draggingIndex.value === index) return
  const items = [...filteredSongs.value]
  const [moved] = items.splice(draggingIndex.value, 1)
  items.splice(index, 0, moved)
  draggingIndex.value = null
  await reorderItems(items)
}

function onDragEnd() {
  draggingIndex.value = null
}

async function moveItem(index: number, direction: -1 | 1) {
  if (searchQuery.value) return
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= filteredSongs.value.length) return
  const items = [...filteredSongs.value]
  const [moved] = items.splice(index, 1)
  items.splice(nextIndex, 0, moved)
  await reorderItems(items)
}

async function togglePin(item: Song) {
  try {
    if (selectedSetlistMode.value === 'user' && !selectedGigId.value) {
      await apiJson(`/songs/user-setlist/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isPinned: !isPinnedItem(item) }),
      })
    } else {
      await songsStore.updateSong(item.id, { isPinned: !item.isPinned })
    }
    await refreshAll()
  } catch {}
}

async function onSwipeRight(item: Song, reset: () => void) {
  if (item.type !== 'song' || selectedGigId.value || selectedSetlistMode.value !== 'master') {
    reset()
    return
  }

  if (currentTab.value === 'archived') {
    if (atSetlistLimit.value) {
      $q.notify({
        message: t('voting.proSetlistLimitTooltip', { limit: FREE_SETLIST_LIMIT }),
        color: 'warning',
      })
      reset()
      return
    }

    try {
      await songsStore.updateSong(item.id, { isArchived: false })
      await songsStore.fetchSongs()
      $q.notify({
        message: t('setlist.songReactivatedNamed', { title: item.title }),
        color: 'positive',
        timeout: 6000,
        actions: [
          {
            label: t('common.undo'),
            color: 'white',
            handler: async () => {
              try {
                await songsStore.updateSong(item.id, { isArchived: true })
                await songsStore.fetchSongs()
                $q.notify({ message: t('common.undone'), color: 'info', timeout: 2000 })
              } catch {
                $q.notify({ message: t('common.error'), color: 'negative' })
              }
            },
          },
        ],
      })
    } catch {
      $q.notify({ message: t('common.error'), color: 'negative' })
    } finally {
      reset()
    }
    return
  }

  // Active tab: move to voting (isSetlist: false)
  try {
    await songsStore.updateSong(item.id, { isSetlist: false })
    await songsStore.fetchSongs()
    $q.notify({
      message: t('setlist.songMovedToVotingNamed', { title: item.title }),
      color: 'positive',
      timeout: 6000,
      actions: [
        {
          label: t('common.undo'),
          color: 'white',
          handler: async () => {
            try {
              await songsStore.updateSong(item.id, { isSetlist: true })
              await songsStore.fetchSongs()
              $q.notify({ message: t('common.undone'), color: 'info', timeout: 2000 })
            } catch {
              $q.notify({ message: t('common.error'), color: 'negative' })
            }
          },
        },
      ],
    })
  } catch {
    $q.notify({ message: t('common.error'), color: 'negative' })
  } finally {
    reset()
  }
}

async function onSwipeLeft(item: Song, reset: () => void) {
  if (item.type !== 'song' || selectedGigId.value || selectedSetlistMode.value !== 'master' || currentTab.value !== 'active') {
    reset()
    return
  }

  // Active tab: archive song (isArchived: true)
  try {
    await songsStore.updateSong(item.id, { isArchived: true })
    await songsStore.fetchSongs()
    $q.notify({
      message: t('setlist.songArchivedNamed', { title: item.title }),
      color: 'positive',
      timeout: 6000,
      actions: [
        {
          label: t('common.undo'),
          color: 'white',
          handler: async () => {
            try {
              await songsStore.updateSong(item.id, { isArchived: false })
              await songsStore.fetchSongs()
              $q.notify({ message: t('common.undone'), color: 'info', timeout: 2000 })
            } catch {
              $q.notify({ message: t('common.error'), color: 'negative' })
            }
          },
        },
      ],
    })
  } catch {
    $q.notify({ message: t('common.error'), color: 'negative' })
  } finally {
    reset()
  }
}

async function removeFromSetlist(item: Song) {
  $q.dialog({
    title: t('common.delete'),
    message: t('setlist.removeConfirm', { title: item.title }),
    cancel: true,
  }).onOk(async () => {
    try {
      if (selectedGigId.value) {
        await apiJson(`/gigs/${selectedGigId.value}/songs/${item.id}`, { method: 'DELETE' })
        await fetchGigSongs(selectedGigId.value)
      } else if (item.type !== 'song') {
        await songsStore.deleteSong(item.id)
      } else if (selectedSetlistMode.value === 'user' && !selectedGigId.value) {
        await apiJson(`/songs/user-setlist/${item.id}`, { method: 'DELETE' })
        await fetchUserSetlistSongs()
      } else {
        await songsStore.updateSong(item.id, { isSetlist: false })
      }
      await refreshAll()
    } catch {
      $q.notify({ message: t('setlist.failedRemove'), color: 'negative' })
    }
  })
}

async function toggleUserSetlist(item: Song) {
  if (item.type !== 'song') return
  try {
    if (isInUserSetlist(item.id)) {
      await apiJson(`/songs/user-setlist/${item.id}`, { method: 'DELETE' })
      $q.notify({ message: t('setlist.removedFromUserSetlist'), color: 'positive' })
    } else {
      await apiJson('/songs/user-setlist', { method: 'POST', body: JSON.stringify({ songId: item.id }) })
      $q.notify({ message: t('setlist.addedToUserSetlist'), color: 'positive' })
    }
    await fetchUserSetlistSongs()
  } catch {
    $q.notify({ message: t('setlist.failedSave'), color: 'negative' })
  }
}

// Note viewer
const showNoteModal = ref(false)
const noteModalTitle = ref('')
const noteModalContent = ref('')

function showNote(title: string, content: string | null | undefined) {
  noteModalTitle.value = title
  noteModalContent.value = content || ''
  showNoteModal.value = true
}

// Add song to master setlist
const showAddSongModal = ref(false)
const addSongLengthInput = ref('')
const addSongForm = ref({
  title: '',
  artist: '',
  spotifyUrl: '',
  youtubeUrl: '',
  tags: [] as string[],
  notes: '',
  lengthMs: null as number | null,
  bpm: null as number | null,
  pitch: 0,
})
const addSongLookingUp = ref(false)
const addSongLookupError = ref('')
const isSaving = ref(false)

function openAddSongModal() {
  if (selectedGigId.value) {
    openGigBuilder()
  } else {
    addSongForm.value = { title: '', artist: '', spotifyUrl: '', youtubeUrl: '', tags: [], notes: '', lengthMs: null, bpm: null, pitch: 0 }
    addSongLengthInput.value = ''
    addSongLookupError.value = ''
    showAddSongModal.value = true
  }
}

async function deleteSong(item: Song) {
  $q
    .dialog({
      title: t('common.delete'),
      message: t('voting.failedDelete', { title: item.title }),
      cancel: true,
    })
    .onOk(async () => {
      try {
        await songsStore.deleteSong(item.id)
        await refreshAll()
      } catch {
        $q.notify({ message: t('setlist.failedRemove'), color: 'negative' })
      }
    })
}

async function submitAddSong() {
  isSaving.value = true
  try {
    const parsedLengthMs = parseLengthToMs(addSongLengthInput.value)
    await songsStore.createSong({
      title: addSongForm.value.title,
      artist: addSongForm.value.artist,
      spotifyUrl: addSongForm.value.spotifyUrl || undefined,
      youtubeUrl: addSongForm.value.youtubeUrl || undefined,
      lengthMs: parsedLengthMs ?? addSongForm.value.lengthMs ?? undefined,
      bpm: normalizeBpmValue(addSongForm.value.bpm),
      tags: normalizeTagList(addSongForm.value.tags),
      pitch: addSongForm.value.pitch ?? 0,
      notes: addSongForm.value.notes || undefined,
      position: filteredSongs.value.length,
      isSetlist: true,
    } as any)
    showAddSongModal.value = false
    await refreshAll()
  } catch { $q.notify({ message: t('setlist.failedAdd'), color: 'negative' }) }
  finally { isSaving.value = false }
}

async function lookupSpotifyForAdd(force = true) {
  const url = addSongForm.value.spotifyUrl
  if (!url?.includes('spotify.com')) return
  if (!force && addSongForm.value.title && addSongForm.value.artist) return
  addSongLookingUp.value = true
  addSongLookupError.value = ''
  try {
    const data = await apiJson<any>(`/songs/lookup?url=${encodeURIComponent(url)}`)
    if (data?.title && (force || !addSongForm.value.title)) addSongForm.value.title = data.title
    if (data?.artist && (force || !addSongForm.value.artist)) addSongForm.value.artist = data.artist
    if (typeof data?.lengthMs === 'number') {
      addSongForm.value.lengthMs = data.lengthMs
      addSongLengthInput.value = formatLength(data.lengthMs)
    }
  } catch {
    addSongLookupError.value = t('voting.lookupFailed')
  } finally {
    addSongLookingUp.value = false
  }
}

function onAddSpotifyPaste() {
  setTimeout(() => lookupSpotifyForAdd(false), 100)
}

// Gig setlist builder
const showGigBuilderModal = ref(false)
const gigBuilderSearch = ref('')
const gigBuilderDraftItems = ref<Song[]>([])

const filteredGigBuilderSourceItems = computed(() => {
  const draftIds = new Set(gigBuilderDraftItems.value.map((s) => s.id))
  const q = gigBuilderSearch.value.trim().toLowerCase()
  return masterSetlistItems.value.filter((song) => {
    if (draftIds.has(song.id)) return false
    if (!q) return true
    const inTags = (song.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
    return song.title.toLowerCase().includes(q) || song.artist.toLowerCase().includes(q) || inTags
  })
})

function formatGigBuilderType(type: Song['type']) {
  if (type === 'song') return t('setlist.noteTypeSong')
  if (type === 'pause') return t('setlist.noteTypePause')
  if (type === 'tuning') return t('setlist.noteTypeTuning')
  return t('setlist.noteTypeCustom')
}

function openGigBuilder() {
  gigBuilderDraftItems.value = [...gigSongs.value].sort((a, b) => a.position - b.position)
  gigBuilderSearch.value = ''
  showGigBuilderModal.value = true
}

function addToGigBuilder(item: Song) {
  if (gigBuilderDraftItems.value.some((existing) => existing.id === item.id)) return
  gigBuilderDraftItems.value.push(item)
}

function removeFromGigBuilder(songId: number) {
  gigBuilderDraftItems.value = gigBuilderDraftItems.value.filter((item) => item.id !== songId)
}

function cancelGigBuilder() {
  showGigBuilderModal.value = false
  gigBuilderSearch.value = ''
  gigBuilderDraftItems.value = []
}

async function confirmGigBuilder() {
  if (!selectedGigId.value) return
  isSaving.value = true
  try {
    const targetGigId = selectedGigId.value
    const currentSongIds = Array.from(new Set(gigSongs.value.map((item) => item.id)))
    const draftSongIds = gigBuilderDraftItems.value.map((item) => item.id)

    for (const songId of currentSongIds.filter((id) => !draftSongIds.includes(id))) {
      await apiJson(`/gigs/${targetGigId}/songs/${songId}`, { method: 'DELETE' })
    }

    for (const songId of draftSongIds.filter((id) => !currentSongIds.includes(id))) {
      await apiJson(`/gigs/${targetGigId}/songs`, {
        method: 'POST',
        body: JSON.stringify({ songId, position: draftSongIds.indexOf(songId) }),
      })
    }

    await fetchGigSongs(targetGigId)

    const order = draftSongIds
      .map((songId, index) => {
        const row = gigSongs.value.find((item) => item.id === songId && typeof (item as Song & { gigSongId?: number }).gigSongId === 'number')
        if (!row) return null
        return {
          id: (row as Song & { gigSongId: number }).gigSongId,
          position: index,
        }
      })
      .filter((entry): entry is { id: number; position: number } => Boolean(entry))

    if (order.length) {
      await apiJson(`/gigs/${targetGigId}/songs/reorder`, {
        method: 'POST',
        body: JSON.stringify({ order }),
      })
      await fetchGigSongs(targetGigId)
    }

    cancelGigBuilder()
  } catch {
    $q.notify({ message: t('setlist.failedAdd'), color: 'negative' })
  } finally {
    isSaving.value = false
  }
}

const showAddUserSetlistModal = ref(false)
const selectedUserSetlistSongIds = ref<number[]>([])

function openAddToUserSetlistModal() {
  selectedUserSetlistSongIds.value = []
  showAddUserSetlistModal.value = true
}

async function submitAddUserSetlistSongs() {
  isSaving.value = true
  try {
    for (let i = 0; i < selectedUserSetlistSongIds.value.length; i++) {
      await apiJson('/songs/user-setlist', {
        method: 'POST',
        body: JSON.stringify({ songId: selectedUserSetlistSongIds.value[i], position: userSetlistSongs.value.length + i }),
      })
    }
    showAddUserSetlistModal.value = false
    selectedUserSetlistSongIds.value = []
    await fetchUserSetlistSongs()
  } catch {
    $q.notify({ message: t('setlist.failedAdd'), color: 'negative' })
  } finally {
    isSaving.value = false
  }
}

// Setlist note element
const showSpecialModal = ref(false)
type SpecialNoteType = 'set' | 'pause' | 'encore' | 'tuning' | 'custom'
const specialElementForm = ref<{ noteType: SpecialNoteType; title: string; notes: string } | null>(null)
const specialNoteTypeOptions = computed(() => [
  { label: t('setlist.noteTypeSet'), value: 'set' },
  { label: t('setlist.noteTypePause'), value: 'pause' },
  { label: t('setlist.noteTypeEncore'), value: 'encore' },
  { label: t('setlist.noteTypeTuning'), value: 'tuning' },
  { label: t('setlist.noteTypeCustom'), value: 'custom' },
])

function defaultNoteTitleForType(noteType: SpecialNoteType) {
  if (noteType === 'set') {
    const existingSetsCount = activeSongs.value.filter((s) => s.type === 'set').length
    return `SET ${existingSetsCount + 1}`
  }
  if (noteType === 'pause') return 'PAUSE'
  if (noteType === 'encore') return 'ZUGABE'
  if (noteType === 'tuning') return t('setlist.tuningChange')
  return t('setlist.customNote')
}

function openSpecialModal() {
  specialElementForm.value = { noteType: 'set', title: defaultNoteTitleForType('set'), notes: '' }
  showSpecialModal.value = true
}

function applySpecialTypePreset(noteType: SpecialNoteType) {
  if (!specialElementForm.value) return
  specialElementForm.value.title = defaultNoteTitleForType(noteType)
}

async function submitSpecialElement() {
  if (!specialElementForm.value) return
  isSaving.value = true
  const noteType = specialElementForm.value.noteType
  try {
    const created = await songsStore.createSong({
      title: specialElementForm.value.title,
      artist: 'Band',
      type: noteType === 'custom' ? 'note' : noteType,
      notes: specialElementForm.value.notes,
      position: filteredSongs.value.length,
      isSetlist: true,
    } as any)

    if (selectedGigId.value && created?.id) {
      await apiJson(`/gigs/${selectedGigId.value}/songs`, {
        method: 'POST',
        body: JSON.stringify({ songId: created.id, position: gigSongs.value.length }),
      })
      await fetchGigSongs(selectedGigId.value)
    }

    showSpecialModal.value = false
    await refreshAll()
  } catch {
    $q.notify({ message: t('setlist.failedAdd'), color: 'negative' })
  } finally {
    isSaving.value = false
  }
}

// Edit modal
const showEditModal = ref(false)
const editingItem = ref<any>(null)
const editingSongLengthInput = ref('')
const editingItemPersonalNote = ref('')
const isLookingUp = ref(false)
const lookupError = ref('')

function openEditModal(item: Song) {
  editingItem.value = { ...item, tags: [...(item.tags ?? [])] }
  editingSongLengthInput.value = formatLength(item.lengthMs ?? null)
  editingItemPersonalNote.value = getPersonalNote(item.id)
  showEditModal.value = true
}

async function lookupSpotify(force = true) {
  if (!editingItem.value) return
  const url = editingItem.value.spotifyUrl
  if (!url?.includes('spotify.com')) return
  if (!force && editingItem.value.title && editingItem.value.artist) return
  isLookingUp.value = true
  lookupError.value = ''
  try {
    const data = await apiJson<any>(`/songs/lookup?url=${encodeURIComponent(url)}`)
    if (data?.title && (force || !editingItem.value.title)) editingItem.value.title = data.title
    if (data?.artist && (force || !editingItem.value.artist)) editingItem.value.artist = data.artist
    if (typeof data?.lengthMs === 'number') {
      editingItem.value.lengthMs = data.lengthMs
      editingSongLengthInput.value = formatLength(data.lengthMs)
    }
  } catch { lookupError.value = t('voting.lookupFailed') }
  finally { isLookingUp.value = false }
}

function onSpotifyPaste() { setTimeout(() => lookupSpotify(false), 100) }

async function saveItemEdit() {
  isSaving.value = true
  try {
    const parsedLengthMs = parseLengthToMs(editingSongLengthInput.value)
    await songsStore.updateSong(editingItem.value.id, {
      title: editingItem.value.title,
      artist: editingItem.value.artist,
      spotifyUrl: editingItem.value.spotifyUrl,
      youtubeUrl: editingItem.value.youtubeUrl,
      lengthMs: parsedLengthMs ?? editingItem.value.lengthMs,
      bpm: normalizeBpmValue(editingItem.value.bpm),
      tags: normalizeTagList(editingItem.value.tags),
      pitch: editingItem.value.pitch,
      notes: editingItem.value.notes,
    } as any)

    // Save personal note if changed
    const currentNote = getPersonalNote(editingItem.value.id)
    if (editingItemPersonalNote.value !== currentNote) {
      await apiJson('/songs/notes', { method: 'POST', body: JSON.stringify({ songId: editingItem.value.id, content: editingItemPersonalNote.value }) })
    }

    showEditModal.value = false
    await refreshAll()
  } catch { $q.notify({ message: t('setlist.failedSave'), color: 'negative' }) }
  finally { isSaving.value = false }
}

// Export
function handleExport() {
  import('xlsx').then(async ({ utils }) => {
    const data = filteredSongs.value.map((item, idx) => {
      if (item.type === 'song') {
        return {
          '#': idx + 1,
          Title: item.title,
          Artist: item.artist,
          Length: item.lengthMs ? formatDuration(item.lengthMs) : '',
          BPM: typeof item.bpm === 'number' ? item.bpm : '',
          Tags: (item.tags ?? []).join(', '),
          Pitch: item.pitch !== 0 ? (item.pitch > 0 ? '+' : '') + item.pitch : '',
          Notes: item.notes || '',
          'Personal Note': getPersonalNote(item.id),
        }
      }
      return { '#': idx + 1, Title: item.title, Artist: `[${item.type.toUpperCase()}]`, Pitch: '', Notes: item.notes || '', 'Personal Note': '' }
    })
    const ws = utils.json_to_sheet(data)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Setlist')
    try {
      await exportXlsx(wb, `bandstr_setlist_${new Date().toISOString().split('T')[0]}.xlsx`)
    } catch (e: any) {
      if (!isShareCancellation(e)) {
        $q.notify({ message: 'Failed to export Excel file.', color: 'negative' })
      }
    }
  })
}

// Print & Export Dialog
const showPrintExportModal = ref(false)
const exportPreset = ref<'standard' | 'drummer' | 'guitar' | 'all'>('standard')
const selectedExportColumns = ref({
  artist: true,
  bpm: true,
  tuning: false,
  pitch: false,
  notes: false,
  length: true,
})

function applyExportPreset(preset: 'standard' | 'drummer' | 'guitar' | 'all') {
  exportPreset.value = preset
  if (preset === 'standard') {
    selectedExportColumns.value = { artist: true, bpm: true, tuning: false, pitch: false, notes: false, length: true }
  } else if (preset === 'drummer') {
    selectedExportColumns.value = { artist: false, bpm: true, tuning: false, pitch: false, notes: true, length: false }
  } else if (preset === 'guitar') {
    selectedExportColumns.value = { artist: false, bpm: false, tuning: true, pitch: true, notes: false, length: false }
  } else if (preset === 'all') {
    selectedExportColumns.value = { artist: true, bpm: true, tuning: true, pitch: true, notes: true, length: true }
  }
}

const exportPresets = computed(() => [
  { label: t('setlist.presetStandard'), value: 'standard' },
  { label: t('setlist.presetDrummer'), value: 'drummer' },
  { label: t('setlist.presetGuitar'), value: 'guitar' },
  { label: t('setlist.presetAll'), value: 'all' },
])

const exportColumnsList = computed<SetlistExportColumn[]>(() => {
  const cols: SetlistExportColumn[] = [{ key: 'title', label: t('voting.songTitle') }]
  if (selectedExportColumns.value.artist) cols.push({ key: 'artist', label: t('voting.artist') })
  if (selectedExportColumns.value.bpm) cols.push({ key: 'bpm', label: t('setlist.bpm') })
  if (selectedExportColumns.value.tuning) cols.push({ key: 'tuning', label: t('setlist.tuning') })
  if (selectedExportColumns.value.pitch) cols.push({ key: 'pitch', label: t('setlist.pitch') })
  if (selectedExportColumns.value.notes) cols.push({ key: 'notes', label: t('setlist.notes') })
  if (selectedExportColumns.value.length) cols.push({ key: 'length', label: t('voting.lengthLabel') })
  return cols
})

const previewItems = computed(() => {
  let songIdx = 1
  return filteredSongs.value.map((s) => {
    const isSong = s.type === 'song'
    const tuning = (s.tags ?? []).find(
      (t) =>
        t.toLowerCase().includes('drop') ||
        t.toLowerCase().includes('tuning') ||
        t.toLowerCase().includes('eb') ||
        t.toLowerCase().includes('standard')
    ) || null

    return {
      ...s,
      songIndex: isSong ? songIdx++ : null,
      tuning,
      personalNote: getPersonalNote(s.id),
    }
  })
})

function buildExportData(): SetlistExportData {
  const band = authStore.activeBand
  const bandName = band?.name || 'bandstr'

  let gigTitle = t('setlist.masterSetlist')
  let gigDate = ''
  let gigTime = ''
  let gigLocation = ''
  let gigNotes = ''

  if (selectedGigId.value && selectedGigMeta.value) {
    gigTitle = selectedGigMeta.value.title
    gigDate = selectedGigMeta.value.gigDate
    gigTime = selectedGigMeta.value.gigTime
    gigLocation = selectedGigMeta.value.location
    gigNotes = selectedGigMeta.value.notes
  } else if (selectedSetlistMode.value === 'user') {
    gigTitle = t('setlist.userSetlist')
  }

  const items: SetlistExportItem[] = filteredSongs.value.map((s) => ({
    id: s.id,
    title: s.title,
    artist: s.artist,
    type: s.type,
    bpm: s.bpm,
    pitch: s.pitch,
    notes: s.notes,
    lengthMs: s.lengthMs,
    tuning: (s.tags ?? []).find(
      (t) =>
        t.toLowerCase().includes('drop') ||
        t.toLowerCase().includes('tuning') ||
        t.toLowerCase().includes('eb') ||
        t.toLowerCase().includes('standard')
    ) || null,
    personalNote: getPersonalNote(s.id),
  }))

  return {
    bandName,
    gigTitle,
    gigDate,
    gigTime,
    gigLocation,
    gigNotes,
    totalDurationMs: totalDurationMs.value,
    columns: exportColumnsList.value,
    items,
  }
}

const exportingPdf = ref(false)
const exportingDocx = ref(false)
const isExporting = computed(() => exportingPdf.value || exportingDocx.value)

function getExportFilename(extension: 'pdf' | 'docx'): string {
  const data = buildExportData()
  const cleanTitle = (data.gigTitle || 'Setlist').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
  const dateStr = data.gigDate || new Date().toISOString().split('T')[0]
  return `${cleanTitle}_${dateStr}.${extension}`
}

async function handleDownloadPdf() {
  exportingPdf.value = true
  try {
    const data = buildExportData()
    const success = await exportPdf(data, getExportFilename('pdf'))
    if (success) {
      $q.notify({ message: 'PDF exportiert', color: 'positive' })
    }
  } catch (e: any) {
    if (!isShareCancellation(e)) {
      $q.notify({ message: e.message || 'PDF Export fehlgeschlagen', color: 'negative' })
    }
  } finally {
    exportingPdf.value = false
  }
}

async function handleDownloadDocx() {
  exportingDocx.value = true
  try {
    const data = buildExportData()
    const success = await exportDocx(data, getExportFilename('docx'))
    if (success) {
      $q.notify({ message: 'Word (.docx) exportiert', color: 'positive' })
    }
  } catch (e: any) {
    if (!isShareCancellation(e)) {
      $q.notify({ message: e.message || 'DOCX Export fehlgeschlagen', color: 'negative' })
    }
  } finally {
    exportingDocx.value = false
  }
}

function handlePrint() {
  window.print()
}

function openPrintExportModal() {
  showPrintExportModal.value = true
}

function formatPitch(pitch: number | null | undefined): string {
  if (typeof pitch !== 'number' || pitch === 0) return '-'
  return (pitch > 0 ? '+' : '') + pitch
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
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

function formatLength(ms: number | null): string {
  if (typeof ms !== 'number' || ms < 0) return ''
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function normalizeAddSongLengthInput() {
  const ms = parseLengthToMs(addSongLengthInput.value)
  if (ms !== null) addSongLengthInput.value = formatLength(ms)
}

function normalizeEditingSongLengthInput() {
  const ms = parseLengthToMs(editingSongLengthInput.value)
  if (ms !== null) editingSongLengthInput.value = formatLength(ms)
}

function normalizeTagList(rawTags: unknown): string[] {
  if (!Array.isArray(rawTags)) return []
  const tags = rawTags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean)
  return Array.from(new Set(tags))
}

function normalizeBpmValue(rawBpm: unknown): number | null {
  if (rawBpm === '' || rawBpm === null || rawBpm === undefined) return null
  const bpm = typeof rawBpm === 'number' ? rawBpm : Number(rawBpm)
  if (!Number.isFinite(bpm)) return null
  const normalized = Math.trunc(bpm)
  return normalized > 0 ? normalized : null
}

onMounted(() => {
  if (typeof route.query.q === 'string') searchQuery.value = route.query.q
  if (typeof route.query.list === 'string') {
    const raw = route.query.list
    if (raw === 'master' || raw === 'user' || raw.startsWith('gig:')) selectedListOption.value = raw
  }
  songsStore.fetchSongs()
  fetchGigs()
  fetchCalendarGigs()
  fetchUserSetlistSongs()
  fetchPersonalNotes()
})
</script>

<template>
  <q-page padding>
    <div style="max-width: 1200px; margin: 0 auto">
      <q-card flat bordered>
        <q-card-section>
          <div class="row items-center justify-between">
            <div class="text-h5 text-weight-bold">{{ t('setlist.heading') }}</div>
            <div class="row q-gutter-sm items-center">
              <q-btn v-if="selectedSetlistMode === 'master' || selectedGigId" flat round icon="note_add" @click="openSpecialModal">
                <q-tooltip>{{ t('setlist.addSetlistNote') }}</q-tooltip>
              </q-btn>
              <q-btn
                v-if="selectedSetlistMode === 'user' && !selectedGigId"
                flat
                round
                icon="add"
                @click="openAddToUserSetlistModal"
              >
                <q-tooltip>{{ t('setlist.addToUserSetlist') }}</q-tooltip>
              </q-btn>
              <q-btn flat round icon="print" @click="openPrintExportModal">
                <q-tooltip>{{ t('setlist.printExport') }}</q-tooltip>
              </q-btn>
              <q-btn flat round icon="download" @click="handleExport">
                <q-tooltip>{{ t('setlist.exportExcel') }}</q-tooltip>
              </q-btn>
              <q-btn
                v-if="isIos && (selectedSetlistMode === 'master' || selectedGigId)"
                flat
                no-caps
                color="primary"
                :icon="pIcon('add')"
                :label="selectedGigId ? t('setlist.buildSetlist') : t('common.add')"
                class="q-px-sm text-weight-medium"
                :disable="!selectedGigId && atSetlistLimit"
                @click="openAddSongModal"
              >
                <q-tooltip v-if="!selectedGigId && atSetlistLimit">
                  PRO feature — free plan is limited to {{ FREE_SETLIST_LIMIT }} songs in the master setlist
                </q-tooltip>
              </q-btn>
              <q-btn
                v-else-if="!isAndroid && (selectedSetlistMode === 'master' || selectedGigId)"
                round
                :color="!selectedGigId && atSetlistLimit ? 'grey' : 'primary'"
                icon="add"
                class="round-add-btn"
                :disable="!selectedGigId && atSetlistLimit"
                @click="openAddSongModal"
              >
                <q-tooltip v-if="!selectedGigId && atSetlistLimit">
                  PRO feature — free plan is limited to {{ FREE_SETLIST_LIMIT }} songs in the master setlist
                </q-tooltip>
              </q-btn>
            </div>
          </div>
        </q-card-section>

        <q-card-section>
          <SegmentedControl
            v-if="!selectedGigId && selectedSetlistMode === 'master'"
            v-model="currentTab"
            :options="setlistTabOptions"
            class="q-mb-md"
          />

          <div class="row q-gutter-sm q-mb-md items-center">
            <q-input v-model="searchQuery" dense outlined :placeholder="t('setlist.filterTitle')" class="col" clearable>
              <template #prepend><q-icon name="search" /></template>
            </q-input>
            <q-select
              v-model="selectedListOption"
              :options="filteredListOptions"
              use-input
              input-debounce="0"
              @filter="filterListOptions"
              emit-value
              map-options
              dense
              outlined
              class="setlist-select"
              style="min-width: 196px"
            >
              <template #option="scope">
                <q-item v-bind="scope.itemProps" :class="{ 'text-primary text-weight-medium': scope.opt.value === 'new_gig' }">
                  <q-item-section v-if="scope.opt.value === 'new_gig'" avatar style="min-width: 28px; padding-right: 8px">
                    <q-icon name="add" color="primary" size="xs" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
              <template #no-option>
                <q-item>
                  <q-item-section class="text-grey">
                    {{ t('common.noResults') }}
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-select
              v-if="!selectedGigId && selectedSetlistMode === 'master'"
              v-model="selectedTagFilters"
              :options="availableTagOptions"
              multiple
              use-input
              use-chips
              hide-dropdown-icon
              new-value-mode="add-unique"
              outlined
              dense
              style="min-width: 260px"
              :label="t('setlist.filterTags')"
            />
          </div>
          <div v-if="selectedGigId && selectedGigMeta" class="q-mb-md q-pa-md rounded-borders bg-widget-surface border-subtle">
            <div class="row q-col-gutter-sm q-mb-sm">
              <div class="col-12 col-md-4">
                <q-input v-model="selectedGigMeta.title" :label="t('common.title')" outlined dense />
              </div>
              <div class="col-12 col-md-4">
                <q-select
                  v-model="selectedGigMeta.calendarEventId"
                  :options="filteredCalendarGigLinkOptions"
                  use-input
                  input-debounce="0"
                  @filter="filterCalendarGigOptions"
                  emit-value
                  map-options
                  outlined
                  dense
                  clearable
                  :label="t('setlist.linkCalendarGig')"
                >
                  <template #no-option>
                    <q-item>
                      <q-item-section class="text-grey">
                        {{ t('common.noResults') }}
                      </q-item-section>
                    </q-item>
                  </template>
                </q-select>
              </div>
              <div class="col-12 col-md-4">
                <q-input v-model="selectedGigMeta.location" :label="t('setlist.location')" outlined dense />
              </div>
            </div>
            <div class="row q-col-gutter-sm q-mb-sm">
              <div class="col-12 col-sm-6 col-md-3">
                <q-input v-model="selectedGigMeta.gigDate" :label="t('setlist.gigDate')" outlined dense placeholder="YYYY-MM-DD" />
              </div>
              <div class="col-12 col-sm-6 col-md-3">
                <q-input v-model="selectedGigMeta.gigTime" :label="t('setlist.gigTime')" outlined dense placeholder="HH:MM" />
              </div>
              <div class="col-12 col-md-6">
                <q-input v-model="selectedGigMeta.notes" :label="t('setlist.notes')" outlined dense />
              </div>
            </div>
            <div class="row items-center justify-between q-mt-xs">
              <div class="text-caption text-grey-7">
                Songs: {{ songCount }} · Total length: {{ formatTotalDuration(totalDurationMs) }}
              </div>
              <div class="row q-gutter-xs">
                <q-btn
                  v-if="selectedGigMeta.calendarEventId"
                  outline
                  dense
                  color="primary"
                  icon="home"
                  :label="t('setlist.viewGigOnHome')"
                  @click="goToHome"
                />
                <q-btn outline dense color="secondary" icon="content_copy" :label="t('setlist.duplicateGig')" @click="duplicateGigSetlist" />
                <q-btn flat dense color="primary" icon="save" :label="t('common.save')" @click="saveGigMeta" />
                <q-btn flat dense color="negative" icon="delete" @click="deleteGigSetlist" />
              </div>
            </div>
          </div>
          <div v-else class="text-caption text-grey-7 q-mb-md">
            Songs: {{ songCount }} · Total length: {{ formatTotalDuration(totalDurationMs) }}
          </div>

          <q-list v-if="filteredSongs.length" separator>
            <q-slide-item
              v-for="(item, index) in filteredSongs"
              :key="getItemKey(item)"
              class="setlist-slide-item"
              :class="{
                'set-divider-slide': item.type === 'set',
                'encore-divider-slide': item.type === 'encore',
              }"
              :left-color="currentTab === 'archived' ? 'positive' : 'primary'"
              right-color="negative"
              @left="({ reset }) => onSwipeRight(item, reset)"
              @right="({ reset }) => onSwipeLeft(item, reset)"
            >
              <template v-if="item.type === 'song' && !selectedGigId && selectedSetlistMode === 'master'" #left>
                <div class="row items-center q-gutter-xs">
                  <q-icon :name="currentTab === 'active' ? 'how_to_vote' : 'unarchive'" size="28px" />
                </div>
              </template>
              <template v-if="item.type === 'song' && !selectedGigId && selectedSetlistMode === 'master' && currentTab === 'active'" #right>
                <div class="row items-center q-gutter-xs">
                  <q-icon name="archive" size="28px" />
                </div>
              </template>

              <q-item
                class="q-pa-sm"
                :class="{
                  'border-dashed': item.type !== 'song' && item.type !== 'set' && item.type !== 'encore',
                  'set-divider-item': item.type === 'set',
                  'encore-divider-item': item.type === 'encore',
                  'dragging-item': draggingIndex === index,
                }"
                :draggable="(!selectedGigId && selectedSetlistMode === 'master' ? currentTab === 'active' : true) && !searchQuery"
                @dragstart="onDragStart(index, $event)"
                @dragover.prevent
                @drop="onDrop(index)"
                @dragend="onDragEnd"
              >
                <!-- Reorder + Pin -->
                <q-item-section side>
                  <div class="column items-center q-gutter-xs">
                    <q-icon
                      v-if="selectedGigId || selectedSetlistMode !== 'master' || currentTab === 'active'"
                      name="drag_indicator"
                      size="sm"
                      color="grey-6"
                      class="cursor-grab"
                    />
                    <q-btn
                      v-if="selectedGigId || selectedSetlistMode !== 'master' || currentTab === 'active'"
                      flat
                      round
                      dense
                      icon="keyboard_arrow_up"
                      size="sm"
                      @click="moveItem(index, -1)"
                    />
                    <q-btn
                      v-if="selectedGigId || selectedSetlistMode !== 'master' || currentTab === 'active'"
                      flat
                      round
                      dense
                      icon="keyboard_arrow_down"
                      size="sm"
                      @click="moveItem(index, 1)"
                    />
                    <span class="text-caption text-grey">{{ index + 1 }}</span>
                    <q-btn
                      v-if="selectedGigId || selectedSetlistMode !== 'master' || currentTab === 'active'"
                      flat
                      round
                      dense
                      :icon="isPinnedItem(item) ? 'lock' : 'lock_open'"
                      :color="isPinnedItem(item) ? 'primary' : 'grey'"
                      :class="{ 'pinned-lock-btn': isPinnedItem(item) }"
                      size="sm"
                      @click="togglePin(item)"
                    />
                  </div>
                </q-item-section>

              <!-- Thumbnail (songs only) -->
              <q-item-section v-if="item.type === 'song'" side>
                <a v-if="item.spotifyUrl && item.thumbnailUrl" :href="item.spotifyUrl" target="_blank">
                  <q-avatar rounded size="48px"><img :src="item.thumbnailUrl" /></q-avatar>
                </a>
                <a v-else-if="item.youtubeUrl && getYouTubeId(item.youtubeUrl)" :href="item.youtubeUrl" target="_blank">
                  <q-avatar rounded size="48px"><img :src="`https://img.youtube.com/vi/${getYouTubeId(item.youtubeUrl)}/mqdefault.jpg`" /></q-avatar>
                </a>
                <q-avatar v-else rounded size="48px" color="grey-3"><q-icon name="music_note" color="grey" /></q-avatar>
                <div v-if="item.pitch !== 0" class="pitch-box q-mt-xs text-center text-caption text-weight-bold">
                  Pitch {{ item.pitch > 0 ? '+' : '' }}{{ item.pitch }}
                </div>
              </q-item-section>

              <!-- Content -->
              <q-item-section>
                <!-- Song content -->
                <template v-if="item.type === 'song'">
                  <q-item-label class="text-weight-bold">
                    {{ item.title }}
                    <q-icon
                      v-if="item.notes"
                      name="info"
                      color="grey"
                      size="xs"
                      class="cursor-pointer q-ml-xs"
                      @click="showNote(t('setlist.notes') + ': ' + item.title, item.notes)"
                    />
                    <q-icon v-if="getPersonalNote(item.id)" name="person" color="primary" size="xs" class="cursor-pointer q-ml-xs" @click="showNote(t('setlist.personalNotes') + ': ' + item.title, getPersonalNote(item.id))">
                      <q-tooltip>{{ t('setlist.personalNotes') }}</q-tooltip>
                    </q-icon>
                  </q-item-label>
                  <q-item-label caption>{{ item.artist }}</q-item-label>
                  <q-item-label v-if="typeof item.bpm === 'number'" caption>
                    {{ t('setlist.bpm') }}: {{ item.bpm }}
                  </q-item-label>
                  <div v-if="item.tags?.length" class="row q-gutter-xs q-mt-xs">
                    <q-chip
                      v-for="tag in item.tags"
                      :key="`${item.id}-tag-${tag}`"
                      dense
                      square
                      size="sm"
                      color="grey-3"
                      text-color="grey-9"
                    >
                      {{ tag }}
                    </q-chip>
                  </div>
                  <div class="row q-gutter-xs q-mt-xs">
                    <a v-if="item.spotifyUrl" :href="item.spotifyUrl" target="_blank" class="text-green text-caption text-weight-bold" style="text-decoration:none">Spotify</a>
                    <a v-if="item.youtubeUrl" :href="item.youtubeUrl" target="_blank" class="text-red text-caption text-weight-bold" style="text-decoration:none">YouTube</a>
                  </div>
                  <q-item-label caption v-if="item.lengthMs">
                    Length: {{ formatDuration(item.lengthMs) }}
                  </q-item-label>
                </template>

                <!-- Set divider -->
                <template v-else-if="item.type === 'set'">
                  <div class="row items-center q-gutter-sm text-primary text-weight-bold text-subtitle1">
                    <q-icon name="layers" size="sm" />
                    <span>{{ item.title }}</span>
                    <q-icon v-if="item.notes" name="info" color="primary" size="xs" class="cursor-pointer q-ml-xs" @click="showNote(item.title, item.notes)" />
                  </div>
                </template>

                <!-- Encore divider -->
                <template v-else-if="item.type === 'encore'">
                  <div class="row items-center q-gutter-sm text-deep-orange text-weight-bold text-subtitle1">
                    <q-icon name="celebration" size="sm" />
                    <span>{{ item.title }}</span>
                    <q-icon v-if="item.notes" name="info" color="deep-orange" size="xs" class="cursor-pointer q-ml-xs" @click="showNote(item.title, item.notes)" />
                  </div>
                </template>

                <!-- Pause content -->
                <template v-else-if="item.type === 'pause'">
                  <q-item-label class="text-grey text-italic">
                    <q-icon name="pause_circle" class="q-mr-xs" />
                    {{ item.title }}
                    <q-icon v-if="item.notes" name="info" color="grey" size="xs" class="cursor-pointer q-ml-xs" @click="showNote(item.title, item.notes)" />
                  </q-item-label>
                </template>

                <!-- Tuning content -->
                <template v-else-if="item.type === 'tuning'">
                  <q-item-label class="text-orange text-italic">
                    <q-icon name="tune" class="q-mr-xs" />
                    {{ item.title }}
                    <q-icon v-if="item.notes" name="info" color="orange" size="xs" class="cursor-pointer q-ml-xs" @click="showNote(item.title, item.notes)" />
                  </q-item-label>
                </template>

                <!-- Generic note content -->
                <template v-else>
                  <q-item-label class="text-blue text-italic">
                    <q-icon name="sticky_note_2" class="q-mr-xs" />
                    {{ item.title }}
                    <q-icon v-if="item.notes" name="info" color="blue" size="xs" class="cursor-pointer q-ml-xs" @click="showNote(item.title, item.notes)" />
                  </q-item-label>
                </template>
              </q-item-section>

              <!-- Actions -->
              <q-item-section side>
                <div class="row q-gutter-xs">
                  <q-btn v-if="canModifySong(item)" flat round dense icon="edit" size="sm" @click="openEditModal(item)" />
                  <q-btn
                    v-if="!selectedGigId && selectedSetlistMode === 'master'"
                    flat
                    round
                    dense
                    icon="delete"
                    color="red"
                    size="sm"
                    @click="deleteSong(item)"
                  >
                    <q-tooltip>{{ t('common.delete') }}</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-else-if="selectedGigId"
                    flat
                    round
                    dense
                    icon="playlist_remove"
                    color="red"
                    size="sm"
                    @click="removeFromSetlist(item)"
                  >
                    <q-tooltip>Remove from Gig Setlist</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-else-if="item.type === 'song' && !selectedGigId && selectedSetlistMode === 'user'"
                    flat
                    round
                    dense
                    icon="playlist_remove"
                    color="red"
                    size="sm"
                    @click="removeFromSetlist(item)"
                  >
                    <q-tooltip>{{ t('setlist.removeFromUserSetlist') }}</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-if="item.type === 'song' && !selectedGigId && selectedSetlistMode === 'master'"
                    flat
                    round
                    dense
                    :icon="isInUserSetlist(item.id) ? 'playlist_add_check' : 'playlist_add'"
                    color="primary"
                    size="sm"
                    @click="toggleUserSetlist(item)"
                  >
                    <q-tooltip>{{ isInUserSetlist(item.id) ? t('setlist.removeFromUserSetlist') : t('setlist.addToUserSetlist') }}</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-if="item.type !== 'song' && !selectedGigId"
                    flat
                    round
                    dense
                    icon="close"
                    color="red"
                    size="sm"
                    @click="removeFromSetlist(item)"
                  />
                </div>
              </q-item-section>
            </q-item>
          </q-slide-item>
        </q-list>

        <q-banner v-else rounded class="bg-widget-surface">
          {{ !selectedGigId && selectedSetlistMode === 'master' && currentTab === 'archived' ? t('setlist.noArchivedSongs') : t('setlist.noItems') }}
        </q-banner>
        </q-card-section>
      </q-card>
    </div>

    <!-- Add Song to Master Setlist Dialog -->
    <q-dialog v-model="showAddSongModal" :position="isIos ? 'bottom' : 'standard'">
      <q-card style="min-width: 450px">
        <div v-if="isIos" class="ios-sheet-grabber" />
        <q-card-section class="row items-center">
          <div class="text-h6">{{ t('setlist.addSongTitle') }}</div>
          <q-space /><q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <div class="row q-gutter-sm">
            <q-input v-model="addSongForm.spotifyUrl" :label="t('voting.spotifyUrl')" outlined dense class="col" @paste="onAddSpotifyPaste" />
            <q-btn color="green" icon="search" :loading="addSongLookingUp" :disable="!addSongForm.spotifyUrl" @click="lookupSpotifyForAdd(true)">{{ t('voting.spotifyLookup') }}</q-btn>
          </div>
          <div v-if="addSongLookupError" class="text-red text-caption">{{ addSongLookupError }}</div>
          <q-input v-model="addSongForm.title" :label="t('voting.songTitle')" outlined dense autofocus />
          <q-input v-model="addSongForm.artist" :label="t('voting.artist')" outlined dense />
          <q-input
            v-model="addSongLengthInput"
            label="Length (mm:ss)"
            hint="Example: 3:45"
            outlined
            dense
            @blur="normalizeAddSongLengthInput"
          />
          <q-input
            v-model.number="addSongForm.bpm"
            :label="t('setlist.bpm')"
            type="number"
            min="1"
            step="1"
            outlined
            dense
          />
          <q-input v-model="addSongForm.youtubeUrl" :label="t('voting.youtubeUrl')" outlined dense />
          <div class="row items-center q-gutter-md">
            <span class="text-caption">{{ t('setlist.pitchShift') }}</span>
            <q-slider v-model="addSongForm.pitch" :min="-5" :max="5" :step="1" snap label class="col" :disable="authStore.isFreePlan" />
            <q-badge color="grey-8" class="text-body2">
              {{ addSongForm.pitch > 0 ? '+' : '' }}{{ addSongForm.pitch }}
            </q-badge>
            <q-badge v-if="authStore.isFreePlan" color="orange" label="PRO feature" />
          </div>
          <div class="row items-center q-gutter-sm">
            <q-input
              v-model="addSongForm.notes"
              :label="t('setlist.notes')"
              :hint="t('setlist.markdownHint')"
              type="textarea"
              outlined
              dense
              autogrow
              :input-style="{ minHeight: '140px' }"
              :disable="authStore.isFreePlan"
              class="col"
            />
            <q-badge v-if="authStore.isFreePlan" color="orange" label="PRO feature" />
          </div>
          <q-select
            v-model="addSongForm.tags"
            :options="availableTagOptions"
            multiple
            use-input
            use-chips
            hide-dropdown-icon
            new-value-mode="add-unique"
            outlined
            dense
            :label="t('setlist.tags')"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.cancel')" v-close-popup />
          <q-btn color="primary" :label="t('common.add')" :loading="isSaving" @click="submitAddSong" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Gig Setlist Builder Dialog -->
    <q-dialog v-model="showGigBuilderModal" full-width>
      <q-card class="gig-builder-card">
        <q-card-section class="row items-center">
          <div class="text-h6">{{ t('setlist.editGigSetlist') }}</div>
          <q-space /><q-btn flat round dense icon="close" @click="cancelGigBuilder" />
        </q-card-section>
        <q-card-section class="gig-builder-body">
          <div class="gig-builder-target q-pa-sm rounded-borders bg-widget-surface">
            <div class="text-subtitle2 text-weight-bold q-mb-sm">{{ t('setlist.gigSetlistCurrent') }}</div>
            <q-list v-if="gigBuilderDraftItems.length" separator>
              <q-item v-for="(item, index) in gigBuilderDraftItems" :key="`${item.id}-${index}`" dense>
                <q-item-section side class="text-caption text-grey">{{ index + 1 }}</q-item-section>
                <q-item-section>
                  <q-item-label class="text-weight-medium">{{ item.title }}</q-item-label>
                  <q-item-label caption>{{ item.artist }} · {{ formatGigBuilderType(item.type) }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-btn flat round dense icon="remove_circle" color="negative" @click="removeFromGigBuilder(item.id)" />
                </q-item-section>
              </q-item>
            </q-list>
            <div v-else class="text-grey text-italic">{{ t('setlist.noItems') }}</div>
          </div>

          <div class="gig-builder-source q-mt-md">
            <div class="row q-gutter-sm items-center q-mb-sm">
              <div class="text-subtitle2 text-weight-bold">{{ t('setlist.masterSetlist') }}</div>
              <q-space />
              <q-input
                v-model="gigBuilderSearch"
                dense
                outlined
                clearable
                :placeholder="t('setlist.filterTitle')"
                style="min-width: 240px"
              >
                <template #prepend><q-icon name="search" /></template>
              </q-input>
            </div>
            <q-list v-if="filteredGigBuilderSourceItems.length" separator bordered class="rounded-borders">
              <q-item v-for="item in filteredGigBuilderSourceItems" :key="`master-${item.id}`" dense>
                <q-item-section>
                  <q-item-label>{{ item.title }}</q-item-label>
                  <q-item-label caption>{{ item.artist }} · {{ formatGigBuilderType(item.type) }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-btn flat round dense icon="playlist_add" color="primary" @click="addToGigBuilder(item)" />
                </q-item-section>
              </q-item>
            </q-list>
            <div v-else class="text-grey text-italic text-center q-pa-md">{{ t('setlist.noItems') }}</div>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.cancel')" @click="cancelGigBuilder" />
          <q-btn color="primary" :label="t('common.ok')" :loading="isSaving" @click="confirmGigBuilder" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Add Songs to User Setlist Dialog -->
    <q-dialog v-model="showAddUserSetlistModal" :position="isIos ? 'bottom' : 'standard'">
      <q-card class="song-picker-card">
        <div v-if="isIos" class="ios-sheet-grabber" />
        <q-card-section class="row items-center">
          <div class="text-h6">{{ t('setlist.addToUserSetlist') }}</div>
          <q-space /><q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section class="song-picker-body">
          <div class="song-picker-search">
            <q-select
              v-model="selectedUserSetlistSongIds"
              :options="availableUserSetlistSongOptions"
              emit-value
              map-options
              multiple
              use-input
              input-debounce="0"
              use-chips
              outlined
              dense
              :label="t('setlist.selectSongs')"
              option-label="label"
              option-value="value"
              popup-content-class="song-picker-options-popup"
            />
          </div>
          <div class="row q-gutter-sm q-mt-sm">
            <q-btn flat dense size="sm" :label="t('setlist.selectAll')" @click="selectedUserSetlistSongIds = availableUserSetlistSongOptions.map(o => o.value)" />
            <q-btn flat dense size="sm" :label="t('setlist.selectNone')" @click="selectedUserSetlistSongIds = []" />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.cancel')" v-close-popup />
          <q-btn color="primary" :label="t('common.add')" :loading="isSaving" :disable="!selectedUserSetlistSongIds.length" @click="submitAddUserSetlistSongs" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Note Viewer Dialog -->
    <q-dialog v-model="showNoteModal" :position="isIos ? 'bottom' : 'standard'">
      <q-card style="min-width: 400px">
        <div v-if="isIos" class="ios-sheet-grabber" />
        <q-card-section class="row items-center">
          <div class="text-h6">{{ noteModalTitle }}</div>
          <q-space /><q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section>
          <Markdown v-if="noteModalContent" :content="noteModalContent" />
          <div v-else class="text-grey text-italic text-center q-pa-lg">{{ t('setlist.emptyNote') }}</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.close')" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Edit Song Dialog -->
    <q-dialog v-model="showEditModal" :position="isIos ? 'bottom' : 'standard'">
      <q-card v-if="editingItem" style="min-width: 450px">
        <div v-if="isIos" class="ios-sheet-grabber" />
        <q-card-section class="row items-center">
          <div class="text-h6">{{ t('setlist.editSong') }}: {{ editingItem.title }}</div>
          <q-space /><q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <template v-if="editingItem.type === 'song'">
            <div class="row q-gutter-sm">
              <q-input v-model="editingItem.spotifyUrl" :label="t('voting.spotifyUrl')" outlined dense class="col" @paste="onSpotifyPaste" />
              <q-btn color="green" icon="search" :loading="isLookingUp" :disable="!editingItem.spotifyUrl" @click="lookupSpotify(true)">{{ t('voting.spotifyLookup') }}</q-btn>
            </div>
            <div v-if="lookupError" class="text-red text-caption">{{ lookupError }}</div>
            <q-input v-model="editingItem.title" :label="t('voting.songTitle')" outlined dense />
            <q-input v-model="editingItem.artist" :label="t('voting.artist')" outlined dense />
            <q-input
              v-model="editingSongLengthInput"
              label="Length (mm:ss)"
              hint="Example: 3:45"
              outlined
              dense
              @blur="normalizeEditingSongLengthInput"
            />
            <q-input
              v-model.number="editingItem.bpm"
              :label="t('setlist.bpm')"
              type="number"
              min="1"
              step="1"
              outlined
              dense
            />
            <q-input v-model="editingItem.youtubeUrl" :label="t('voting.youtubeUrl')" outlined dense />
            <div class="row items-center q-gutter-md">
              <span class="text-caption">{{ t('setlist.pitchShift') }}</span>
              <q-slider v-model="editingItem.pitch" :min="-5" :max="5" :step="1" snap label class="col" :disable="authStore.isFreePlan" />
              <q-badge color="grey-8" class="text-body2">{{ editingItem.pitch > 0 ? '+' : '' }}{{ editingItem.pitch }}</q-badge>
              <q-badge v-if="authStore.isFreePlan" color="orange" label="PRO feature" />
            </div>
          </template>
          <div class="row items-center q-gutter-sm">
            <q-input
              v-model="editingItem.notes"
              :label="t('setlist.notes')"
              :hint="t('setlist.markdownHint')"
              type="textarea"
              outlined
              dense
              autogrow
              :input-style="{ minHeight: '160px' }"
              :disable="authStore.isFreePlan"
              class="col"
            />
            <q-badge v-if="authStore.isFreePlan" color="orange" label="PRO feature" />
          </div>
          <div class="row items-center q-gutter-sm">
            <q-input
              v-model="editingItemPersonalNote"
              :label="t('setlist.personalNotes')"
              :hint="`${t('setlist.personalNotesHint')} ${t('setlist.markdownHint')}`"
              type="textarea"
              outlined
              dense
              autogrow
              :input-style="{ minHeight: '200px' }"
              :disable="authStore.isFreePlan"
              class="col"
            />
            <q-badge v-if="authStore.isFreePlan" color="orange" label="PRO feature" />
          </div>
          <q-select
            v-model="editingItem.tags"
            :options="availableTagOptions"
            multiple
            use-input
            use-chips
            hide-dropdown-icon
            new-value-mode="add-unique"
            outlined
            dense
            :label="t('setlist.tags')"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.cancel')" v-close-popup />
          <q-btn color="primary" :label="t('common.save')" :loading="isSaving" @click="saveItemEdit" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Setlist Note Dialog -->
    <q-dialog v-model="showSpecialModal">
      <q-card v-if="specialElementForm" style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">{{ t('setlist.addSetlistNote') }}</div>
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-select
            v-model="specialElementForm.noteType"
            :options="specialNoteTypeOptions"
            emit-value
            map-options
            outlined
            dense
            :label="t('setlist.noteType')"
            @update:model-value="applySpecialTypePreset"
          />
          <q-input v-model="specialElementForm.title" :label="t('common.title')" outlined dense autofocus />
          <q-input v-model="specialElementForm.notes" :label="t('voting.notes')" type="textarea" outlined dense autogrow />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.cancel')" v-close-popup />
          <q-btn color="primary" :label="t('common.add')" :loading="isSaving" @click="submitSpecialElement" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Print & Export Dialog -->
    <q-dialog v-model="showPrintExportModal" maximized transition-show="slide-up" transition-hide="slide-down">
      <q-card class="bg-surface column full-height">
        <q-toolbar class="bg-primary text-white no-print">
          <q-toolbar-title class="row items-center q-gutter-sm">
            <q-icon name="print" />
            <span>{{ t('setlist.printExport') }}</span>
          </q-toolbar-title>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-toolbar>

        <!-- Top Controls / Toolbar -->
        <q-card-section class="bg-surface q-py-sm shadow-1 no-print border-bottom-subtle">
          <div class="row items-center justify-between q-col-gutter-md">
            <!-- Presets -->
            <div class="col-12 col-lg-auto row items-center q-gutter-sm">
              <span class="text-caption text-weight-bold">Presets:</span>
              <q-btn-toggle
                v-model="exportPreset"
                toggle-color="primary"
                flat
                dense
                rounded
                :options="exportPresets"
                @update:model-value="applyExportPreset"
              />
            </div>

            <!-- Column Checkboxes -->
            <div class="col-12 col-lg-auto row items-center q-gutter-sm">
              <span class="text-caption text-weight-bold">{{ t('setlist.columns') }}:</span>
              <q-checkbox v-model="selectedExportColumns.artist" :label="t('voting.artist')" dense size="sm" />
              <q-checkbox v-model="selectedExportColumns.bpm" label="BPM" dense size="sm" />
              <q-checkbox v-model="selectedExportColumns.tuning" :label="t('setlist.tuning')" dense size="sm" />
              <q-checkbox v-model="selectedExportColumns.pitch" :label="t('setlist.pitch')" dense size="sm" />
              <q-checkbox v-model="selectedExportColumns.notes" :label="t('setlist.notes')" dense size="sm" />
              <q-checkbox v-model="selectedExportColumns.length" :label="t('voting.lengthLabel')" dense size="sm" />
            </div>

            <!-- Export Buttons -->
            <div class="col-12 col-lg-auto row items-center q-gutter-sm">
              <q-btn
                color="secondary"
                icon="description"
                :label="t('setlist.exportDocx')"
                :loading="exportingDocx"
                no-caps
                dense
                @click="handleDownloadDocx"
              />
              <q-btn
                color="primary"
                icon="picture_as_pdf"
                :label="t('setlist.exportPdf')"
                :loading="exportingPdf"
                no-caps
                dense
                @click="handleDownloadPdf"
              />
              <q-btn
                color="grey-9"
                icon="print"
                :label="t('setlist.print')"
                no-caps
                dense
                @click="handlePrint"
              />
            </div>
          </div>
        </q-card-section>

        <!-- Preview / Printable Area -->
        <q-card-section class="col overflow-auto q-pa-md flex justify-center bg-widget-surface">
          <div class="print-sheet-area bg-white text-black shadow-3 q-pa-lg">
            <!-- Header -->
            <div class="row items-center justify-between q-pb-md border-bottom-dark">
              <div>
                <div class="text-h5 text-weight-bolder">
                  {{ selectedGigId && selectedGigMeta ? selectedGigMeta.title : (selectedSetlistMode === 'user' ? t('setlist.userSetlist') : t('setlist.masterSetlist')) }}
                </div>
                <div class="text-subtitle2 text-grey-8">
                  {{ authStore.activeBand?.name || 'bandstr' }}
                  <span class="q-ml-sm text-caption">· {{ filteredSongs.filter((s) => s.type === 'song').length }} Songs ({{ formatTotalDuration(totalDurationMs) }})</span>
                </div>
              </div>
              <div v-if="selectedGigId && selectedGigMeta" class="text-right text-caption">
                <div v-if="selectedGigMeta.gigDate" class="text-weight-bold">
                  {{ selectedGigMeta.gigDate }} <span v-if="selectedGigMeta.gigTime">@ {{ selectedGigMeta.gigTime }}</span>
                </div>
                <div v-if="selectedGigMeta.location" class="text-grey-8">
                  📍 {{ selectedGigMeta.location }}
                </div>
              </div>
            </div>

            <!-- Gig Notes (if any) -->
            <div v-if="selectedGigId && selectedGigMeta?.notes" class="q-my-sm q-pa-sm bg-grey-2 rounded-borders text-caption">
              <strong>Notes:</strong> {{ selectedGigMeta.notes }}
            </div>

            <!-- Printable Table -->
            <table class="print-table q-mt-md full-width">
              <thead>
                <tr>
                  <th style="width: 40px; text-align: center">#</th>
                  <th style="text-align: left">{{ t('voting.songTitle') }}</th>
                  <th v-if="selectedExportColumns.artist" style="text-align: left">{{ t('voting.artist') }}</th>
                  <th v-if="selectedExportColumns.bpm" style="width: 70px; text-align: center">{{ t('setlist.bpm') }}</th>
                  <th v-if="selectedExportColumns.tuning" style="width: 90px; text-align: center">{{ t('setlist.tuning') }}</th>
                  <th v-if="selectedExportColumns.pitch" style="width: 70px; text-align: center">{{ t('setlist.pitch') }}</th>
                  <th v-if="selectedExportColumns.notes" style="text-align: left">{{ t('setlist.notes') }}</th>
                  <th v-if="selectedExportColumns.length" style="width: 70px; text-align: right">{{ t('voting.lengthLabel') }}</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="(item, idx) in previewItems" :key="item.id || idx">
                  <!-- Set Divider -->
                  <tr v-if="item.type === 'set'" class="divider-row set-divider">
                    <td :colspan="2 + (selectedExportColumns.artist ? 1 : 0) + (selectedExportColumns.bpm ? 1 : 0) + (selectedExportColumns.tuning ? 1 : 0) + (selectedExportColumns.pitch ? 1 : 0) + (selectedExportColumns.notes ? 1 : 0) + (selectedExportColumns.length ? 1 : 0)">
                      <div class="row items-center q-gutter-xs text-weight-bold">
                        <span>▶ {{ item.title.toUpperCase() }}</span>
                        <span v-if="item.notes" class="text-caption text-weight-normal text-grey-8 q-ml-sm">({{ item.notes }})</span>
                      </div>
                    </td>
                  </tr>

                  <!-- Encore Divider -->
                  <tr v-else-if="item.type === 'encore'" class="divider-row encore-divider">
                    <td :colspan="2 + (selectedExportColumns.artist ? 1 : 0) + (selectedExportColumns.bpm ? 1 : 0) + (selectedExportColumns.tuning ? 1 : 0) + (selectedExportColumns.pitch ? 1 : 0) + (selectedExportColumns.notes ? 1 : 0) + (selectedExportColumns.length ? 1 : 0)">
                      <div class="row items-center q-gutter-xs text-weight-bold">
                        <span>★ {{ item.title.toUpperCase() }}</span>
                        <span v-if="item.notes" class="text-caption text-weight-normal text-grey-8 q-ml-sm">({{ item.notes }})</span>
                      </div>
                    </td>
                  </tr>

                  <!-- Pause Divider -->
                  <tr v-else-if="item.type === 'pause'" class="divider-row pause-divider">
                    <td :colspan="2 + (selectedExportColumns.artist ? 1 : 0) + (selectedExportColumns.bpm ? 1 : 0) + (selectedExportColumns.tuning ? 1 : 0) + (selectedExportColumns.pitch ? 1 : 0) + (selectedExportColumns.notes ? 1 : 0) + (selectedExportColumns.length ? 1 : 0)">
                      <div class="row items-center q-gutter-xs text-weight-bold text-italic">
                        <span>⏸ {{ item.title }}</span>
                        <span v-if="item.notes" class="text-caption text-weight-normal text-grey-8 q-ml-sm">({{ item.notes }})</span>
                      </div>
                    </td>
                  </tr>

                  <!-- Tuning / Note Row -->
                  <tr v-else-if="item.type === 'tuning' || item.type === 'note'" class="divider-row note-divider">
                    <td :colspan="2 + (selectedExportColumns.artist ? 1 : 0) + (selectedExportColumns.bpm ? 1 : 0) + (selectedExportColumns.tuning ? 1 : 0) + (selectedExportColumns.pitch ? 1 : 0) + (selectedExportColumns.notes ? 1 : 0) + (selectedExportColumns.length ? 1 : 0)">
                      <div class="text-italic text-grey-8">
                        <span>{{ item.title }}</span>
                        <span v-if="item.notes" class="q-ml-sm">— {{ item.notes }}</span>
                      </div>
                    </td>
                  </tr>

                  <!-- Regular Song -->
                  <tr v-else class="song-row">
                    <td class="text-center text-weight-medium">{{ item.songIndex }}</td>
                    <td class="text-weight-bold">{{ item.title }}</td>
                    <td v-if="selectedExportColumns.artist" class="text-grey-9">{{ item.artist || '-' }}</td>
                    <td v-if="selectedExportColumns.bpm" class="text-center font-monospace">{{ item.bpm || '-' }}</td>
                    <td v-if="selectedExportColumns.tuning" class="text-center">{{ item.tuning || '-' }}</td>
                    <td v-if="selectedExportColumns.pitch" class="text-center font-monospace">{{ formatPitch(item.pitch) }}</td>
                    <td v-if="selectedExportColumns.notes" class="text-caption notes-cell">{{ item.notes || item.personalNote || '-' }}</td>
                    <td v-if="selectedExportColumns.length" class="text-right font-monospace">{{ item.lengthMs ? formatDuration(item.lengthMs) : '-' }}</td>
                  </tr>
                </template>
              </tbody>
            </table>

            <!-- Footer summary -->
            <div class="row justify-between items-center q-mt-lg text-caption text-grey-7 border-top-dark q-pt-sm">
              <div>Total Songs: {{ filteredSongs.filter((s) => s.type === 'song').length }} · Total Duration: {{ formatTotalDuration(totalDurationMs) }}</div>
              <div>Generated with bandstr</div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Android Floating Action Button (FAB) -->
    <q-page-sticky
      v-if="isAndroid && (selectedSetlistMode === 'master' || selectedGigId)"
      position="bottom-right"
      :offset="[18, 76]"
      style="z-index: 1000"
    >
      <q-btn
        fab
        icon="add"
        color="primary"
        :disable="!selectedGigId && atSetlistLimit"
        @click="openAddSongModal"
      />
    </q-page-sticky>
  </q-page>
</template>

<style lang="scss" scoped>
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

.pitch-box {
  border: 1px solid var(--q-warning);
  background: rgba(245, 158, 11, 0.14);
  color: #f59e0b;
  border-radius: 6px;
  width: 44px;
  margin: 0 auto;
  padding: 1px 2px;
  font-size: 10px;
  line-height: 1.15;
}

.dragging-item {
  opacity: 0.92;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.35) inset;
  background: rgba(59, 130, 246, 0.08);
}

.pinned-lock-btn {
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.35) inset;
  background: rgba(25, 118, 210, 0.1);
}

.gig-builder-card {
  width: min(95vw, 980px);
  max-width: 980px;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
}

.gig-builder-body {
  overflow: auto;
  min-height: 0;
}

.gig-builder-target {
  position: sticky;
  top: 0;
  z-index: 2;
  max-height: 40vh;
  overflow-y: auto;
}

.gig-builder-source {
  max-height: 45vh;
  overflow-y: auto;
}

@media (max-width: 768px) {
  .gig-builder-target {
    max-height: 34vh;
  }

  .gig-builder-source {
    max-height: 42vh;
  }
}

.song-picker-card {
  min-width: 450px;
  width: min(92vw, 720px);
  max-height: min(82vh, 860px);
  display: flex;
  flex-direction: column;
}

.song-picker-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.song-picker-search {
  position: sticky;
  top: 100px;
  z-index: 5;
  background: white;
  padding-bottom: 6px;
}

:deep(.song-picker-options-popup) {
  max-height: 55vh;
  overflow-y: auto;
}

.setlist-slide-item {
  border-bottom: 1px solid var(--q-separator-color, rgba(0, 0, 0, 0.12));

  :deep(.q-slide-item__content) {
    background: var(--surface);
  }

  &.set-divider-slide :deep(.q-slide-item__content) {
    background: rgba(25, 118, 210, 0.08);
  }

  &.encore-divider-slide :deep(.q-slide-item__content) {
    background: rgba(255, 87, 34, 0.08);
  }
}

.set-divider-item {
  background: rgba(25, 118, 210, 0.08);
  border-left: 4px solid var(--q-primary);
}

.encore-divider-item {
  background: rgba(255, 87, 34, 0.08);
  border-left: 4px solid #ff5722;
}

.print-sheet-area {
  width: 210mm;
  min-height: 297mm;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  margin: auto;
}

.border-bottom-dark {
  border-bottom: 2px solid #222;
}

.border-top-dark {
  border-top: 1px solid #ddd;
}

:deep(.bg-surface),
.bg-surface {
  background: var(--surface) !important;
  color: var(--text);
}

.border-bottom-subtle {
  border-bottom: 1px solid var(--border);
}

.print-table {
  border-collapse: collapse;
  width: 100%;

  th, td {
    border-bottom: 1px solid #e0e0e0;
    padding: 6px 8px;
    font-size: 13px;
    color: #000000;
  }

  th {
    border-bottom: 2px solid #333;
    font-weight: 700;
    color: #000000;
  }

  .divider-row td {
    padding: 8px 10px;
    border-bottom: 2px solid #333;
  }

  .set-divider td {
    background-color: #f0f4f8;
    color: #0d47a1;
  }

  .encore-divider td {
    background-color: #fff3e0;
    color: #e65100;
  }

  .pause-divider td {
    background-color: #f5f5f5;
    color: #616161;
  }

  .note-divider td {
    background-color: #fafafa;
    border-bottom: 1px solid #eee;
  }

  .song-row:nth-child(even) {
    background-color: #fafafa;
  }

  .notes-cell {
    max-width: 180px;
    word-break: break-word;
  }

  .font-monospace {
    font-family: monospace;
  }
}

@media print {
  body,
  body.body--dark {
    background: #ffffff !important;
    color: #000000 !important;
  }
  body * {
    visibility: hidden;
  }
  .print-sheet-area, .print-sheet-area * {
    visibility: visible;
  }
  .print-sheet-area {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    padding: 10mm;
    box-shadow: none !important;
    background: #ffffff !important;
    color: #000000 !important;
  }
  .no-print {
    display: none !important;
  }
}

.setlist-select {
  .q-field__control {
    display: flex;
    align-items: center;
  }
  .q-field__native {
    display: flex;
    align-items: center;
  }
}
</style>
