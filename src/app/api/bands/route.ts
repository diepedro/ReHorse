import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { bands, bandMembers } from '@/lib/schema'
import { eq, or } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

function generateInviteCode(bandName: string): string {
  const slug = bandName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8)
  const digits = Math.floor(1000 + Math.random() * 9000).toString()
  return `${slug}-${digits}`
}

// GET /api/bands — list bands for the authenticated user
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  // Bands created by user + bands where user has claimed a slot
  const created = await db.query.bands.findMany({
    where: eq(bands.createdBy, userId),
    with: { members: true },
  })

  const memberOf = await db.query.bandMembers.findMany({
    where: eq(bandMembers.claimedBy, userId),
    with: { band: { with: { members: true } } },
  })

  const memberOfBandIds = new Set(memberOf.map((m) => m.band.id))
  const createdIds = new Set(created.map((b) => b.id))

  const allBands = [
    ...created.map((b) => ({ ...b, role: 'admin' as const })),
    ...memberOf
      .filter((m) => !createdIds.has(m.band.id))
      .map((m) => ({ ...m.band, role: 'member' as const })),
  ]

  return NextResponse.json(allBands)
}

// POST /api/bands — create a new band
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, members } = body as {
    name: string
    members: { displayName: string; color: string }[]
  }

  if (!name?.trim()) return NextResponse.json({ error: 'Band name required' }, { status: 400 })
  if (!Array.isArray(members) || members.length === 0)
    return NextResponse.json({ error: 'At least one member required' }, { status: 400 })
  if (members.length > 12)
    return NextResponse.json({ error: 'Maximum 12 members' }, { status: 400 })
  for (const m of members) {
    if (!m.displayName?.trim() || !m.color)
      return NextResponse.json({ error: 'Each member needs a name and color' }, { status: 400 })
  }

  // Unique invite code with collision retry
  let inviteCode = generateInviteCode(name.trim())
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await db.query.bands.findFirst({
      where: eq(bands.inviteCode, inviteCode),
    })
    if (!existing) break
    inviteCode = generateInviteCode(name.trim())
  }

  const bandId = randomUUID()

  await db.insert(bands).values({
    id: bandId,
    name: name.trim(),
    inviteCode,
    createdBy: session.user.id,
  })

  await db.insert(bandMembers).values(
    members.map((m, i) => ({
      id: randomUUID(),
      bandId,
      displayName: m.displayName.trim(),
      color: m.color,
      sortOrder: i,
    }))
  )

  return NextResponse.json({ inviteCode }, { status: 201 })
}
