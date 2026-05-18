import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bands, songs, songReferences } from '@/lib/schema'
import { eq, ilike, and } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// GET — list references for a song
export async function GET(
  _req: NextRequest,
  { params }: { params: { inviteCode: string; songId: string } }
) {
  const refs = await db
    .select()
    .from(songReferences)
    .where(eq(songReferences.songId, parseInt(params.songId)))
  return NextResponse.json(refs)
}

// POST — add a reference (youtube or spotify)
export async function POST(
  req: NextRequest,
  { params }: { params: { inviteCode: string; songId: string } }
) {
  const band = await db.query.bands.findFirst({ where: ilike(bands.inviteCode, params.inviteCode) })
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  const { type, refId, title, previewUrl, artworkUrl, artistName, durationMs } = await req.json()
  if (!type || !refId || !title)
    return NextResponse.json({ error: 'type, refId and title required' }, { status: 400 })

  // Remove any existing reference for this song before adding the new one
  await db.delete(songReferences).where(eq(songReferences.songId, parseInt(params.songId)))

  const [ref] = await db.insert(songReferences).values({
    songId: parseInt(params.songId),
    type,
    refId,
    title: title.slice(0, 200),
    previewUrl: previewUrl ?? null,
    artworkUrl: artworkUrl ?? null,
    artistName: artistName ?? null,
    durationMs: durationMs ?? null,
  }).returning()

  return NextResponse.json(ref)
}

// DELETE — remove a reference
export async function DELETE(
  req: NextRequest,
  { params }: { params: { inviteCode: string; songId: string } }
) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db.delete(songReferences).where(eq(songReferences.id, id))
  return NextResponse.json({ ok: true })
}
