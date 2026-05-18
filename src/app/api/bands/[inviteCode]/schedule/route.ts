import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { bands } from '@/lib/schema'
import { eq, ilike } from 'drizzle-orm'
import { pushToBand } from '@/lib/push'

export const dynamic = 'force-dynamic'

async function getAdminBand(inviteCode: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Unauthorized' as const, status: 401 as const }

  const band = await db.query.bands.findFirst({
    where: ilike(bands.inviteCode, inviteCode),
  })
  if (!band) return { error: 'Band not found' as const, status: 404 as const }
  if (band.createdBy !== session.user.id) return { error: 'Forbidden' as const, status: 403 as const }

  return { band, session }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const result = await getAdminBand(params.inviteCode)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  const body = await request.json()
  const date = typeof body.date === 'string' ? body.date.trim() : ''
  const time = typeof body.time === 'string' ? body.time.trim() : ''
  const note = typeof body.note === 'string' ? body.note.trim() : ''

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
  }
  if (time && !/^\d{2}:\d{2}$/.test(time)) {
    return NextResponse.json({ error: 'time must be HH:mm' }, { status: 400 })
  }

  await db.update(bands).set({
    rehearsalDate: date,
    rehearsalTime: time || null,
    rehearsalNote: note || null,
  }).where(eq(bands.id, result.band.id))

  const when = `${formatDate(date)}${time ? ` às ${time}` : ''}`
  pushToBand(result.band.id, {
    title: 'Ensaio confirmado',
    body: `${result.band.name}: próximo ensaio em ${when}.`,
    url: `/band/${result.band.inviteCode}/rehearsals`,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const result = await getAdminBand(params.inviteCode)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  await db.update(bands).set({
    rehearsalDate: null,
    rehearsalTime: null,
    rehearsalNote: null,
  }).where(eq(bands.id, result.band.id))

  pushToBand(result.band.id, {
    title: 'Ensaio desmarcado',
    body: `${result.band.name}: a data confirmada foi removida.`,
    url: `/band/${result.band.inviteCode}/rehearsals`,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}

function formatDate(date: string) {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}
