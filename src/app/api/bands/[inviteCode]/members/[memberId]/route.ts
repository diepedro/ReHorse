import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { bands, bandMembers } from '@/lib/schema'
import { eq, and, ilike } from 'drizzle-orm'
import { isColorBlocked, isMemberColor, normalizeMemberColor } from '@/lib/member-colors'
import { recordHistoryEvent } from '@/lib/history'

export const dynamic = 'force-dynamic'

// PATCH /api/bands/[inviteCode]/members/[memberId] — update own slot; admins can edit any slot
export async function PATCH(
  req: NextRequest,
  { params }: { params: { inviteCode: string; memberId: string } }
) {
  const session = await getServerSession(authOptions)
  const body = await req.json()
  const name = typeof body.displayName === 'string' ? body.displayName.trim() : undefined
  const color = typeof body.color === 'string' ? normalizeMemberColor(body.color) : undefined
  const actorMemberId = typeof body.actorMemberId === 'string' ? body.actorMemberId : null

  if (name !== undefined && !name) return NextResponse.json({ error: 'displayName cannot be empty' }, { status: 400 })
  if (color !== undefined && !isMemberColor(color)) return NextResponse.json({ error: 'Invalid color' }, { status: 400 })
  if (name === undefined && color === undefined) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const band = await db.query.bands.findFirst({
    where: ilike(bands.inviteCode, params.inviteCode),
    with: { members: true },
  })
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })
  const isAdmin = session?.user?.id === band.createdBy
  if (!isAdmin && actorMemberId !== params.memberId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const member = band.members.find((m) => m.id === params.memberId)
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  const actor = band.members.find((m) => m.id === actorMemberId) ?? null

  if (color && isColorBlocked(band.members, color, params.memberId)) {
    return NextResponse.json({ error: 'Essa cor ja esta em uso. Escolha uma cor livre.' }, { status: 409 })
  }

  const changes: Partial<typeof bandMembers.$inferInsert> = {}
  if (name !== undefined) changes.displayName = name
  if (color !== undefined) changes.color = color

  await db.update(bandMembers).set(changes).where(eq(bandMembers.id, params.memberId))

  if (name !== undefined && name !== member.displayName) {
    await recordHistoryEvent({
      bandId: band.id,
      actorMemberId: actor?.id ?? (isAdmin ? member.id : null),
      actorName: actor?.displayName ?? (isAdmin ? 'Administrador' : member.displayName),
      type: 'member_name_changed',
      subjectType: 'member',
      subjectId: member.id,
      subjectName: name,
      details: { from: member.displayName, to: name },
    })
  }

  if (color !== undefined && normalizeMemberColor(member.color) !== color) {
    await recordHistoryEvent({
      bandId: band.id,
      actorMemberId: actor?.id ?? (isAdmin ? member.id : null),
      actorName: actor?.displayName ?? (isAdmin ? 'Administrador' : member.displayName),
      type: 'member_color_changed',
      subjectType: 'member',
      subjectId: member.id,
      subjectName: name ?? member.displayName,
      details: { from: member.color, to: color },
    })
  }

  return NextResponse.json({ ok: true, displayName: name ?? member.displayName, color: color ?? member.color })
}

// DELETE /api/bands/[inviteCode]/members/[memberId] — remove slot (admin only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { inviteCode: string; memberId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const band = await db.query.bands.findFirst({
    where: ilike(bands.inviteCode, params.inviteCode),
  })

  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })
  if (band.createdBy !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const member = await db.query.bandMembers.findFirst({
    where: and(
      eq(bandMembers.id, params.memberId),
      eq(bandMembers.bandId, band.id)
    ),
  })

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  await db.delete(bandMembers).where(eq(bandMembers.id, params.memberId))

  await recordHistoryEvent({
    bandId: band.id,
    actorName: 'Administrador',
    type: 'member_removed',
    subjectType: 'member',
    subjectId: member.id,
    subjectName: member.displayName,
    details: { color: member.color },
  })

  return NextResponse.json({ ok: true })
}
