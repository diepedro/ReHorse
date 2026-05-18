import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bands, bandMembers, availability, pushSubscriptions } from '@/lib/schema'
import { eq, and, gte, inArray } from 'drizzle-orm'
import { pushToBand } from '@/lib/push'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/rehearsal-reminder
 *
 * Finds the next date where ALL active band members are available ('yes'),
 * and sends push reminders when that date is exactly 7, 2 or 1 day(s) away.
 *
 * Protect with CRON_SECRET header:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Run daily — e.g. via system cron:
 *   0 9 * * * curl -H "Authorization: Bearer $CRON_SECRET" https://yourapp.com/api/cron/rehearsal-reminder
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Look ahead 8 days to cover all reminder windows
  const lookAhead = new Date(today)
  lookAhead.setDate(today.getDate() + 8)
  const startStr = today.toISOString().slice(0, 10)
  const endStr = lookAhead.toISOString().slice(0, 10)

  const allBands = await db.query.bands.findMany({ with: { members: true } })

  const results: string[] = []

  for (const band of allBands) {
    const activeMembers = band.members.filter((m) => m.claimedBy)
    if (activeMembers.length === 0) continue

    const memberIds = activeMembers.map((m) => m.id)

    // Fetch availability for all active members in the next 8 days
    const rows = await db.query.availability.findMany({
      where: (a, { and, inArray, gte, lte }) =>
        and(
          inArray(a.bandMemberId, memberIds),
          gte(a.date, startStr),
          lte(a.date, endStr),
          eq(a.status, 'yes'),
        ),
    })

    // Group by date, count how many members said yes
    const byDate: Record<string, Set<string>> = {}
    for (const row of rows) {
      if (!byDate[row.date]) byDate[row.date] = new Set()
      byDate[row.date].add(row.bandMemberId)
    }

    // Find earliest date where ALL active members said yes
    const greenDates = Object.entries(byDate)
      .filter(([, members]) => members.size === activeMembers.length)
      .map(([date]) => date)
      .sort()

    if (greenDates.length === 0) continue

    const nextDate = greenDates[0]
    const nextDateObj = new Date(nextDate + 'T00:00:00')
    const daysUntil = Math.round((nextDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (![7, 2, 1].includes(daysUntil)) continue

    const formatted = nextDateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
    const body =
      daysUntil === 1
        ? `Amanhã tem ensaio! (${formatted})`
        : daysUntil === 2
        ? `Daqui 2 dias tem ensaio (${formatted})`
        : `Ensaio em 1 semana (${formatted})`

    await pushToBand(band.id, {
      title: '🎸 Lembrete de ensaio',
      body,
      url: `/${band.inviteCode}/disponibilidade`,
    })

    results.push(`${band.name}: ${daysUntil}d → ${nextDate}`)
  }

  return NextResponse.json({ ok: true, sent: results })
}
