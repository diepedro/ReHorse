import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { bands, bandMembers } from '@/lib/schema'
import { eq, and, ilike } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

// POST /api/bands/[inviteCode]/members — add a member slot (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const band = await db.query.bands.findFirst({
    where: ilike(bands.inviteCode, params.inviteCode),
    with: { members: true },
  })

  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })
  if (band.createdBy !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (band.members.length >= 12)
    return NextResponse.json({ error: 'Maximum 12 members' }, { status: 400 })

  const body = await request.json()
  const { displayName, color } = body

  if (!displayName?.trim() || !color)
    return NextResponse.json({ error: 'displayName and color required' }, { status: 400 })

  const sortOrder = band.members.length

  const [member] = await db
    .insert(bandMembers)
    .values({
      id: randomUUID(),
      bandId: band.id,
      displayName: displayName.trim(),
      color,
      sortOrder,
    })
    .returning()

  return NextResponse.json(member, { status: 201 })
}
