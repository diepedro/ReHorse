import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { bands, songs } from '@/lib/schema'
import { and, eq, ilike } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// PUT /api/bands/[inviteCode]/songs/reorder - admin or band member
export async function PUT(
  request: NextRequest,
  { params }: { params: { inviteCode: string } },
) {
  const session = await getServerSession(authOptions)

  const body = await request.json().catch(() => null)
  const songIds = body?.songIds
  const bandMemberId = typeof body?.bandMemberId === 'string' ? body.bandMemberId : null
  if (!Array.isArray(songIds) || songIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    return NextResponse.json({ error: 'songIds must be an array of song ids' }, { status: 400 })
  }

  const uniqueSongIds = new Set(songIds)
  if (uniqueSongIds.size !== songIds.length) {
    return NextResponse.json({ error: 'songIds must not contain duplicates' }, { status: 400 })
  }

  const band = await db.query.bands.findFirst({
    where: ilike(bands.inviteCode, params.inviteCode),
    with: { members: true },
  })
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })
  const isAdmin = !!session?.user?.id && band.createdBy === session.user.id
  const isMember = bandMemberId
    ? band.members.some((member) => member.id === bandMemberId)
    : false
  if (!isAdmin && !isMember) {
    return NextResponse.json(
      { error: bandMemberId ? 'Member not in band' : 'Unauthorized' },
      { status: bandMemberId ? 403 : 401 },
    )
  }

  const existingSongs = await db
    .select({ id: songs.id })
    .from(songs)
    .where(eq(songs.bandId, band.id))

  const existingIds = new Set(existingSongs.map((song) => song.id))
  if (songIds.length !== existingIds.size || songIds.some((id) => !existingIds.has(id))) {
    return NextResponse.json({ error: 'songIds must include every song in this band' }, { status: 400 })
  }

  await db.transaction(async (tx) => {
    for (let sortOrder = 0; sortOrder < songIds.length; sortOrder++) {
      const songId = songIds[sortOrder]
      await tx
        .update(songs)
        .set({ sortOrder })
        .where(and(eq(songs.id, songId), eq(songs.bandId, band.id)))
    }
  })

  return NextResponse.json({ ok: true })
}
