import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bands, bandMembers, songs, rehearsalSessions } from '@/lib/schema'
import { and, eq, ilike, isNull, desc, inArray } from 'drizzle-orm'
import { recordHistoryEvent } from '@/lib/history'

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
    where: and(eq(rehearsalSessions.bandId, band.id), isNull(rehearsalSessions.endedAt)),
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
  req: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const band = await getBand(params.inviteCode)
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })
  const actor = await getActor(req, band.id)

  await db
    .update(rehearsalSessions)
    .set({ endedAt: new Date() })
    .where(and(eq(rehearsalSessions.bandId, band.id), isNull(rehearsalSessions.endedAt)))

  // Default song order = current songs sorted by id
  const bandSongs = await db.select({ id: songs.id }).from(songs).where(eq(songs.bandId, band.id))
  const order = bandSongs.map((s) => s.id)

  const [session] = await db.insert(rehearsalSessions).values({
    bandId: band.id,
    songOrder: JSON.stringify(order),
    playedSongs: '[]',
  }).returning()

  await recordHistoryEvent({
    bandId: band.id,
    actorMemberId: actor?.id,
    actorName: actor?.displayName,
    type: 'rehearsal_started',
    subjectType: 'rehearsal',
    subjectId: session.id,
    subjectName: 'Ensaio',
    details: { songCount: order.length },
  })

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

  const active = await db.query.rehearsalSessions.findFirst({
    where: and(eq(rehearsalSessions.bandId, band.id), isNull(rehearsalSessions.endedAt)),
    orderBy: desc(rehearsalSessions.createdAt),
  })
  if (!active) return NextResponse.json({ error: 'No active session' }, { status: 404 })

  await db.update(rehearsalSessions).set(update).where(eq(rehearsalSessions.id, active.id))

  return NextResponse.json({ ok: true })
}

// DELETE — end the active session
export async function DELETE(
  req: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const band = await getBand(params.inviteCode)
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })
  const actor = await getActor(req, band.id)

  const active = await db.query.rehearsalSessions.findFirst({
    where: and(eq(rehearsalSessions.bandId, band.id), isNull(rehearsalSessions.endedAt)),
    orderBy: desc(rehearsalSessions.createdAt),
  })
  if (!active) return NextResponse.json({ error: 'No active session' }, { status: 404 })

  const endedAt = new Date()
  await db.update(rehearsalSessions).set({ endedAt }).where(eq(rehearsalSessions.id, active.id))

  const playedSongs = safeArray(active.playedSongs)
  const songRows = playedSongs.length > 0
    ? await db
        .select({ id: songs.id, name: songs.name })
        .from(songs)
        .where(and(eq(songs.bandId, band.id), inArray(songs.id, playedSongs)))
    : []
  const playedNames = playedSongs
    .map((id) => songRows.find((song) => song.id === id)?.name)
    .filter(Boolean)

  await recordHistoryEvent({
    bandId: band.id,
    actorMemberId: actor?.id,
    actorName: actor?.displayName,
    type: 'rehearsal_ended',
    subjectType: 'rehearsal',
    subjectId: active.id,
    subjectName: 'Ensaio',
    details: {
      durationMs: endedAt.getTime() - active.createdAt.getTime(),
      playedSongs: playedNames,
    },
  })

  return NextResponse.json({ ok: true })
}

async function getActor(req: NextRequest, bandId: string) {
  const url = new URL(req.url)
  const memberId = url.searchParams.get('bandMemberId')
  if (!memberId) return null
  return db.query.bandMembers.findFirst({
    where: and(eq(bandMembers.id, memberId), eq(bandMembers.bandId, bandId)),
  })
}

function safeArray(value: string) {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
