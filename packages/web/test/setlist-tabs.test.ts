import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Task 3 & 4 (Plan v2): Three Fixed Tabs & Vertical Gig List with Swipe-to-Archive', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/SetlistPage.vue')
  const content = fs.readFileSync(pagePath, 'utf-8')

  it('renders three fixed tabs for navigation', () => {
    expect(content).toContain('v-model="activeTab"')
    expect(content).toContain("name=\"repertoire\" :label=\"t('setlist.tabRepertoire')\"")
    expect(content).toContain("name=\"gig\" :label=\"t('setlist.tabGigSetlists')\"")
    expect(content).toContain("name=\"user\" :label=\"t('setlist.tabUserSetlist')\"")
  })

  it('renders vertical gig list with swipe-to-archive and back button', () => {
    expect(content).toContain("activeTab === 'gig' && !selectedGigId")
    expect(content).toContain('toggleGigArchive(gig, reset)')
    expect(content).toContain('selectGig(gig.id)')
    expect(content).toContain("activeTab === 'gig' && selectedGigId")
    expect(content).toContain('backToGigList')
  })

  it('implements toggleGigArchive and selectGig and backToGigList functions', () => {
    expect(content).toContain('async function toggleGigArchive')
    expect(content).toContain('function selectGig')
    expect(content).toContain('function backToGigList')
  })
})
