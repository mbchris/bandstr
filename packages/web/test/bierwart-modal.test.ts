import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getAutoBierwartCandidate } from '../src/utils/bierwart'

describe('Bierwart Modal & Auto Assigner (Issue #44)', () => {
  const indexPath = path.resolve(__dirname, '../src/pages/IndexPage.vue')
  const indexContent = fs.readFileSync(indexPath, 'utf-8')

  it('imports and uses getAutoBierwartCandidate and calculateBeerMetrics', () => {
    expect(indexContent).toContain('getAutoBierwartCandidate')
    expect(indexContent).toContain('calculateBeerMetrics')
  })

  it('computes autoCandidate based on visible members and current bierwart', () => {
    expect(indexContent).toContain('autoCandidate = computed(() => getAutoBierwartCandidate(visibleMembers.value, bierwart.value?.id))')
  })

  it('renders auto assigner item in Bierwart selection dialog', () => {
    expect(indexContent).toContain('v-if="autoCandidate"')
    expect(indexContent).toContain('auto-assign-item')
    expect(indexContent).toContain("confirmBierwart(autoCandidate, true)")
    expect(indexContent).toContain("t('home.autoAssign')")
  })

  it('increments outgoing bierwart beer counter upon confirmation', () => {
    expect(indexContent).toMatch(/if\s*\(outgoingBierwart\?\.id\)\s*\{[\s\S]*?PATCH[\s\S]*?beerCount:\s*\(outgoingBierwart\.beerCount\s*\|\|\s*0\)\s*\+\s*1/)
  })

  it('selects the lowest count member deterministically with tie-breaker', () => {
    const candidate = getAutoBierwartCandidate([
      { id: '1', name: 'Member A', email: 'a@ex.com', role: 'member', sortOrder: 2, isHidden: false, beerCount: 3, joinedAt: '' },
      { id: '2', name: 'Member B', email: 'b@ex.com', role: 'member', sortOrder: 1, isHidden: false, beerCount: 1, joinedAt: '' },
      { id: '3', name: 'Member C', email: 'c@ex.com', role: 'member', sortOrder: 0, isHidden: false, beerCount: 2, joinedAt: '' },
    ], '1')
    expect(candidate?.id).toBe('2')
  })
})
