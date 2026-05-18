import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bands, bandMembers, songs, songStatus, songRehearsed, songReferences } from '@/lib/schema'
import { eq, and, inArray, ilike } from 'drizzle-orm'
import type { SongStatus } from '@/lib/types'

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
  const { name } = body

  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const band = await getBandByCode(params.inviteCode)
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  const [song] = await db
    .insert(songs)
    .values({ bandId: band.id, name: name.trim() })
    .returning()

  return NextResponse.json({ id: song.id, name: song.name }, { status: 201 })
}

// DELETE /api/bands/[inviteCode]/songs?id=123
export async function DELETE(
  req: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const id = Number(new URL(req.url).searchParams.get('id'))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const band = await getBandByCode(params.inviteCode)
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  await db.delete(songs).where(and(eq(songs.id, id), eq(songs.bandId, band.id)))

  return NextResponse.json({ ok: true })
}
