import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import en from '../src/i18n/en'
import de from '../src/i18n/de'

describe('Voting Swipe-to-Setlist and Swipe-to-Archive (#25)', () => {
  it('has i18n keys for swipe actions in English and German', () => {
    expect(en.voting).toHaveProperty('songAccepted')
    expect(de.voting).toHaveProperty('songAccepted')
    expect(en.voting.songAccepted).toBeTruthy()
    expect(de.voting.songAccepted).toBeTruthy()
  })

  it('verifies VotingPage.vue includes q-slide-item with green right-swipe and red left-swipe', () => {
    const pagePath = path.resolve(__dirname, '../src/pages/VotingPage.vue')
    const content = fs.readFileSync(pagePath, 'utf-8')

    // Must use q-slide-item
    expect(content).toContain('<q-slide-item')

    // Must configure positive (green) left-color and negative (red) right-color
    expect(content).toMatch(/left-color=["']positive["']/)
    expect(content).toMatch(/right-color=["']negative["']/)

    // Must handle left and right slide events (swiping right triggers @left, swiping left triggers @right)
    expect(content).toContain('@left=')
    expect(content).toContain('@right=')

    // Left slot (swipe right) must show acceptance icon (check or playlist_add_check)
    expect(content).toMatch(/#left/)
    expect(content).toMatch(/check/)

    // Right slot (swipe left) must show archive icon
    expect(content).toMatch(/#right/)
    expect(content).toMatch(/archive/)

    // Script must define swipe handlers
    expect(content).toContain('onSwipeRight')
    expect(content).toContain('onSwipeLeft')
  })
})
