import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { availability, bands, songs, songRehearsed, songStatus } from '@/lib/schema'
import { and, eq, gte, ilike, inArray } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// GET /api/bands/[inviteCode]/insights?memberId=xxx
export async function GET(
  req: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const memberId = new URL(req.url).searchParams.get('memberId')
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  const band = await db.query.bands.findFirst({
    where: ilike(bands.inviteCode, params.inviteCode),
    with: { members: true },
  })
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  const member = band.members.find((m) => m.id === memberId)
  if (!member) return NextResponse.json({ error: 'Member not in band' }, { status: 403 })

  const today = new Date().toISOString().slice(0, 10)

  const bandSongs = await db.select().from(songs).where(eq(songs.bandId, band.id))
  const memberIds = band.members.map((m) => m.id)

  const allStatuses =
    bandSongs.length > 0
      ? await db
          .select()
          .from(songStatus)
          .where(inArray(songStatus.songId, bandSongs.map((s) => s.id)))
      : []

  const rehearsedRows =
    bandSongs.length > 0
      ? await db
          .select()
          .from(songRehearsed)
          .where(inArray(songRehearsed.songId, bandSongs.map((s) => s.id)))
      : []

  const availRows =
    memberIds.length > 0
      ? await db
          .select()
          .from(availability)
          .where(
            and(
              inArray(availability.bandMemberId, memberIds),
              gte(availability.date, today)
            )
          )
      : []

  const totalSongs = bandSongs.length
  const myStatuses = allStatuses.filter((s) => s.bandMemberId === memberId)
  const songsFull = myStatuses.filter((s) => s.status === 'full').length
  const songsPartial = myStatuses.filter((s) => s.status === 'partial').length
  const songsNone = totalSongs - songsFull - songsPartial
  const availCount = availRows.filter(
    (a) => a.bandMemberId === memberId && a.status === 'available'
  ).length

  const personal: string[] = []
  const general: string[] = []
  const insightSuggestions: string[] = []

  if (totalSongs === 0) {
    insightSuggestions.push('Adicione musicas ao repertorio para comecar a rastrear o progresso.')
    return NextResponse.json({ personal, general, suggestions: insightSuggestions, stats: null })
  }

  if (songsFull === totalSongs) {
    personal.push(`Voce tirou todas as ${totalSongs} musicas. Parabens!`)
  } else if (songsFull === 0 && songsPartial === 0) {
    personal.push('Voce ainda nao marcou progresso em nenhuma musica.')
    insightSuggestions.push('Marque as musicas que voce ja sabe na aba Musicas.')
  } else {
    const pct = Math.round((songsFull / totalSongs) * 100)
    personal.push(`Voce tirou ${songsFull} de ${totalSongs} musicas (${pct}%).`)
    if (songsPartial > 0) personal.push(`${songsPartial} musicas estao parcialmente aprendidas.`)
  }

  if (availCount === 0) {
    personal.push('Voce nao marcou disponibilidade para as proximas semanas.')
    insightSuggestions.push('Marque sua disponibilidade na aba Ensaios.')
  } else {
    personal.push(`Voce esta disponivel em ${availCount} dia(s) nas proximas semanas.`)
  }

  const bandFullSongs = rehearsedRows.filter((r) => r.status === 'full').length

  if (bandFullSongs > 0) {
    general.push(`A banda ja ensaiou ${bandFullSongs} musica(s) completamente.`)
  }

  const bandReadySongs = bandSongs.filter((song) => {
    return band.members.every((m) => {
      const status = allStatuses.find(
        (s) => s.songId === song.id && s.bandMemberId === m.id
      )
      return status?.status === 'full'
    })
  })
  if (bandReadySongs.length > 0) {
    general.push(
      `${bandReadySongs.length} musica(s) estao dominadas por todos os membros: ${bandReadySongs
        .slice(0, 3)
        .map((s) => s.name)
        .join(', ')}${bandReadySongs.length > 3 ? '...' : ''}.`
    )
  }

  return NextResponse.json({
    personal,
    general,
    suggestions: insightSuggestions,
    stats: { totalSongs, songsFull, songsPartial, songsNone, availCount },
  })
}
