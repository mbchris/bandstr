import { describe, it, expect } from 'vitest'
import { getAutoBierwartCandidate, calculateBeerMetrics } from '../src/utils/bierwart'
import type { BandMember } from '../src/stores/band'

describe('Bierwart Utils', () => {
  const createMember = (id: string, name: string, beerCount: number, sortOrder = 0, isHidden = false): BandMember => ({
    id,
    name,
    email: `${id}@example.com`,
    role: 'member',
    sortOrder,
    isHidden,
    beerCount,
    joinedAt: new Date().toISOString(),
  })

  describe('getAutoBierwartCandidate', () => {
    it('returns member with lowest beer count', () => {
      const members = [
        createMember('1', 'Alice', 5),
        createMember('2', 'Bob', 2),
        createMember('3', 'Charlie', 4),
      ]
      const candidate = getAutoBierwartCandidate(members, '1')
      expect(candidate?.id).toBe('2')
    })

    it('breaks ties using sortOrder then alphabetical name', () => {
      const members = [
        createMember('1', 'Dave', 2, 2),
        createMember('2', 'Bob', 2, 1),
        createMember('3', 'Alice', 2, 1),
      ]
      // SortOrder 1 comes before 2; Alice comes before Bob alphabetically
      const candidate = getAutoBierwartCandidate(members)
      expect(candidate?.id).toBe('3')
    })

    it('considers current Bierwart increment when handing over', () => {
      const members = [
        createMember('1', 'Alice', 1),
        createMember('2', 'Bob', 1),
      ]
      // Alice is current Bierwart. Handing over makes her effective count 2, so Bob (count 1) is chosen.
      const candidate = getAutoBierwartCandidate(members, '1')
      expect(candidate?.id).toBe('2')
    })

    it('excludes hidden members', () => {
      const members = [
        createMember('1', 'Hidden User', 0, 0, true),
        createMember('2', 'Active User', 3, 0, false),
      ]
      const candidate = getAutoBierwartCandidate(members)
      expect(candidate?.id).toBe('2')
    })

    it('returns null when no eligible members exist', () => {
      expect(getAutoBierwartCandidate([])).toBeNull()
      expect(getAutoBierwartCandidate([createMember('1', 'Hidden', 0, 0, true)])).toBeNull()
    })
  })

  describe('calculateBeerMetrics', () => {
    it('calculates total, max, and relative progress safely without division by zero', () => {
      const zeroMembers = [
        createMember('1', 'Alice', 0),
        createMember('2', 'Bob', 0),
      ]
      const zeroMetrics = calculateBeerMetrics(zeroMembers)
      expect(zeroMetrics.totalBeers).toBe(0)
      expect(zeroMetrics.maxBeerCount).toBe(0)
      expect(zeroMetrics.getRelativeProgress(0)).toBe(0)

      const members = [
        createMember('1', 'Alice', 10),
        createMember('2', 'Bob', 5),
        createMember('3', 'Charlie', 0),
      ]
      const metrics = calculateBeerMetrics(members)
      expect(metrics.totalBeers).toBe(15)
      expect(metrics.maxBeerCount).toBe(10)
      expect(metrics.getRelativeProgress(5)).toBe(0.5)
      expect(metrics.getRelativeProgress(10)).toBe(1)
      expect(metrics.isHighest('1')).toBe(true)
      expect(metrics.isLowest('3')).toBe(true)
      expect(metrics.isLowest('2')).toBe(false)
    })
  })
})
