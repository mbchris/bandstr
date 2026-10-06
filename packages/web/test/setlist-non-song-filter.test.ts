import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Setlist builder source filtering and duplicate draft support', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/SetlistPage.vue')
  const content = fs.readFileSync(pagePath, 'utf-8')

  it('filters masterSetlistItems strictly to isSetlist && !isArchived && type === song', () => {
    const masterItemsSnippet = content.slice(
      content.indexOf('const masterSetlistItems = computed('),
      content.indexOf('const masterSetlistItems = computed(') + 200,
    )
    expect(masterItemsSnippet).toContain("s.type === 'song'")
    expect(masterItemsSnippet).toContain('s.isSetlist')
    expect(masterItemsSnippet).toContain('!s.isArchived')
  })

  it('allows adding duplicate items in filteredGigBuilderSourceItems without filtering by draftIds', () => {
    const sourceItemsFn = content.slice(
      content.indexOf('const filteredGigBuilderSourceItems = computed('),
      content.indexOf('function formatGigBuilderType('),
    )
    expect(sourceItemsFn).not.toContain('draftIds.has(song.id)')
  })

  it('allows addToGigBuilder to add duplicate items', () => {
    const addFn = content.slice(
      content.indexOf('function addToGigBuilder('),
      content.indexOf('function removeFromGigBuilder('),
    )
    expect(addFn).not.toContain('gigBuilderDraftItems.value.some(')
  })

  it('removes from gig builder draft by index instead of song id', () => {
    expect(content).toContain('removeFromGigBuilder(index)')
  })
})
