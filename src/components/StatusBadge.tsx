'use client'

import type { SongStatus } from '@/lib/types'

interface StatusBadgeProps {
  status: SongStatus
  onClick?: () => void
  isOwn?: boolean
}

const STATUS_CONFIG: Record<SongStatus, { label: string; bg: string; text: string; ring: string }> = {
  none: { label: 'Nada', bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-400 dark:text-gray-500', ring: 'ring-gray-200 dark:ring-gray-700' },
  partial: { label: 'Parcial', bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', ring: 'ring-amber-200 dark:ring-amber-800' },
  full: { label: 'Total', bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', ring: 'ring-emerald-200 dark:ring-emerald-800' },
}

export default function StatusBadge({ status, onClick, isOwn = false }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  if (!isOwn || !onClick) {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset cursor-default select-none ${config.bg} ${config.text} ${config.ring}`}
      >
        {config.label}
      </span>
    )
  }

  return (
    <button
      onClick={onClick}
      title="Clique para alterar"
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset transition-all hover:scale-105 active:scale-95 cursor-pointer ring-offset-1 hover:ring-offset-2 ${config.bg} ${config.text} ${config.ring}`}
    >
      {config.label}
    </button>
  )
}
