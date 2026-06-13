'use client'

import type { SongStatus } from '@/lib/types'

interface StatusBadgeProps {
  status: SongStatus
  onClick?: () => void
  isOwn?: boolean
}

const STATUS_CONFIG: Record<SongStatus, { label: string; bg: string; text: string; ring: string }> = {
  none: { label: 'Nada', bg: 'bg-slate-100 dark:bg-slate-950/70', text: 'text-slate-500 dark:text-slate-400', ring: 'ring-slate-200 dark:ring-white/10' },
  partial: { label: 'Parcial', bg: 'bg-amber-100 dark:bg-amber-400/15', text: 'text-amber-800 dark:text-amber-200', ring: 'ring-amber-200 dark:ring-amber-300/25' },
  full: { label: 'Total', bg: 'bg-emerald-100 dark:bg-emerald-400/15', text: 'text-emerald-800 dark:text-emerald-200', ring: 'ring-emerald-200 dark:ring-emerald-300/25' },
}

export default function StatusBadge({ status, onClick, isOwn = false }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  if (!isOwn || !onClick) {
    return (
      <span
        className={`party-status inline-flex min-w-[3.7rem] items-center justify-center rounded-lg px-2 py-1 text-xs ring-1 ring-inset cursor-default select-none ${config.bg} ${config.text} ${config.ring}`}
      >
        {config.label}
      </span>
    )
  }

  return (
    <button
      onClick={onClick}
      title="Clique para alterar"
      className={`party-status inline-flex min-w-[3.7rem] items-center justify-center rounded-lg px-2 py-1 text-xs ring-1 ring-inset transition-colors hover:brightness-110 active:brightness-95 cursor-pointer ${config.bg} ${config.text} ${config.ring}`}
    >
      {config.label}
    </button>
  )
}
