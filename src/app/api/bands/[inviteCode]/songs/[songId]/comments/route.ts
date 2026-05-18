import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bands, songs, songComments } from '@/lib/schema'
import { eq, ilike, and } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// POST — add a comment
export async function POST(
  req: NextRequest,
  { params }: { params: { inviteCode: string; songId: string } }
) {
  const band = await db.query.bands.findFirst({ where: ilike(bands.inviteCode, params.inviteCode) })
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  const { content, memberId } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const [comment] = await db.insert(songComments).values({
    songId: parseInt(params.songId),
    authorId: memberId ?? null,
    content: content.trim().slice(0, 500),
  }).returning()

  return NextResponse.json(comment)
}

// DELETE — remove a comment
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db.delete(songComments).where(eq(songComments.id, id))
  return NextResponse.json({ ok: true })
}
