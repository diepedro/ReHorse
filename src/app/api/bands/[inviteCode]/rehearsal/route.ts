import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bands, songs, rehearsalSessions } from '@/lib/schema'
import { eq, ilike, isNull, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

async function getBand(inviteCode: string) {
  return db.query.bands.findFirst({ where: ilike(bands.inviteCode, inviteCode) })
}

// GET — active session (endedAt IS NULL), or last ended session
export async function GET(
  _req: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const band = await getBand(params.inviteCode)
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  const active = await db.query.rehearsalSessions.findFirst({
    where: eq(rehearsalSessions.bandId, band.id) && isNull(rehearsalSessions.endedAt),
    orderBy: desc(rehearsalSessions.createdAt),
  })

  if (active) return NextResponse.json({ ...active, songOrder: JSON.parse(active.songOrder), playedSongs: JSON.parse(active.playedSongs) })

  const last = await db.query.rehearsalSessions.findFirst({
    where: eq(rehearsalSessions.bandId, band.id),
    orderBy: desc(rehearsalSessions.createdAt),
  })

  if (last) return NextResponse.json({ ...last, songOrder: JSON.parse(last.songOrder), playedSongs: JSON.parse(last.playedSongs) })

  return NextResponse.json(null)
}

// POST — start a new session (ends any active one first)
export async function POST(
  _req: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const band = await getBand(params.inviteCode)
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  // End any active session
  const allSessions = await db.select().from(rehearsalSessions).where(eq(rehearsalSessions.bandId, band.id))
  for (const s of allSessions) {
    if (!s.endedAt) {
      await db.update(rehearsalSessions).set({ endedAt: new Date() }).where(eq(rehearsalSessions.id, s.id))
    }
  }

  // Default song order = current songs sorted by id
  const bandSongs = await db.select({ id: songs.id }).from(songs).where(eq(songs.bandId, band.id))
  const order = bandSongs.map((s) => s.id)

  const [session] = await db.insert(rehearsalSessions).values({
    bandId: band.id,
    songOrder: JSON.stringify(order),
    playedSongs: '[]',
  }).returning()

  return NextResponse.json({ ...session, songOrder: order, playedSongs: [] })
}

// PATCH — update songOrder and/or playedSongs
export async function PATCH(
  req: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const band = await getBand(params.inviteCode)
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  const body = await req.json()
  const update: Record<string, string> = {}
  if (body.songOrder !== undefined) update.songOrder = JSON.stringify(body.songOrder)
  if (body.playedSongs !== undefined) update.playedSongs = JSON.stringify(body.playedSongs)

  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const allSessions = await db.select().from(rehearsalSessions).where(eq(rehearsalSessions.bandId, band.id))
  const active = allSessions.find((s) => !s.endedAt)
  if (!active) return NextResponse.json({ error: 'No active session' }, { status: 404 })

  await db.update(rehearsalSessions).set(update).where(eq(rehearsalSessions.id, active.id))

  return NextResponse.json({ ok: true })
}

// DELETE — end the active session
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const band = await getBand(params.inviteCode)
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  const allSessions = await db.select().from(rehearsalSessions).where(eq(rehearsalSessions.bandId, band.id))
  const active = allSessions.find((s) => !s.endedAt)
  if (!active) return NextResponse.json({ error: 'No active session' }, { status: 404 })

  await db.update(rehearsalSessions).set({ endedAt: new Date() }).where(eq(rehearsalSessions.id, active.id))

  return NextResponse.json({ ok: true })
}
