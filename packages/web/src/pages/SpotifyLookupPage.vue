<template>
  <q-page class="spotify-lookup-page q-pa-md">
    <div class="spotify-lookup-content">
      <div class="row items-center q-mb-md">
        <q-btn flat icon="arrow_back" label="Back to Impress" @click="goBackToImpress" />
      </div>

      <q-card class="lookup-card">
        <q-card-section>
          <div class="text-h6">Spotify Metadata Test</div>
          <div class="text-subtitle2 text-grey-6">
            Retrieves Artist, Title, Thumbnail and iTunes track length
          </div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="spotifyUrl"
            outlined
            label="Spotify Track URL"
            placeholder="https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl"
            @keyup.enter="fetchTrackData"
          >
            <template #append>
              <q-btn
                round
                dense
                flat
                icon="search"
                :loading="isLoading"
                @click="fetchTrackData"
              />
            </template>
          </q-input>
        </q-card-section>

        <q-card-section v-if="errorMsg">
          <q-banner class="bg-negative text-white rounded-borders">
            {{ errorMsg }}
          </q-banner>
        </q-card-section>

        <q-card-section v-if="trackData">
          <q-list bordered class="rounded-borders">
            <q-item>
              <q-item-section avatar>
                <q-avatar rounded size="80px">
                  <img v-if="trackData.thumbnail" :src="trackData.thumbnail" alt="Spotify thumbnail" />
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-h6">{{ trackData.title || 'Unknown Title' }}</q-item-label>
                <q-item-label caption class="text-subtitle1">
                  {{ trackData.artist || 'Unknown Artist' }}
                </q-item-label>
                <q-item-label caption>
                  Length: {{ formatDuration(trackData.durationMs) }}
                  <span v-if="trackData.durationSource">({{ trackData.durationSource }})</span>
                </q-item-label>
                <q-item-label caption v-if="trackData.trackTimeMillis !== null">
                  iTunes trackTimeMillis: {{ trackData.trackTimeMillis }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <div class="q-mt-md">
            <div class="text-overline">Metadata JSON</div>
            <q-input
              type="textarea"
              outlined
              readonly
              autogrow
              class="bg-grey-2"
              :model-value="rawJson"
            />
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

type TrackMetadata = {
  spotifyUrl: string
  spotifyTrackId: string
  title: string | null
  artist: string | null
  thumbnail: string | null
  spotifyDurationMs: number | null
  trackTimeMillis: number | null
  durationMs: number | null
  durationSource: 'itunes' | 'spotify' | null
  queriedAt: string
}

type LookupResponse = {
  metadata?: TrackMetadata
  error?: string
}

const router = useRouter()
const spotifyUrl = ref('')
const trackData = ref<TrackMetadata | null>(null)
const errorMsg = ref('')
const isLoading = ref(false)

const rawJson = computed(() => (trackData.value ? JSON.stringify(trackData.value, null, 2) : ''))

function goBackToImpress() {
  void router.push('/impress')
}

function formatDuration(ms: number | null): string {
  if (ms === null) return 'Unknown'
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

async function fetchTrackData() {
  errorMsg.value = ''
  trackData.value = null

  const trimmed = spotifyUrl.value.trim()
  if (!trimmed) {
    errorMsg.value = 'Please enter a Spotify track URL.'
    return
  }

  isLoading.value = true

  try {
    const base = (process.env.API_URL ?? '').replace(/\/+$/, '').replace(/\/api$/, '')
    const endpoint = `${base}/api/spotify/lookup?url=${encodeURIComponent(trimmed)}`
    const response = await fetch(endpoint)
    const payload = (await response.json()) as LookupResponse

    if (!response.ok) {
      throw new Error(payload.error || 'Lookup failed.')
    }

    if (!payload.metadata) {
      throw new Error('No metadata returned.')
    }

    trackData.value = payload.metadata
  } catch (error) {
    errorMsg.value = error instanceof Error ? error.message : 'Lookup failed.'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.spotify-lookup-page {
  min-height: 100vh;
}

.spotify-lookup-content {
  max-width: 760px;
  margin: 0 auto;
}

.lookup-card {
  border-radius: 14px;
}
</style>
