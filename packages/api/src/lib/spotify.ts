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
