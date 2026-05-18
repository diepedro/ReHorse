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
      return 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/50'
    if (availableCount === 0 && dayAvailability.length > 0)
      return 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30'
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
          ? 'bg-gray-50 border-gray-100 opacity-40 cursor-default dark:bg-gray-800/30 dark:border-gray-800'
          : tint
          ? `${tint} ${canInteract ? 'hover:brightness-95 dark:hover:brightness-110 cursor-pointer' : ''}`
          : `bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-700/60 ${canInteract ? 'hover:border-gray-300 hover:shadow-sm dark:hover:border-gray-600 cursor-pointer' : ''}`
      } ${isToday ? 'ring-2 ring-blue-400 ring-offset-1 dark:ring-offset-gray-950' : ''}`}
    >
      <span
        className={`text-xs font-medium leading-none ${
          isToday ? 'text-blue-500 dark:text-blue-400' : isPast ? 'text-gray-400 dark:text-gray-600' : 'text-gray-600 dark:text-gray-300'
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
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500" title="Todos disponíveis" />
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
