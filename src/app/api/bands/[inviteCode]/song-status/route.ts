import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bands, bandMembers, songs, songStatus, songRehearsed } from '@/lib/schema'
import { eq, and, ilike } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// PUT /api/bands/[inviteCode]/song-status
export async function PUT(
  request: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const body = await request.json()
  const { songId, bandMemberId, status, rehearsed } = body

  if (!songId || !status)
    return NextResponse.json({ error: 'songId and status required' }, { status: 400 })

  const band = await db.query.bands.findFirst({
    where: ilike(bands.inviteCode, params.inviteCode),
    with: { members: true },
  })
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  // Validate song belongs to this band
  const song = await db.query.songs.findFirst({
    where: and(eq(songs.id, Number(songId)), eq(songs.bandId, band.id)),
  })
  if (!song) return NextResponse.json({ error: 'Song not found' }, { status: 404 })

  if (rehearsed) {
    // Update band rehearsal status
    await db
      .insert(songRehearsed)
      .values({ songId: Number(songId), status })
      .onConflictDoUpdate({
        target: songRehearsed.songId,
        set: { status },
      })
  } else {
    // Update individual member status
    if (!bandMemberId) return NextResponse.json({ error: 'bandMemberId required' }, { status: 400 })
    const member = band.members.find((m) => m.id === bandMemberId)
    if (!member) return NextResponse.json({ error: 'Member not in band' }, { status: 403 })

    await db
      .insert(songStatus)
      .values({ songId: Number(songId), bandMemberId, status })
      .onConflictDoUpdate({
        target: [songStatus.songId, songStatus.bandMemberId],
        set: { status },
      })
  }

  return NextResponse.json({ ok: true })
}
