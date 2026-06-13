import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bandNotifications, bands, suggestions, suggestionVotes } from '@/lib/schema'
import { and, eq, ilike } from 'drizzle-orm'
import { pushToBand } from '@/lib/push'
import { recordHistoryEvent } from '@/lib/history'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { inviteCode: string } },
) {
  const body = await request.json().catch(() => null)
  const suggestionId = Number(body?.suggestionId)
  const bandMemberId = typeof body?.bandMemberId === 'string' ? body.bandMemberId : ''

  if (!Number.isInteger(suggestionId) || suggestionId <= 0 || !bandMemberId) {
    return NextResponse.json({ error: 'suggestionId and bandMemberId required' }, { status: 400 })
  }

  const band = await db.query.bands.findFirst({
    where: ilike(bands.inviteCode, params.inviteCode),
    with: { members: true },
  })
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  const actor = band.members.find((member) => member.id === bandMemberId)
  if (!actor) return NextResponse.json({ error: 'Member not in band' }, { status: 403 })

  const suggestion = await db.query.suggestions.findFirst({
    where: and(
      eq(suggestions.id, suggestionId),
      eq(suggestions.bandId, band.id),
    ),
  })
  if (!suggestion) return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
  if (suggestion.suggestedBy !== bandMemberId) {
    return NextResponse.json({ error: 'Only the suggester can nudge pending voters' }, { status: 403 })
  }

  const votes = await db
    .select()
    .from(suggestionVotes)
    .where(eq(suggestionVotes.suggestionId, suggestion.id))
  const votedMemberIds = new Set(votes.map((vote) => vote.bandMemberId))
  const pendingMembers = band.members
    .filter((member) => member.id !== bandMemberId && !votedMemberIds.has(member.id))
    .sort((a, b) => a.sortOrder - b.sortOrder)

  if (pendingMembers.length === 0) {
    return NextResponse.json({ error: 'Todo mundo ja respondeu essa sugestao.' }, { status: 409 })
  }

  const notificationUrl = `/band/${band.inviteCode}/suggestions`
  const notificationTitle = 'Lembrete de sugestao'
  const notificationBody = `${actor.displayName} pediu seu voto em "${suggestion.name}".`
  const [notification] = await db.insert(bandNotifications).values({
    bandId: band.id,
    createdBy: null,
    title: notificationTitle,
    body: notificationBody,
    url: notificationUrl,
  }).returning()

  const result = await pushToBand(band.id, {
    title: notificationTitle,
    body: notificationBody,
    url: notificationUrl,
  }, {
    notificationId: notification.id,
    targetMemberIds: pendingMembers.map((member) => member.id),
  })

  const pending = pendingMembers.map((member) => ({
    id: member.id,
    displayName: member.displayName,
  }))
  const whatsappText = buildWhatsappText({
    bandName: band.name,
    suggestionName: suggestion.name,
    pendingNames: pending.map((member) => member.displayName),
    url: new URL(notificationUrl, getPublicBaseUrl(request)).toString(),
  })

  await recordHistoryEvent({
    bandId: band.id,
    actorMemberId: actor.id,
    actorName: actor.displayName,
    type: 'suggestion_nudged',
    subjectType: 'suggestion',
    subjectId: suggestion.id,
    subjectName: suggestion.name,
    details: {
      notificationId: notification.id,
      pendingMembers: pending,
      push: result,
    },
  })

  return NextResponse.json({
    ok: true,
    notificationId: notification.id,
    pendingMembers: pending,
    whatsappText,
    result,
  })
}

function buildWhatsappText({
  bandName,
  suggestionName,
  pendingNames,
  url,
}: {
  bandName: string
  suggestionName: string
  pendingNames: string[]
  url: string
}) {
  const names = formatNameList(pendingNames)
  const prefix = pendingNames.length === 1
    ? `Oi ${names}! Falta seu voto`
    : `Oi ${names}! Falta o voto de voces`

  return `${prefix} na sugestao "${suggestionName}" da banda ${bandName}. Vota aqui: ${url}`
}

function formatNameList(names: string[]) {
  if (names.length <= 2) return names.join(' e ')
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
}

function getPublicBaseUrl(request: NextRequest) {
  const configuredUrl = process.env.NEXTAUTH_URL?.trim()
  if (configuredUrl && !configuredUrl.includes('0.0.0.0')) {
    return configuredUrl.replace(/\/+$/, '')
  }

  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = forwardedHost ?? request.headers.get('host')
  if (host && !host.startsWith('0.0.0.0')) {
    const proto = request.headers.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https')
    return `${proto}://${host}`
  }

  return request.nextUrl.origin
}
