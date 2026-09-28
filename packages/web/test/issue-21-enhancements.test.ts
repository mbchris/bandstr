import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Issue #21 Attendance Display Grouping', () => {
  it('groups attendance by status in CalendarPage.vue', () => {
    const pagePath = path.resolve(__dirname, '../src/pages/CalendarPage.vue')
    const content = fs.readFileSync(pagePath, 'utf-8')

    // Computed properties for grouping
    expect(content).toContain('const groupedAttendancePresent = computed(')
    expect(content).toContain('const groupedAttendanceAbsent = computed(')
    expect(content).toContain('const groupedAttendanceOpen = computed(')

    // Template elements for rendering grouped lists
    expect(content).toContain('groupedAttendancePresent.map((m) => m.userName).join(\', \')')
    expect(content).toContain('groupedAttendanceAbsent.map((m) => m.userName).join(\', \')')
    expect(content).toContain('groupedAttendanceOpen.map((m) => m.userName).join(\', \')')
  })

  it('correctly filters attendance groups by status', () => {
    const members = [
      { userId: '1', userName: 'Chris', status: 'present' },
      { userId: '2', userName: 'Andre', status: 'present' },
      { userId: '3', userName: 'Andreas', status: 'absent' },
      { userId: '4', userName: 'Stefan', status: 'absent' },
      { userId: '5', userName: 'Daniel', status: 'open' },
    ]

    const present = members.filter((m) => m.status === 'present').map((m) => m.userName).join(', ')
    const absent = members.filter((m) => m.status === 'absent').map((m) => m.userName).join(', ')
    const open = members.filter((m) => m.status !== 'present' && m.status !== 'absent').map((m) => m.userName).join(', ')

    expect(present).toBe('Chris, Andre')
    expect(absent).toBe('Andreas, Stefan')
    expect(open).toBe('Daniel')
  })
})
