import { boot } from 'quasar/wrappers'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import type { LocationQueryRaw } from 'vue-router'

type ParsedDeepLink = {
  path: string
  query: LocationQueryRaw
}

function parseQuery(queryString: string): LocationQueryRaw {
  const params = new URLSearchParams(queryString)
  const query: LocationQueryRaw = {}
  params.forEach((value, key) => {
    query[key] = value
  })
  return query
}

function parseCapacitorDeepLink(rawUrl: string): ParsedDeepLink | null {
  try {
    const parsed = new URL(rawUrl)

    // Our callback primarily carries route/query in hash form: #/login?...,
    // but keep pathname/query fallback for non-hash variants.
    const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash
    if (hash.startsWith('/')) {
      const [pathPart, queryPart = ''] = hash.split('?', 2)
      return {
        path: pathPart || '/login',
        query: parseQuery(queryPart),
      }
    }

    const path = parsed.pathname?.startsWith('/') ? parsed.pathname : '/login'
    return {
      path,
      query: parseQuery(parsed.search.startsWith('?') ? parsed.search.slice(1) : parsed.search),
    }
  } catch {
    return null
  }
}

export default boot(async ({ router }) => {
  if (!Capacitor.isNativePlatform()) return

  const applyDeepLink = async (incomingUrl: string) => {
    const parsed = parseCapacitorDeepLink(incomingUrl)
    if (!parsed) return

    await router.replace({
      path: parsed.path || '/login',
      query: parsed.query,
    })
  }

  const launch = await App.getLaunchUrl().catch(() => null)
  if (launch?.url) {
    await applyDeepLink(launch.url)
  }

  App.addListener('appUrlOpen', ({ url }) => {
    if (!url) return
    void applyDeepLink(url)
  })
})
