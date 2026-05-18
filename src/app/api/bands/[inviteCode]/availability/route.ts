import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bands, bandMembers, availability } from '@/lib/schema'
import { eq, and, gte, lte, inArray, ilike } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

async function getBand(inviteCode: string) {
  return db.query.bands.findFirst({
    where: ilike(bands.inviteCode, inviteCode),
    with: { members: true },
  })
}

function validateMember(band: NonNullable<Awaited<ReturnType<typeof getBand>>>, memberId: string) {
  return band.members.find((m) => m.id === memberId) ?? null
}

// GET /api/bands/[inviteCode]/availability?start=YYYY-MM-DD&end=YYYY-MM-DD
export async function GET(
  req: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  if (!start || !end) return NextResponse.json({ error: 'start and end required' }, { status: 400 })

  const band = await getBand(params.inviteCode)
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  const memberIds = band.members.map((m) => m.id)
  if (memberIds.length === 0) return NextResponse.json([])

  const rows = await db
    .select()
    .from(availability)
    .where(
      and(
        inArray(availability.bandMemberId, memberIds),
        gte(availability.date, start),
        lte(availability.date, end)
      )
    )

  return NextResponse.json(rows)
}

// POST /api/bands/[inviteCode]/availability
export async function POST(
  request: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const body = await request.json()
  const { bandMemberId, date, status } = body

  if (!bandMemberId || !date) return NextResponse.json({ error: 'bandMemberId and date required' }, { status: 400 })

  const band = await getBand(params.inviteCode)
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })
  if (!validateMember(band, bandMemberId)) return NextResponse.json({ error: 'Member not in band' }, { status: 403 })

  if (!status || status === 'neutral') {
    await db
      .delete(availability)
      .where(
        and(
          eq(availability.bandMemberId, bandMemberId),
          eq(availability.date, date)
        )
      )
  } else {
    await db
      .insert(availability)
      .values({ bandMemberId, date, status })
      .onConflictDoUpdate({
        target: [availability.bandMemberId, availability.date],
        set: { status },
      })
  }

  return NextResponse.json({ ok: true })
}
