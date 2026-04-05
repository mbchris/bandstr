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

type ITunesTrackMatch = {
  trackName: string
  artistName: string
  trackTimeMillis: number | null
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

type SpotifyPageMetadata = {
  title: string | null
  artist: string | null
  thumbnail: string | null
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function extractMetaContent(html: string, attribute: string, name: string): string | null {
  const regex = new RegExp(
    `<meta[^>]+${attribute}=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    'i',
  )
  const match = html.match(regex)
  return match?.[1] ? decodeHtmlEntities(match[1]) : null
}

async function fetchSpotifyMetadataFromPage(url: string): Promise<SpotifyPageMetadata> {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html',
      'User-Agent': 'Mozilla/5.0 (compatible; bandstr-bot/1.0)',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch Spotify page metadata (HTTP ${response.status})`)
  }

  const html = await response.text()
  const ogTitle = extractMetaContent(html, 'property', 'og:title')
  const ogImage = extractMetaContent(html, 'property', 'og:image')
  const ogDescription = extractMetaContent(html, 'property', 'og:description')

  let artist: string | null = null
  if (ogDescription) {
    const parts = ogDescription.split('·').map((s) => s.trim()).filter(Boolean)
    if (parts.length >= 2) {
      artist = parts[1] || null
    }
  }

  if (!artist && ogTitle) {
    const parsed = parseArtistFromSpotifyTitle(ogTitle)
    artist = parsed.artist
  }

  return {
    title: ogTitle ?? null,
    artist,
    thumbnail: ogImage ?? null,
  }
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

function parseArtistFromSpotifyTitle(rawTitle: string): { title: string; artist: string | null } {
  const trimmed = rawTitle.trim()
  if (!trimmed) return { title: rawTitle, artist: null }

  const byIdx = trimmed.toLowerCase().lastIndexOf(' by ')
  if (byIdx > 0 && byIdx < trimmed.length - 4) {
    return {
      title: trimmed.slice(0, byIdx).trim(),
      artist: trimmed.slice(byIdx + 4).trim() || null,
    }
  }

  return { title: trimmed, artist: null }
}

async function fetchITunesBestMatch(title: string, artist?: string | null): Promise<ITunesTrackMatch | null> {
  const term = encodeURIComponent([title, artist ?? ''].filter(Boolean).join(' '))
  const response = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=8`, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Failed to query iTunes API (HTTP ${response.status})`)
  }

  const payload = (await response.json()) as ITunesSearchResponse
  const results = payload.results ?? []
  if (!results.length) return null

  const wantedTitle = normalizeText(title)
  const wantedArtist = normalizeText(artist ?? '')
  let best: ITunesTrackMatch | null = null
  let bestScore = -1

  for (const result of results) {
    const trackName = (result.trackName ?? '').trim()
    const artistName = (result.artistName ?? '').trim()
    if (!trackName || !artistName) continue

    const candidateTitle = normalizeText(trackName)
    const candidateArtist = normalizeText(artistName)
    let score = 0

    if (candidateTitle === wantedTitle) score += 3
    else if (candidateTitle.includes(wantedTitle) || wantedTitle.includes(candidateTitle)) score += 2

    if (wantedArtist) {
      if (candidateArtist === wantedArtist) score += 3
      else if (candidateArtist.includes(wantedArtist) || wantedArtist.includes(candidateArtist)) score += 2
    }

    if (score > bestScore) {
      bestScore = score
      best = {
        trackName,
        artistName,
        trackTimeMillis: typeof result.trackTimeMillis === 'number' ? result.trackTimeMillis : null,
      }
    }
  }

  return best
}

export async function fetchSpotifyEnrichedMetadata(url: string): Promise<SpotifyEnrichedMetadata> {
  const trackId = extractSpotifyTrackId(url)
  if (!trackId) {
    throw new Error('Could not extract a valid Spotify track ID from the URL')
  }

  let title: string | null = null
  let artist: string | null = null
  let thumbnail: string | null = null
  let spotifyDurationMs: number | null = null

  try {
    const token = await fetchAnonymousSpotifyToken()
    const track = await fetchSpotifyTrack(trackId, token)
    title = track.name?.trim() || null
    artist = track.artists?.map((a) => a.name?.trim()).filter(Boolean).join(', ') || null
    thumbnail = track.album?.images?.[0]?.url ?? null
    spotifyDurationMs = typeof track.duration_ms === 'number' ? track.duration_ms : null
  } catch (error) {
    console.warn(`[SPOTIFY] Token-based track lookup failed for ${url}:`, error)
  }

  // Fallback path without oEmbed: scrape open.spotify.com track page metadata.
  if (!title || !artist || !thumbnail) {
    const fallback = await fetchSpotifyMetadataFromPage(url)
    title = title ?? fallback.title ?? null
    artist = artist ?? fallback.artist ?? null
    thumbnail = thumbnail ?? fallback.thumbnail ?? null
  }

  if (title && !artist) {
    const parsed = parseArtistFromSpotifyTitle(title)
    title = parsed.title
    artist = parsed.artist
  }

  let iTunesMatch: ITunesTrackMatch | null = null
  if (title && (!artist || artist.trim().length === 0)) {
    try {
      iTunesMatch = await fetchITunesBestMatch(title, null)
      if (iTunesMatch?.artistName) {
        artist = iTunesMatch.artistName
      }
      if (iTunesMatch?.trackName) {
        title = iTunesMatch.trackName
      }
    } catch (error) {
      console.warn(`[ITUNES] Artist recovery failed for ${title}:`, error)
    }
  }

  if (!title && !artist && !thumbnail) {
    throw new Error('Could not retrieve Spotify metadata for the provided URL')
  }

  let trackTimeMillis: number | null = null
  if (iTunesMatch?.trackTimeMillis !== null && iTunesMatch?.trackTimeMillis !== undefined) {
    trackTimeMillis = iTunesMatch.trackTimeMillis
  } else if (title && artist) {
    try {
      trackTimeMillis = await fetchITunesTrackDuration(artist, title)
    } catch (error) {
      console.warn(`[ITUNES] Duration lookup failed for ${artist} - ${title}:`, error)
    }
  }

  return {
    spotifyUrl: `https://open.spotify.com/track/${trackId}`,
    spotifyTrackId: trackId,
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
