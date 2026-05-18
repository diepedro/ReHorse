const APP_VERSION = 'v2'
const SHELL_CACHE = `rehorse-shell-${APP_VERSION}`
const ASSET_CACHE = `rehorse-assets-${APP_VERSION}`
const OFFLINE_URL = '/offline'

const APP_SHELL = [
  OFFLINE_URL,
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![SHELL_CACHE, ASSET_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  if (isStaticAsset(request, url)) {
    event.respondWith(cacheFirst(request))
  }
})

async function networkFirstNavigation(request) {
  try {
    return await fetch(request)
  } catch {
    return (await caches.match(OFFLINE_URL)) ?? Response.error()
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response && response.ok) {
    const cache = await caches.open(ASSET_CACHE)
    cache.put(request, response.clone())
  }
  return response
}

function isStaticAsset(request, url) {
  if (url.pathname.startsWith('/_next/static/')) return true
  if (url.pathname.startsWith('/icons/')) return true
  if (['style', 'script', 'font', 'image'].includes(request.destination)) return true
  return ['/manifest.json', '/favicon.svg'].includes(url.pathname)
}

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'ReHorse', {
      body: data.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(openNotificationTarget(event.notification.data?.url ?? '/'))
})

async function openNotificationTarget(path) {
  const targetUrl = new URL(path, self.location.origin).href
  const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })
  const existing = windows.find((client) => client.url === targetUrl)
  if (existing) return existing.focus()
  return clients.openWindow(targetUrl)
}
