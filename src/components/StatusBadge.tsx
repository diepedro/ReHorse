'use client'

import type { SongStatus } from '@/lib/types'

interface StatusBadgeProps {
  status: SongStatus
  onClick?: () => void
  isOwn?: boolean
}

const STATUS_CONFIG: Record<SongStatus, { label: string; bg: string; text: string; ring: string }> = {
  none: { label: 'Nada', bg: 'bg-white/10', text: 'text-indigo-200/70', ring: 'ring-white/15' },
  partial: { label: 'Parcial', bg: 'bg-yellow-300', text: 'text-gray-950', ring: 'ring-white/70' },
  full: { label: 'Total', bg: 'bg-cyan-300', text: 'text-gray-950', ring: 'ring-white/70' },
}

export default function StatusBadge({ status, onClick, isOwn = false }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  if (!isOwn || !onClick) {
    return (
      <span
        className={`party-status inline-flex items-center px-2 py-0.5 rounded-full text-xs ring-1 ring-inset cursor-default select-none ${config.bg} ${config.text} ${config.ring}`}
      >
        {config.label}
      </span>
    )
  }

  return (
    <button
      onClick={onClick}
      title="Clique para alterar"
      className={`party-status inline-flex items-center px-2 py-0.5 rounded-full text-xs ring-1 ring-inset transition-all hover:scale-105 active:scale-95 cursor-pointer ring-offset-1 hover:ring-offset-2 ${config.bg} ${config.text} ${config.ring}`}
    >
      {config.label}
    </button>
  )
}
