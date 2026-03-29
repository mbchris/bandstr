import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiJson } from '../boot/api'

export type Vote = {
  id: number
  userId: string
  score: number
  comment?: string | null
}

export type Song = {
  id: number
  bandId: number
  title: string
  artist: string
  spotifyUrl?: string | null
  youtubeUrl?: string | null
  thumbnailUrl?: string | null
  notes?: string | null
  type: 'song' | 'pause' | 'tuning'
  pitch: number
  isSetlist: boolean
  position: number
  isPinned: boolean
  addedBy?: string | null
  createdAt: string
  // Computed from API
  voteCount: number
  voteAverage: number
  hasVoted: number // -1 if not voted
  allVotes: Vote[]
}

export const useSongsStore = defineStore('songs', () => {
  const songs = ref<Song[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchSongs(setlistOnly = false) {
    loading.value = true
    error.value = null
    try {
      const query = setlistOnly ? '?setlist=true' : ''
      songs.value = await apiJson<Song[]>(`/songs${query}`)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load songs'
    } finally {
      loading.value = false
    }
  }

  async function createSong(data: Partial<Song>) {
    const song = await apiJson<Song>('/songs', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    songs.value.push(song)
    return song
  }

  async function updateSong(id: number, data: Partial<Song>) {
    const updated = await apiJson<Song>(`/songs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    const idx = songs.value.findIndex((s) => s.id === id)
    if (idx !== -1) songs.value[idx] = updated
    return updated
  }

  async function deleteSong(id: number) {
    await apiJson(`/songs/${id}`, { method: 'DELETE' })
    songs.value = songs.value.filter((s) => s.id !== id)
  }

  async function reorderSongs(order: Array<{ id: number; position: number }>) {
    await apiJson('/songs/reorder', { method: 'POST', body: JSON.stringify({ order }) })
    order.forEach(({ id, position }) => {
      const song = songs.value.find((s) => s.id === id)
      if (song) song.position = position
    })
  }

  return { songs, loading, error, fetchSongs, createSong, updateSong, deleteSong, reorderSongs }
})
