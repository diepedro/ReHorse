import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bands, songs, songReferences, songComments, bandMembers } from '@/lib/schema'
import { eq, ilike, and, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// GET — full song details: metadata + references + comments
export async function GET(
  _req: NextRequest,
  { params }: { params: { inviteCode: string; songId: string } }
) {
  const band = await db.query.bands.findFirst({ where: ilike(bands.inviteCode, params.inviteCode) })
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  const song = await db.query.songs.findFirst({ where: and(eq(songs.id, parseInt(params.songId)), eq(songs.bandId, band.id)) })
  if (!song) return NextResponse.json({ error: 'Song not found' }, { status: 404 })

  const [refs, comments] = await Promise.all([
    db.select().from(songReferences).where(eq(songReferences.songId, song.id)).orderBy(songReferences.createdAt),
    db.select().from(songComments).where(eq(songComments.songId, song.id)).orderBy(desc(songComments.createdAt)).limit(100),
  ])

  return NextResponse.json({ ...song, references: refs, comments })
}

// PATCH — update song metadata (bpm, tonality, notes)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { inviteCode: string; songId: string } }
) {
  const band = await db.query.bands.findFirst({ where: ilike(bands.inviteCode, params.inviteCode) })
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (body.bpm !== undefined) update.bpm = body.bpm ? Number(body.bpm) : null
  if (body.tonality !== undefined) update.tonality = body.tonality?.trim() ?? null
  if (body.notes !== undefined) update.notes = body.notes?.trim() ?? null

  await db.update(songs).set(update).where(and(eq(songs.id, parseInt(params.songId)), eq(songs.bandId, band.id)))
  return NextResponse.json({ ok: true })
}
