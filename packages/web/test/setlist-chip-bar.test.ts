import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Task 3: Horizontal Chip Bar for Setlist Selection', () => {
  const pagePath = path.resolve(__dirname, '../src/pages/SetlistPage.vue')
  const content = fs.readFileSync(pagePath, 'utf-8')

  it('renders a scrollable gig-chip-bar for fast setlist selection', () => {
    expect(content).toContain('class="gig-chip-bar')
    expect(content).toContain('selectedListOption === opt.value')
    expect(content).toContain("selectedListOption = 'new_gig'")
  })

  it('has responsive gig-chip-bar styles for smooth horizontal scrolling', () => {
    expect(content).toContain('.gig-chip-bar')
    expect(content).toContain('overflow-x: auto')
  })
})
