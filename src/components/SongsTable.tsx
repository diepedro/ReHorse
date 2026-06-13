'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import StatusBadge from './StatusBadge'
import AddSongModal from './AddSongModal'
import { useToast } from './ToastProvider'
import type { MusicTrack } from './MusicSearchModal'
import type { BandMember, Song, SongStatus } from '@/lib/types'
import { cachedJson, invalidateCache } from '@/lib/client-cache'

const SongDetailDrawer = dynamic(() => import('./SongDetailDrawer'), {
  loading: () => null,
})

const MusicSearchModal = dynamic(() => import('./MusicSearchModal'), {
  loading: () => null,
})

const CYCLE: SongStatus[] = ['none', 'partial', 'full']

const STATUS_META: Record<SongStatus, { label: string; short: string; classes: string }> = {
  none: {
    label: 'Nada',
    short: 'N',
    classes: 'bg-gray-100 text-gray-500 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700',
  },
  partial: {
    label: 'Parcial',
    short: 'P',
    classes: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800',
  },
  full: {
    label: 'Total',
    short: 'T',
    classes: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800',
  },
}

function fmtDuration(ms: number) {
  const totalSec = Math.round(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function countStatuses(song: Song, members: BandMember[]) {
  return members.reduce(
    (acc, member) => {
      acc[song.statuses[member.id] ?? 'none'] += 1
      return acc
    },
    { full: 0, partial: 0, none: 0 } as Record<SongStatus, number>
  )
}

function ReorderControls({
  canMoveUp,
  canMoveDown,
  disabled,
  disabledTitle = 'Reordenando...',
  onMoveUp,
  onMoveDown,
}: {
  canMoveUp: boolean
  canMoveDown: boolean
  disabled: boolean
  disabledTitle?: string
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const baseClass = 'flex flex-1 items-center justify-center transition-colors'
  const activeClass = 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
  const inactiveClass = 'cursor-not-allowed text-slate-300 dark:text-slate-700'

  return (
    <div className="flex h-14 w-8 shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <button
        type="button"
        onClick={onMoveUp}
        disabled={disabled || !canMoveUp}
        className={`${baseClass} ${disabled || !canMoveUp ? inactiveClass : activeClass}`}
        title={disabled ? disabledTitle : 'Subir musica'}
        aria-label="Subir musica"
      >
        <ChevronIcon direction="up" />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={disabled || !canMoveDown}
        className={`${baseClass} border-t border-slate-200 dark:border-slate-800 ${disabled || !canMoveDown ? inactiveClass : activeClass}`}
        title={disabled ? disabledTitle : 'Descer musica'}
        aria-label="Descer musica"
      >
        <ChevronIcon direction="down" />
      </button>
    </div>
  )
}

function ChevronIcon({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
      {direction === 'up' ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5-5 5 5" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 8l5 5 5-5" />
      )}
    </svg>
  )
}

interface SongsTableProps {
  inviteCode: string
  currentMember: BandMember | null
  allMembers: BandMember[]
  isAdmin?: boolean
  bandName?: string
  readOnly?: boolean
}

export default function SongsTable({ inviteCode, currentMember, allMembers, isAdmin = false, bandName = '', readOnly = false }: SongsTableProps) {
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [filterRehearsed, setFilterRehearsed] = useState<'all' | 'none' | 'partial' | 'full'>('all')
  const [filterMine, setFilterMine] = useState<'all' | 'none' | 'partial' | 'full'>('all')
  const [detailSongId, setDetailSongId] = useState<number | null>(null)
  const [searchSongId, setSearchSongId] = useState<number | null>(null)
  const [addingFromSearch, setAddingFromSearch] = useState(false)
  const [songPrimaryRef, setSongPrimaryRef] = useState<Record<number, { previewUrl: string | null; trackName: string; artistName: string; artworkUrl: string; durationMs: number | null }>>({})
  const [playingId, setPlayingId] = useState<number | null>(null)
  const [reorderingSongId, setReorderingSongId] = useState<number | null>(null)
  const [reorderControlsVisible, setReorderControlsVisible] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const toast = useToast()

  const canEdit = (!!currentMember || isAdmin) && !readOnly
  const hasActiveFilters = search.trim() !== '' || filterRehearsed !== 'all' || filterMine !== 'all'
  const canToggleReorderControls = isAdmin && !readOnly
  const showReorderControls = canToggleReorderControls && reorderControlsVisible
  const canReorderSongs = showReorderControls && !hasActiveFilters
  const sortedMembers = [...allMembers].sort((a, b) => a.sortOrder - b.sortOrder)

  const fetchSongs = useCallback(async () => {
    try {
      const data = await cachedJson<Array<Song & { itunesRef: { previewUrl: string | null; trackName: string; artistName: string; artworkUrl: string; durationMs: number | null } | null }>>(`/api/bands/${inviteCode}/songs`)
      setSongs(data)
      const refs: Record<number, { previewUrl: string | null; trackName: string; artistName: string; artworkUrl: string; durationMs: number | null }> = {}
      for (const s of data) {
        if (s.itunesRef) refs[s.id] = s.itunesRef
      }
      setSongPrimaryRef(refs)
    } catch {
      toast('Erro ao carregar musicas.', 'error')
    } finally {
      setLoading(false)
    }
  }, [inviteCode, toast])

  useEffect(() => {
    fetchSongs()
  }, [fetchSongs])

  async function addSong(name: string) {
    if (!canEdit) return
    const res = await fetch(`/api/bands/${inviteCode}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, bandMemberId: currentMember?.id }),
    })
    if (!res.ok) { toast('Erro ao adicionar música.', 'error'); return }
    invalidateCache(`/api/bands/${inviteCode}/songs`)
    toast('Música adicionada!', 'success')
    fetchSongs()
  }

  async function addTrack(track: MusicTrack) {
    if (!canEdit) return
    const res = await fetch(`/api/bands/${inviteCode}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: track.trackName,
        bandMemberId: currentMember?.id,
        reference: {
          type: track.source,
          refId: track.id,
          title: `${track.trackName} — ${track.artistName}`,
          previewUrl: track.previewUrl ?? null,
          artworkUrl: track.artworkUrl,
          artistName: track.artistName,
          durationMs: track.durationMs ?? null,
        },
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      toast(data?.error ?? 'Erro ao adicionar música.', 'error')
      return
    }
    invalidateCache(`/api/bands/${inviteCode}/songs`)
    toast('Música adicionada ao repertório!', 'success')
    setAddingFromSearch(false)
    fetchSongs()
  }

  async function deleteSong(id: number) {
    if (!canEdit) return
    const actorQuery = currentMember ? `&bandMemberId=${encodeURIComponent(currentMember.id)}` : ''
    const res = await fetch(`/api/bands/${inviteCode}/songs?id=${id}${actorQuery}`, { method: 'DELETE' })
    if (!res.ok) { toast('Erro ao remover música.', 'error'); return }
    invalidateCache(`/api/bands/${inviteCode}/songs`)
    setConfirmDelete(null)
    fetchSongs()
  }

  async function cycleStatus(songId: number, memberId: string) {
    if (readOnly) return
    const song = songs.find((s) => s.id === songId)
    if (!song) return
    const current = song.statuses[memberId] ?? 'none'
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length]

    await fetch(`/api/bands/${inviteCode}/song-status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId, bandMemberId: memberId, status: next }),
    })
    invalidateCache(`/api/bands/${inviteCode}/songs`)
    fetchSongs()
  }

  async function cycleRehearsed(songId: number) {
    if (!canEdit) return
    const song = songs.find((s) => s.id === songId)
    if (!song) return
    const next = CYCLE[(CYCLE.indexOf(song.rehearsed) + 1) % CYCLE.length]

    await fetch(`/api/bands/${inviteCode}/song-status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId, rehearsed: true, status: next }),
    })
    invalidateCache(`/api/bands/${inviteCode}/songs`)
    fetchSongs()
  }

  async function moveSong(songId: number, direction: -1 | 1) {
    if (!canReorderSongs || reorderingSongId !== null) return

    const from = songs.findIndex((song) => song.id === songId)
    const to = from + direction
    if (from < 0 || to < 0 || to >= songs.length) return

    const previousSongs = songs
    const nextSongs = [...songs]
    const moved = nextSongs[from]
    nextSongs[from] = nextSongs[to]
    nextSongs[to] = moved
    const orderedSongs = nextSongs.map((song, index) => ({ ...song, sortOrder: index }))

    setSongs(orderedSongs)
    setReorderingSongId(songId)

    try {
      const res = await fetch(`/api/bands/${inviteCode}/songs/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songIds: orderedSongs.map((song) => song.id) }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Erro ao reordenar musicas.')
      }
      invalidateCache(`/api/bands/${inviteCode}/songs`)
    } catch (error) {
      setSongs(previousSongs)
      toast(error instanceof Error ? error.message : 'Erro ao reordenar musicas.', 'error')
    } finally {
      setReorderingSongId(null)
    }
  }

  const filtered = songs.filter((s) => {
    if (search.trim() && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterRehearsed !== 'all' && (s.rehearsed ?? 'none') !== filterRehearsed) return false
    if (filterMine !== 'all' && currentMember) {
      if ((s.statuses[currentMember.id] ?? 'none') !== filterMine) return false
    }
    return true
  })

  const colSpan = sortedMembers.length + 4 + (canEdit ? 1 : 0) + (showReorderControls ? 1 : 0)

  const totalDurationMs = filtered.reduce((sum, s) => {
    const ref = songPrimaryRef[s.id]
    return sum + (ref?.durationMs ?? 0)
  }, 0)
  const songsWithDuration = filtered.filter((s) => songPrimaryRef[s.id]?.durationMs).length

  function handlePlay(song: Song) {
    const ref = songPrimaryRef[song.id]
    if (!ref) {
      if (!canEdit) return
      // No reference yet — open search
      setSearchSongId(song.id)
      return
    }
    if (!ref.previewUrl) {
      if (!canEdit) return
      // Has reference but no preview — open search to update
      setSearchSongId(song.id)
      return
    }
    // Toggle preview playback
    if (playingId === song.id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    if (audioRef.current) audioRef.current.pause()
    const audio = new Audio(ref.previewUrl)
    audio.play().catch(() => {})
    audio.onended = () => setPlayingId(null)
    audioRef.current = audio
    setPlayingId(song.id)
  }

  async function handleMusicSelect(track: MusicTrack) {
    if (!canEdit) return
    if (searchSongId === null) return
    const res = await fetch(`/api/bands/${inviteCode}/songs/${searchSongId}/references`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: track.source,
        refId: track.id,
        title: `${track.trackName} — ${track.artistName}`,
        previewUrl: track.previewUrl ?? null,
        artworkUrl: track.artworkUrl,
        artistName: track.artistName,
        durationMs: track.durationMs ?? null,
      }),
    })
    if (!res.ok) { toast('Erro ao vincular música.', 'error'); return }
    invalidateCache(`/api/bands/${inviteCode}/songs`)
    setSongPrimaryRef((prev) => ({
      ...prev,
      [searchSongId]: {
        previewUrl: track.previewUrl,
        trackName: track.trackName,
        artistName: track.artistName,
        artworkUrl: track.artworkUrl,
        durationMs: track.durationMs ?? null,
      },
    }))
    setSearchSongId(null)
  }

  useEffect(() => () => { audioRef.current?.pause() }, [])

  function printSetlist() {
    const existing = document.getElementById('print-setlist')
    if (existing) existing.remove()

    const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    const STATUS_SYMBOL: Record<string, string> = { none: '', partial: '◑', full: '●' }
    const STATUS_COLOR: Record<string, string> = { none: 'transparent', partial: '#d97706', full: '#059669' }

    const rows = filtered.map((s, i) => {
      const sym = STATUS_SYMBOL[s.rehearsed ?? 'none']
      const col = STATUS_COLOR[s.rehearsed ?? 'none']
      return `<tr class="${i % 2 === 0 ? 'even' : ''}">
        <td class="num">${i + 1}</td>
        <td class="name">${s.name}</td>
        <td class="status" style="color:${col}">${sym}</td>
      </tr>`
    }).join('')

    const div = document.createElement('div')
    div.id = 'print-setlist'
    div.innerHTML = `
      <style>
        #print-setlist {
          display: none;
          font-family: 'Georgia', serif;
          padding: 48px 56px;
          color: #111;
          max-width: 720px;
          margin: 0 auto;
        }
        @media print {
          body > *:not(#print-setlist) { display: none !important; }
          #print-setlist { display: block !important; }
          @page { margin: 20mm 16mm; }
        }
        .sl-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 6px; }
        .sl-band { font-size: 13px; text-transform: uppercase; letter-spacing: .12em; color: #555; }
        .sl-title { font-size: 32px; font-weight: bold; letter-spacing: -.5px; line-height: 1; }
        .sl-meta { text-align: right; font-size: 12px; color: #888; line-height: 1.6; }
        hr { border: none; border-top: 2px solid #111; margin: 12px 0 20px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 9px 6px; vertical-align: middle; }
        td.num { width: 36px; font-size: 12px; color: #aaa; text-align: right; padding-right: 14px; font-family: monospace; }
        td.name { font-size: 17px; }
        td.status { width: 24px; font-size: 14px; text-align: center; }
        tr.even td { background: #f8f8f8; }
        tr:last-child td { border-bottom: 1px solid #e5e5e5; }
        .sl-footer { margin-top: 32px; font-size: 11px; color: #bbb; text-align: center; letter-spacing: .05em; }
        .sl-legend { margin-top: 18px; display: flex; gap: 20px; font-size: 11px; color: #888; }
        .sl-legend span { display: flex; align-items: center; gap: 5px; }
      </style>
      <div class="sl-header">
        <div>
          ${bandName ? `<div class="sl-band">${bandName}</div>` : ''}
          <div class="sl-title">Setlist</div>
        </div>
        <div class="sl-meta">
          ${date}<br>
          ${filtered.length} música${filtered.length !== 1 ? 's' : ''}
        </div>
      </div>
      <hr>
      <table><tbody>${rows}</tbody></table>
      <div class="sl-legend">
        <span><span style="color:#059669">●</span> Total</span>
        <span><span style="color:#d97706">◑</span> Parcial</span>
        <span><span style="color:#ccc">○</span> Não ensaiado</span>
      </div>
      <div class="sl-footer">Gerado por ReHorse</div>
    `
    document.body.appendChild(div)
    window.print()
    setTimeout(() => div.remove(), 3000)
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 grid gap-2 sm:flex sm:flex-wrap sm:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
          className="party-input min-w-0 px-3 py-2 sm:w-48 sm:flex-none"
        />

        <div className="party-segment w-full sm:w-auto">
          {(['all', 'none', 'partial', 'full'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilterRehearsed(v)}
              className={`text-xs px-2 py-1 rounded-md transition-colors font-medium ${
                filterRehearsed === v ? 'party-segment-item party-segment-item-active' : 'party-segment-item'
              }`}
            >
              {v === 'all' ? 'Todas' : v === 'none' ? '—' : v === 'partial' ? 'Parcial' : 'Total'}
            </button>
          ))}
        </div>

        {currentMember && (
          <div className="party-segment w-full sm:w-auto">
            {(['all', 'none', 'partial', 'full'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilterMine(v)}
                className={`text-xs px-2 py-1 rounded-md transition-colors font-medium ${
                  filterMine === v ? 'party-segment-item party-segment-item-active' : 'party-segment-item'
                }`}
                title="Meu aprendizado"
              >
                {v === 'all' ? 'Meu' : v === 'none' ? '—' : v === 'partial' ? 'Parcial' : 'Total'}
              </button>
            ))}
          </div>
        )}

        {(search || filterRehearsed !== 'all' || filterMine !== 'all') && (
          <button
            onClick={() => { setSearch(''); setFilterRehearsed('all'); setFilterMine('all') }}
            className="text-xs font-semibold text-blue-600 transition-colors hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
          >
            Limpar
          </button>
        )}
      </div>

      {!canEdit && (
        <div className="party-card-soft mb-4 flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
          <span>Entre como membro para editar o repertorio, marcar preparo e vincular referencias.</span>
          <Link href={`/join/${inviteCode}`} className="party-button shrink-0 text-center">
            Entrar na banda
          </Link>
        </div>
      )}

      <div className="sm:hidden">
        {loading ? (
          <div className="party-card py-8">
            <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="party-card px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            {search ? 'Nenhuma música encontrada.' : 'Nenhuma música adicionada ainda.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((song) => {
              const counts = countStatuses(song, sortedMembers)
              const ownStatus = currentMember ? song.statuses[currentMember.id] ?? 'none' : null
              const duration = songPrimaryRef[song.id]?.durationMs
              const isFirst = songs[0]?.id === song.id
              const isLast = songs[songs.length - 1]?.id === song.id

              return (
                <article key={song.id} className="party-card p-3.5">
                  <div className="flex items-start gap-2">
                    {showReorderControls && (
                      <ReorderControls
                        canMoveUp={!isFirst}
                        canMoveDown={!isLast}
                        disabled={!canReorderSongs || reorderingSongId !== null}
                        disabledTitle={!canReorderSongs ? 'Limpe os filtros para reordenar' : 'Salvando ordem'}
                        onMoveUp={() => moveSong(song.id, -1)}
                        onMoveDown={() => moveSong(song.id, 1)}
                      />
                    )}
                    <button
                      onClick={() => handlePlay(song)}
                      disabled={!canEdit && !songPrimaryRef[song.id]?.previewUrl}
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs transition-all ${
                        playingId === song.id
                          ? 'bg-emerald-600 text-white'
                          : songPrimaryRef[song.id]
                          ? 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100'
                      }`}
                      title={songPrimaryRef[song.id] ? 'Tocar pré-escuta' : 'Vincular música'}
                    >
                      {playingId === song.id ? '⏸' : '▶'}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() => setDetailSongId(song.id)}
                          className="min-w-0 text-left text-sm font-semibold leading-snug text-slate-950 transition-colors hover:text-blue-700 dark:text-slate-100 dark:hover:text-blue-300"
                          title="Ver detalhes"
                        >
                          {song.name}
                        </button>
                        {duration && (
                          <span className="party-subtle shrink-0 pt-0.5 font-mono text-[11px] tabular-nums">
                            {fmtDuration(duration)}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span><strong className="text-emerald-600 dark:text-emerald-300">{counts.full}</strong> Total</span>
                        <span aria-hidden="true">·</span>
                        <span><strong className="text-amber-600 dark:text-amber-300">{counts.partial}</strong> Parcial</span>
                        <span aria-hidden="true">·</span>
                        <span><strong className="text-gray-500 dark:text-gray-400">{counts.none}</strong> Nada</span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {sortedMembers.map((member) => {
                          const status = song.statuses[member.id] ?? 'none'
                          const meta = STATUS_META[status]
                          return (
                            <span
                              key={member.id}
                              title={`${member.displayName}: ${meta.label}`}
                              aria-label={`${member.displayName}: ${meta.label}`}
                              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: member.color }} />
                              <span className="max-w-[4.5rem] truncate">{member.displayName}</span>
                              <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none ring-1 ring-inset ${meta.classes}`}>
                                {meta.short}
                              </span>
                            </span>
                          )
                        })}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/80 p-2 dark:border-white/10 dark:bg-slate-950/40">
                        {currentMember && ownStatus && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Meu</span>
                          <StatusBadge
                            status={ownStatus}
                            isOwn={canEdit}
                            onClick={canEdit ? () => cycleStatus(song.id, currentMember.id) : undefined}
                          />
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Ens.</span>
                          <StatusBadge
                            status={song.rehearsed}
                            isOwn={canEdit}
                            onClick={canEdit ? () => cycleRehearsed(song.id) : undefined}
                          />
                        </div>
                      </div>
                    </div>

                    {canEdit && (
                    <div className="shrink-0">
                      {confirmDelete === song.id ? (
                        <div className="flex flex-col items-end gap-1">
                          <button
                            onClick={() => deleteSong(song.id)}
                            className="rounded bg-red-500 px-2 py-0.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
                          >
                            Remover
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(song.id)}
                          className="p-1 text-gray-300 transition-colors hover:text-red-400 dark:text-gray-500 dark:hover:text-red-400"
                          title="Remover música"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      <div className="party-card hidden overflow-hidden p-0 sm:block">
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70">
                {showReorderControls && <th className="w-12" />}
                <th className="w-10" />
                <th className="min-w-[140px] px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Música</th>
                {sortedMembers.map((m) => (
                  <th
                    key={m.id}
                    className="text-center px-2 py-3 font-medium whitespace-nowrap hidden sm:table-cell"
                    style={{ color: m.color }}
                  >
                    <span className="hidden md:inline">{m.displayName}</span>
                    <span
                      className="inline md:hidden w-3 h-3 rounded-full block mx-auto"
                      style={{ backgroundColor: m.color }}
                      title={m.displayName}
                    />
                  </th>
                ))}
                <th className="px-2 py-3 text-center font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                  <span className="hidden sm:inline">Ensaiado</span>
                  <span className="sm:hidden">Ens.</span>
                </th>
                <th className="hidden px-3 py-3 text-right font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap sm:table-cell">Duração</th>
                {canEdit && <th className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colSpan} className="py-8">
                    <div className="flex justify-center">
                      <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="text-center py-12 text-gray-400">
                    {search ? 'Nenhuma música encontrada.' : 'Nenhuma música adicionada ainda.'}
                  </td>
                </tr>
              ) : (
                filtered.map((song) => {
                  const isFirst = songs[0]?.id === song.id
                  const isLast = songs[songs.length - 1]?.id === song.id

                  return (
                  <tr
                    key={song.id}
                    className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70"
                  >
                    {showReorderControls && (
                      <td className="w-12 px-2 py-3">
                        <ReorderControls
                          canMoveUp={!isFirst}
                          canMoveDown={!isLast}
                          disabled={!canReorderSongs || reorderingSongId !== null}
                          disabledTitle={!canReorderSongs ? 'Limpe os filtros para reordenar' : 'Salvando ordem'}
                          onMoveUp={() => moveSong(song.id, -1)}
                          onMoveDown={() => moveSong(song.id, 1)}
                        />
                      </td>
                    )}
                    <td className="px-2 py-3 w-10 text-center">
                      <button
                        onClick={() => handlePlay(song)}
                        disabled={!canEdit && !songPrimaryRef[song.id]?.previewUrl}
                        className={`w-7 h-7 flex items-center justify-center rounded-full text-xs transition-all mx-auto ${
                          playingId === song.id
                            ? 'bg-emerald-600 text-white'
                            : songPrimaryRef[song.id]
                            ? 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100'
                        }`}
                        title={songPrimaryRef[song.id] ? 'Tocar pré-escuta' : 'Vincular música'}
                      >
                        {playingId === song.id ? '⏸' : '▶'}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => setDetailSongId(song.id)}
                        className="text-left font-semibold leading-snug text-slate-950 transition-colors hover:text-blue-700 dark:text-slate-100 dark:hover:text-blue-300"
                        title="Ver detalhes"
                      >
                        {song.name}
                      </button>
                    </td>
                    {sortedMembers.map((m) => {
                      const isOwn = currentMember?.id === m.id
                      return (
                        <td key={m.id} className="text-center px-2 py-3 hidden sm:table-cell">
                          <StatusBadge
                            status={song.statuses[m.id] ?? 'none'}
                            isOwn={isOwn && canEdit}
                            onClick={isOwn && canEdit ? () => cycleStatus(song.id, m.id) : undefined}
                          />
                        </td>
                      )
                    })}
                    <td className="text-center px-2 py-3">
                      <StatusBadge
                        status={song.rehearsed}
                        isOwn={canEdit}
                        onClick={canEdit ? () => cycleRehearsed(song.id) : undefined}
                      />
                    </td>
                    <td className="text-right px-3 py-3 hidden sm:table-cell">
                      {songPrimaryRef[song.id]?.durationMs ? (
                        <span className="text-xs text-gray-400 dark:text-gray-500 font-mono tabular-nums">
                          {fmtDuration(songPrimaryRef[song.id].durationMs!)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-200 dark:text-gray-700">—</span>
                      )}
                    </td>
                    {canEdit && <td className="px-1 py-3">
                      {confirmDelete === song.id ? (
                        <div className="flex flex-col gap-1 items-center">
                          <button
                            onClick={() => deleteSong(song.id)}
                            className="text-xs text-white bg-red-500 hover:bg-red-600 rounded px-2 py-0.5 font-medium transition-colors"
                          >
                            Remover
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(song.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors dark:text-gray-500 dark:hover:text-red-400"
                          title="Remover música"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </td>}
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {songsWithDuration > 0 && (
        <div className="mt-2 flex justify-end px-1">
            <span className="party-subtle text-xs">
            {songsWithDuration < filtered.length && `${songsWithDuration}/${filtered.length} com duração · `}
            Total: <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">{fmtDuration(totalDurationMs)}</span>
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <button
            onClick={() => setShowModal(true)}
            className="party-button mt-4 flex-1 sm:flex-none"
          >
            + Adicionar música
          </button>
        )}
        {canEdit && (
          <button
            onClick={() => setAddingFromSearch(true)}
            className="party-button-secondary mt-4 flex-1 sm:flex-none"
          >
            Buscar e adicionar
          </button>
        )}
        {canToggleReorderControls && (
          <button
            type="button"
            onClick={() => setReorderControlsVisible((visible) => !visible)}
            aria-pressed={reorderControlsVisible}
            className="party-button-secondary mt-4 flex-1 sm:flex-none"
            title={reorderControlsVisible && hasActiveFilters ? 'Limpe os filtros para reordenar' : undefined}
          >
            {reorderControlsVisible ? 'Ocultar reordenacao' : 'Mostrar reordenacao'}
          </button>
        )}
        <button
          onClick={printSetlist}
          className="party-button-secondary mt-4 flex-1 sm:flex-none"
        >
          Exportar setlist
        </button>
      </div>

      <AddSongModal open={showModal} onClose={() => setShowModal(false)} onAdd={addSong} />

      {detailSongId !== null && (
        <SongDetailDrawer
          songId={detailSongId}
          inviteCode={inviteCode}
          currentMember={currentMember}
          allMembers={allMembers}
          isAdmin={isAdmin}
          readOnly={readOnly}
          onClose={() => setDetailSongId(null)}
        />
      )}

      {searchSongId !== null && (
        <MusicSearchModal
          songName={songs.find((s) => s.id === searchSongId)?.name ?? ''}
          onSelect={handleMusicSelect}
          onClose={() => setSearchSongId(null)}
        />
      )}

      {addingFromSearch && (
        <MusicSearchModal
          songName=""
          onSelect={addTrack}
          onClose={() => setAddingFromSearch(false)}
          selectLabel="Adicionar"
        />
      )}
    </div>
  )
}
