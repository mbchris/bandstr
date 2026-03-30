<template>
  <q-page padding>
    <div style="max-width: 1200px; margin: 0 auto">
      <q-card flat bordered>
        <q-card-section>
          <div class="row items-center justify-between">
            <div class="text-h5 text-weight-bold">{{ t('voting.heading') }}</div>
            <div class="row q-gutter-sm">
              <q-btn flat round icon="download" @click="handleExport" />
              <q-btn round color="primary" icon="add" @click="openAddModal" />
            </div>
          </div>
        </q-card-section>

        <q-card-section>
          <div class="row q-gutter-sm q-mb-md">
            <q-input v-model="searchQuery" dense outlined :placeholder="t('voting.filterSongs')" class="col" clearable>
              <template #prepend><q-icon name="search" /></template>
            </q-input>
            <q-select v-model="sortBy" :options="sortOptions" emit-value map-options dense outlined style="width: 160px" />
          </div>

          <q-list v-if="filteredSongs.length" separator>
            <q-item v-for="song in filteredSongs" :key="song.id" class="q-pa-sm song-item">
              <q-item-section side class="song-order-controls">
                <div class="column items-center q-gutter-xs">
                  <template v-if="sortBy === 'custom'">
                    <q-btn flat round dense icon="keyboard_arrow_up" size="xs" @click="moveSong(song, -1)" />
                    <q-btn flat round dense icon="keyboard_arrow_down" size="xs" @click="moveSong(song, 1)" />
                  </template>
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
                <div class="row q-gutter-xs q-mt-sm">
                  <div v-for="member in visibleMembers" :key="member.id" class="row items-center no-wrap bg-widget-surface rounded-borders q-px-xs q-py-xxs">
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
              </q-item-section>

              <!-- Vote buttons -->
              <q-item-section side class="song-order-votes">
                <div class="column items-end vote-controls">
                  <div class="row q-gutter-xs vote-buttons">
                    <q-btn
                      v-for="sc in [0, 1, 2, 3]"
                      :key="sc"
                      :label="isCompactVotes ? voteShortLabels[sc] : voteLabels[sc]"
                      :color="song.hasVoted === sc ? voteColors[sc] : 'grey-7'"
                      :text-color="song.hasVoted === sc ? 'white' : 'grey-2'"
                      :class="{ 'vote-btn-compact': isCompactVotes }"
                      dense
                      size="sm"
                      no-caps
                      @click="toggleVote(song, sc)"
                    >
                      <q-tooltip>{{ voteLabels[sc] }}</q-tooltip>
                    </q-btn>
                  </div>
                  <div class="text-caption text-grey-8 q-mt-xs text-right">
                    {{ t('voting.avg') }} {{ Number(song.voteAverage || 0).toFixed(1) }} • {{ song.voteCount }} {{ t('voting.votes') }}
                  </div>
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
const sortBy = ref('newest')
const sortOptions = computed(() => [
  { label: t('voting.mostVotes'), value: 'votes' },
  { label: t('voting.newest'), value: 'newest' },
  { label: t('voting.customOrder'), value: 'custom' },
])

const voteLabels = computed<Record<number, string>>(() => ({ 0: t('voting.veto'), 1: t('voting.ok'), 2: t('voting.good'), 3: t('voting.great') }))
const voteShortLabels: Record<number, string> = { 0: '-', 1: 'OK', 2: '+', 3: '++' }
const voteColors: Record<number, string> = { 0: 'red', 1: 'orange', 2: 'primary', 3: 'green' }
const isCompactVotes = computed(() => $q.screen.lt.sm)

const isAdmin = computed(() => {
  const band = authStore.activeBand
  return band && ['owner', 'admin'].includes(band.role)
})

const visibleMembers = computed(() => bandStore.members.filter((m) => !m.isHidden))

const filteredSongs = computed(() => {
  let list = songsStore.songs.filter((s) => s.type !== 'pause' && s.type !== 'tuning' && !s.isSetlist)
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q))
  }
  if (sortBy.value === 'votes') list = [...list].sort((a, b) => (b.voteAverage || 0) - (a.voteAverage || 0))
  else if (sortBy.value === 'custom') list = [...list].sort((a, b) => { if (a.isPinned && !b.isPinned) return -1; if (!a.isPinned && b.isPinned) return 1; return a.position - b.position })
  else list = [...list].sort((a, b) => b.id - a.id)
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
  const vote = song.allVotes?.find((v) => v.userId === userId)
  if (!vote) return '-'
  return String(vote.score)
}

// Voting
async function toggleVote(song: Song, score: number) {
  try {
    const remove = song.hasVoted === score
    await apiJson('/votes', { method: 'POST', body: JSON.stringify({ songId: song.id, score: remove ? undefined : score, remove }) })
    await songsStore.fetchSongs()
  } catch (e: any) { $q.notify({ message: e.message || t('voting.failedVote'), color: 'negative' }) }
}

async function togglePin(song: Song) {
  try {
    await songsStore.updateSong(song.id, { isPinned: !song.isPinned } as any)
    await songsStore.fetchSongs()
  } catch { /* ignore */ }
}

async function moveSong(song: Song, dir: number) {
  const idx = filteredSongs.value.findIndex((s) => s.id === song.id)
  const target = idx + dir
  if (target < 0 || target >= filteredSongs.value.length) return
  const items = [...filteredSongs.value]
  ;[items[idx], items[target]] = [items[target], items[idx]]
  await songsStore.reorderSongs(items.map((s, i) => ({ id: s.id, position: i })))
}

async function deleteSong(song: Song) {
  $q.dialog({ title: t('common.delete'), message: t('voting.failedDelete', { title: song.title }), cancel: true }).onOk(async () => {
    await songsStore.deleteSong(song.id)
  })
}

// Song modal
const showSongModal = ref(false)
const submitting = ref(false)
const modalSong = ref({ id: null as number | null, title: '', artist: '', spotifyUrl: '', youtubeUrl: '', notes: '' })
const lookingUp = ref(false)
const lookupError = ref('')

function openAddModal() {
  modalSong.value = { id: null, title: '', artist: '', spotifyUrl: '', youtubeUrl: '', notes: '' }
  lookupError.value = ''
  showSongModal.value = true
}

function openEditModal(song: Song) {
  modalSong.value = { id: song.id, title: song.title, artist: song.artist, spotifyUrl: song.spotifyUrl || '', youtubeUrl: song.youtubeUrl || '', notes: song.notes || '' }
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
  } catch { lookupError.value = t('voting.lookupFailed') }
  finally { lookingUp.value = false }
}

function onSpotifyPaste() { setTimeout(() => lookupSpotify(false), 100) }

async function submitSong() {
  submitting.value = true
  try {
    if (modalSong.value.id) {
      await songsStore.updateSong(modalSong.value.id, modalSong.value as any)
    } else {
      await songsStore.createSong(modalSong.value as any)
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

  .song-order-votes {
    width: 100%;
    order: 10;
  }

  .song-order-actions {
    width: 100%;
    order: 11;
  }

  .vote-controls {
    width: 100%;
    align-items: flex-start;
  }

  .vote-buttons {
    flex-wrap: wrap;
    gap: 4px;
  }

  .song-actions {
    flex-direction: row;
  }
}

.vote-btn-compact {
  min-width: 38px;
  padding-left: 6px;
  padding-right: 6px;
}
</style>
