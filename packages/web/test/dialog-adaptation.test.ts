import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDialog } from '../src/composables/useDialog'
import { Capacitor } from '@capacitor/core'
import fs from 'node:fs'
import path from 'node:path'

describe('useDialog composable & bottom sheet adaptation', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('provides bottom position on iOS and standard on Android/Web', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('ios')

    const { dialogPosition, isIos } = useDialog()
    expect(isIos.value).toBe(true)
    expect(dialogPosition.value).toBe('bottom')

    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')
    const androidDialog = useDialog()
    expect(androidDialog.isIos.value).toBe(false)
    expect(androidDialog.dialogPosition.value).toBe('standard')
  })

  it('configures Action Sheet styling on iOS in confirmDialog', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('ios')

    const mockQDialog = vi.fn().mockReturnValue({ onOk: vi.fn(), onCancel: vi.fn() })
    const mockQ = { dialog: mockQDialog } as any

    const { confirmDialog } = useDialog(mockQ)
    confirmDialog({
      title: 'Delete Song',
      message: 'Are you sure?',
      isDestructive: true,
    })

    expect(mockQDialog).toHaveBeenCalledTimes(1)
    const callArgs = mockQDialog.mock.calls[0][0]
    expect(callArgs.position).toBe('bottom')
    expect(callArgs.class).toContain('ios-action-sheet')
    expect(callArgs.ok.color).toBe('negative')
  })

  it('configures standard centered dialog on Android/Web in confirmDialog', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')

    const mockQDialog = vi.fn().mockReturnValue({ onOk: vi.fn(), onCancel: vi.fn() })
    const mockQ = { dialog: mockQDialog } as any

    const { confirmDialog } = useDialog(mockQ)
    confirmDialog({
      title: 'Delete Song',
      message: 'Are you sure?',
      isDestructive: true,
    })

    expect(mockQDialog).toHaveBeenCalledTimes(1)
    const callArgs = mockQDialog.mock.calls[0][0]
    expect(callArgs.position).toBe('standard')
  })

  it('adapts form dialogs with iOS bottom position in key pages', () => {
    const pagesDir = path.resolve(__dirname, '../src/pages')
    const setlistContent = fs.readFileSync(path.resolve(pagesDir, 'SetlistPage.vue'), 'utf8')
    const votingContent = fs.readFileSync(path.resolve(pagesDir, 'VotingPage.vue'), 'utf8')
    const calendarContent = fs.readFileSync(path.resolve(pagesDir, 'CalendarPage.vue'), 'utf8')
    const dashboardContent = fs.readFileSync(path.resolve(pagesDir, 'DashboardPage.vue'), 'utf8')

    expect(setlistContent).toMatch(/position="isIos \? 'bottom' : 'standard'"|:position="isIos \? 'bottom' : 'standard'"/)
    expect(votingContent).toMatch(/position="isIos \? 'bottom' : 'standard'"|:position="isIos \? 'bottom' : 'standard'"/)
    expect(calendarContent).toMatch(/position="isIos \? 'bottom' : 'standard'"|:position="isIos \? 'bottom' : 'standard'"/)
    expect(dashboardContent).toMatch(/position="isIos \? 'bottom' : 'standard'"|:position="isIos \? 'bottom' : 'standard'"/)

    expect(setlistContent).toContain('ios-sheet-grabber')
    expect(votingContent).toContain('ios-sheet-grabber')
    expect(calendarContent).toContain('ios-sheet-grabber')
    expect(dashboardContent).toContain('ios-sheet-grabber')
  })
})
