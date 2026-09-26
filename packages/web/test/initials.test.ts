import { describe, it, expect } from 'vitest'
import { getInitials } from '../src/utils/initials'

describe('getInitials', () => {
  it('returns ? for empty, null or undefined input', () => {
    expect(getInitials('')).toBe('?')
    expect(getInitials(null)).toBe('?')
    expect(getInitials(undefined)).toBe('?')
    expect(getInitials('   ')).toBe('?')
  })

  it('returns first two letters of a single word', () => {
    expect(getInitials('Chris')).toBe('CH')
    expect(getInitials('band')).toBe('BA')
    expect(getInitials('A')).toBe('A')
  })

  it('returns initials of first and last word', () => {
    expect(getInitials('John Doe')).toBe('JD')
    expect(getInitials('Ludwig van Beethoven')).toBe('LB')
    expect(getInitials('Miles Davis Quartet')).toBe('MQ')
  })
})
