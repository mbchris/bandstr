import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Setlist Filter Layout & Sizing', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/SetlistPage.vue')
  const content = fs.readFileSync(pagePath, 'utf-8')

  it('places three fixed tabs and universal status filter above search query and filter tags', () => {
    // Top layout contains q-tabs with activeTab and universal SegmentedControl
    expect(content).toContain('v-model="activeTab"')
    expect(content).toContain('v-model="statusFilter"')

    // Lower row contains search query and filter tags side by side
    const lowerRowMatch = content.match(/<div class="row q-col-gutter-sm q-mb-md items-center">([\s\S]*?)<\/div>\s*<!-- Vertical Gig List/)
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
