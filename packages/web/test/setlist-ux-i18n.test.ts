import { describe, it, expect } from 'vitest'
import en from '../src/i18n/en'
import de from '../src/i18n/de'

describe('Setlist UX i18n keys', () => {
  it('has setlist.buildSetlist defined in both en and de', () => {
    expect((en as any).setlist?.buildSetlist).toBe('Build Setlist')
    expect((de as any).setlist?.buildSetlist).toBe('Setlist zusammenstellen')
  })

  it('has new setlist UX keys defined in en and de', () => {
    expect((en as any).setlist?.gigTabAll).toBe('Repertoire')
    expect((de as any).setlist?.gigTabAll).toBe('Repertoire')

    expect((en as any).setlist?.addToGigQuick).toBe('Add to Setlist')
    expect((de as any).setlist?.addToGigQuick).toBe('Zur Setlist hinzufügen')

    expect((en as any).setlist?.collapseGigMeta).toBe('Hide gig details')
    expect((de as any).setlist?.collapseGigMeta).toBe('Gig-Details ausblenden')

    expect((en as any).setlist?.expandGigMeta).toBe('Show gig details')
    expect((de as any).setlist?.expandGigMeta).toBe('Gig-Details einblenden')

    expect((en as any).setlist?.spotifyUrlLabel).toBe('Spotify URL')
    expect((de as any).setlist?.spotifyUrlLabel).toBe('Spotify URL')

    expect((en as any).setlist?.addSongQuickTitle).toBe('Add Song')
    expect((de as any).setlist?.addSongQuickTitle).toBe('Song hinzufügen')
  })
})
