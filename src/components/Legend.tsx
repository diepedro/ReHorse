'use client'

import type { BandMember } from '@/lib/types'

interface LegendProps {
  members: BandMember[]
}

export default function Legend({ members }: LegendProps) {
  const sortedMembers = [...members].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      {sortedMembers.map((member) => (
        <div key={member.id} className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
          <span
            className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15"
            style={{ backgroundColor: member.color }}
          />
          <span>{member.displayName}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-400 dark:text-slate-500">
        <span className="h-3 w-3 shrink-0 rounded-full bg-slate-300 ring-1 ring-black/10 dark:bg-slate-600 dark:ring-white/15" />
        <span>Neutro</span>
      </div>
    </div>
  )
}
