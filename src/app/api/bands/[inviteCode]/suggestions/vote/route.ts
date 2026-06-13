import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bands, suggestions, suggestionVotes, songs } from '@/lib/schema'
import { eq, and, ilike } from 'drizzle-orm'
import { pushToBand } from '@/lib/push'
import { recordHistoryEvent } from '@/lib/history'

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
  const actor = band.members.find((m) => m.id === bandMemberId)

  await db
    .insert(suggestionVotes)
    .values({ suggestionId: Number(suggestionId), bandMemberId, vote })
    .onConflictDoUpdate({
      target: [suggestionVotes.suggestionId, suggestionVotes.bandMemberId],
      set: { vote },
    })

  await recordHistoryEvent({
    bandId: band.id,
    actorMemberId: actor?.id,
    actorName: actor?.displayName,
    type: 'suggestion_vote',
    subjectType: 'suggestion',
    subjectId: suggestion.id,
    subjectName: suggestion.name,
    details: { vote },
  })

  const votes = await db
    .select()
    .from(suggestionVotes)
    .where(eq(suggestionVotes.suggestionId, Number(suggestionId)))

  const memberCount = band.members.length
  const yesCount = votes.filter((v) => v.vote === 'yes').length
  const noCount = votes.filter((v) => v.vote === 'no').length
  const approvalThreshold = Math.max(1, Math.ceil(memberCount * 0.7))
  const approved = yesCount >= approvalThreshold && yesCount > noCount

  let promoted = false

  if (approved) {
    const existing = await db.select().from(songs).where(eq(songs.bandId, band.id))
    const duplicate = existing.some((song) => song.name.trim().toLowerCase() === suggestion.name.trim().toLowerCase())
    let songId: number | null = null
    if (!duplicate) {
      const nextSortOrder = existing.reduce((max, song) => Math.max(max, song.sortOrder), -1) + 1
      const [song] = await db
        .insert(songs)
        .values({ bandId: band.id, name: suggestion.name, sortOrder: nextSortOrder })
        .returning()
      songId = song.id
    }
    await db.delete(suggestions).where(eq(suggestions.id, Number(suggestionId)))
    promoted = true
    const voteDetails = votes.map((row) => {
      const member = band.members.find((m) => m.id === row.bandMemberId)
      return {
        memberId: row.bandMemberId,
        memberName: member?.displayName ?? 'Membro removido',
        vote: row.vote,
      }
    })

    await recordHistoryEvent({
      bandId: band.id,
      actorMemberId: actor?.id,
      actorName: actor?.displayName,
      type: 'suggestion_auto_approved',
      subjectType: 'suggestion',
      subjectId: suggestion.id,
      subjectName: suggestion.name,
      details: { yesCount, noCount, approvalThreshold, duplicate, votes: voteDetails },
    })
    if (!duplicate) {
      await recordHistoryEvent({
        bandId: band.id,
        actorMemberId: actor?.id,
        actorName: actor?.displayName,
        type: 'song_added_from_suggestion',
        subjectType: 'song',
        subjectId: songId,
        subjectName: suggestion.name,
        details: { suggestionId: suggestion.id, votes: voteDetails },
      })
    }

    pushToBand(band.id, {
      title: 'Música aprovada',
      body: `"${suggestion.name}" foi adicionada ao repertório da banda.`,
      url: `/band/${params.inviteCode}/songs`,
    }).catch(() => {})
  } else if (votes.length === memberCount) {
    pushToBand(band.id, {
      title: 'Votação encerrada',
      body: `"${suggestion.name}" continua nas sugestões.`,
      url: `/band/${params.inviteCode}/suggestions`,
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, promoted, yesCount, noCount, approvalThreshold })
}
