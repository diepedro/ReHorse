'use client'

import { useEffect, useMemo, useState } from 'react'
import type { BandHistoryEvent } from '@/lib/types'

const TYPE_LABEL: Record<string, string> = {
  song_added: 'Musica adicionada',
  song_added_from_suggestion: 'Musica adicionada por sugestao',
  song_removed: 'Musica removida',
  suggestion_created: 'Sugestao criada',
  suggestion_vote: 'Voto registrado',
  suggestion_approved: 'Sugestao aprovada',
  suggestion_auto_approved: 'Sugestao aprovada por votos',
  suggestion_rejected: 'Sugestao rejeitada',
  suggestion_removed: 'Sugestao removida',
  rehearsal_started: 'Ensaio iniciado',
  rehearsal_ended: 'Ensaio encerrado',
  rehearsal_updated: 'Ensaio atualizado',
  member_added: 'Membro adicionado',
  member_removed: 'Membro removido',
  member_name_changed: 'Nome alterado',
  member_color_changed: 'Cor alterada',
}

export default function BandHistoryPanel({
  inviteCode,
  type,
  title = 'Historico',
}: {
  inviteCode: string
  type?: string
  title?: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [events, setEvents] = useState<BandHistoryEvent[]>([])

  useEffect(() => {
    if (!open || events.length > 0) return
    setLoading(true)
    const query = type ? `?type=${encodeURIComponent(type)}` : ''
    fetch(`/api/bands/${inviteCode}/history${query}`)
      .then((res) => res.ok ? res.json() : [])
      .then(setEvents)
      .finally(() => setLoading(false))
  }, [events.length, inviteCode, open, type])

  const visible = useMemo(() => events.slice(0, 30), [events])

  return (
    <section className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-800">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <span>{title}</span>
        <span className="text-xs text-gray-400">{open ? 'Ocultar' : 'Ver historico'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-400 dark:border-gray-800 dark:bg-gray-900">
              Carregando historico...
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-400 dark:border-gray-800 dark:bg-gray-900">
              Nenhum registro ainda.
            </div>
          ) : (
            visible.map((event) => <HistoryItem key={event.id} event={event} />)
          )}
        </div>
      )}
    </section>
  )
}

function HistoryItem({ event }: { event: BandHistoryEvent }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {TYPE_LABEL[event.type] ?? event.type}
          </p>
          <p className="mt-0.5 truncate text-sm text-gray-600 dark:text-gray-300">
            {event.subjectName ?? 'Sem titulo'}
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
    <dl className="mt-2 grid gap-2 text-xs text-gray-500 dark:text-gray-400 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-md bg-gray-50 px-2.5 py-2 dark:bg-gray-950">
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
    playedSongs: 'Musicas tocadas',
    durationMs: 'Duracao',
    from: 'Antes',
    to: 'Depois',
    songCount: 'Musicas no ensaio',
    source: 'Origem',
    duplicate: 'Duplicada',
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
  if (key === 'durationMs' && typeof value === 'number') {
    if (value < 60000) return '< 1 min'
    return `${Math.round(value / 60000)} min`
  }
  if (typeof value === 'object' && value) return JSON.stringify(value)
  if (typeof value === 'boolean') return value ? 'sim' : 'nao'
  return String(value)
}
