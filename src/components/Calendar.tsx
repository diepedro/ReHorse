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
  rehearsalDate?: string | null
  rehearsalTime?: string | null
  rehearsalNote?: string | null
  isAdmin?: boolean
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
  onScheduleChange,
}: CalendarProps) {
  const [availability, setAvailability] = useState<Availability[]>([])
  const [loading, setLoading] = useState(true)
  const [scheduleTime, setScheduleTime] = useState(rehearsalTime ?? '')
  const [scheduleNote, setScheduleNote] = useState(rehearsalNote ?? '')
  const [schedulingDate, setSchedulingDate] = useState<string | null>(null)
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

  useEffect(() => {
    setScheduleTime(rehearsalTime ?? '')
    setScheduleNote(rehearsalNote ?? '')
  }, [rehearsalNote, rehearsalTime])

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

  async function schedule(date: string) {
    setSchedulingDate(date)
    const res = await fetch(`/api/bands/${inviteCode}/schedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, time: scheduleTime, note: scheduleNote }),
    })
    setSchedulingDate(null)
    if (res.ok) onScheduleChange?.()
  }

  async function clearSchedule() {
    setSchedulingDate(rehearsalDate ?? '')
    const res = await fetch(`/api/bands/${inviteCode}/schedule`, { method: 'DELETE' })
    setSchedulingDate(null)
    if (res.ok) onScheduleChange?.()
  }

  const rankedDates = days
    .filter((date) => date >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    .map((date) => getDateScore(formatDate(date), availability, allMembers))
    .sort((a, b) => b.available - a.available || b.responded - a.responded || a.date.localeCompare(b.date))
    .slice(0, 5)

  return (
    <div>
      <div className="mb-5 space-y-3">
        {rehearsalDate ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Próximo ensaio confirmado</p>
                <p className="mt-1 text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                  {formatDisplayDate(rehearsalDate)}{rehearsalTime ? ` às ${rehearsalTime}` : ''}
                </p>
                {rehearsalNote && <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">{rehearsalNote}</p>}
              </div>
              {isAdmin && (
                <button
                  onClick={clearSchedule}
                  disabled={schedulingDate === rehearsalDate}
                  className="self-start rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                >
                  Desmarcar
                </button>
              )}
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Melhores datas</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Ranking baseado nas respostas de disponibilidade.</p>
            </div>
            {isAdmin && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                <input
                  type="text"
                  value={scheduleNote}
                  onChange={(e) => setScheduleNote(e.target.value)}
                  placeholder="Nota opcional"
                  maxLength={80}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>
            )}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-5">
            {rankedDates.map((item) => (
              <div key={item.date} className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">{formatDisplayDateShort(item.date)}</p>
                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                  {item.available}/{item.total} disponíveis
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  {item.missing === 0 ? 'todos responderam' : `${item.missing} sem resposta`}
                </p>
                {isAdmin && (
                  <button
                    onClick={() => schedule(item.date)}
                    disabled={schedulingDate === item.date}
                    className="mt-2 w-full rounded-md bg-gray-900 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
                  >
                    Confirmar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

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

function getDateScore(date: string, availability: Availability[], members: BandMember[]) {
  const entries = availability.filter((a) => a.date === date)
  const available = entries.filter((a) => a.status === 'available').length
  const unavailable = entries.filter((a) => a.status === 'unavailable').length
  const responded = available + unavailable
  const total = members.length
  return { date, available, unavailable, responded, missing: Math.max(0, total - responded), total }
}

function formatDisplayDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
}

function formatDisplayDateShort(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  })
}
