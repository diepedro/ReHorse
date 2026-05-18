import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bands, bandMembers, songs, songStatus, songRehearsed, availability, suggestions } from '@/lib/schema'
import { eq, and, gte, inArray, ilike } from 'drizzle-orm'
import type { SongStatus } from '@/lib/types'

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

  const mySuggestions = await db
    .select()
    .from(suggestions)
    .where(and(eq(suggestions.bandId, band.id), eq(suggestions.suggestedBy, memberId)))

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
    insightSuggestions.push('Adicione músicas ao repertório para começar a rastrear o progresso.')
    return NextResponse.json({ personal, general, suggestions: insightSuggestions, stats: null })
  }

  // Personal insights
  if (songsFull === totalSongs) {
    personal.push(`Você tirou todas as ${totalSongs} músicas. Parabéns!`)
  } else if (songsFull === 0 && songsPartial === 0) {
    personal.push(`Você ainda não marcou progresso em nenhuma música.`)
    insightSuggestions.push('Marque as músicas que você já sabe na aba Músicas.')
  } else {
    const pct = Math.round((songsFull / totalSongs) * 100)
    personal.push(`Você tirou ${songsFull} de ${totalSongs} músicas (${pct}%).`)
    if (songsPartial > 0) personal.push(`${songsPartial} músicas estão parcialmente aprendidas.`)
  }

  if (availCount === 0) {
    personal.push(`Você não marcou disponibilidade para as próximas semanas.`)
    insightSuggestions.push('Marque sua disponibilidade na aba Ensaios.')
  } else {
    personal.push(`Você está disponível em ${availCount} dia(s) nas próximas semanas.`)
  }

  // General band insights
  const bandFullSongs = rehearsedRows.filter((r) => r.status === 'full').length
  const bandPartialSongs = rehearsedRows.filter((r) => r.status === 'partial').length

  if (bandFullSongs > 0) {
    general.push(`A banda já ensaiou ${bandFullSongs} música(s) completamente.`)
  }

  // Find songs where all members have full status
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
      `${bandReadySongs.length} música(s) estão dominadas por todos os membros: ${bandReadySongs
        .slice(0, 3)
        .map((s) => s.name)
        .join(', ')}${bandReadySongs.length > 3 ? '...' : ''}.`
    )
  }

  // Find days where most members are available
  const dateAvailMap: Record<string, number> = {}
  for (const a of availRows.filter((a) => a.status === 'available')) {
    dateAvailMap[a.date] = (dateAvailMap[a.date] || 0) + 1
  }
  const bestDates = Object.entries(dateAvailMap)
    .filter(([, count]) => count === band.members.length)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 3)

  if (bestDates.length > 0) {
    const formatted = bestDates.map(([date]) => {
      const [y, m, d] = date.split('-')
      return `${d}/${m}`
    })
    general.push(`Todos disponíveis em: ${formatted.join(', ')}.`)
  } else {
    const partialDates = Object.entries(dateAvailMap)
      .filter(([, count]) => count >= Math.ceil(band.members.length * 0.75))
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 3)
    if (partialDates.length > 0) {
      const formatted = partialDates.map(([date, count]) => {
        const [y, m, d] = date.split('-')
        return `${d}/${m} (${count}/${band.members.length})`
      })
      general.push(`Melhores datas para ensaio: ${formatted.join(', ')}.`)
    }
  }

  return NextResponse.json({
    personal,
    general,
    suggestions: insightSuggestions,
    stats: { totalSongs, songsFull, songsPartial, songsNone, availCount },
  })
}
