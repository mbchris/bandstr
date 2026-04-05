<template>
  <q-page padding>
    <div class="testing-wrap">
      <q-card flat bordered>
        <q-card-section class="row items-center justify-between">
          <div>
            <div class="text-h5 text-weight-bold">Testing: Compact Voting (3 options)</div>
            <div class="text-caption text-grey-7">Only voted avatars + average in list rows.</div>
          </div>
          <q-btn flat icon="refresh" label="Refresh" :loading="isLoading" @click="reloadData" />
        </q-card-section>
        <q-separator />
        <q-card-section>
          <q-banner v-if="!songs.length" rounded class="bg-widget-surface">No songs available.</q-banner>

          <div v-else class="column q-gutter-lg">
            <q-card flat bordered>
              <q-card-section class="q-pb-xs">
                <div class="text-subtitle1 text-weight-bold">Option 1: Avatar Stack</div>
              </q-card-section>
              <q-separator />
              <q-list separator>
                <q-item v-for="song in songs" :key="`a-${song.id}`" class="compact-row">
                  <q-item-section class="song-cell">
                    <q-item-label class="text-weight-medium ellipsis">{{ song.title }}</q-item-label>
                    <q-item-label caption class="ellipsis">{{ song.artist }}</q-item-label>
                  </q-item-section>
                  <q-item-section>
                    <div class="row items-center no-wrap q-gutter-sm">
                      <div class="avatar-stack">
                        <q-avatar
                          v-for="(member, i) in votedMembers(song)"
                          :key="`a-v-${song.id}-${member.id}`"
                          size="24px"
                          class="stack-avatar"
                          :style="{ left: `${i * 16}px`, zIndex: 20 - i }"
                          color="primary"
                          text-color="white"
                        >
                          <img v-if="member.image" :src="member.image" />
                          <span v-else>{{ getInitial(member.name) }}</span>
                        </q-avatar>
                        <span v-if="!votedMembers(song).length" class="text-caption text-grey-6">no votes</span>
                      </div>
                    </div>
                  </q-item-section>
                  <q-item-section side>
                    <q-badge outline color="primary">Avg {{ avgLabel(song) }}</q-badge>
                  </q-item-section>
                  <q-item-section side>
                    <div class="row items-center q-gutter-xs">
                      <q-btn dense flat icon="how_to_vote" label="My vote" @click="openVoteDialog(song)" />
                      <q-btn dense flat icon="visibility" label="Details" @click="openDetailsDialog(song)" />
                    </div>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card>

            <q-card flat bordered>
              <q-card-section class="q-pb-xs">
                <div class="text-subtitle1 text-weight-bold">Option 2: Vote Counter Pill</div>
              </q-card-section>
              <q-separator />
              <q-list separator>
                <q-item v-for="song in songs" :key="`b-${song.id}`" class="compact-row">
                  <q-item-section class="song-cell">
                    <q-item-label class="text-weight-medium ellipsis">{{ song.title }}</q-item-label>
                    <q-item-label caption class="ellipsis">{{ song.artist }}</q-item-label>
                  </q-item-section>
                  <q-item-section>
                    <div class="voted-pill">
                      <q-icon name="group" size="16px" />
                      <span>{{ votedMembers(song).length }}/{{ visibleMembers.length }} voted</span>
                      <div class="mini-avatars">
                        <q-avatar
                          v-for="member in votedMembers(song).slice(0, 4)"
                          :key="`b-v-${song.id}-${member.id}`"
                          size="18px"
                          color="secondary"
                          text-color="white"
                        >
                          <img v-if="member.image" :src="member.image" />
                          <span v-else>{{ getInitial(member.name) }}</span>
                        </q-avatar>
                        <span v-if="votedMembers(song).length > 4" class="text-caption">+{{ votedMembers(song).length - 4 }}</span>
                      </div>
                    </div>
                  </q-item-section>
                  <q-item-section side>
                    <q-badge outline color="primary">Avg {{ avgLabel(song) }}</q-badge>
                  </q-item-section>
                  <q-item-section side>
                    <div class="row items-center q-gutter-xs">
                      <q-btn dense flat icon="edit" label="My vote" @click="openVoteDialog(song)" />
                      <q-btn dense flat icon="table_view" label="Details" @click="openDetailsDialog(song)" />
                    </div>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card>

            <q-card flat bordered>
              <q-card-section class="q-pb-xs">
                <div class="text-subtitle1 text-weight-bold">Option 3: Right Overlay Cluster</div>
              </q-card-section>
              <q-separator />
              <q-list separator>
                <q-item v-for="song in songs" :key="`c-${song.id}`" class="compact-row cluster-row">
                  <q-item-section class="song-cell">
                    <q-item-label class="text-weight-medium ellipsis">{{ song.title }}</q-item-label>
                    <q-item-label caption class="ellipsis">{{ song.artist }}</q-item-label>
                  </q-item-section>
                  <q-item-section>
                    <div class="cluster-host">
                      <div class="cluster-badges">
                        <q-avatar
                          v-for="(member, i) in votedMembers(song).slice(0, 6)"
                          :key="`c-v-${song.id}-${member.id}`"
                          size="20px"
                          class="cluster-avatar"
                          :style="{ right: `${i * 14}px` }"
                          color="accent"
                          text-color="white"
                        >
                          <img v-if="member.image" :src="member.image" />
                          <span v-else>{{ getInitial(member.name) }}</span>
                        </q-avatar>
                      </div>
                    </div>
                  </q-item-section>
                  <q-item-section side>
                    <q-badge outline color="primary">Avg {{ avgLabel(song) }}</q-badge>
                  </q-item-section>
                  <q-item-section side>
                    <div class="row items-center q-gutter-xs">
                      <q-btn dense flat icon="tune" label="My vote" @click="openVoteDialog(song)" />
                      <q-btn dense flat icon="insights" label="Details" @click="openDetailsDialog(song)" />
                    </div>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <q-dialog v-model="showVoteDialog">
      <q-card style="min-width: 320px">
        <q-card-section class="row items-center">
          <div class="text-h6">My Vote</div>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-separator />
        <q-card-section v-if="activeSong">
          <div class="text-subtitle2">{{ activeSong.title }} - {{ activeSong.artist }}</div>
          <div class="q-mt-md">
            <q-btn-toggle
              :model-value="getCurrentUserVote(activeSong)"
              spread
              unelevated
              toggle-color="primary"
              color="grey-3"
              text-color="dark"
              :options="voteOptions"
              @update:model-value="(value) => onVoteSelect(value)"
            />
          </div>
          <div class="text-caption text-grey-7 q-mt-sm">Tap the same value again to remove your vote.</div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showDetailsDialog">
      <q-card style="min-width: 360px; max-width: 96vw">
        <q-card-section class="row items-center">
          <div class="text-h6">Voting Details</div>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-separator />
        <q-card-section v-if="activeSong">
          <div class="text-subtitle2">{{ activeSong.title }} - {{ activeSong.artist }}</div>
          <div class="text-caption text-grey-7 q-mt-xs">Average: {{ avgLabel(activeSong) }} | Votes: {{ activeSong.voteCount }}</div>
          <q-list class="q-mt-sm" dense bordered separator>
            <q-item v-for="member in visibleMembers" :key="`d-${activeSong.id}-${member.id}`">
              <q-item-section avatar>
                <q-avatar size="24px" color="grey-7" text-color="white">
                  <img v-if="member.image" :src="member.image" />
                  <span v-else>{{ getInitial(member.name) }}</span>
                </q-avatar>
              </q-item-section>
              <q-item-section>{{ member.name }}</q-item-section>
              <q-item-section side>
                <q-badge :color="getVoteScore(activeSong, member.id) === null ? 'grey-6' : 'primary'">
                  {{ getVoteScore(activeSong, member.id) === null ? '-' : getVoteScore(activeSong, member.id) }}
                </q-badge>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../stores/auth'
import { useSongsStore, type Song } from '../stores/songs'
import { useBandStore, type BandMember } from '../stores/band'
import { apiJson } from '../boot/api'

const $q = useQuasar()
const authStore = useAuthStore()
const songsStore = useSongsStore()
const bandStore = useBandStore()

const voteOptions = [
  { label: '0', value: 0 },
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
]

const currentUserId = computed(() => authStore.user?.id ?? '')
const visibleMembers = computed(() => bandStore.members.filter((member) => !member.isHidden))
const songs = computed(() =>
  songsStore.songs
    .filter((song) => song.type === 'song' && !song.isSetlist)
    .slice()
    .sort((a, b) => a.position - b.position),
)
const isLoading = computed(() => songsStore.loading || bandStore.loading)

const showVoteDialog = ref(false)
const showDetailsDialog = ref(false)
const activeSong = ref<Song | null>(null)

function getInitial(name?: string | null): string {
  return (name?.trim()?.charAt(0) || '?').toUpperCase()
}

function getVoteScore(song: Song, userId: string): number | null {
  const vote = song.allVotes.find((entry) => entry.userId === userId)
  return vote?.score ?? null
}

function getCurrentUserVote(song: Song): number | null {
  if (!currentUserId.value) return null
  return getVoteScore(song, currentUserId.value)
}

function votedMembers(song: Song): BandMember[] {
  const votedIds = new Set(song.allVotes.map((entry) => entry.userId))
  return visibleMembers.value.filter((member) => votedIds.has(member.id))
}

function avgLabel(song: Song): string {
  return Number(song.voteAverage || 0).toFixed(1)
}

function openVoteDialog(song: Song) {
  activeSong.value = song
  showVoteDialog.value = true
}

function openDetailsDialog(song: Song) {
  activeSong.value = song
  showDetailsDialog.value = true
}

async function setVote(song: Song, score: number) {
  if (!currentUserId.value) return
  try {
    const current = getCurrentUserVote(song)
    const remove = current === score
    await apiJson('/votes', {
      method: 'POST',
      body: JSON.stringify({ songId: song.id, score: remove ? undefined : score, remove }),
    })
    await songsStore.fetchSongs()
    if (activeSong.value) {
      activeSong.value = songsStore.songs.find((entry) => entry.id === activeSong.value?.id) || null
    }
  } catch (error) {
    $q.notify({ color: 'negative', message: error instanceof Error ? error.message : 'Failed to vote' })
  }
}

async function onVoteSelect(value: number | null) {
  if (!activeSong.value || typeof value !== 'number') return
  await setVote(activeSong.value, value)
}

async function reloadData() {
  await Promise.all([songsStore.fetchSongs(), bandStore.fetchMembers()])
}

onMounted(() => {
  void reloadData()
})
</script>

<style scoped>
.testing-wrap {
  max-width: 1240px;
  margin: 0 auto;
}

.compact-row {
  min-height: 56px;
}

.song-cell {
  max-width: 280px;
  min-width: 180px;
}

.avatar-stack {
  position: relative;
  min-height: 24px;
  min-width: 110px;
}

.stack-avatar {
  position: absolute;
  border: 2px solid var(--q-dark-page);
}

.voted-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
}

.mini-avatars {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.cluster-row {
  position: relative;
}

.cluster-host {
  position: relative;
  min-height: 22px;
  min-width: 140px;
}

.cluster-badges {
  position: absolute;
  right: 0;
  top: 1px;
  width: 120px;
  height: 22px;
}

.cluster-avatar {
  position: absolute;
  border: 2px solid var(--q-dark-page);
}

@media (max-width: 900px) {
  .compact-row {
    flex-wrap: wrap;
    gap: 6px;
  }
}
</style>
