'use client'

import type { Availability, BandMember } from '@/lib/types'

interface CalendarDayProps {
  date: Date
  today: Date
  availability: Availability[]
  currentMember: BandMember | null
  allMembers: BandMember[]
  onToggle?: (dateStr: string) => void
}

export default function CalendarDay({
  date,
  today,
  availability,
  currentMember,
  allMembers,
  onToggle,
}: CalendarDayProps) {
  const dateStr = formatDate(date)
  const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const isToday = dateStr === formatDate(today)
  const dayAvailability = availability.filter((a) => a.date === dateStr)

  // Summary: count available vs members who responded
  const availableCount = dayAvailability.filter((a) => a.status === 'available').length
  const totalMembers = allMembers.length

  // Day tint based on availability ratio
  const getTint = () => {
    if (isPast || dayAvailability.length === 0) return ''
    if (availableCount === totalMembers && totalMembers > 0)
      return 'bg-emerald-50 border-emerald-200 dark:bg-emerald-400/10 dark:border-emerald-300/25'
    if (availableCount === 0 && dayAvailability.length > 0)
      return 'bg-rose-50 border-rose-200 dark:bg-rose-400/10 dark:border-rose-300/25'
    return ''
  }

  const tint = getTint()
  const canInteract = !isPast && !!onToggle

  function handleClick() {
    if (!canInteract) return
    onToggle!(dateStr)
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPast || !canInteract}
      className={`relative flex flex-col items-start p-1.5 sm:p-2 min-h-[68px] sm:min-h-[78px] rounded-lg border transition-colors text-left w-full ${
        isPast
          ? 'bg-slate-100 border-slate-200 opacity-45 cursor-default dark:bg-slate-900 dark:border-slate-800'
          : tint
          ? `${tint} ${canInteract ? 'hover:brightness-95 dark:hover:brightness-110 cursor-pointer' : ''}`
          : `bg-white border-slate-200 dark:bg-slate-900/80 dark:border-white/10 ${canInteract ? 'hover:border-cyan-300 hover:bg-cyan-50/60 dark:hover:border-cyan-300/40 dark:hover:bg-cyan-300/10 cursor-pointer' : ''}`
      } ${isToday ? 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-slate-50 dark:ring-cyan-300 dark:ring-offset-slate-950' : ''}`}
    >
      <span
        className={`text-xs font-medium leading-none ${
          isToday ? 'text-blue-700 dark:text-blue-300' : isPast ? 'text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-200'
        }`}
      >
        {date.getDate()}
      </span>

      {/* Member dots */}
      <div className="flex flex-wrap gap-0.5 mt-1.5">
        {allMembers.map((member) => {
          const entry = dayAvailability.find((a) => a.bandMemberId === member.id)
          if (!entry) return null

          const isAvailable = entry.status === 'available'
          return (
            <span
              key={member.id}
              className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center text-white leading-none"
              style={{
                backgroundColor: isAvailable ? member.color : `${member.color}44`,
                fontSize: '8px',
                fontWeight: 700,
                boxShadow: '0 1px 2px rgba(15,23,42,.18)',
              }}
              title={`${member.displayName}: ${isAvailable ? 'disponível' : 'indisponível'}`}
            >
              {isAvailable ? '✓' : '✕'}
            </span>
          )
        })}
      </div>

      {!isPast && dayAvailability.length > 0 && (
        <span className="mt-auto pt-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
          {availableCount}/{totalMembers}
        </span>
      )}

      {/* "All free" indicator */}
      {availableCount === totalMembers && totalMembers > 1 && !isPast && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-emerald-500" title="Todos disponíveis" />
      )}
    </button>
  )
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
