import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bandNotificationRecipients } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const notificationId = Number(body?.notificationId)
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : ''
  const event = body?.event === 'opened' ? 'opened' : body?.event === 'received' ? 'received' : null

  if (!notificationId || !endpoint || !event) {
    return NextResponse.json({ error: 'notificationId, endpoint and event required' }, { status: 400 })
  }

  const now = new Date()
  await db.update(bandNotificationRecipients)
    .set(event === 'opened'
      ? { status: 'opened', receivedAt: now, openedAt: now }
      : { status: 'received', receivedAt: now })
    .where(and(
      eq(bandNotificationRecipients.notificationId, notificationId),
      eq(bandNotificationRecipients.endpoint, endpoint),
    ))

  return NextResponse.json({ ok: true })
}
