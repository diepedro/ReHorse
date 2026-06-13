'use client'

import { useCallback, useEffect, useState } from 'react'
import CalendarDay from './CalendarDay'
import Legend from './Legend'
import type { Availability, BandMember } from '@/lib/types'
import { cachedJson, invalidateCache } from '@/lib/client-cache'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
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
  rehearsalDate?: string | null
  rehearsalTime?: string | null
  rehearsalNote?: string | null
  isAdmin?: boolean
  readOnly?: boolean
  onScheduleChange?: () => void
}

export default function Calendar({
  inviteCode,
  currentMember,
  allMembers,
  rehearsalDate,
  rehearsalTime,
  rehearsalNote,
  isAdmin = false,
  readOnly = false,
  onScheduleChange,
}: CalendarProps) {
  const [availability, setAvailability] = useState<Availability[]>([])
  const [loading, setLoading] = useState(true)
  const [schedulingDate, setSchedulingDate] = useState<string | null>(null)
  const today = new Date()

  const days = generateDays(today)
  const weeks = chunkWeeks(days)
  const blocks = groupByMonth(weeks)
  const startDate = formatDate(days[0])
  const endDate = formatDate(days[days.length - 1])

  const fetchAvailability = useCallback(async () => {
    const url = `/api/bands/${inviteCode}/availability?start=${startDate}&end=${endDate}`
    try {
      setAvailability(await cachedJson<Availability[]>(url))
    } catch {
      setAvailability([])
    }
    setLoading(false)
  }, [inviteCode, startDate, endDate])

  useEffect(() => {
    fetchAvailability()
  }, [fetchAvailability])

  async function handleToggle(dateStr: string) {
    if (readOnly) return
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

    invalidateCache(`/api/bands/${inviteCode}/availability`)
    fetchAvailability()
  }

  async function clearSchedule() {
    if (readOnly) return
    setSchedulingDate(rehearsalDate ?? '')
    const res = await fetch(`/api/bands/${inviteCode}/schedule`, { method: 'DELETE' })
    setSchedulingDate(null)
    if (res.ok) onScheduleChange?.()
  }

  return (
    <div>
      <div className="mb-5 space-y-3">
        {rehearsalDate ? (
          <div className="party-card border-cyan-300/70 bg-cyan-50/80 dark:border-cyan-300/25 dark:bg-cyan-300/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">Proximo ensaio confirmado</p>
                <p className="mt-1 text-lg font-bold text-slate-950 dark:text-white">
                  {formatDisplayDate(rehearsalDate)}{rehearsalTime ? ` as ${rehearsalTime}` : ''}
                </p>
                {rehearsalNote && <p className="party-subtle mt-1 text-xs">{rehearsalNote}</p>}
              </div>
              {isAdmin && (
                <button
                  onClick={clearSchedule}
                  disabled={readOnly || schedulingDate === rehearsalDate}
                  className="party-button-secondary self-start px-3 py-1.5 text-xs"
                >
                  Desmarcar
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
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
                className={`py-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 ${
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
                        onToggle={currentMember && !readOnly ? handleToggle : undefined}
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
      {currentMember && !readOnly && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Clique para alternar: neutro - disponivel - indisponivel - neutro
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

function formatDisplayDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
}
