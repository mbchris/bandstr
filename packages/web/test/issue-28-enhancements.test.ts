import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { formatDuration, formatTotalDuration } from '../src/utils/export'

describe('Issue #28 Usability Enhancements (OPEN items)', () => {
  it('formats total duration in hh:mm:ss format', () => {
    // 0 ms -> 00:00:00
    expect(formatTotalDuration(0)).toBe('00:00:00')

    // 45 minutes, 30 seconds -> 00:45:30
    expect(formatTotalDuration((45 * 60 + 30) * 1000)).toBe('00:45:30')

    // 1 hour, 15 minutes, 20 seconds -> 01:15:20
    expect(formatTotalDuration((1 * 3600 + 15 * 60 + 20) * 1000)).toBe('01:15:20')

    // 2 hours, 5 minutes, 9 seconds -> 02:05:09
    expect(formatTotalDuration((2 * 3600 + 5 * 60 + 9) * 1000)).toBe('02:05:09')

    // Negative / invalid
    expect(formatTotalDuration(-100)).toBe('00:00:00')

    // Regular per-song formatDuration stays mm:ss
    expect(formatDuration((3 * 60 + 45) * 1000)).toBe('3:45')
  })

  it('uses formatTotalDuration for setlist total duration display in SetlistPage.vue', () => {
    const pagePath = path.resolve(__dirname, '../src/pages/SetlistPage.vue')
    const content = fs.readFileSync(pagePath, 'utf-8')

    expect(content).toContain('formatTotalDuration(totalDurationMs)')
    expect(content).toMatch(/Total Duration:\s*\{\{\s*formatTotalDuration\(totalDurationMs\)\s*\}\}/)
  })

  it('configures event modal dialog with position top, top spacing, and 30% reduced width in CalendarPage.vue', () => {
    const pagePath = path.resolve(__dirname, '../src/pages/CalendarPage.vue')
    const content = fs.readFileSync(pagePath, 'utf-8')

    // Dialog positioned at top
    expect(content).toMatch(/<q-dialog v-model="showEventModal" position="top">/)

    // Card style decreased by ~30% (from 450px to 315px) and moved down (margin-top: 84px) to leave space for app header
    expect(content).toMatch(/max-width:\s*315px/)
    expect(content).toMatch(/margin-top:\s*84px/)
  })

  it('places Rehearsal Start/End and Gig Start/End on 2 lines side-by-side in AdminPage.vue', () => {
    const pagePath = path.resolve(__dirname, '../src/pages/AdminPage.vue')
    const content = fs.readFileSync(pagePath, 'utf-8')

    // Should not stack as col-12 col-sm-6
    expect(content).not.toMatch(/col-12 col-sm-6[\s\S]*?defaultRehearsalStartTime/)

    // Rehearsal start & end in same row with col-6
    expect(content).toMatch(/<div class="row q-col-gutter-sm">[\s\S]*?defaultRehearsalStartTime[\s\S]*?defaultRehearsalEndTime/)

    // Gig start & end in same row with col-6
    expect(content).toMatch(/<div class="row q-col-gutter-sm">[\s\S]*?defaultGigStartTime[\s\S]*?defaultGigEndTime/)
  })

  it('has calendar.rehearsal, calendar.gig, and common.ok defined in both English and German', async () => {
    const { default: en } = await import('../src/i18n/en')
    const { default: de } = await import('../src/i18n/de')

    expect(en.common).toHaveProperty('ok')
    expect(en.common.ok).toBe('OK')
    expect(de.common).toHaveProperty('ok')
    expect(de.common.ok).toBe('OK')

    expect(en.calendar).toHaveProperty('rehearsal')
    expect(en.calendar.rehearsal).toBe('Rehearsal')
    expect(de.calendar).toHaveProperty('rehearsal')
    expect(de.calendar.rehearsal).toBe('Probe')

    expect(en.calendar).toHaveProperty('gig')
    expect(en.calendar.gig).toBe('Gig')
    expect(de.calendar).toHaveProperty('gig')
    expect(de.calendar.gig).toBe('Auftritt')
  })
})
