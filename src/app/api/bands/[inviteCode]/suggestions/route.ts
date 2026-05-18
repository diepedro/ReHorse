import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { bands, suggestions, suggestionVotes, songs } from '@/lib/schema'
import { eq, and, inArray, ilike } from 'drizzle-orm'
import { pushToBand } from '@/lib/push'

export const dynamic = 'force-dynamic'

async function getBand(inviteCode: string) {
  return db.query.bands.findFirst({
    where: ilike(bands.inviteCode, inviteCode),
    with: { members: true },
  })
}

// GET /api/bands/[inviteCode]/suggestions
export async function GET(
  _req: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const band = await getBand(params.inviteCode)
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  const rows = await db
    .select()
    .from(suggestions)
    .where(eq(suggestions.bandId, band.id))
    .orderBy(suggestions.createdAt)

  if (rows.length === 0) return NextResponse.json([])

  const suggestionIds = rows.map((s) => s.id)
  const votes = await db
    .select()
    .from(suggestionVotes)
    .where(inArray(suggestionVotes.suggestionId, suggestionIds))

  const result = rows.map((s) => {
    const voteMap: Record<string, string> = {}
    for (const v of votes.filter((v) => v.suggestionId === s.id)) {
      voteMap[v.bandMemberId] = v.vote
    }
    return {
      id: s.id,
      name: s.name,
      suggestedBy: s.suggestedBy,
      createdAt: s.createdAt,
      votes: voteMap,
    }
  })

  return NextResponse.json(result)
}

// POST /api/bands/[inviteCode]/suggestions
export async function POST(
  request: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const body = await request.json()
  const { name, bandMemberId } = body

  if (!name?.trim() || !bandMemberId)
    return NextResponse.json({ error: 'name and bandMemberId required' }, { status: 400 })

  const band = await getBand(params.inviteCode)
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })
  if (!band.members.find((m) => m.id === bandMemberId))
    return NextResponse.json({ error: 'Member not in band' }, { status: 403 })

  const normalized = name.trim().toLowerCase()
  const [existingSongs, existingSuggestions] = await Promise.all([
    db.select().from(songs).where(eq(songs.bandId, band.id)),
    db.select().from(suggestions).where(eq(suggestions.bandId, band.id)),
  ])
  if (existingSongs.some((s) => s.name.trim().toLowerCase() === normalized)) {
    return NextResponse.json({ error: 'Música já está no repertório' }, { status: 409 })
  }
  if (existingSuggestions.some((s) => s.name.trim().toLowerCase() === normalized)) {
    return NextResponse.json({ error: 'Sugestão já existe' }, { status: 409 })
  }

  const [suggestion] = await db
    .insert(suggestions)
    .values({ bandId: band.id, name: name.trim(), suggestedBy: bandMemberId })
    .returning()

  // Auto-vote yes for the person who suggested
  await db.insert(suggestionVotes).values({
    suggestionId: suggestion.id,
    bandMemberId,
    vote: 'yes',
  })

  // Notify other band members
  const suggester = band.members.find((m) => m.id === bandMemberId)
  pushToBand(
    band.id,
    {
      title: '🎵 Nova sugestão',
      body: `${suggester?.displayName ?? 'Alguém'} sugeriu "${name.trim()}"`,
      url: `/${params.inviteCode}/sugestoes`,
    },
    bandMemberId,
  ).catch(() => {})

  return NextResponse.json({ id: suggestion.id }, { status: 201 })
}

// PATCH /api/bands/[inviteCode]/suggestions — admin approve/reject
export async function PATCH(
  request: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const id = Number(body.id)
  const action = body.action
  if (!id || (action !== 'promote' && action !== 'reject')) {
    return NextResponse.json({ error: 'id and valid action required' }, { status: 400 })
  }

  const band = await getBand(params.inviteCode)
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })
  if (band.createdBy !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const suggestion = await db.query.suggestions.findFirst({
    where: and(eq(suggestions.id, id), eq(suggestions.bandId, band.id)),
  })
  if (!suggestion) return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })

  if (action === 'promote') {
    const existing = await db.select().from(songs).where(eq(songs.bandId, band.id))
    const duplicate = existing.some((song) => song.name.trim().toLowerCase() === suggestion.name.trim().toLowerCase())
    if (!duplicate) await db.insert(songs).values({ bandId: band.id, name: suggestion.name })
    await db.delete(suggestions).where(eq(suggestions.id, id))

    pushToBand(band.id, {
      title: 'Música aprovada',
      body: `"${suggestion.name}" foi adicionada ao repertório.`,
      url: `/band/${params.inviteCode}/songs`,
    }).catch(() => {})

    return NextResponse.json({ ok: true, promoted: !duplicate })
  }

  await db.delete(suggestions).where(eq(suggestions.id, id))
  pushToBand(band.id, {
    title: 'Sugestão encerrada',
    body: `"${suggestion.name}" foi removida das sugestões.`,
    url: `/band/${params.inviteCode}/suggestions`,
  }).catch(() => {})

  return NextResponse.json({ ok: true, rejected: true })
}

// DELETE /api/bands/[inviteCode]/suggestions?id=123
export async function DELETE(
  req: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const id = Number(new URL(req.url).searchParams.get('id'))
  const bandMemberId = new URL(req.url).searchParams.get('bandMemberId')

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const band = await getBand(params.inviteCode)
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  const suggestion = await db.query.suggestions.findFirst({
    where: and(eq(suggestions.id, id), eq(suggestions.bandId, band.id)),
  })
  if (!suggestion) return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })

  // Only the suggester can delete
  if (bandMemberId && suggestion.suggestedBy !== bandMemberId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await db.delete(suggestions).where(eq(suggestions.id, id))

  return NextResponse.json({ ok: true })
}
