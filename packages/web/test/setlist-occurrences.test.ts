import { describe, it, expect } from 'vitest'
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
