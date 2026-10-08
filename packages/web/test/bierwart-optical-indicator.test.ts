import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { calculateBeerMetrics } from '../src/utils/bierwart'

describe('Bierwart Optical Indicators & Leaderboard (Issue #44)', () => {
  const indexPath = path.resolve(__dirname, '../src/pages/IndexPage.vue')
  const indexContent = fs.readFileSync(indexPath, 'utf-8')

  it('renders total beers summary banner with sports_bar icon in modal', () => {
    expect(indexContent).toContain("t('home.totalBeersBrought', { count: beerMetrics.totalBeers })")
    expect(indexContent).toContain("t('home.beerRanking')")
  })

  it('renders optical progress bars and badges for highest and lowest contributors', () => {
    expect(indexContent).toContain('beerMetrics.isHighest(member.id)')
    expect(indexContent).toContain("t('home.highestCountBadge')")
    expect(indexContent).toContain('beerMetrics.isLowest(member.id)')
    expect(indexContent).toContain("t('home.lowestCountBadge')")
    expect(indexContent).toContain('beerMetrics.getRelativeProgress(member.beerCount || 0)')
    expect(indexContent).toContain('<q-linear-progress')
  })

  it('enhances Home page Bierwart card with mini progress bar and count', () => {
    expect(indexContent).toContain('beerMetrics.getRelativeProgress(bierwart.beerCount || 0)')
    expect(indexContent).toContain('beerMetrics.isHighest(bierwart.id)')
  })

  it('calculates metrics correctly for varied contributions', () => {
    const members = [
      { id: '1', name: 'Max', email: 'm@ex.com', role: 'member', sortOrder: 0, isHidden: false, beerCount: 8, joinedAt: '' },
      { id: '2', name: 'Mid', email: 'mid@ex.com', role: 'member', sortOrder: 1, isHidden: false, beerCount: 4, joinedAt: '' },
      { id: '3', name: 'Low', email: 'low@ex.com', role: 'member', sortOrder: 2, isHidden: false, beerCount: 1, joinedAt: '' },
    ]
    const metrics = calculateBeerMetrics(members)
    expect(metrics.totalBeers).toBe(13)
    expect(metrics.maxBeerCount).toBe(8)
    expect(metrics.minBeerCount).toBe(1)
    expect(metrics.getRelativeProgress(4)).toBe(0.5)
    expect(metrics.isHighest('1')).toBe(true)
    expect(metrics.isLowest('3')).toBe(true)
    expect(metrics.isLowest('2')).toBe(false)
  })
})
