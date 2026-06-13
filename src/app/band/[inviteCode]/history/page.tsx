'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useBand } from '@/contexts/BandContext'
import type { BandHistoryEvent } from '@/lib/types'
import { cachedJson } from '@/lib/client-cache'

const FILTERS = [
  { value: 'all', label: 'Tudo' },
  { value: 'song', label: 'Músicas' },
  { value: 'suggestion', label: 'Sugestões' },
  { value: 'rehearsal', label: 'Ensaios' },
  { value: 'member', label: 'Membros' },
]

const TYPE_LABEL: Record<string, string> = {
  song_added: 'Música adicionada',
  song_added_from_suggestion: 'Música adicionada por sugestão',
  song_removed: 'Música removida',
  suggestion_created: 'Sugestão criada',
  suggestion_vote: 'Voto registrado',
  suggestion_approved: 'Sugestão aprovada',
  suggestion_auto_approved: 'Sugestão aprovada por votos',
  suggestion_rejected: 'Sugestão rejeitada',
  suggestion_removed: 'Sugestão removida',
  suggestion_nudged: 'Nudge enviado',
  rehearsal_started: 'Ensaio iniciado',
  rehearsal_ended: 'Ensaio encerrado',
  rehearsal_updated: 'Ensaio atualizado',
  member_added: 'Membro adicionado',
  member_removed: 'Membro removido',
  member_name_changed: 'Nome alterado',
  member_color_changed: 'Cor alterada',
  member_claim_reset: 'Entrada liberada',
}

export default function HistoryPage() {
  const { inviteCode } = useParams() as { inviteCode: string }
  const { band } = useBand()
  const [events, setEvents] = useState<BandHistoryEvent[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cachedJson<BandHistoryEvent[]>(`/api/bands/${inviteCode}/history`)
      .catch(() => [])
      .then(setEvents)
      .finally(() => setLoading(false))
  }, [inviteCode])

  const visible = useMemo(() => {
    if (filter === 'all') return events
    return events.filter((event) => event.subjectType === filter || event.type.startsWith(filter))
  }, [events, filter])

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h2 className="text-lg font-semibold dark:text-gray-100">Histórico</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Registro das mudanças importantes de {band.name}.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            onClick={() => setFilter(item.value)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === item.value
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-950'
                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-400 dark:bg-gray-900 dark:border-gray-800">
            Carregando histórico...
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400 dark:bg-gray-900 dark:border-gray-800">
            Nenhum registro ainda.
          </div>
        ) : (
          visible.map((event) => <HistoryRow key={event.id} event={event} />)
        )}
      </div>
    </div>
  )
}

function HistoryRow({ event }: { event: BandHistoryEvent }) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 dark:bg-gray-900 dark:border-gray-800">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {TYPE_LABEL[event.type] ?? event.type}
          </p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {event.subjectName ?? 'Sem título'}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {event.actorName ? `por ${event.actorName}` : 'sem autor registrado'}
          </p>
        </div>
        <time className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
          {new Date(event.createdAt).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      </div>
      <EventDetails details={event.details} />
    </article>
  )
}

function EventDetails({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details).filter(([, value]) => value !== null && value !== undefined && value !== '')
  if (entries.length === 0) return null

  return (
    <dl className="mt-3 grid gap-2 text-xs text-gray-500 dark:text-gray-400 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-950">
          <dt className="font-medium text-gray-400">{labelKey(key)}</dt>
          <dd className="mt-0.5 break-words">{formatValue(key, value)}</dd>
        </div>
      ))}
    </dl>
  )
}

function labelKey(key: string) {
  const labels: Record<string, string> = {
    votes: 'Votos',
    playedSongs: 'Músicas tocadas',
    durationMs: 'Duração',
    previousColor: 'Cor anterior',
    nextColor: 'Nova cor',
    reason: 'Motivo',
  }
  return labels[key] ?? key
}

function formatValue(key: string, value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'object' && item && 'memberName' in item && 'vote' in item) {
          const vote = (item as { vote: string }).vote === 'yes' ? 'sim' : 'nao'
          return `${(item as { memberName: string }).memberName}: ${vote}`
        }
        return String(item)
      })
      .join(', ')
  }
  if (typeof value === 'object' && value) return JSON.stringify(value)
  if (key === 'durationMs' && typeof value === 'number') {
    if (value < 60000) return '< 1 min'
    return `${Math.round(value / 60000)} min`
  }
  return String(value)
}
