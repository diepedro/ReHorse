import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { bandNotificationRecipients, bandNotifications, bands } from '@/lib/schema'
import { and, desc, eq, ilike } from 'drizzle-orm'
import { pushToBand } from '@/lib/push'

export const dynamic = 'force-dynamic'

async function getAdminBand(inviteCode: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Unauthorized' as const, status: 401 as const }

  const band = await db.query.bands.findFirst({
    where: ilike(bands.inviteCode, inviteCode),
  })

  if (!band) return { error: 'Band not found' as const, status: 404 as const }
  if (band.createdBy !== session.user.id) return { error: 'Forbidden' as const, status: 403 as const }

  return { band, session }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { inviteCode: string } },
) {
  const admin = await getAdminBand(params.inviteCode)
  if ('error' in admin) return NextResponse.json({ error: admin.error }, { status: admin.status })

  const notifications = await db
    .select()
    .from(bandNotifications)
    .where(eq(bandNotifications.bandId, admin.band.id))
    .orderBy(desc(bandNotifications.createdAt))
    .limit(10)

  if (notifications.length === 0) return NextResponse.json([])

  const rows = await db
    .select()
    .from(bandNotificationRecipients)
    .where(eq(bandNotificationRecipients.notificationId, notifications[0].id))

  const remaining = notifications.slice(1)
  for (const notification of remaining) {
    rows.push(...await db
      .select()
      .from(bandNotificationRecipients)
      .where(eq(bandNotificationRecipients.notificationId, notification.id)))
  }

  return NextResponse.json(notifications.map((notification) => {
    const recipients = rows.filter((row) => row.notificationId === notification.id)
    return {
      ...notification,
      stats: {
        targets: recipients.length,
        sent: recipients.filter((row) => ['sent', 'received', 'opened'].includes(row.status)).length,
        received: recipients.filter((row) => row.receivedAt || row.openedAt).length,
        opened: recipients.filter((row) => row.openedAt).length,
        failed: recipients.filter((row) => row.status === 'failed').length,
        noSubscription: recipients.filter((row) => row.status === 'no_subscription').length,
      },
      recipients,
    }
  }))
}

export async function POST(
  request: NextRequest,
  { params }: { params: { inviteCode: string } },
) {
  const admin = await getAdminBand(params.inviteCode)
  if ('error' in admin) return NextResponse.json({ error: admin.error }, { status: admin.status })

  const body = await request.json().catch(() => null)
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const message = typeof body?.message === 'string' ? body.message.trim() : ''

  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 })
  if (title.length > 80) return NextResponse.json({ error: 'title too long' }, { status: 400 })
  if (message.length > 240) return NextResponse.json({ error: 'message too long' }, { status: 400 })

  const notificationTitle = title || `Aviso - ${admin.band.name}`
  const notificationUrl = `/band/${admin.band.inviteCode}/rehearsals`
  const [notification] = await db.insert(bandNotifications).values({
    bandId: admin.band.id,
    createdBy: admin.session.user.id,
    title: notificationTitle,
    body: message,
    url: notificationUrl,
  }).returning()

  const result = await pushToBand(admin.band.id, {
    title: notificationTitle,
    body: message,
    url: notificationUrl,
  }, {
    notificationId: notification.id,
  })

  return NextResponse.json({ ok: true, notificationId: notification.id, result })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { inviteCode: string } },
) {
  const admin = await getAdminBand(params.inviteCode)
  if ('error' in admin) return NextResponse.json({ error: admin.error }, { status: admin.status })

  const id = Number(new URL(request.url).searchParams.get('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'notification id required' }, { status: 400 })
  }

  const deleted = await db
    .delete(bandNotifications)
    .where(and(
      eq(bandNotifications.id, id),
      eq(bandNotifications.bandId, admin.band.id),
    ))
    .returning({ id: bandNotifications.id })

  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
