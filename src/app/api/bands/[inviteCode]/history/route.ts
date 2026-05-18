import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bandHistoryEvents, bands } from '@/lib/schema'
import { desc, eq, ilike } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const band = await db.query.bands.findFirst({
    where: ilike(bands.inviteCode, params.inviteCode),
  })
  if (!band) return NextResponse.json({ error: 'Band not found' }, { status: 404 })

  const type = new URL(req.url).searchParams.get('type')
  const rows = await db
    .select()
    .from(bandHistoryEvents)
    .where(eq(bandHistoryEvents.bandId, band.id))
    .orderBy(desc(bandHistoryEvents.createdAt))
    .limit(200)

  const filtered = type ? rows.filter((row) => row.subjectType === type || row.type.startsWith(type)) : rows

  return NextResponse.json(
    filtered.map((row) => ({
      ...row,
      details: safeJson(row.details),
    }))
  )
}

function safeJson(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}
