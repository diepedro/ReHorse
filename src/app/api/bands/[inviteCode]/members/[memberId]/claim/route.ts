import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { bands, bandMembers } from '@/lib/schema'
import { eq, and, ilike } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// POST /api/bands/[inviteCode]/members/[memberId]/claim
export async function POST(
  req: NextRequest,
  { params }: { params: { inviteCode: string; memberId: string } }
) {
  const session = await getServerSession(authOptions)

  const band = await db.query.bands.findFirst({
    where: ilike(bands.inviteCode, params.inviteCode),
  })
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  const member = await db.query.bandMembers.findFirst({
    where: and(eq(bandMembers.id, params.memberId), eq(bandMembers.bandId, band.id)),
  })
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // If authenticated, store their user ID so the band shows in their dashboard.
  // Otherwise fall back to the anonymous identifier.
  const newClaimedBy = session?.user?.id ?? `anon:${params.memberId}`

  await db
    .update(bandMembers)
    .set({ claimedBy: newClaimedBy, claimedAt: new Date() })
    .where(eq(bandMembers.id, params.memberId))

  return NextResponse.json({ ok: true, memberId: params.memberId })
}
