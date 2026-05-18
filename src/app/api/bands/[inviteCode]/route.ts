import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { bands } from '@/lib/schema'
import { eq, ilike } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// GET /api/bands/[inviteCode] — get band info + member slots (public)
export async function GET(
  _req: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const band = await db.query.bands.findFirst({
    where: ilike(bands.inviteCode, params.inviteCode),
    with: { members: true },
  })

  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  // Sort members by sortOrder
  const sorted = [...band.members].sort((a, b) => a.sortOrder - b.sortOrder)

  return NextResponse.json({
    id: band.id,
    name: band.name,
    inviteCode: band.inviteCode,
    createdBy: band.createdBy,
    createdAt: band.createdAt,
    rehearsalDate: band.rehearsalDate,
    rehearsalTime: band.rehearsalTime,
    rehearsalNote: band.rehearsalNote,
    members: sorted.map((m) => ({
      id: m.id,
      bandId: m.bandId,
      displayName: m.displayName,
      color: m.color,
      sortOrder: m.sortOrder,
      claimed: m.claimedBy !== null,
      claimedBy: m.claimedBy,
    })),
  })
}

// DELETE /api/bands/[inviteCode] — delete band (admin only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const band = await db.query.bands.findFirst({
    where: ilike(bands.inviteCode, params.inviteCode),
  })

  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })
  if (band.createdBy !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await db.delete(bands).where(eq(bands.id, band.id))

  return NextResponse.json({ ok: true })
}
