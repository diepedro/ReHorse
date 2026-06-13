import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { bands, bandMembers, pushSubscriptions } from '@/lib/schema'
import { and, eq, ilike } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// POST — save push subscription
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const body = await req.json()
  const { endpoint, keys } = body

  if (!endpoint || !keys?.p256dh || !keys?.auth)
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })

  const linkedUserId = await resolvePushUserId({
    inviteCode: typeof body.inviteCode === 'string' ? body.inviteCode : null,
    memberId: typeof body.memberId === 'string' ? body.memberId : null,
    sessionUserId: session?.user?.id ?? null,
  })

  await db.insert(pushSubscriptions)
    .values({
      userId: linkedUserId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: linkedUserId, p256dh: keys.p256dh, auth: keys.auth },
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

async function resolvePushUserId({
  inviteCode,
  memberId,
  sessionUserId,
}: {
  inviteCode: string | null
  memberId: string | null
  sessionUserId: string | null
}) {
  if (inviteCode && memberId) {
    const band = await db.query.bands.findFirst({
      where: ilike(bands.inviteCode, inviteCode),
    })

    if (band) {
      const member = await db.query.bandMembers.findFirst({
        where: and(eq(bandMembers.id, memberId), eq(bandMembers.bandId, band.id)),
      })

      if (member?.claimedBy) return member.claimedBy
    }
  }

  return sessionUserId
}
