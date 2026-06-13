const APP_VERSION = 'v7-icon-refresh'
const SHELL_CACHE = `rehorse-shell-${APP_VERSION}`
const ASSET_CACHE = `rehorse-assets-${APP_VERSION}`
const NAV_CACHE = `rehorse-nav-${APP_VERSION}`
const API_CACHE = `rehorse-api-${APP_VERSION}`
const OFFLINE_URL = '/offline'
const ICON_REVISION = '20260602'

const APP_SHELL = [
  '/',
  OFFLINE_URL,
  `/icons/rehorse-favicon-32.png?v=${ICON_REVISION}`,
  `/icons/rehorse-apple-touch.png?v=${ICON_REVISION}`,
  `/icons/rehorse-logo-192.png?v=${ICON_REVISION}`,
  `/icons/rehorse-logo-512.png?v=${ICON_REVISION}`,
  `/icons/rehorse-mark-96.png?v=${ICON_REVISION}`,
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
          .filter((key) => ![SHELL_CACHE, ASSET_CACHE, NAV_CACHE, API_CACHE].includes(key))
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
  if (isCacheableApi(url)) {
    event.respondWith(networkFirstApi(request))
    return
  }
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  if (url.pathname === '/manifest.json') {
    event.respondWith(networkFirstAsset(request))
    return
  }

  if (isStaticAsset(request, url)) {
    event.respondWith(cacheFirst(request))
  }
})

async function networkFirstNavigation(request) {
  const cache = await caches.open(NAV_CACHE)
  try {
    const response = await fetch(request)
    if (response && response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return (
      (await cache.match(request)) ??
      (await cache.match(new URL(request.url).pathname)) ??
      (await cache.match('/')) ??
      (await caches.match(OFFLINE_URL)) ??
      Response.error()
    )
  }
}

async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE)
  try {
    const response = await fetch(request)
    if (response && response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return withCacheHeader(cached, 'stale')
    return Response.error()
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

async function networkFirstAsset(request) {
  try {
    const response = await fetch(request)
    if (response && response.ok) {
      const cache = await caches.open(ASSET_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return (await caches.match(request)) ?? Response.error()
  }
}

function isStaticAsset(request, url) {
  if (url.pathname.startsWith('/_next/static/')) return true
  if (url.pathname.startsWith('/icons/')) return true
  if (['style', 'script', 'font', 'image'].includes(request.destination)) return true
  return ['/icons/rehorse-favicon-32.png', '/icons/rehorse-apple-touch.png'].includes(url.pathname)
}

function isCacheableApi(url) {
  return url.pathname.startsWith('/api/bands')
}

function withCacheHeader(response, cacheState) {
  const headers = new Headers(response.headers)
  headers.set('X-ReHorse-Cache', cacheState)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    Promise.all([
      trackNotification(data.notificationId, 'received'),
      self.registration.showNotification(data.title ?? 'ReHorse', {
        body: data.body ?? '',
        icon: `/icons/rehorse-logo-192.png?v=${ICON_REVISION}`,
        badge: `/icons/rehorse-logo-192.png?v=${ICON_REVISION}`,
        data: { url: data.url ?? '/', notificationId: data.notificationId },
      }),
    ])
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(Promise.all([
    trackNotification(event.notification.data?.notificationId, 'opened'),
    openNotificationTarget(event.notification.data?.url ?? '/'),
  ]))
})

async function trackNotification(notificationId, event) {
  if (!notificationId) return
  try {
    const sub = await self.registration.pushManager.getSubscription()
    if (!sub?.endpoint) return
    await fetch('/api/push/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId, event, endpoint: sub.endpoint }),
    })
  } catch {
    // Tracking is best-effort and must not block showing/opening notifications.
  }
}

async function openNotificationTarget(path) {
  const targetUrl = new URL(path, self.location.origin).href
  const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })
  const existing = windows.find((client) => client.url === targetUrl)
  if (existing) return existing.focus()
  return clients.openWindow(targetUrl)
}
