import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bands, bandMembers, bandAnnouncements } from '@/lib/schema'
import { eq, desc, ilike } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

async function getBand(inviteCode: string) {
  return db.query.bands.findFirst({ where: ilike(bands.inviteCode, inviteCode) })
}

// GET — list announcements for a band
export async function GET(
  _req: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const band = await getBand(params.inviteCode)
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  const rows = await db.select().from(bandAnnouncements)
    .where(eq(bandAnnouncements.bandId, band.id))
    .orderBy(desc(bandAnnouncements.createdAt))
    .limit(50)

  return NextResponse.json(rows)
}

// POST — create announcement (any member)
export async function POST(
  req: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const band = await getBand(params.inviteCode)
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  const { content, memberId } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const [row] = await db.insert(bandAnnouncements).values({
    bandId: band.id,
    authorId: memberId ?? null,
    content: content.trim().slice(0, 1000),
  }).returning()

  return NextResponse.json(row)
}

// DELETE — delete announcement
export async function DELETE(
  req: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const band = await getBand(params.inviteCode)
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await db.delete(bandAnnouncements)
    .where(eq(bandAnnouncements.id, id))

  return NextResponse.json({ ok: true })
}
