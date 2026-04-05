import { Hono } from 'hono'
import { fetchSpotifyEnrichedMetadata } from '../lib/spotify.js'

export const spotify = new Hono()

// Public test route for Spotify URL metadata extraction.
spotify.get('/lookup', async (c) => {
  const url = (c.req.query('url') ?? '').trim()
  if (!url) {
    return c.json({ error: 'url is required' }, 400)
  }

  try {
    const metadata = await fetchSpotifyEnrichedMetadata(url)
    return c.json({ metadata })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch Spotify metadata'
    return c.json({ error: message }, 400)
  }
})
