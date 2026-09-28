import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Setlist Filter Layout & Sizing', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/SetlistPage.vue')
  const content = fs.readFileSync(pagePath, 'utf-8')

  it('places search filter on the line below next to filter tags', () => {
    // Top row contains SegmentedControl and setlist-select
    expect(content).toMatch(/<div class="row q-col-gutter-sm q-mb-md items-center justify-between">[\s\S]*?<SegmentedControl[\s\S]*?<q-select[\s\S]*?class="setlist-select"/)

    // Lower row contains search query and filter tags side by side
    const lowerRowMatch = content.match(/<div class="row q-col-gutter-sm q-mb-md items-center">([\s\S]*?)<\/div>\s*<div v-if="selectedGigId && selectedGigMeta"/)
    expect(lowerRowMatch).not.toBeNull()
    const lowerRowContent = lowerRowMatch![1]

    expect(lowerRowContent).toContain('v-model="searchQuery"')
    expect(lowerRowContent).toContain('v-model="selectedTagFilters"')
  })

  it('removes dense from search filter and tag filter to increase touch target and size', () => {
    // searchQuery input should not be dense
    const searchInputMatch = content.match(/<q-input\s+v-model="searchQuery"[\s\S]*?>/)
    expect(searchInputMatch).not.toBeNull()
    expect(searchInputMatch![0]).not.toContain('dense')

    // selectedTagFilters select should not be dense
    const tagSelectMatch = content.match(/<q-select\s+v-model="selectedTagFilters"[\s\S]*?>/)
    expect(tagSelectMatch).not.toBeNull()
    expect(tagSelectMatch![0]).not.toContain('dense')
  })
})
