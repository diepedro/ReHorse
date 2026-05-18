import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { bands, bandMembers } from '@/lib/schema'
import { eq, and, ilike } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// PATCH /api/bands/[inviteCode]/members/[memberId] — rename own slot (open trust)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { inviteCode: string; memberId: string } }
) {
  const body = await req.json()
  const name = (body.displayName ?? '').trim()
  if (!name) return NextResponse.json({ error: 'displayName required' }, { status: 400 })

  const band = await db.query.bands.findFirst({
    where: ilike(bands.inviteCode, params.inviteCode),
  })
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  const member = await db.query.bandMembers.findFirst({
    where: and(eq(bandMembers.id, params.memberId), eq(bandMembers.bandId, band.id)),
  })
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  await db.update(bandMembers).set({ displayName: name }).where(eq(bandMembers.id, params.memberId))

  return NextResponse.json({ ok: true, displayName: name })
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

  return NextResponse.json({ ok: true })
}
