<template>
  <q-page padding>
    <div style="max-width: 1200px; margin: 0 auto">
      <q-card flat bordered>
        <q-card-section>
          <div class="row items-center justify-between">
            <div class="text-h5 text-weight-bold">{{ t('voting.heading') }}</div>
            <div class="row q-gutter-sm">
              <q-btn flat round icon="download" @click="handleExport" />
              <q-btn round color="primary" icon="add" class="round-add-btn" @click="openAddModal" />
            </div>
          </div>
        </q-card-section>

        <q-card-section>
          <div class="row q-gutter-sm q-mb-md">
            <q-input v-model="searchQuery" dense outlined :placeholder="t('voting.filterSongs')" class="col" clearable>
              <template #prepend><q-icon name="search" /></template>
            </q-input>
          </div>

          <q-list v-if="filteredSongs.length" separator>
            <q-item
              v-for="(song, index) in filteredSongs"
              :key="song.id"
              class="q-pa-sm song-item"
              :draggable="!searchQuery"
              @dragstart="onDragStart(index)"
              @dragover.prevent
              @drop="onDrop(index)"
              @dragend="onDragEnd"
            >
              <q-item-section side class="song-order-controls">
                <div class="column items-center q-gutter-xs">
                  <q-icon name="drag_indicator" size="sm" color="grey-6" class="cursor-grab" />
                  <q-btn flat round dense :icon="song.isPinned ? 'bookmark' : 'bookmark_border'" :color="song.isPinned ? 'primary' : 'grey'" size="sm" @click="togglePin(song)" />
                </div>
              </q-item-section>

              <!-- Thumbnail -->
              <q-item-section side class="song-order-thumb">
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
                  <a v-if="song.spotifyUrl" :href="song.spotifyUrl" target="_blank" class="text-green text-caption text-weight-bold" style="text-decoration:none">Spotify</a>
                  <a v-if="song.youtubeUrl" :href="song.youtubeUrl" target="_blank" class="text-red text-caption text-weight-bold" style="text-decoration:none">YouTube</a>
                </div>
                <div v-if="song.lengthMs" class="text-caption text-grey-7 q-mt-xs">
                  Length: {{ formatDuration(song.lengthMs) }}
                </div>
                <div class="votes-grid q-mt-sm">
                  <div class="votes-self">
                    <button
                      type="button"
                      class="own-vote-trigger bg-widget-surface rounded-borders"
                      @click="openVotePicker(song)"
                      :disabled="!currentUserId"
                    >
                      <q-avatar
                        size="26px"
                        :class="getMemberVoteRingClass(song, currentUserId)"
                        :color="currentUser?.image ? undefined : getMemberFallbackColor(song, currentUserId)"
                        :text-color="currentUser?.image ? undefined : 'white'"
                      >
                        <img v-if="currentUser?.image" :src="currentUser.image" />
                        <span v-else style="font-size: 11px">{{ getNameInitial(currentUser?.name || authStore.user?.name) }}</span>
                      </q-avatar>
                      <span class="text-caption text-weight-bold q-ml-xs">{{ getMemberVoteLabel(song, currentUserId) }}</span>
                      <q-icon name="touch_app" size="16px" color="primary" class="q-ml-xs" />
                      <q-tooltip>{{ t('voting.selfVoteHint') }}</q-tooltip>
                    </button>
                  </div>

                  <div class="votes-others">
                    <div
                      v-for="member in otherMembers"
                      :key="member.id"
                      class="row items-center no-wrap bg-widget-surface rounded-borders q-px-xs q-py-xxs"
                    >
                      <q-avatar
                        size="22px"
                        :class="getMemberVoteRingClass(song, member.id)"
                        :color="member.image ? undefined : getMemberFallbackColor(song, member.id)"
                        :text-color="member.image ? undefined : 'white'"
                      >
                        <img v-if="member.image" :src="member.image" />
                        <span v-else style="font-size: 10px">{{ member.name?.charAt(0) }}</span>
                      </q-avatar>
                      <span class="text-caption text-weight-bold q-ml-xs">{{ getMemberVoteLabel(song, member.id) }}</span>
                      <q-tooltip>{{ member.name }}</q-tooltip>
                    </div>
                  </div>
                </div>
                  <div class="text-caption text-grey-8 q-mt-xs text-right">
                    {{ t('voting.avg') }} {{ Number(song.voteAverage || 0).toFixed(1) }} • {{ song.voteCount }} {{ t('voting.votes') }}
                  </div>
              </q-item-section>

              <!-- Actions -->
              <q-item-section side class="song-order-actions">
                <div class="column q-gutter-xs song-actions">
                  <q-btn v-if="!song.isSetlist" flat round dense icon="arrow_forward" color="grey" size="sm" @click="openTransferModal(song)">
                    <q-tooltip>{{ t('voting.sendToSetlist') }}</q-tooltip>
                  </q-btn>
                  <q-btn v-if="canEdit(song)" flat round dense icon="edit" size="sm" @click="openEditModal(song)" />
                  <q-btn v-if="canDelete(song)" flat round dense icon="delete" color="red" size="sm" @click="deleteSong(song)" />
                </div>
              </q-item-section>
            </q-item>
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
          <q-input v-model="modalSong.youtubeUrl" :label="t('voting.youtubeUrl')" outlined dense />
          <q-input v-model="modalSong.notes" :label="t('voting.notes')" type="textarea" outlined dense autogrow />
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
            <q-item-section>0 (Veto!)</q-item-section>
          </q-item>
          <q-item clickable v-ripple @click="selectOwnVote(1)">
            <q-item-section>1 (OK)</q-item-section>
          </q-item>
          <q-item clickable v-ripple @click="selectOwnVote(2)">
            <q-item-section>2 (Good)</q-item-section>
          </q-item>
          <q-item clickable v-ripple @click="selectOwnVote(3)">
            <q-item-section>3 (Great)</q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../stores/auth'
import { useSongsStore, type Song } from '../stores/songs'
import { useBandStore } from '../stores/band'
import { apiJson } from '../boot/api'
import { useI18n } from '../composables/useI18n'

const $q = useQuasar()
const authStore = useAuthStore()
const songsStore = useSongsStore()
const bandStore = useBandStore()
const { t } = useI18n()

const searchQuery = ref('')
const draggingIndex = ref<number | null>(null)

const isAdmin = computed(() => {
  const band = authStore.activeBand
  return band && ['owner', 'admin'].includes(band.role)
})

const visibleMembers = computed(() => bandStore.members.filter((m) => !m.isHidden))
const currentUserId = computed(() => authStore.user?.id || '')
const currentUser = computed(() => visibleMembers.value.find((m) => m.id === currentUserId.value) || null)
const otherMembers = computed(() => visibleMembers.value.filter((m) => m.id !== currentUserId.value))

const filteredSongs = computed(() => {
  let list = songsStore.songs.filter((s) => s.type !== 'pause' && s.type !== 'tuning' && !s.isSetlist)
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q))
  }
  list = [...list].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return a.position - b.position
  })
  return list
})

function canEdit(song: Song) { return isAdmin.value || authStore.user?.id === song.addedBy }
function canDelete(song: Song) { return isAdmin.value || authStore.user?.id === song.addedBy }

function getMemberVoteRingClass(song: Song, userId: string) {
  const vote = song.allVotes?.find((v) => v.userId === userId)
  if (!vote) return 'member-vote-empty'
  return ['member-vote-veto', 'member-vote-ok', 'member-vote-good', 'member-vote-great'][vote.score] || 'member-vote-empty'
}

function getMemberFallbackColor(song: Song, userId: string) {
  const vote = song.allVotes?.find((v) => v.userId === userId)
  if (!vote) return 'blue-grey-8'
  return ['red-10', 'deep-orange-10', 'blue-10', 'green-10'][vote.score] || 'blue-grey-8'
}

function getMemberVoteLabel(song: Song, userId: string) {
  if (!userId) return '-'
  const vote = song.allVotes?.find((v) => v.userId === userId)
  if (!vote) return '-'
  return String(vote.score)
}

function getNameInitial(name?: string | null) {
  return (name?.trim()?.charAt(0) || '?').toUpperCase()
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
  await reorderSongs(items)
}

function onDragEnd() {
  draggingIndex.value = null
}

async function deleteSong(song: Song) {
  $q.dialog({ title: t('common.delete'), message: t('voting.failedDelete', { title: song.title }), cancel: true }).onOk(async () => {
    await songsStore.deleteSong(song.id)
  })
}

// Song modal
const showSongModal = ref(false)
const submitting = ref(false)
const modalSong = ref({
  id: null as number | null,
  title: '',
  artist: '',
  spotifyUrl: '',
  youtubeUrl: '',
  notes: '',
  lengthMs: null as number | null,
})
const lookingUp = ref(false)
const lookupError = ref('')

function openAddModal() {
  modalSong.value = { id: null, title: '', artist: '', spotifyUrl: '', youtubeUrl: '', notes: '', lengthMs: null }
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
  }
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
    if (typeof data?.lengthMs === 'number') modalSong.value.lengthMs = data.lengthMs
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
    const payload = {
      title: modalSong.value.title,
      artist: modalSong.value.artist,
      spotifyUrl: modalSong.value.spotifyUrl || undefined,
      youtubeUrl: modalSong.value.youtubeUrl || undefined,
      notes: modalSong.value.notes || undefined,
      lengthMs: modalSong.value.lengthMs || undefined,
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
  import('xlsx').then(({ utils, writeFile }) => {
    const data = filteredSongs.value.map((s) => {
      const row: any = { Title: s.title, Artist: s.artist, Average: Number(s.voteAverage || 0).toFixed(1), Votes: s.voteCount }
      visibleMembers.value.forEach((m) => { row[m.name] = getMemberVoteLabel(s, m.id) })
      return row
    })
    const ws = utils.json_to_sheet(data)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Voting')
    writeFile(wb, `bandstr_voting_${new Date().toISOString().split('T')[0]}.xlsx`)
  })
}

onMounted(() => {
  songsStore.fetchSongs()
  bandStore.fetchMembers()
})
</script>

<style scoped>
.member-vote-empty {
  border: 1px solid #9ca3af;
}

.member-vote-veto {
  border: 2px solid #ef4444;
}

.member-vote-ok {
  border: 2px solid #f97316;
}

.member-vote-good {
  border: 2px solid #3b82f6;
}

.member-vote-great {
  border: 2px solid #22c55e;
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
}

.votes-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px 18px;
  width: 100%;
}

.votes-self {
  flex: 0 0 auto;
}

.own-vote-trigger {
  border: 1px dashed var(--q-primary);
  color: inherit;
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  cursor: pointer;
}

.own-vote-trigger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.votes-others {
  flex: 1 1 280px;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
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
</style>
