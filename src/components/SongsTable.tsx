'use client'

import dynamic from 'next/dynamic'
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

interface SongsTableProps {
  inviteCode: string
  currentMember: BandMember | null
  allMembers: BandMember[]
  isAdmin?: boolean
  bandName?: string
}

export default function SongsTable({ inviteCode, currentMember, allMembers, isAdmin = false, bandName = '' }: SongsTableProps) {
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
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const toast = useToast()

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
    const actorQuery = currentMember ? `&bandMemberId=${encodeURIComponent(currentMember.id)}` : ''
    const res = await fetch(`/api/bands/${inviteCode}/songs?id=${id}${actorQuery}`, { method: 'DELETE' })
    if (!res.ok) { toast('Erro ao remover música.', 'error'); return }
    invalidateCache(`/api/bands/${inviteCode}/songs`)
    setConfirmDelete(null)
    fetchSongs()
  }

  async function cycleStatus(songId: number, memberId: string) {
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

  const filtered = songs.filter((s) => {
    if (search.trim() && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterRehearsed !== 'all' && (s.rehearsed ?? 'none') !== filterRehearsed) return false
    if (filterMine !== 'all' && currentMember) {
      if ((s.statuses[currentMember.id] ?? 'none') !== filterMine) return false
    }
    return true
  })

  const colSpan = sortedMembers.length + 5 // play + name + members + rehearsed + duration + delete

  const totalDurationMs = filtered.reduce((sum, s) => {
    const ref = songPrimaryRef[s.id]
    return sum + (ref?.durationMs ?? 0)
  }, 0)
  const songsWithDuration = filtered.filter((s) => songPrimaryRef[s.id]?.durationMs).length

  function handlePlay(song: Song) {
    const ref = songPrimaryRef[song.id]
    if (!ref) {
      // No reference yet — open search
      setSearchSongId(song.id)
      return
    }
    if (!ref.previewUrl) {
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
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white flex-1 min-w-0 sm:flex-none sm:w-40 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-600"
        />

        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5 dark:bg-gray-800">
          {(['all', 'none', 'partial', 'full'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilterRehearsed(v)}
              className={`text-xs px-2 py-1 rounded-md transition-colors font-medium ${
                filterRehearsed === v ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {v === 'all' ? 'Todas' : v === 'none' ? '—' : v === 'partial' ? 'Parcial' : 'Total'}
            </button>
          ))}
        </div>

        {currentMember && (
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5 dark:bg-gray-800">
            {(['all', 'none', 'partial', 'full'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilterMine(v)}
                className={`text-xs px-2 py-1 rounded-md transition-colors font-medium ${
                  filterMine === v ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
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
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Limpar
          </button>
        )}
      </div>

      <div className="sm:hidden">
        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white py-8 dark:border-gray-800 dark:bg-gray-900/70">
            <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-400 dark:border-gray-800 dark:bg-gray-900/70">
            {search ? 'Nenhuma música encontrada.' : 'Nenhuma música adicionada ainda.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((song) => {
              const counts = countStatuses(song, sortedMembers)
              const ownStatus = currentMember ? song.statuses[currentMember.id] ?? 'none' : null
              const duration = songPrimaryRef[song.id]?.durationMs

              return (
                <article key={song.id} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900/70">
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => handlePlay(song)}
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs transition-all ${
                        playingId === song.id
                          ? 'bg-emerald-500 text-white'
                          : songPrimaryRef[song.id]
                          ? 'bg-gray-900 text-white hover:bg-gray-700 dark:bg-gray-700/80'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:bg-gray-800/80 dark:hover:bg-gray-700'
                      }`}
                      title={songPrimaryRef[song.id] ? 'Tocar pré-escuta' : 'Vincular música'}
                    >
                      {playingId === song.id ? '⏸' : '▶'}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() => setDetailSongId(song.id)}
                          className="min-w-0 text-left text-sm font-semibold leading-snug text-gray-900 transition-colors hover:text-blue-600 dark:text-gray-100"
                          title="Ver detalhes"
                        >
                          {song.name}
                        </button>
                        {duration && (
                          <span className="shrink-0 pt-0.5 font-mono text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                            {fmtDuration(duration)}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
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
                              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-600 dark:border-gray-800 dark:bg-gray-950/70 dark:text-gray-300"
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

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {currentMember && ownStatus && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">Meu</span>
                            <StatusBadge
                              status={ownStatus}
                              isOwn={true}
                              onClick={() => cycleStatus(song.id, currentMember.id)}
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">Ens.</span>
                          <StatusBadge
                            status={song.rehearsed}
                            isOwn={true}
                            onClick={() => cycleRehearsed(song.id)}
                          />
                        </div>
                      </div>
                    </div>

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
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      <div className="hidden bg-white rounded-xl border border-gray-200 overflow-hidden dark:bg-gray-900/70 dark:border-gray-800 sm:block">
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900">
                <th className="w-10" />
                <th className="text-left px-4 py-3 font-medium text-gray-500 min-w-[140px] dark:text-gray-400">Música</th>
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
                <th className="text-center px-2 py-3 font-medium text-gray-500 whitespace-nowrap dark:text-gray-400">
                  <span className="hidden sm:inline">Ensaiado</span>
                  <span className="sm:hidden">Ens.</span>
                </th>
                <th className="text-right px-3 py-3 font-medium text-gray-500 whitespace-nowrap hidden sm:table-cell dark:text-gray-400">Duração</th>
                <th className="w-8" />
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
                filtered.map((song) => (
                  <tr
                    key={song.id}
                    className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors last:border-b-0 dark:border-gray-800/80 dark:hover:bg-gray-800/40"
                  >
                    <td className="px-2 py-3 w-10 text-center">
                      <button
                        onClick={() => handlePlay(song)}
                        className={`w-7 h-7 flex items-center justify-center rounded-full text-xs transition-all mx-auto ${
                          playingId === song.id
                            ? 'bg-emerald-500 text-white'
                            : songPrimaryRef[song.id]
                            ? 'bg-gray-900 dark:bg-gray-700/80 text-white hover:bg-gray-700'
                            : 'bg-gray-100 dark:bg-gray-800/80 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600'
                        }`}
                        title={songPrimaryRef[song.id] ? 'Tocar pré-escuta' : 'Vincular música'}
                      >
                        {playingId === song.id ? '⏸' : '▶'}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => setDetailSongId(song.id)}
                        className="font-medium text-gray-900 hover:text-blue-600 text-left transition-colors dark:text-gray-100 leading-snug"
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
                            isOwn={isOwn}
                            onClick={isOwn ? () => cycleStatus(song.id, m.id) : undefined}
                          />
                        </td>
                      )
                    })}
                    <td className="text-center px-2 py-3">
                      <StatusBadge
                        status={song.rehearsed}
                        isOwn={true}
                        onClick={() => cycleRehearsed(song.id)}
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
                    <td className="px-1 py-3">
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {songsWithDuration > 0 && (
        <div className="mt-2 flex justify-end px-1">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {songsWithDuration < filtered.length && `${songsWithDuration}/${filtered.length} com duração · `}
            Total: <span className="font-semibold text-gray-600 dark:text-gray-300 font-mono tabular-nums">{fmtDuration(totalDurationMs)}</span>
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {currentMember && (
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 px-4 py-2.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            + Adicionar música
          </button>
        )}
        {currentMember && (
          <button
            onClick={() => setAddingFromSearch(true)}
            className="mt-4 px-4 py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors dark:text-emerald-300 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70"
          >
            Buscar e adicionar
          </button>
        )}
        <button
          onClick={printSetlist}
          className="mt-4 px-4 py-2.5 text-sm font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors dark:bg-gray-900 dark:border-gray-800 dark:hover:bg-gray-800"
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
