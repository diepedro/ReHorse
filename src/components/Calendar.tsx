'use client'

import { useCallback, useEffect, useState } from 'react'
import CalendarDay from './CalendarDay'
import Legend from './Legend'
import type { Availability, BandMember } from '@/lib/types'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

interface MonthBlock {
  label: string
  weeks: Date[][]
}

interface CalendarProps {
  inviteCode: string
  currentMember: BandMember | null
  allMembers: BandMember[]
}

export default function Calendar({ inviteCode, currentMember, allMembers }: CalendarProps) {
  const [availability, setAvailability] = useState<Availability[]>([])
  const [loading, setLoading] = useState(true)
  const today = new Date()

  const days = generateDays(today)
  const weeks = chunkWeeks(days)
  const blocks = groupByMonth(weeks)
  const startDate = formatDate(days[0])
  const endDate = formatDate(days[days.length - 1])

  const fetchAvailability = useCallback(async () => {
    const res = await fetch(
      `/api/bands/${inviteCode}/availability?start=${startDate}&end=${endDate}`
    )
    if (res.ok) setAvailability(await res.json())
    setLoading(false)
  }, [inviteCode, startDate, endDate])

  useEffect(() => {
    fetchAvailability()
  }, [fetchAvailability])

  async function handleToggle(dateStr: string) {
    if (!currentMember) return
    const current = availability.find(
      (a) => a.bandMemberId === currentMember.id && a.date === dateStr
    )
    let newStatus: string
    if (!current) newStatus = 'available'
    else if (current.status === 'available') newStatus = 'unavailable'
    else newStatus = 'neutral'

    await fetch(`/api/bands/${inviteCode}/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bandMemberId: currentMember.id, date: dateStr, status: newStatus }),
    })

    fetchAvailability()
  }

  return (
    <div>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-gray-400 py-2">
            {day}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="min-h-[72px] sm:min-h-[80px] rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-0">
          {blocks.map((block, bi) => (
            <div key={bi}>
              <div
                className={`text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide py-2 ${
                  bi > 0 ? 'mt-3 border-t border-gray-200 dark:border-gray-800' : ''
                }`}
              >
                {block.label}
              </div>
              <div className="space-y-1">
                {block.weeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-1">
                    {week.map((date, di) => (
                      <CalendarDay
                        key={di}
                        date={date}
                        today={today}
                        availability={availability}
                        currentMember={currentMember}
                        allMembers={allMembers}
                        onToggle={currentMember ? handleToggle : undefined}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Legend members={allMembers} />
      {currentMember && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          Clique para alternar: neutro → disponível → indisponível → neutro
        </p>
      )}
    </div>
  )
}

function generateDays(today: Date): Date[] {
  const start = new Date(today)
  const dayOfWeek = start.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  start.setDate(start.getDate() + mondayOffset)

  const days: Date[] = []
  for (let i = 0; i < 56; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d)
  }
  return days
}

function chunkWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }
  return weeks
}

function getWeekMonth(week: Date[]): string {
  const counts: Record<string, number> = {}
  for (const d of week) {
    const key = `${d.getFullYear()}-${d.getMonth()}`
    counts[key] = (counts[key] || 0) + 1
  }
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
  const [year, month] = dominant.split('-').map(Number)
  return `${MONTH_NAMES[month]} ${year}`
}

function groupByMonth(weeks: Date[][]): MonthBlock[] {
  const blocks: MonthBlock[] = []
  for (const week of weeks) {
    const label = getWeekMonth(week)
    const last = blocks[blocks.length - 1]
    if (last && last.label === label) last.weeks.push(week)
    else blocks.push({ label, weeks: [week] })
  }
  return blocks
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
