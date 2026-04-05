# Iteration 13 - Spotify optimizations


- [x] Based on the following code snippet, a test page (linked from 'impress') is created to query spotify in a different way

<template>
  <q-page class="flex flex-center q-pa-md">
    <q-card class="full-width" style="max-width: 600px">
      <q-card-section>
        <div class="text-h6">Spotify Track Data Scraper</div>
        <div class="text-subtitle2 text-grey">Bypasses Developer App requirement</div>
      </q-card-section>

      <q-card-section>
        <q-input
          v-model="spotifyUrl"
          outlined
          label="Paste Spotify Track URL"
          placeholder="https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl"
          @keyup.enter="fetchTrackData"
        >
          <template v-slot:append>
            <q-btn 
              round 
              dense 
              flat 
              icon="search" 
              @click="fetchTrackData" 
              :loading="isLoading" 
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
                <img :src="trackData.thumbnail_url" alt="Cover" />
              </q-avatar>
            </q-item-section>

            <q-item-section>
              <q-item-label class="text-h6">{{ trackData.title }}</q-item-label>
              <q-item-label caption class="text-subtitle1">{{ trackData.artist }}</q-item-label>
              <q-item-label caption>Length: {{ formatDuration(trackData.length_ms) }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>

        <div class="q-mt-md">
          <div class="text-overline">Raw JSON</div>
          <q-input
            v-model="rawJson"
            type="textarea"
            readonly
            outlined
            class="bg-grey-2"
          />
        </div>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'

const spotifyUrl = ref('')
const trackData = ref(null)
const errorMsg = ref('')
const isLoading = ref(false)

const rawJson = computed(() => {
  return trackData.value ? JSON.stringify(trackData.value, null, 2) : ''
})

// Formatting MS to MM:SS
const formatDuration = (ms) => {
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(0)
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
}

const fetchTrackData = async () => {
  errorMsg.value = ''
  trackData.value = null
  
  if (!spotifyUrl.value) {
    errorMsg.value = 'Please enter a valid URL'
    return
  }

  // 1. Extract Track ID
  const trackIdMatch = spotifyUrl.value.match(/track\/([a-zA-Z0-9]+)/)
  if (!trackIdMatch || !trackIdMatch[1]) {
    errorMsg.value = 'Could not find a valid Track ID in the URL.'
    return
  }
  const trackId = trackIdMatch[1]

  isLoading.value = true

  try {
    // 2. Fetch Anonymous Bearer Token
    // NOTE: In a real Quasar SPA, this URL must be routed through a backend proxy to avoid CORS!
    // Example: const tokenUrl = 'https://your-proxy.com/spotify-token'
    const tokenUrl = 'https://open.spotify.com/get_access_token?reason=transport&productType=web_player'
    
    const tokenResponse = await fetch(tokenUrl)
    if (!tokenResponse.ok) throw new Error('Failed to fetch anonymous token.')
    
    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.accessToken

    // 3. Fetch Track Details from Internal API
    const trackResponse = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })
    
    if (!trackResponse.ok) throw new Error('Failed to fetch track details.')
    
    const data = await trackResponse.json()

    // 4. Construct our custom JSON
    trackData.value = {
      title: data.name,
      artist: data.artists[0]?.name || 'Unknown Artist',
      length_ms: data.duration_ms,
      thumbnail_url: data.album.images[0]?.url || ''
    }

  } catch (err) {
    console.error(err)
    errorMsg.value = err.message || 'An error occurred while fetching data.'
  } finally {
    isLoading.value = false
  }
}
</script>

- [x] Using Spotify links, it shall be possible do determine Artist, Title, Thumbail.
- [x] Based on the retreived Artist and Title, the iTunes API shall be queried to retrieve the track length (trackTimeMillis)
- [x] A JSON format with all metadata shall be created to be used in a separate step

