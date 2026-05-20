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
      return 'bg-cyan-300/18 border-cyan-300/50'
    if (availableCount === 0 && dayAvailability.length > 0)
      return 'bg-pink-500/12 border-pink-400/35'
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
          ? 'bg-black/20 border-white/5 opacity-40 cursor-default'
          : tint
          ? `${tint} ${canInteract ? 'hover:brightness-95 dark:hover:brightness-110 cursor-pointer' : ''}`
          : `bg-black/24 border-white/10 ${canInteract ? 'hover:border-cyan-200/50 hover:bg-white/8 cursor-pointer' : ''}`
      } ${isToday ? 'ring-2 ring-yellow-300 ring-offset-2 ring-offset-[#080914]' : ''}`}
    >
      <span
        className={`text-xs font-medium leading-none ${
          isToday ? 'text-yellow-200' : isPast ? 'text-indigo-200/35' : 'text-indigo-100'
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
                boxShadow: '0 2px 0 rgba(0,0,0,.35)',
              }}
              title={`${member.displayName}: ${isAvailable ? 'disponível' : 'indisponível'}`}
            >
              {isAvailable ? '✓' : '✕'}
            </span>
          )
        })}
      </div>

      {/* "All free" indicator */}
      {availableCount === totalMembers && totalMembers > 1 && !isPast && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-yellow-300 shadow-[0_2px_0_rgba(0,0,0,0.35)]" title="Todos disponíveis" />
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
