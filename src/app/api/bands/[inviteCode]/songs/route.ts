import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bands, songs, songStatus, songRehearsed, songReferences } from '@/lib/schema'
import { eq, and, inArray, ilike } from 'drizzle-orm'
import type { SongStatus } from '@/lib/types'
import { recordHistoryEvent } from '@/lib/history'

export const dynamic = 'force-dynamic'

async function getBandByCode(inviteCode: string) {
  return db.query.bands.findFirst({
    where: ilike(bands.inviteCode, inviteCode),
    with: { members: true },
  })
}

// GET /api/bands/[inviteCode]/songs
export async function GET(
  _req: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const band = await getBandByCode(params.inviteCode)
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  const bandSongs = await db
    .select()
    .from(songs)
    .where(eq(songs.bandId, band.id))
    .orderBy(songs.createdAt)

  if (bandSongs.length === 0) return NextResponse.json([])

  const songIds = bandSongs.map((s) => s.id)
  const memberIds = band.members.map((m) => m.id)

  const statuses =
    memberIds.length > 0
      ? await db
          .select()
          .from(songStatus)
          .where(inArray(songStatus.songId, songIds))
      : []

  const rehearsedRows = await db
    .select()
    .from(songRehearsed)
    .where(inArray(songRehearsed.songId, songIds))

  const refsRows = await db
    .select()
    .from(songReferences)
    .where(inArray(songReferences.songId, songIds))

  const result = bandSongs.map((song) => {
    const statusMap: Record<string, SongStatus> = {}
    for (const m of band.members) {
      const row = statuses.find((s) => s.songId === song.id && s.bandMemberId === m.id)
      statusMap[m.id] = (row?.status ?? 'none') as SongStatus
    }
    const rehearsed = rehearsedRows.find((r) => r.songId === song.id)
    const primaryRef = refsRows.find((r) => r.songId === song.id && r.type === 'itunes')
    return {
      id: song.id,
      name: song.name,
      createdAt: song.createdAt,
      statuses: statusMap,
      rehearsed: (rehearsed?.status ?? 'none') as SongStatus,
      itunesRef: primaryRef ? {
        previewUrl: primaryRef.previewUrl ?? null,
        trackName: primaryRef.title.split(' — ')[0] ?? primaryRef.title,
        artistName: primaryRef.artistName ?? '',
        artworkUrl: primaryRef.artworkUrl ?? '',
        durationMs: primaryRef.durationMs ?? null,
      } : null,
    }
  })

  return NextResponse.json(result)
}

// POST /api/bands/[inviteCode]/songs
export async function POST(
  request: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const body = await request.json()
  const { name, reference, bandMemberId } = body

  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const band = await getBandByCode(params.inviteCode)
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })
  const actor = bandMemberId
    ? band.members.find((member) => member.id === bandMemberId) ?? null
    : null

  const existing = await db.select().from(songs).where(eq(songs.bandId, band.id))
  const normalizedName = name.trim().toLowerCase()
  if (existing.some((song) => song.name.trim().toLowerCase() === normalizedName)) {
    return NextResponse.json({ error: 'Música já está no repertório' }, { status: 409 })
  }

  const [song] = await db
    .insert(songs)
    .values({ bandId: band.id, name: name.trim() })
    .returning()

  if (reference?.refId && reference?.type && reference?.title) {
    await db.insert(songReferences).values({
      songId: song.id,
      type: reference.type,
      refId: reference.refId,
      title: reference.title,
      previewUrl: reference.previewUrl ?? null,
      artworkUrl: reference.artworkUrl ?? null,
      artistName: reference.artistName ?? null,
      durationMs: reference.durationMs ?? null,
    })
  }

  await recordHistoryEvent({
    bandId: band.id,
    actorMemberId: actor?.id,
    actorName: actor?.displayName,
    type: 'song_added',
    subjectType: 'song',
    subjectId: song.id,
    subjectName: song.name,
    details: {
      source: reference?.type ? 'search' : 'manual',
      artistName: reference?.artistName ?? null,
    },
  })

  return NextResponse.json({ id: song.id, name: song.name }, { status: 201 })
}

// DELETE /api/bands/[inviteCode]/songs?id=123
export async function DELETE(
  req: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const url = new URL(req.url)
  const id = Number(url.searchParams.get('id'))
  const bandMemberId = url.searchParams.get('bandMemberId')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const band = await getBandByCode(params.inviteCode)
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })
  const song = await db.query.songs.findFirst({
    where: and(eq(songs.id, id), eq(songs.bandId, band.id)),
  })
  if (!song) return NextResponse.json({ error: 'Song not found' }, { status: 404 })
  const actor = bandMemberId ? band.members.find((member) => member.id === bandMemberId) ?? null : null

  await db.delete(songs).where(and(eq(songs.id, id), eq(songs.bandId, band.id)))

  await recordHistoryEvent({
    bandId: band.id,
    actorMemberId: actor?.id,
    actorName: actor?.displayName,
    type: 'song_removed',
    subjectType: 'song',
    subjectId: song.id,
    subjectName: song.name,
    details: { removedAt: new Date().toISOString() },
  })

  return NextResponse.json({ ok: true })
}
