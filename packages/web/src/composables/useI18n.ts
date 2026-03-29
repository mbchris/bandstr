import { computed, ref } from 'vue'
import en from '../i18n/en'
import de from '../i18n/de'

type Locale = 'en' | 'de'
type Params = Record<string, string | number>

const messages = { en, de } as const
const currentLocale = ref<Locale>('en')
let initialized = false

function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en'
  return (navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en'
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, obj)
}

export function useI18n() {
  if (!initialized) {
    initialized = true
    const saved = localStorage.getItem('bandstr-locale') as Locale | null
    currentLocale.value = saved === 'de' || saved === 'en' ? saved : detectBrowserLocale()
  }

  const locale = currentLocale

  function setLocale(next: Locale) {
    currentLocale.value = next
    localStorage.setItem('bandstr-locale', next)
  }

  function toggleLocale() {
    setLocale(locale.value === 'en' ? 'de' : 'en')
  }

  function t(key: string, params?: Params): string {
    const raw = getNestedValue(messages[locale.value] as unknown as Record<string, unknown>, key)
    if (typeof raw !== 'string') return key

    if (!params) return raw

    let translated = raw
    for (const [paramKey, paramValue] of Object.entries(params)) {
      translated = translated.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue))
    }

    return translated
  }

  function tv(key: string): unknown {
    return getNestedValue(messages[locale.value] as unknown as Record<string, unknown>, key)
  }

  const dateLocale = computed(() => (locale.value === 'de' ? 'de-DE' : 'en-US'))

  return { locale, setLocale, toggleLocale, t, tv, dateLocale }
}

export type { Locale }