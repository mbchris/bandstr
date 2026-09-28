import { computed } from 'vue'
import { Capacitor } from '@capacitor/core'
import { platformIcon, type SupportedPlatform } from '../utils/platformIcons'

export function usePlatform() {
  const isNative = computed(() => {
    try {
      return Capacitor.isNativePlatform()
    } catch {
      return false
    }
  })

  const rawPlatform = computed<SupportedPlatform>(() => {
    try {
      const p = Capacitor.getPlatform()
      if (p === 'ios') return 'ios'
      if (p === 'android') return 'android'
      return 'web'
    } catch {
      return 'web'
    }
  })

  const isIos = computed(() => rawPlatform.value === 'ios')
  const isAndroid = computed(() => rawPlatform.value === 'android')
  const isWeb = computed(() => !isNative.value)
  const platform = computed<SupportedPlatform>(() => rawPlatform.value)

  /**
   * Helper to resolve icons for the active platform.
   */
  function pIcon(name: string): string {
    return platformIcon(name, platform.value)
  }

  return {
    isNative,
    isIos,
    isAndroid,
    isWeb,
    platform,
    pIcon,
  }
}
