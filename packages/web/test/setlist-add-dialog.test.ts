import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Task 2: Spotify URL at top of Add Song Dialog', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/SetlistPage.vue')
  const content = fs.readFileSync(pagePath, 'utf-8')

  it('places Spotify URL row before song title in showAddSongModal', () => {
    const dialogStart = content.indexOf('v-model="showAddSongModal"')
    expect(dialogStart).toBeGreaterThan(-1)

    const dialogContent = content.slice(dialogStart, dialogStart + 2500)
    const spotifyPos = dialogContent.indexOf('addSongForm.spotifyUrl')
    const titlePos = dialogContent.indexOf('addSongForm.title')

    expect(spotifyPos).toBeGreaterThan(-1)
    expect(titlePos).toBeGreaterThan(-1)
    expect(spotifyPos).toBeLessThan(titlePos)
  })

  it('keeps autofocus on the first relevant input or handles quick paste smoothly', () => {
    const dialogStart = content.indexOf('v-model="showAddSongModal"')
    const dialogContent = content.slice(dialogStart, dialogStart + 2500)
    expect(dialogContent).toContain('onAddSpotifyPaste')
    expect(dialogContent).toContain('lookupSpotifyForAdd')
  })
})
