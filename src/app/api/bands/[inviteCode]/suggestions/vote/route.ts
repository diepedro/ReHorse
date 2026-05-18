import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bands, bandMembers, suggestions, suggestionVotes, songs } from '@/lib/schema'
import { eq, and, inArray, count, ilike } from 'drizzle-orm'
import { pushToBand } from '@/lib/push'

export const dynamic = 'force-dynamic'

// PUT /api/bands/[inviteCode]/suggestions/vote
export async function PUT(
  request: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const body = await request.json()
  const { suggestionId, bandMemberId, vote } = body

  if (!suggestionId || !bandMemberId || !vote)
    return NextResponse.json({ error: 'suggestionId, bandMemberId and vote required' }, { status: 400 })
  if (vote !== 'yes' && vote !== 'no')
    return NextResponse.json({ error: 'vote must be yes or no' }, { status: 400 })

  const band = await db.query.bands.findFirst({
    where: ilike(bands.inviteCode, params.inviteCode),
    with: { members: true },
  })
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })
  if (!band.members.find((m) => m.id === bandMemberId))
    return NextResponse.json({ error: 'Member not in band' }, { status: 403 })

  const suggestion = await db.query.suggestions.findFirst({
    where: and(
      eq(suggestions.id, Number(suggestionId)),
      eq(suggestions.bandId, band.id)
    ),
  })
  if (!suggestion) return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })

  await db
    .insert(suggestionVotes)
    .values({ suggestionId: Number(suggestionId), bandMemberId, vote })
    .onConflictDoUpdate({
      target: [suggestionVotes.suggestionId, suggestionVotes.bandMemberId],
      set: { vote },
    })

  // Check if all band members voted yes → promote to repertoire
  const votes = await db
    .select()
    .from(suggestionVotes)
    .where(eq(suggestionVotes.suggestionId, Number(suggestionId)))

  const memberCount = band.members.length
  const allVotedYes =
    votes.filter((v) => v.vote === 'yes').length === memberCount &&
    votes.length === memberCount

  let promoted = false

  if (allVotedYes) {
    await db.insert(songs).values({ bandId: band.id, name: suggestion.name })
    await db.delete(suggestions).where(eq(suggestions.id, Number(suggestionId)))
    promoted = true

    pushToBand(band.id, {
      title: '✅ Música aprovada!',
      body: `"${suggestion.name}" foi adicionada ao repertório da banda.`,
      url: `/${params.inviteCode}/musicas`,
    }).catch(() => {})
  } else {
    // Check if all members have voted (but not unanimously yes)
    const allVoted = votes.length === memberCount
    if (allVoted) {
      pushToBand(band.id, {
        title: '🗳️ Votação encerrada',
        body: `"${suggestion.name}" continua nas sugestões — não houve unanimidade.`,
        url: `/${params.inviteCode}/sugestoes`,
      }).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true, promoted })
}
