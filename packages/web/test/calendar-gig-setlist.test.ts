import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('CalendarPage Gig Setlist Selection', () => {
  it('filters gigSetlistOptions to only show active gig setlists', () => {
    const pagePath = path.resolve(__dirname, '../src/pages/CalendarPage.vue')
    const content = fs.readFileSync(pagePath, 'utf-8')

    // Must filter out archived gig setlists
    expect(content).toMatch(/availableGigSetlists\.value\s*\.filter\(\(g\)\s*=>\s*!g\.isArchived\)/)
  })

  it('resolves gig setlist title from availableGigSetlists', () => {
    const pagePath = path.resolve(__dirname, '../src/pages/CalendarPage.vue')
    const content = fs.readFileSync(pagePath, 'utf-8')

    expect(content).toMatch(/function resolveGigSetlistTitle\(event:\s*CalendarEvent\)/)
    expect(content).toMatch(/availableGigSetlists\.value\.find\([\s\S]*?opt\.id === event\.gigSetlistId/)
  })
})
