import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Swipe Layout Cues in VotingPage and SetlistPage', () => {
  it('applies swipe affordance classes to VotingPage slide items', () => {
    const pagePath = path.resolve(__dirname, '../src/pages/VotingPage.vue')
    const content = fs.readFileSync(pagePath, 'utf-8')

    expect(content).toContain('swipeable-affordance-item')
    expect(content).toContain('has-swipe-left-affordance')
    expect(content).toContain('has-swipe-right-affordance')
  })

  it('applies swipe affordance classes to SetlistPage slide items', () => {
    const pagePath = path.resolve(__dirname, '../src/pages/SetlistPage.vue')
    const content = fs.readFileSync(pagePath, 'utf-8')

    expect(content).toContain('swipeable-affordance-item')
    expect(content).toContain('has-swipe-left-affordance')
  })
})
