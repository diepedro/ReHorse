type CacheEntry = {
  expiresAt: number
  value: unknown
}

const memoryCache = new Map<string, CacheEntry>()

export async function cachedJson<T>(url: string, ttlMs = 15000): Promise<T> {
  const now = Date.now()
  const cached = memoryCache.get(url)
  if (cached && cached.expiresAt > now) return cached.value as T

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Request failed: ${url}`)
  const value = await res.json() as T
  memoryCache.set(url, { value, expiresAt: now + ttlMs })
  return value
}

export function invalidateCache(prefix: string) {
  for (const key of Array.from(memoryCache.keys())) {
    if (key.startsWith(prefix)) memoryCache.delete(key)
  }
}
