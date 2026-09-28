import { describe, it, expect, vi, beforeEach } from 'vitest'
import { platformIcon, ICON_MAP } from '../src/utils/platformIcons'
import { usePlatform } from '../src/composables/usePlatform'
import { Capacitor } from '@capacitor/core'

describe('platformIcon mapping', () => {
  it('resolves semantic replacements on Android and Web to Material Icons', () => {
    expect(platformIcon('push_pin', 'android')).toBe('push_pin')
    expect(platformIcon('library_add', 'android')).toBe('library_add')
    expect(platformIcon('thumb_up', 'android')).toBe('thumb_up')
    expect(platformIcon('thumb_down', 'android')).toBe('thumb_down')
    expect(platformIcon('done', 'android')).toBe('done')
    expect(platformIcon('inventory_2', 'android')).toBe('inventory_2')
    expect(platformIcon('replay', 'android')).toBe('replay')
    expect(platformIcon('drag_handle', 'android')).toBe('drag_handle')

    // Web should use Android / Material default
    expect(platformIcon('push_pin', 'web')).toBe('push_pin')
    expect(platformIcon('library_add', 'web')).toBe('library_add')
  })

  it('resolves icons on iOS to Ionicons equivalents', () => {
    expect(platformIcon('add', 'ios')).toBe('ion-ios-add')
    expect(platformIcon('edit', 'ios')).toBe('ion-ios-create')
    expect(platformIcon('delete', 'ios')).toBe('ion-ios-trash')
    expect(platformIcon('close', 'ios')).toBe('ion-ios-close')
    expect(platformIcon('push_pin', 'ios')).toBe('ion-ios-pin')
    expect(platformIcon('library_add', 'ios')).toBe('ion-ios-add-circle-outline')
    expect(platformIcon('library_add_check', 'ios')).toBe('ion-ios-checkmark-circle-outline')
    expect(platformIcon('thumb_up', 'ios')).toBe('ion-ios-thumbs-up')
    expect(platformIcon('thumb_down', 'ios')).toBe('ion-ios-thumbs-down')
    expect(platformIcon('done', 'ios')).toBe('ion-ios-checkmark')
    expect(platformIcon('inventory_2', 'ios')).toBe('ion-ios-archive')
    expect(platformIcon('replay', 'ios')).toBe('ion-ios-refresh')
    expect(platformIcon('drag_handle', 'ios')).toBe('ion-ios-menu')
  })

  it('falls back safely to original name for unmapped icons', () => {
    expect(platformIcon('some_non_existent_icon', 'ios')).toBe('some_non_existent_icon')
    expect(platformIcon('some_non_existent_icon', 'android')).toBe('some_non_existent_icon')
  })

  it('contains at least 50 mapped icons covering app features', () => {
    expect(Object.keys(ICON_MAP).length).toBeGreaterThanOrEqual(50)
  })
})

describe('usePlatform composable', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('detects iOS native platform correctly', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('ios')

    const { isIos, isAndroid, isNative, isWeb, platform, pIcon } = usePlatform()

    expect(isIos.value).toBe(true)
    expect(isAndroid.value).toBe(false)
    expect(isNative.value).toBe(true)
    expect(isWeb.value).toBe(false)
    expect(platform.value).toBe('ios')
    expect(pIcon('add')).toBe('ion-ios-add')
  })

  it('detects Android native platform correctly', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')

    const { isIos, isAndroid, isNative, isWeb, platform, pIcon } = usePlatform()

    expect(isIos.value).toBe(false)
    expect(isAndroid.value).toBe(true)
    expect(isNative.value).toBe(true)
    expect(isWeb.value).toBe(false)
    expect(platform.value).toBe('android')
    expect(pIcon('add')).toBe('add')
  })

  it('detects web platform correctly', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('web')

    const { isIos, isAndroid, isNative, isWeb, platform, pIcon } = usePlatform()

    expect(isIos.value).toBe(false)
    expect(isAndroid.value).toBe(false)
    expect(isNative.value).toBe(false)
    expect(isWeb.value).toBe(true)
    expect(platform.value).toBe('web')
    expect(pIcon('add')).toBe('add')
  })
})
