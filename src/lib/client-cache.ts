import { publishOfflineStatus } from './offline-events'

type CacheEntry = {
  cachedAt: number
  expiresAt: number
  stale: boolean
  value: unknown
}

type PersistentEntry<T> = {
  cachedAt: number
  value: T
}

export type CachedJsonSource = 'network' | 'memory' | 'persistent'

export interface CachedJsonResult<T> {
  data: T
  source: CachedJsonSource
  stale: boolean
}

const memoryCache = new Map<string, CacheEntry>()
const PERSISTENT_CACHE = 'rehorse-api-json-v1'
const LOCAL_STORAGE_PREFIX = 'rehorse_api_json:'

export async function cachedJson<T>(url: string, ttlMs = 15000): Promise<T> {
  return (await cachedJsonWithMeta<T>(url, ttlMs)).data
}

export async function cachedJsonWithMeta<T>(url: string, ttlMs = 15000): Promise<CachedJsonResult<T>> {
  const now = Date.now()
  const key = normalizeUrl(url)
  const cached = memoryCache.get(key)
  if (ttlMs > 0 && cached && cached.expiresAt > now) {
    if (cached.stale) publishOfflineStatus(true, 'api-cache')
    return { data: cached.value as T, source: cached.stale ? 'persistent' : 'memory', stale: cached.stale }
  }

  let networkError: unknown = null
  let allowPersistentFallback = true

  try {
    const res = await fetch(url)
    const staleFromServiceWorker = res.headers.get('X-ReHorse-Cache') === 'stale'

    if (res.ok) {
      const value = await res.json() as T
      memoryCache.set(key, { value, cachedAt: now, expiresAt: now + ttlMs, stale: staleFromServiceWorker })
      await writePersistent(key, value)
      publishOfflineStatus(staleFromServiceWorker, staleFromServiceWorker ? 'api-cache' : 'network')
      return { data: value, source: staleFromServiceWorker ? 'persistent' : 'network', stale: staleFromServiceWorker }
    }

    if (res.status < 500) {
      allowPersistentFallback = false
      publishOfflineStatus(false, 'network')
    }
    networkError = new Error(`Request failed: ${url}`)
  } catch (error) {
    networkError = error
  }

  if (allowPersistentFallback) {
    const persistent = await readPersistent<T>(key)
    if (persistent) {
      memoryCache.set(key, {
        value: persistent.value,
        cachedAt: persistent.cachedAt,
        expiresAt: now + ttlMs,
        stale: true,
      })
      publishOfflineStatus(true, 'api-cache')
      return { data: persistent.value, source: 'persistent', stale: true }
    }
  }

  if (!allowPersistentFallback) {
    if (networkError instanceof Error) throw networkError
    throw new Error(`Request failed: ${url}`)
  }

  publishOfflineStatus(true, 'api-error')
  if (networkError instanceof Error) throw networkError
  throw new Error(`Request failed: ${url}`)
}

export function invalidateCache(prefix: string) {
  const normalizedPrefix = normalizeUrl(prefix)
  for (const key of Array.from(memoryCache.keys())) {
    if (key.startsWith(normalizedPrefix)) memoryCache.delete(key)
  }
}

function normalizeUrl(url: string) {
  if (typeof window === 'undefined') return url
  return new URL(url, window.location.origin).href
}

async function writePersistent<T>(key: string, value: T) {
  if (typeof window === 'undefined') return

  const entry: PersistentEntry<T> = {
    cachedAt: Date.now(),
    value,
  }

  if ('caches' in window) {
    try {
      const cache = await caches.open(PERSISTENT_CACHE)
      await cache.put(key, new Response(JSON.stringify(entry), {
        headers: {
          'Content-Type': 'application/json',
          'X-ReHorse-Client-Cache': '1',
        },
      }))
      return
    } catch {
      // Fall back to localStorage below.
    }
  }

  try {
    window.localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${key}`, JSON.stringify(entry))
  } catch {
    // A failed persistent write should not block online data.
  }
}

async function readPersistent<T>(key: string): Promise<PersistentEntry<T> | null> {
  if (typeof window === 'undefined') return null

  if ('caches' in window) {
    try {
      const cache = await caches.open(PERSISTENT_CACHE)
      const cached = await cache.match(key)
      if (cached) return await cached.json() as PersistentEntry<T>
    } catch {
      // Try localStorage below.
    }
  }

  try {
    const raw = window.localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${key}`)
    return raw ? JSON.parse(raw) as PersistentEntry<T> : null
  } catch {
    return null
  }
}
