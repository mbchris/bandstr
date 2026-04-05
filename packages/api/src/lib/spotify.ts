export async function fetchSpotifyMetadata(url: string) {
  if (!url || !url.includes('spotify.com')) {
    return { title: null, artist: null, thumbnail: null }
  }

  try {
    const res = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string }
    return {
      title: data.title ?? null,
      artist: data.author_name ?? null,
      thumbnail: data.thumbnail_url ?? null,
    }
  } catch (e) {
    console.warn(`[SPOTIFY] Failed to fetch metadata for ${url}:`, e)
    return { title: null, artist: null, thumbnail: null }
  }
}

type SpotifyTrackApiResponse = {
  id?: string
  name?: string
  duration_ms?: number
  artists?: Array<{ name?: string }>
  album?: {
    images?: Array<{ url?: string }>
  }
}

type ITunesSearchResponse = {
  resultCount?: number
  results?: Array<{
    trackName?: string
    artistName?: string
    trackTimeMillis?: number
  }>
}

export type SpotifyEnrichedMetadata = {
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

export function extractSpotifyTrackId(url: string): string | null {
  if (!url) return null

  const normalized = url.trim()
  const fromRegex = normalized.match(/track\/([a-zA-Z0-9]+)/)?.[1]
  if (fromRegex) return fromRegex

  try {
    const parsed = new URL(normalized)
    const segments = parsed.pathname.split('/').filter(Boolean)
    const trackIndex = segments.findIndex((segment) => segment === 'track')
    if (trackIndex >= 0 && segments[trackIndex + 1]) {
      return segments[trackIndex + 1]
    }
  } catch {
    return null
  }

  return null
}

async function fetchAnonymousSpotifyToken(): Promise<string> {
  const tokenUrl = 'https://open.spotify.com/get_access_token?reason=transport&productType=web_player'
  const tokenRes = await fetch(tokenUrl, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!tokenRes.ok) {
    throw new Error(`Failed to fetch anonymous Spotify token (HTTP ${tokenRes.status})`)
  }

  const tokenJson = (await tokenRes.json()) as { accessToken?: string }
  const accessToken = (tokenJson.accessToken ?? '').trim()

  if (!accessToken) {
    throw new Error('Spotify token response did not contain an access token')
  }

  return accessToken
}

async function fetchSpotifyTrack(trackId: string, accessToken: string): Promise<SpotifyTrackApiResponse> {
  const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!trackRes.ok) {
    throw new Error(`Failed to fetch Spotify track details (HTTP ${trackRes.status})`)
  }

  return (await trackRes.json()) as SpotifyTrackApiResponse
}

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

async function fetchITunesTrackDuration(artist: string, title: string): Promise<number | null> {
  const term = encodeURIComponent(`${artist} ${title}`)
  const response = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=8`, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to query iTunes API (HTTP ${response.status})`)
  }

  const payload = (await response.json()) as ITunesSearchResponse
  const results = payload.results ?? []
  if (!results.length) return null

  const wantedTitle = normalizeText(title)
  const wantedArtist = normalizeText(artist)

  let bestDuration: number | null = null
  let bestScore = -1

  for (const result of results) {
    const candidateTitle = normalizeText(result.trackName ?? '')
    const candidateArtist = normalizeText(result.artistName ?? '')

    let score = 0
    if (candidateTitle === wantedTitle) score += 3
    else if (candidateTitle.includes(wantedTitle) || wantedTitle.includes(candidateTitle)) score += 2

    if (candidateArtist === wantedArtist) score += 3
    else if (candidateArtist.includes(wantedArtist) || wantedArtist.includes(candidateArtist)) score += 2

    if (score > bestScore && typeof result.trackTimeMillis === 'number') {
      bestScore = score
      bestDuration = result.trackTimeMillis
    }
  }

  return bestDuration
}

export async function fetchSpotifyEnrichedMetadata(url: string): Promise<SpotifyEnrichedMetadata> {
  const trackId = extractSpotifyTrackId(url)
  if (!trackId) {
    throw new Error('Could not extract a valid Spotify track ID from the URL')
  }

  const token = await fetchAnonymousSpotifyToken()
  const track = await fetchSpotifyTrack(trackId, token)

  const title = track.name?.trim() || null
  const artist = track.artists?.map((a) => a.name?.trim()).filter(Boolean).join(', ') || null
  const thumbnail = track.album?.images?.[0]?.url ?? null
  const spotifyDurationMs = typeof track.duration_ms === 'number' ? track.duration_ms : null

  let trackTimeMillis: number | null = null
  if (title && artist) {
    trackTimeMillis = await fetchITunesTrackDuration(artist, title)
  }

  return {
    spotifyUrl: `https://open.spotify.com/track/${track.id ?? trackId}`,
    spotifyTrackId: track.id ?? trackId,
    title,
    artist,
    thumbnail,
    spotifyDurationMs,
    trackTimeMillis,
    durationMs: trackTimeMillis ?? spotifyDurationMs,
    durationSource: trackTimeMillis !== null ? 'itunes' : spotifyDurationMs !== null ? 'spotify' : null,
    queriedAt: new Date().toISOString(),
  }
}
