'use client'

import type { BandMember } from '@/lib/types'

interface LegendProps {
  members: BandMember[]
}

export default function Legend({ members }: LegendProps) {
  const sorted = [...members].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="flex flex-wrap gap-3 mt-4">
      {sorted.map((m) => (
        <div key={m.id} className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} />
          {m.displayName}
        </div>
      ))}
      <div className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500">
        <span className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" />
        Neutro
      </div>
    </div>
  )
}
