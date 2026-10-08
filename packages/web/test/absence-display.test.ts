import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Absence & Attendance Display on Main Page (Issue #48)', () => {
  const indexPath = path.resolve(__dirname, '../src/pages/IndexPage.vue')
  const indexContent = fs.readFileSync(indexPath, 'utf-8')

  it('provides click-to-expand state instead of pure hover for attendance', () => {
    expect(indexContent).toContain('isAttendanceExpanded')
    expect(indexContent).toContain('@click="isAttendanceExpanded = !isAttendanceExpanded"')
    expect(indexContent).not.toContain('<q-tooltip>{{ attendanceNamesLabel }}</q-tooltip>')
  })

  it('groups members by Rejected (Absent), Accepted (Present), and Pending (Open)', () => {
    expect(indexContent).toContain('groupedAttendanceAccepted')
    expect(indexContent).toContain('groupedAttendanceRejected')
    expect(indexContent).toContain('groupedAttendancePending')
  })

  it('renders coloured sections for Rejected (red), Accepted (green), and Pending (grey)', () => {
    expect(indexContent).toContain('bg-red-1 text-negative')
    expect(indexContent).toContain("t('home.attendanceGroupRejected')")
    expect(indexContent).toContain('bg-green-1 text-positive')
    expect(indexContent).toContain("t('home.attendanceGroupAccepted')")
    expect(indexContent).toContain('bg-grey-2 text-grey-8')
    expect(indexContent).toContain("t('home.attendanceGroupPending')")
  })

  it('renders avatar stack and badge counts in the collapsed header', () => {
    expect(indexContent).toContain('attendance-header')
    expect(indexContent).toContain('groupedAttendanceRejected.length')
    expect(indexContent).toContain('groupedAttendanceAccepted.length')
    expect(indexContent).toContain('groupedAttendancePending.length')
  })
})
