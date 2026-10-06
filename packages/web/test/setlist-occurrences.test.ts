import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import en from '../src/i18n/en'
import de from '../src/i18n/de'

describe('Setlist i18n keys', () => {
  it('defines duplicateSongError and songOccurrenceTooltip in en and de', () => {
    expect((en.setlist as Record<string, unknown>).duplicateSongError).toBeDefined()
    expect((de.setlist as Record<string, unknown>).duplicateSongError).toBeDefined()
    expect((en.setlist as Record<string, unknown>).songOccurrenceTooltip).toBeDefined()
    expect((de.setlist as Record<string, unknown>).songOccurrenceTooltip).toBeDefined()
  })
})

describe('Gig Setlist Song Occurrences and Granular Deletion', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/SetlistPage.vue')
  const content = fs.readFileSync(pagePath, 'utf-8')

  it('computes gigSongOccurrences for songs in gig setlist', () => {
    expect(content).toContain('gigSongOccurrences')
  })

  it('renders occurrence badge when a song appears more than once in gig setlist', () => {
    expect(content).toContain('gigSongOccurrences.get(item.id)')
    expect(content).toContain('priority_high')
    expect(content).toContain('songOccurrenceTooltip')
  })

  it('supports granular deletion of gig songs by passing gigSongId', () => {
    expect(content).toContain('gigSongId')
    expect(content).toContain('?gigSongId=')
  })

  it('allows repeated quick add to gig without blocking duplicates', () => {
    const quickAddFn = content.slice(content.indexOf('async function quickAddToGig('))
    const fnBody = quickAddFn.slice(0, quickAddFn.indexOf('const showAddUserSetlistModal'))
    expect(fnBody).not.toContain('gigSongs.value.some((s) => s.id === item.id)')
  })
})
