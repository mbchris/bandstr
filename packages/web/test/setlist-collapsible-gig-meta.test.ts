import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Task 4: Collapsible Gig Meta & Inline Quick-Add from Repertoire', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/SetlistPage.vue')
  const content = fs.readFileSync(pagePath, 'utf-8')

  it('implements gigMetaExpanded and slide transition for collapsible gig meta', () => {
    expect(content).toContain('gigMetaExpanded')
    expect(content).toContain('q-slide-transition')
    expect(content).toContain('t(\'setlist.collapseGigMeta\')')
    expect(content).toContain('t(\'setlist.expandGigMeta\')')
  })

  it('implements quickAddToGig function and inline repertoire expansion panel when in gig mode', () => {
    expect(content).toContain('function quickAddToGig')
    expect(content).toContain('q-expansion-item')
    expect(content).toContain('quickAddToGig(item)')
  })
})
