import type { BandMember } from '../stores/band'

export function getAutoBierwartCandidate(
  members: BandMember[],
  currentBierwartId?: string | null,
): BandMember | null {
  const eligible = members.filter((m) => !m.isHidden)
  if (eligible.length === 0) return null

  const sorted = [...eligible].sort((a, b) => {
    const aCount = (a.beerCount || 0) + (a.id === currentBierwartId ? 1 : 0)
    const bCount = (b.beerCount || 0) + (b.id === currentBierwartId ? 1 : 0)
    if (aCount !== bCount) {
      return aCount - bCount
    }
    const sortA = a.sortOrder ?? 0
    const sortB = b.sortOrder ?? 0
    if (sortA !== sortB) {
      return sortA - sortB
    }
    return (a.name || '').localeCompare(b.name || '')
  })

  return sorted[0] ?? null
}

export function calculateBeerMetrics(members: BandMember[]) {
  const visible = members.filter((m) => !m.isHidden)
  const counts = visible.map((m) => m.beerCount || 0)
  const maxBeerCount = counts.length > 0 ? Math.max(...counts) : 0
  const minBeerCount = counts.length > 0 ? Math.min(...counts) : 0
  const totalBeers = counts.reduce((sum, c) => sum + c, 0)

  return {
    maxBeerCount,
    minBeerCount,
    totalBeers,
    getRelativeProgress: (count: number) => {
      if (maxBeerCount <= 0) return 0
      return Math.min(1, Math.max(0, count / maxBeerCount))
    },
    isLowest: (memberId: string) => {
      if (visible.length <= 1) return false
      const member = visible.find((m) => m.id === memberId)
      if (!member) return false
      const count = member.beerCount || 0
      return count === minBeerCount && minBeerCount < maxBeerCount
    },
    isHighest: (memberId: string) => {
      if (visible.length <= 1) return false
      const member = visible.find((m) => m.id === memberId)
      if (!member) return false
      const count = member.beerCount || 0
      return count === maxBeerCount && maxBeerCount > minBeerCount
    },
  }
}
