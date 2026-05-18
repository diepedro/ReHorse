import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { pushSubscriptions } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// POST — save push subscription
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const body = await req.json()
  const { endpoint, keys } = body

  if (!endpoint || !keys?.p256dh || !keys?.auth)
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })

  await db.insert(pushSubscriptions)
    .values({
      userId: session?.user?.id ?? null,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: session?.user?.id ?? null },
    })

  return NextResponse.json({ ok: true })
}

// DELETE — remove push subscription
export async function DELETE(req: NextRequest) {
  const { endpoint } = await req.json()
  if (!endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 })
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
  return NextResponse.json({ ok: true })
}
