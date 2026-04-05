<template>
  <q-page padding>
    <div style="max-width: 1200px; margin: 0 auto">
      <q-card flat bordered>
        <q-card-section>
          <div class="row items-center justify-between">
            <div class="text-h5 text-weight-bold">{{ t('setlist.heading') }}</div>
            <div class="row q-gutter-sm">
              <q-btn flat round icon="pause_circle" @click="openSpecialModal('pause')" />
              <q-btn flat round icon="tune" @click="openSpecialModal('tuning')" />
              <q-btn flat round icon="download" @click="handleExport" />
              <q-btn round color="primary" icon="add" class="round-add-btn" @click="openAddSongModal" />
            </div>
          </div>
        </q-card-section>

        <q-card-section>
          <div class="row q-gutter-sm q-mb-md">
            <q-input v-model="searchQuery" dense outlined :placeholder="t('setlist.filterTitle')" class="col" clearable>
              <template #prepend><q-icon name="search" /></template>
            </q-input>
            <q-select v-model="selectedGigId" :options="gigOptions" emit-value map-options dense outlined style="width: 200px" />
          </div>
          <div class="text-caption text-grey-7 q-mb-md">
            Songs: {{ songCount }} · Total length: {{ formatDuration(totalDurationMs) }}
          </div>

          <q-list v-if="filteredSongs.length" separator>
            <q-item
              v-for="(item, index) in filteredSongs"
              :key="item.id"
              class="q-pa-sm"
              :class="{
                'bg-blue-1': item.isPinned,
                'border-dashed': item.type !== 'song'
              }"
              :draggable="!searchQuery"
              @dragstart="onDragStart(index)"
              @dragover.prevent
              @drop="onDrop(index)"
              @dragend="onDragEnd"
            >
              <!-- Reorder + Pin -->
              <q-item-section side>
                <div class="column items-center q-gutter-xs">
                  <q-icon name="drag_indicator" size="sm" color="grey-6" class="cursor-grab" />
                  <span class="text-caption text-grey">{{ index + 1 }}</span>
                  <q-btn flat round dense :icon="item.isPinned ? 'lock' : 'lock_open'" :color="item.isPinned ? 'primary' : 'grey'" size="sm" @click="togglePin(item)" />
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
              </q-item-section>

              <!-- Content -->
              <q-item-section>
                <!-- Song content -->
                <template v-if="item.type === 'song'">
                  <q-item-label class="text-weight-bold">
                    {{ item.title }}
                    <q-icon v-if="item.notes" name="info" color="grey" size="xs" class="cursor-pointer q-ml-xs">
                      <q-tooltip>{{ item.notes }}</q-tooltip>
                    </q-icon>
                    <q-icon v-if="getPersonalNote(item.id)" name="person" color="primary" size="xs" class="cursor-pointer q-ml-xs" @click="showNote(t('setlist.personalNotes') + ': ' + item.title, getPersonalNote(item.id))">
                      <q-tooltip>{{ t('setlist.personalNotes') }}</q-tooltip>
                    </q-icon>
                  </q-item-label>
                  <q-item-label caption>{{ item.artist }}</q-item-label>
                  <div class="row q-gutter-xs q-mt-xs">
                    <a v-if="item.spotifyUrl" :href="item.spotifyUrl" target="_blank" class="text-green text-caption text-weight-bold" style="text-decoration:none">Spotify</a>
                    <a v-if="item.youtubeUrl" :href="item.youtubeUrl" target="_blank" class="text-red text-caption text-weight-bold" style="text-decoration:none">YouTube</a>
                    <q-badge v-if="item.pitch !== 0" color="orange" outline class="text-caption">
                      Pitch: {{ item.pitch > 0 ? '+' : '' }}{{ item.pitch }}
                    </q-badge>
                  </div>
                  <q-item-label caption v-if="item.lengthMs">
                    Length: {{ formatDuration(item.lengthMs) }}
                  </q-item-label>
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
              </q-item-section>

              <!-- Actions -->
              <q-item-section side>
                <div class="row q-gutter-xs">
                  <q-btn flat round dense icon="edit" size="sm" @click="openEditModal(item)" />
                  <q-btn v-if="item.type === 'song'" flat round dense icon="arrow_back" color="grey" size="sm" @click="removeFromSetlist(item)">
                    <q-tooltip>{{ t('setlist.moveToVoting') }}</q-tooltip>
                  </q-btn>
                  <q-btn v-else flat round dense icon="close" color="red" size="sm" @click="removeFromSetlist(item)" />
                </div>
              </q-item-section>
            </q-item>
          </q-list>

          <q-banner v-else rounded class="bg-widget-surface">{{ t('setlist.noItems') }}</q-banner>
        </q-card-section>
      </q-card>
    </div>

    <!-- Add Song to Master Setlist Dialog -->
    <q-dialog v-model="showAddSongModal">
      <q-card style="min-width: 450px">
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
          <q-input v-model="addSongForm.youtubeUrl" :label="t('voting.youtubeUrl')" outlined dense />
          <q-input v-model="addSongForm.notes" :label="t('voting.notes')" type="textarea" outlined dense autogrow />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.cancel')" v-close-popup />
          <q-btn color="primary" :label="t('common.add')" :loading="isSaving" @click="submitAddSong" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Add Master Songs to Gig Dialog -->
    <q-dialog v-model="showAddGigSongModal">
      <q-card style="min-width: 450px">
        <q-card-section class="row items-center">
          <div class="text-h6">{{ t('setlist.addGigSongTitle') }}</div>
          <q-space /><q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section>
          <q-select
            v-model="selectedMasterSongIds"
            :options="masterSongOptions"
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
          />
          <div class="row q-gutter-sm q-mt-sm">
            <q-btn flat dense size="sm" :label="t('setlist.selectAll')" @click="selectedMasterSongIds = masterSongOptions.map(o => o.value)" />
            <q-btn flat dense size="sm" :label="t('setlist.selectNone')" @click="selectedMasterSongIds = []" />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.cancel')" v-close-popup />
          <q-btn color="primary" :label="t('setlist.addToGig')" :loading="isSaving" :disable="!selectedMasterSongIds.length" @click="submitAddGigSong" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Note Viewer Dialog -->
    <q-dialog v-model="showNoteModal">
      <q-card style="min-width: 400px">
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
    <q-dialog v-model="showEditModal">
      <q-card v-if="editingItem" style="min-width: 450px">
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
            <q-input v-model="editingItem.youtubeUrl" :label="t('voting.youtubeUrl')" outlined dense />
            <div class="row items-center q-gutter-md">
              <span class="text-caption">{{ t('setlist.pitchShift') }}</span>
              <q-slider v-model="editingItem.pitch" :min="-5" :max="5" :step="1" snap label class="col" />
              <q-badge color="grey-8" class="text-body2">{{ editingItem.pitch > 0 ? '+' : '' }}{{ editingItem.pitch }}</q-badge>
            </div>
          </template>
          <q-input v-model="editingItem.notes" :label="t('setlist.notes')" type="textarea" outlined dense autogrow />
          <q-input v-model="editingItemPersonalNote" :label="t('setlist.personalNotes')" :hint="t('setlist.personalNotesHint')" type="textarea" outlined dense autogrow />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.cancel')" v-close-popup />
          <q-btn color="primary" :label="t('common.save')" :loading="isSaving" @click="saveItemEdit" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Special Element (Pause/Tuning) Dialog -->
    <q-dialog v-model="showSpecialModal">
      <q-card v-if="specialElementForm" style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">{{ specialElementForm.type === 'pause' ? t('setlist.addPause') : t('setlist.changeTuning') }}</div>
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="specialElementForm.title" :label="t('common.title')" outlined dense autofocus />
          <q-input v-model="specialElementForm.notes" :label="t('voting.notes')" type="textarea" outlined dense autogrow />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.cancel')" v-close-popup />
          <q-btn color="primary" :label="t('common.add')" :loading="isSaving" @click="submitSpecialElement" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useSongsStore, type Song } from '../stores/songs'
import { apiJson } from '../boot/api'
import Markdown from '../components/Markdown.vue'
import { useI18n } from '../composables/useI18n'

const $q = useQuasar()
const songsStore = useSongsStore()
const { t } = useI18n()

const searchQuery = ref('')
const draggingIndex = ref<number | null>(null)

// Gig selection
const selectedGigId = ref<number | null>(null)
const gigs = ref<any[]>([])
const gigSongs = ref<Song[]>([])
const personalNotes = ref<any[]>([])

const gigOptions = computed(() => [
  { label: t('setlist.masterSetlist'), value: null },
  ...gigs.value.map((g) => {
    let dateStr = ''
    if (g.startTime) {
      try { dateStr = new Date(g.startTime).toISOString().split('T')[0] } catch {}
    }
    return { label: dateStr ? `${dateStr} ${g.title}` : g.title, value: g.id }
  }),
])

// Active song list depends on gig selection
const activeSongs = computed(() => {
  if (selectedGigId.value) return gigSongs.value
  return songsStore.songs.filter((s) => s.isSetlist)
})

const filteredSongs = computed(() => {
  let list = [...activeSongs.value]

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter((s) => s.title.toLowerCase().includes(q) || (s.artist && s.artist.toLowerCase().includes(q)))
  }

  list.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return a.position - b.position
  })

  return list
})

const songCount = computed(() => activeSongs.value.filter((s) => s.type === 'song').length)
const totalDurationMs = computed(() =>
  activeSongs.value
    .filter((s) => s.type === 'song' && typeof s.lengthMs === 'number')
    .reduce((sum, s) => sum + (s.lengthMs ?? 0), 0),
)

// Master songs for gig song picker
const masterSongOptions = computed(() =>
  songsStore.songs
    .filter((s) => s.type === 'song' && s.isSetlist)
    .map((s) => ({ label: `${s.title} - ${s.artist}`, value: s.id }))
)

function getPersonalNote(songId: number) {
  const note = personalNotes.value.find((n: any) => n.songId === songId)
  return note ? note.content : ''
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
  try { gigs.value = await apiJson<any[]>('/gigs') } catch { gigs.value = [] }
}

async function fetchGigSongs(gigId: number) {
  try { gigSongs.value = await apiJson<Song[]>(`/gigs/${gigId}/songs`) } catch { gigSongs.value = [] }
}

async function fetchPersonalNotes() {
  try { personalNotes.value = await apiJson<any[]>('/songs/notes') } catch { personalNotes.value = [] }
}

async function refreshAll() {
  const promises: Promise<void>[] = [songsStore.fetchSongs(), fetchPersonalNotes()]
  if (selectedGigId.value) promises.push(fetchGigSongs(selectedGigId.value))
  await Promise.all(promises)
}

watch(selectedGigId, (newVal) => {
  if (newVal) fetchGigSongs(newVal)
})

// Reorder
async function reorderItems(items: Song[]) {
  const updates = items.map((itm, idx) => ({ id: itm.id, position: idx }))

  try {
    if (selectedGigId.value) {
      await apiJson(`/gigs/${selectedGigId.value}/songs/reorder`, { method: 'POST', body: JSON.stringify(updates) })
      await fetchGigSongs(selectedGigId.value)
    } else {
      await songsStore.reorderSongs(updates)
    }
  } catch {
    $q.notify({ message: t('setlist.failedReorder'), color: 'negative' })
    await refreshAll()
  }
}

function onDragStart(index: number) {
  if (searchQuery.value) return
  draggingIndex.value = index
}

async function onDrop(index: number) {
  if (searchQuery.value) return
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

async function togglePin(item: Song) {
  try {
    await songsStore.updateSong(item.id, { isPinned: !item.isPinned } as any)
    await refreshAll()
  } catch {}
}

async function removeFromSetlist(item: Song) {
  $q.dialog({
    title: t('common.delete'),
    message: t('setlist.removeConfirm', { title: item.title }),
    cancel: true,
  }).onOk(async () => {
    try {
      if (item.type !== 'song') {
        await songsStore.deleteSong(item.id)
      } else if (selectedGigId.value) {
        await apiJson(`/gigs/${selectedGigId.value}/songs/${item.id}`, { method: 'DELETE' })
        await fetchGigSongs(selectedGigId.value)
      } else {
        await songsStore.updateSong(item.id, { isSetlist: false } as any)
      }
      await refreshAll()
    } catch {
      $q.notify({ message: t('setlist.failedRemove'), color: 'negative' })
    }
  })
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
const addSongForm = ref({
  title: '',
  artist: '',
  spotifyUrl: '',
  youtubeUrl: '',
  notes: '',
  lengthMs: null as number | null,
})
const addSongLookingUp = ref(false)
const addSongLookupError = ref('')
const isSaving = ref(false)

function openAddSongModal() {
  if (selectedGigId.value) {
    showAddGigSongModal.value = true
  } else {
    addSongForm.value = { title: '', artist: '', spotifyUrl: '', youtubeUrl: '', notes: '', lengthMs: null }
    addSongLookupError.value = ''
    showAddSongModal.value = true
  }
}

async function submitAddSong() {
  isSaving.value = true
  try {
    await songsStore.createSong({
      title: addSongForm.value.title,
      artist: addSongForm.value.artist,
      spotifyUrl: addSongForm.value.spotifyUrl || undefined,
      youtubeUrl: addSongForm.value.youtubeUrl || undefined,
      lengthMs: addSongForm.value.lengthMs || undefined,
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
    if (typeof data?.lengthMs === 'number') addSongForm.value.lengthMs = data.lengthMs
  } catch {
    addSongLookupError.value = t('voting.lookupFailed')
  } finally {
    addSongLookingUp.value = false
  }
}

function onAddSpotifyPaste() {
  setTimeout(() => lookupSpotifyForAdd(false), 100)
}

// Add master songs to gig setlist
const showAddGigSongModal = ref(false)
const selectedMasterSongIds = ref<number[]>([])

async function submitAddGigSong() {
  isSaving.value = true
  try {
    for (let i = 0; i < selectedMasterSongIds.value.length; i++) {
      await apiJson(`/gigs/${selectedGigId.value}/songs`, {
        method: 'POST',
        body: JSON.stringify({ songId: selectedMasterSongIds.value[i], position: filteredSongs.value.length + i }),
      })
    }
    showAddGigSongModal.value = false
    selectedMasterSongIds.value = []
    if (selectedGigId.value) await fetchGigSongs(selectedGigId.value)
  } catch (e: any) { $q.notify({ message: t('setlist.failedAdd'), color: 'negative' }) }
  finally { isSaving.value = false }
}

// Special element (pause/tuning)
const showSpecialModal = ref(false)
const specialElementForm = ref<{ type: 'pause' | 'tuning'; title: string; notes: string } | null>(null)

function openSpecialModal(type: 'pause' | 'tuning') {
  specialElementForm.value = { type, title: type === 'pause' ? t('setlist.breakPause') : t('setlist.tuningChange'), notes: '' }
  showSpecialModal.value = true
}

async function submitSpecialElement() {
  if (!specialElementForm.value) return
  isSaving.value = true
  try {
    await songsStore.createSong({
      title: specialElementForm.value.title,
      artist: 'Band',
      type: specialElementForm.value.type,
      notes: specialElementForm.value.notes,
      position: filteredSongs.value.length,
      isSetlist: true,
    } as any)
    showSpecialModal.value = false
    await refreshAll()
  } catch { $q.notify({ message: t('setlist.failedAdd'), color: 'negative' }) }
  finally { isSaving.value = false }
}

// Edit modal
const showEditModal = ref(false)
const editingItem = ref<any>(null)
const editingItemPersonalNote = ref('')
const isLookingUp = ref(false)
const lookupError = ref('')

function openEditModal(item: Song) {
  editingItem.value = { ...item }
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
    if (typeof data?.lengthMs === 'number') editingItem.value.lengthMs = data.lengthMs
  } catch { lookupError.value = t('voting.lookupFailed') }
  finally { isLookingUp.value = false }
}

function onSpotifyPaste() { setTimeout(() => lookupSpotify(false), 100) }

async function saveItemEdit() {
  isSaving.value = true
  try {
    await songsStore.updateSong(editingItem.value.id, {
      title: editingItem.value.title,
      artist: editingItem.value.artist,
      spotifyUrl: editingItem.value.spotifyUrl,
      youtubeUrl: editingItem.value.youtubeUrl,
      lengthMs: editingItem.value.lengthMs,
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
  import('xlsx').then(({ utils, writeFile }) => {
    const data = filteredSongs.value.map((item, idx) => {
      if (item.type === 'song') {
        return {
          '#': idx + 1,
          Title: item.title,
          Artist: item.artist,
          Length: item.lengthMs ? formatDuration(item.lengthMs) : '',
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
    writeFile(wb, `bandstr_setlist_${new Date().toISOString().split('T')[0]}.xlsx`)
  })
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

onMounted(() => {
  songsStore.fetchSongs()
  fetchGigs()
  fetchPersonalNotes()
})
</script>

<style scoped>
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
</style>
