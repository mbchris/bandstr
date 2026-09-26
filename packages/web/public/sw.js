// bandstr Web Push Service Worker
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let title = 'bandstr'
  let options = {
    body: '',
    icon: '/favicons/favicon-128x128.png',
    badge: '/favicons/favicon-128x128.png',
    data: {
      path: '/',
      query: {},
    },
  }

  try {
    const payload = event.data.json()
    if (payload.title) title = payload.title
    if (payload.body) options.body = payload.body
    if (payload.path) options.data.path = payload.path
    if (payload.query) options.data.query = payload.query
  } catch {
    options.body = event.data.text()
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  const targetPath = data.path || '/'
  let targetUrl = targetPath

  if (data.query && typeof data.query === 'object') {
    const searchParams = new URLSearchParams()
    for (const [k, v] of Object.entries(data.query)) {
      if (v !== undefined && v !== null) {
        searchParams.append(k, String(v))
      }
    }
    const qs = searchParams.toString()
    if (qs) {
      targetUrl = `${targetPath}${targetPath.includes('?') ? '&' : '?'}${qs}`
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl)
          }
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    }),
  )
})
