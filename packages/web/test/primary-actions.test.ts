import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('primary action button placement (iOS header trailing vs Android FAB)', () => {
  const pagesDir = path.resolve(__dirname, '../src/pages')

  it('implements platform-specific add action in SetlistPage.vue', () => {
    const content = fs.readFileSync(path.resolve(pagesDir, 'SetlistPage.vue'), 'utf8')
    expect(content).toContain('usePlatform')
    expect(content).toContain('isAndroid')
    expect(content).toContain('isIos')
    expect(content).toContain('<q-page-sticky')
    expect(content).toContain('openAddSongModal')
  })

  it('implements platform-specific suggest song action in VotingPage.vue', () => {
    const content = fs.readFileSync(path.resolve(pagesDir, 'VotingPage.vue'), 'utf8')
    expect(content).toContain('usePlatform')
    expect(content).toContain('isAndroid')
    expect(content).toContain('isIos')
    expect(content).toContain('<q-page-sticky')
    expect(content).toContain('openAddModal')
  })

  it('implements platform-specific create event action in CalendarPage.vue', () => {
    const content = fs.readFileSync(path.resolve(pagesDir, 'CalendarPage.vue'), 'utf8')
    expect(content).toContain('usePlatform')
    expect(content).toContain('isAndroid')
    expect(content).toContain('isIos')
    expect(content).toContain('<q-page-sticky')
    expect(content).toContain('openCreateEventModal')
  })
})
