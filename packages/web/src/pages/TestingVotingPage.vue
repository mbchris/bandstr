<template>
  <q-page padding>
    <div class="testing-wrap">
      <q-card flat bordered>
        <q-card-section>
          <div class="row items-start justify-between q-col-gutter-md">
            <div>
              <div class="text-h5 text-weight-bold">Testing: Voting Variants</div>
              <div class="text-caption text-grey-7">
                Compact concepts using current voting data for direct comparison.
              </div>
            </div>
            <q-btn flat icon="refresh" label="Refresh" @click="reloadData" :loading="isLoading" />
          </div>
        </q-card-section>

        <q-separator />

        <q-card-section>
          <q-banner v-if="!songs.length" rounded class="bg-widget-surface">
            No songs available in voting yet.
          </q-banner>

          <div v-else class="column q-gutter-lg">
            <q-card flat bordered>
              <q-card-section class="q-pb-sm">
                <div class="text-subtitle1 text-weight-bold">Option 1: Inline Chips</div>
                <div class="text-caption text-grey-7">
                  One compact row: title, avg, all member votes, quick own vote buttons.
                </div>
              </q-card-section>
              <q-separator />
              <q-list separator>
                <q-item v-for="song in songs" :key="`opt1-${song.id}`" class="dense-item">
                  <q-item-section class="song-cell">
                    <q-item-label class="text-weight-medium ellipsis">{{ song.title }}</q-item-label>
                    <q-item-label caption class="ellipsis">{{ song.artist }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-badge outline color="primary">
                      Avg {{ Number(song.voteAverage || 0).toFixed(1) }}
                    </q-badge>
                  </q-item-section>
                  <q-item-section>
                    <div class="row items-center no-wrap q-gutter-xs vote-chip-row">
                      <q-chip
                        v-for="member in visibleMembers"
                        :key="`opt1-${song.id}-${member.id}`"
                        dense
                        square
                        :color="isCurrentUser(member.id) ? 'primary' : 'grey-3'"
                        :text-color="isCurrentUser(member.id) ? 'white' : 'dark'"
                      >
                        {{ getShortName(member.name) }}: {{ getVoteValue(song, member.id) }}
                      </q-chip>
                    </div>
                  </q-item-section>
                  <q-item-section side>
                    <q-btn-toggle
                      :model-value="getCurrentUserVote(song)"
                      dense
                      unelevated
                      toggle-color="primary"
                      color="grey-4"
                      text-color="dark"
                      :options="voteOptions"
                      @update:model-value="(value) => onVoteToggle(song, value)"
                    />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card>

            <q-card flat bordered>
              <q-card-section class="q-pb-sm">
                <div class="text-subtitle1 text-weight-bold">Option 2: Member Grid</div>
                <div class="text-caption text-grey-7">
                  Fixed vote columns per member, always visible, own vote highlighted.
                </div>
              </q-card-section>
              <q-separator />
              <div class="grid-wrap">
                <table class="vote-grid-table">
                  <thead>
                    <tr>
                      <th>Song</th>
                      <th>Avg</th>
                      <th v-for="member in visibleMembers" :key="`opt2-head-${member.id}`">
                        {{ getShortName(member.name) }}
                      </th>
                      <th>My Vote</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="song in songs" :key="`opt2-${song.id}`">
                      <td class="song-col">
                        <div class="ellipsis text-weight-medium">{{ song.title }}</div>
                        <div class="text-caption text-grey-7 ellipsis">{{ song.artist }}</div>
                      </td>
                      <td>{{ Number(song.voteAverage || 0).toFixed(1) }}</td>
                      <td
                        v-for="member in visibleMembers"
                        :key="`opt2-cell-${song.id}-${member.id}`"
                        :class="{ 'current-user-cell': isCurrentUser(member.id) }"
                      >
                        {{ getVoteValue(song, member.id) }}
                      </td>
                      <td>
                        <q-btn-group flat>
                          <q-btn
                            v-for="score in voteScores"
                            :key="`opt2-vote-${song.id}-${score}`"
                            dense
                            size="sm"
                            :outline="getCurrentUserVote(song) !== score"
                            :color="getCurrentUserVote(song) === score ? 'primary' : 'grey-7'"
                            :label="String(score)"
                            @click="setVote(song, score)"
                          />
                        </q-btn-group>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </q-card>

            <q-card flat bordered>
              <q-card-section class="q-pb-sm">
                <div class="text-subtitle1 text-weight-bold">Option 3: Swipe-Like Stepper</div>
                <div class="text-caption text-grey-7">
                  Tiny always-visible vote rail plus one-slider own vote action.
                </div>
              </q-card-section>
              <q-separator />
              <q-list separator>
                <q-item v-for="song in songs" :key="`opt3-${song.id}`" class="dense-item">
                  <q-item-section class="song-cell">
                    <q-item-label class="text-weight-medium ellipsis">{{ song.title }}</q-item-label>
                    <q-item-label caption class="ellipsis">{{ song.artist }}</q-item-label>
                  </q-item-section>
                  <q-item-section>
                    <div class="vote-rail">
                      <div
                        v-for="member in visibleMembers"
                        :key="`opt3-rail-${song.id}-${member.id}`"
                        class="vote-rail-cell"
                        :class="{ 'vote-rail-self': isCurrentUser(member.id) }"
                      >
                        <span>{{ getShortName(member.name) }}</span>
                        <strong>{{ getVoteValue(song, member.id) }}</strong>
                      </div>
                    </div>
                  </q-item-section>
                  <q-item-section side class="opt3-actions">
                    <q-badge outline color="primary" class="q-mb-xs">
                      {{ Number(song.voteAverage || 0).toFixed(1) }}
                    </q-badge>
                    <q-slider
                      :model-value="getCurrentUserVote(song)"
                      :min="0"
                      :max="3"
                      :step="1"
                      label
                      snap
                      switch-label-side
                      style="width: 140px"
                      @change="(value) => onSliderVoteChange(song, value)"
                    />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../stores/auth'
import { useSongsStore, type Song } from '../stores/songs'
import { useBandStore } from '../stores/band'
import { apiJson } from '../boot/api'

const $q = useQuasar()
const authStore = useAuthStore()
const songsStore = useSongsStore()
const bandStore = useBandStore()

const voteScores = [0, 1, 2, 3] as const
const voteOptions = voteScores.map((score) => ({ label: String(score), value: score }))

const currentUserId = computed(() => authStore.user?.id ?? '')
const visibleMembers = computed(() => bandStore.members.filter((member) => !member.isHidden))
const songs = computed(() =>
  songsStore.songs
    .filter((song) => song.type === 'song' && !song.isSetlist)
    .slice()
    .sort((a, b) => a.position - b.position),
)
const isLoading = computed(() => songsStore.loading || bandStore.loading)

function isCurrentUser(userId: string): boolean {
  return userId === currentUserId.value
}

function getVoteValue(song: Song, userId: string): string {
  const vote = song.allVotes.find((entry) => entry.userId === userId)
  return vote ? String(vote.score) : '-'
}

function getCurrentUserVote(song: Song): number | null {
  if (!currentUserId.value) return null
  const vote = song.allVotes.find((entry) => entry.userId === currentUserId.value)
  return vote ? vote.score : null
}

function getShortName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed.slice(0, 2).toUpperCase()
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
  } catch (error) {
    $q.notify({ color: 'negative', message: error instanceof Error ? error.message : 'Failed to vote' })
  }
}

async function onVoteToggle(song: Song, value: number | null) {
  if (typeof value !== 'number') return
  await setVote(song, value)
}

async function onSliderVoteChange(song: Song, value: number | string) {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(parsed)) return
  await setVote(song, parsed)
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
  max-width: 1300px;
  margin: 0 auto;
}

.dense-item {
  min-height: 62px;
}

.song-cell {
  min-width: 190px;
  max-width: 280px;
}

.vote-chip-row {
  overflow-x: auto;
  padding-bottom: 2px;
}

.grid-wrap {
  overflow-x: auto;
}

.vote-grid-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.vote-grid-table th,
.vote-grid-table td {
  border-bottom: 1px solid rgba(128, 128, 128, 0.22);
  padding: 8px 10px;
  text-align: center;
  white-space: nowrap;
}

.vote-grid-table th:first-child,
.vote-grid-table td:first-child {
  text-align: left;
}

.song-col {
  max-width: 260px;
}

.current-user-cell {
  background: rgba(25, 118, 210, 0.1);
  font-weight: 600;
}

.vote-rail {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(52px, 1fr));
  gap: 6px;
}

.vote-rail-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid rgba(128, 128, 128, 0.35);
  border-radius: 7px;
  padding: 4px 6px;
  font-size: 11px;
}

.vote-rail-self {
  border-color: var(--q-primary);
  background: rgba(25, 118, 210, 0.08);
}

.opt3-actions {
  min-width: 152px;
}

@media (max-width: 900px) {
  .dense-item {
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>
