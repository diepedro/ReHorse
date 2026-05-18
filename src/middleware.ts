import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory rate limiter (per-deployment, resets on restart)
// For production scale, replace with Redis-backed solution.
const store = new Map<string, { count: number; resetAt: number }>()

function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = store.get(key)
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= limit) return false
  entry.count++
  return true
}

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  Array.from(store.entries()).forEach(([key, entry]) => {
    if (now > entry.resetAt) store.delete(key)
  })
}, 5 * 60 * 1000)

export function middleware(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const path = req.nextUrl.pathname

  // Auth endpoints: 15 req / minute
  if (path.startsWith('/api/auth') || path === '/api/auth/register') {
    if (!rateLimit(`auth:${ip}`, 15, 60_000)) {
      return NextResponse.json({ error: 'Too many requests. Tente novamente em instantes.' }, { status: 429 })
    }
  }

  // Join / claim endpoints: 30 req / minute
  if (path.includes('/claim') || path.startsWith('/api/bands') && req.method === 'POST') {
    if (!rateLimit(`api:${ip}`, 30, 60_000)) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
