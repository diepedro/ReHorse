'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import type { Song, BandMember } from '@/lib/types'
import { useBand } from '@/contexts/BandContext'
import { cachedJson, invalidateCache } from '@/lib/client-cache'
import BrandMark from '@/components/BrandMark'

interface RehearsalSession {
  id: number
  bandId: string
  createdAt: string
  endedAt: string | null
  songOrder: number[]
  playedSongs: number[]
}

const STATUS_CYCLE = ['none', 'partial', 'full'] as const
const STATUS_LABEL: Record<string, string> = { none: '—', partial: 'Parcial', full: 'Total' }
const STATUS_COLOR: Record<string, string> = {
  none: 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  full: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

function fmtSecs(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export default function EnsaioPage() {
  const params = useParams()
  const inviteCode = params.inviteCode as string
  const { currentMember, readOnly } = useBand()
  const canControl = !!currentMember && !readOnly

  const [session, setSession] = useState<RehearsalSession | null | false>(false) // false = loading
  const [songs, setSongs] = useState<Song[]>([])
  const [orderedSongs, setOrderedSongs] = useState<Song[]>([])
  const [elapsed, setElapsed] = useState('0:00')
  const [ending, setEnding] = useState(false)

  // Drag state (mouse + touch)
  const dragIndex = useRef<number | null>(null)
  const touchY = useRef<number>(0)
  const [dragOver, setDragOver] = useState<number | null>(null)

  // Recording state
  const [recordings, setRecordings] = useState<{ url: string; name: string; size: number; songId: number }[]>([])
  const [recording, setRecording] = useState(false)
  const [recordingForSongId, setRecordingForSongId] = useState<number | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchSession = useCallback(async () => {
    const [s, allSongs] = await Promise.all([
      cachedJson<RehearsalSession | null>(`/api/bands/${inviteCode}/rehearsal`, 3000).catch(() => null),
      cachedJson<Song[]>(`/api/bands/${inviteCode}/songs`).catch(() => []),
    ])

    setSongs(allSongs)
    setSession(s)

    if (s && !s.endedAt) {
      // Apply saved order
      const songMap = new Map(allSongs.map((song) => [song.id, song]))
      const ordered = s.songOrder
        .map((id) => songMap.get(id))
        .filter(Boolean) as Song[]
      // Append any songs not in order yet
      allSongs.forEach((song) => {
        if (!s.songOrder.includes(song.id)) ordered.push(song)
      })
      setOrderedSongs(ordered)
    }
  }, [inviteCode])

  // Initial load + polling
  useEffect(() => {
    fetchSession()
    const interval = setInterval(fetchSession, 8000)
    return () => clearInterval(interval)
  }, [fetchSession])

  // Timer
  useEffect(() => {
    if (!session || typeof session !== 'object' || session.endedAt) return
    const tick = () => setElapsed(formatDuration(Date.now() - new Date(session.createdAt).getTime()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [session])

  async function startSession() {
    if (!canControl || !currentMember) return
    setSession(false)
    const actorQuery = currentMember ? `?bandMemberId=${encodeURIComponent(currentMember.id)}` : ''
    const res = await fetch(`/api/bands/${inviteCode}/rehearsal${actorQuery}`, { method: 'POST' })
    invalidateCache(`/api/bands/${inviteCode}/rehearsal`)
    if (res.ok) fetchSession()
  }

  async function endSession() {
    if (!canControl || !currentMember) return
    setEnding(true)
    const actorQuery = currentMember ? `?bandMemberId=${encodeURIComponent(currentMember.id)}` : ''
    const res = await fetch(`/api/bands/${inviteCode}/rehearsal${actorQuery}`, { method: 'DELETE' })
    if (!res.ok) alert('Nao foi possivel encerrar o ensaio.')
    invalidateCache(`/api/bands/${inviteCode}/rehearsal`)
    await fetchSession()
    setEnding(false)
  }

  async function patch(body: { songOrder?: number[]; playedSongs?: number[] }) {
    if (!canControl || !currentMember) return
    await fetch(`/api/bands/${inviteCode}/rehearsal?bandMemberId=${encodeURIComponent(currentMember.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    invalidateCache(`/api/bands/${inviteCode}/rehearsal`)
  }

  async function togglePlayed(songId: number) {
    if (!canControl) return
    if (!session || typeof session !== 'object' || session.endedAt) return
    const current = session.playedSongs
    const next = current.includes(songId)
      ? current.filter((id) => id !== songId)
      : [...current, songId]
    setSession({ ...session, playedSongs: next })
    await patch({ playedSongs: next })
  }

  async function cycleRehearsed(songId: number) {
    if (!canControl) return
    const song = songs.find((s) => s.id === songId)
    if (!song) return
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(song.rehearsed as typeof STATUS_CYCLE[number]) + 1) % STATUS_CYCLE.length]
    setSongs((prev) => prev.map((s) => s.id === songId ? { ...s, rehearsed: next } : s))
    setOrderedSongs((prev) => prev.map((s) => s.id === songId ? { ...s, rehearsed: next } : s))
    await fetch(`/api/bands/${inviteCode}/song-status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId, rehearsed: true, status: next }),
    })
    invalidateCache(`/api/bands/${inviteCode}/songs`)
  }

  // ── Drag helpers ───────────────────────────────────────────────────────────

  async function applyReorder(from: number, to: number) {
    if (!canControl) return
    if (from === to) return
    const next = [...orderedSongs]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setOrderedSongs(next)
    setDragOver(null)
    dragIndex.current = null
    if (session && typeof session === 'object' && !session.endedAt) {
      await patch({ songOrder: next.map((s) => s.id) })
    }
  }

  // Mouse drag
  function handleDragStart(index: number) { if (canControl) dragIndex.current = index }
  function handleDragOver(e: React.DragEvent, index: number) { if (!canControl) return; e.preventDefault(); setDragOver(index) }
  function handleDrop(dropIdx: number) { applyReorder(dragIndex.current ?? dropIdx, dropIdx) }

  // Touch drag
  function handleTouchStart(e: React.TouchEvent, index: number) {
    if (!canControl) return
    dragIndex.current = index
    touchY.current = e.touches[0].clientY
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!canControl) return
    e.preventDefault()
    const y = e.touches[0].clientY
    const el = document.elementFromPoint(e.touches[0].clientX, y)
    const row = el?.closest('[data-drag-index]')
    if (row) {
      const idx = parseInt(row.getAttribute('data-drag-index') ?? '-1')
      if (idx >= 0) setDragOver(idx)
    }
  }

  function handleTouchEnd() {
    if (dragIndex.current !== null && dragOver !== null) {
      applyReorder(dragIndex.current, dragOver)
    }
    dragIndex.current = null
    setDragOver(null)
  }

  // ── Recording helpers ──────────────────────────────────────────────────────

  async function startRecording(songId: number) {
    if (!canControl) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        const name = `Gravação ${time}`
        setRecordings((prev) => [...prev, { url, name, size: blob.size, songId }])
        setRecordingForSongId(null)
        stream.getTracks().forEach((t) => t.stop())
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
      setRecordingForSongId(songId)
      setRecordingTime(0)
      recordTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000)
    } catch {
      alert('Não foi possível acessar o microfone.')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    setRecording(false)
  }

  function removeRecording(url: string) {
    URL.revokeObjectURL(url)
    setRecordings((prev) => prev.filter((r) => r.url !== url))
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (session === false) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    )
  }

  const isActive = session && !session.endedAt
  const playedSongs = isActive ? session.playedSongs : []
  const totalSongs = orderedSongs.length

  if (!currentMember) {
    const visibleSession = session && typeof session === 'object' ? session : null
    const activeGuestSession = visibleSession && !visibleSession.endedAt

    return (
      <div className="mx-auto max-w-lg space-y-6 py-4">
        {visibleSession && (
          <div className="party-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {activeGuestSession ? 'Ensaio em andamento' : 'Ultimo ensaio'}
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {new Date(visibleSession.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                {visibleSession.endedAt && (
                  <span className="ml-2 text-slate-400 dark:text-slate-500">
                    - {formatDuration(new Date(visibleSession.endedAt).getTime() - new Date(visibleSession.createdAt).getTime())}
                  </span>
                )}
              </p>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                {visibleSession.playedSongs.length}/{songs.length} musicas
              </span>
            </div>
          </div>
        )}

        <div className="party-card flex flex-col items-center gap-4 p-8 text-center">
          <div className="rounded-full bg-blue-50 px-4 py-3 text-xl font-bold text-blue-700 ring-1 ring-blue-100 dark:bg-cyan-300/10 dark:text-cyan-200 dark:ring-cyan-300/20">
            RH
          </div>
          <div>
            <p className="font-semibold text-slate-950 dark:text-slate-100">Entre para controlar o ensaio</p>
            <p className="party-subtle mt-1 text-sm">
              Membros podem iniciar ensaios, marcar musicas executadas, reordenar o setlist e gravar referencias.
            </p>
          </div>
          <Link href={`/join/${inviteCode}`} className="party-button w-full text-center sm:w-auto">
            Entrar na banda
          </Link>
        </div>

      </div>
    )
  }

  // ── No active session ──────────────────────────────────────────────────────

  if (!isActive) {
    const lastSession = session
    return (
      <div className="max-w-lg mx-auto space-y-6 py-4">
        {lastSession && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 dark:bg-gray-900 dark:border-gray-800">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium dark:text-gray-400">Último ensaio</p>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {new Date(lastSession.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                {lastSession.endedAt && (
                  <span className="ml-2 text-gray-400 dark:text-gray-500">
                    · {formatDuration(new Date(lastSession.endedAt).getTime() - new Date(lastSession.createdAt).getTime())}
                  </span>
                )}
              </p>
              <span className="text-sm font-semibold text-emerald-600">
                {lastSession.playedSongs.length}/{songs.length} músicas
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {lastSession.playedSongs.map((id) => {
                const s = songs.find((s) => s.id === id)
                return s ? (
                  <span key={id} className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-900">
                    {s.name}
                  </span>
                ) : null
              })}
            </div>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-8 flex flex-col items-center gap-4 dark:bg-gray-900 dark:border-gray-800">
          <BrandMark size="xl" />
          <div className="text-center">
            <p className="font-semibold text-gray-900 dark:text-gray-100">Pronto para ensaiar?</p>
            <p className="text-sm text-gray-400 mt-1 dark:text-gray-400">{songs.length} música{songs.length !== 1 ? 's' : ''} no repertório</p>
          </div>
          <button
            onClick={startSession}
            disabled={songs.length === 0 || !canControl}
            className="px-8 py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            {readOnly ? 'Indisponivel offline' : 'Iniciar ensaio'}
          </button>
        </div>

      </div>
    )
  }

  // ── Active session ─────────────────────────────────────────────────────────

  const playedCount = playedSongs.length
  const progress = totalSongs > 0 ? (playedCount / totalSongs) * 100 : 0

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="font-semibold text-gray-900 dark:text-gray-100">Ensaio em andamento</span>
            <span className="text-sm text-gray-400 font-mono dark:text-gray-400">{elapsed}</span>
          </div>
          <button
            onClick={endSession}
            disabled={ending || !canControl}
            className="text-sm px-4 py-1.5 border border-gray-200 text-gray-500 rounded-lg hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:border-red-800 dark:hover:text-red-400"
          >
            {ending ? 'Encerrando...' : 'Encerrar'}
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden dark:bg-gray-800">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 w-16 text-right">
            {playedCount} de {totalSongs}
          </span>
        </div>
      </div>

      {/* Song list */}
      <div className="space-y-2">
        {orderedSongs.map((song, index) => {
          const played = playedSongs.includes(song.id)
          const isDragTarget = dragOver === index

          return (
            <div
              key={song.id}
              data-drag-index={index}
              draggable={canControl}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(index)}
              onDragEnd={() => { setDragOver(null); dragIndex.current = null }}
              className={`bg-white border rounded-xl px-4 py-3 flex items-center gap-3 transition-all select-none ${
                played ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-gray-200 dark:bg-gray-900 dark:border-gray-800'
              } ${isDragTarget ? 'border-blue-400 shadow-md scale-[1.01]' : ''}`}
            >
              {/* Drag handle — mouse + touch */}
              <div
                className={`text-gray-300 dark:text-gray-600 shrink-0 touch-none ${canControl ? 'cursor-grab active:cursor-grabbing' : 'cursor-default opacity-50'}`}
                title="Arrastar para reordenar"
                onTouchStart={(e) => handleTouchStart(e, index)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
                  <path d="M108,60A16,16,0,1,1,92,44,16,16,0,0,1,108,60Zm56,0a16,16,0,1,1-16-16A16,16,0,0,1,164,60ZM108,128a16,16,0,1,1-16-16A16,16,0,0,1,108,128Zm56,0a16,16,0,1,1-16-16A16,16,0,0,1,164,128ZM108,196a16,16,0,1,1-16-16A16,16,0,0,1,108,196Zm56,0a16,16,0,1,1-16-16A16,16,0,0,1,164,196Z"/>
                </svg>
              </div>

              {/* Position */}
              <span className="text-xs text-gray-300 dark:text-gray-600 w-4 shrink-0 text-center font-mono">{index + 1}</span>

              {/* Song name */}
              <span className={`flex-1 font-medium text-sm ${played ? 'line-through text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                {song.name}
              </span>

              {/* Rehearsed status badge */}
              <button
                onClick={() => cycleRehearsed(song.id)}
                disabled={!canControl}
                className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors shrink-0 ${STATUS_COLOR[song.rehearsed ?? 'none']}`}
                title="Nível de preparo da banda (clique para alterar)"
              >
                {STATUS_LABEL[song.rehearsed ?? 'none']}
              </button>

              {/* Record button for this song */}
              {(() => {
                const isRecordingThis = recordingForSongId === song.id
                const isRecordingOther = recording && !isRecordingThis
                return (
                  <button
                    onClick={() => isRecordingThis ? stopRecording() : startRecording(song.id)}
                    disabled={isRecordingOther || (!canControl && !isRecordingThis)}
                    title={isRecordingThis ? 'Parar gravação' : 'Gravar esta música'}
                    className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all ${
                      isRecordingThis
                        ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                        : isRecordingOther
                        ? 'bg-gray-100 text-gray-300 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                        : 'bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400'
                    }`}
                  >
                    {isRecordingThis ? (
                      <>
                        <span className="w-2 h-2 rounded-sm bg-white shrink-0" />
                        {fmtSecs(recordingTime)}
                      </>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 256 256">
                        <path d="M128,176a48.05,48.05,0,0,0,48-48V64a48,48,0,0,0-96,0v64A48.05,48.05,0,0,0,128,176ZM96,64a32,32,0,0,1,64,0v64a32,32,0,0,1-64,0Zm40,143.6V232a8,8,0,0,1-16,0V207.6A80.11,80.11,0,0,1,48,128a8,8,0,0,1,16,0,64,64,0,0,0,128,0,8,8,0,0,1,16,0A80.11,80.11,0,0,1,136,207.6Z"/>
                      </svg>
                    )}
                  </button>
                )
              })()}

              {/* Played toggle */}
              <button
                onClick={() => togglePlayed(song.id)}
                disabled={!canControl}
                className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                  played
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                {played ? '✓ Executada' : 'Executar'}
              </button>
            </div>
          )
        })}
      </div>

      {orderedSongs.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm">
          Nenhuma música no repertório. Adicione músicas na aba Músicas.
        </div>
      )}

      {/* Audio recordings grouped by song */}
      {recordings.length > 0 && (() => {
        const songIds = Array.from(new Set(recordings.map((r) => r.songId)))
        return (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium px-1">Gravações</p>
            {songIds.map((sid) => {
              const songName = orderedSongs.find((s) => s.id === sid)?.name ?? `Música #${sid}`
              const songRecs = recordings.filter((r) => r.songId === sid)
              return (
                <div key={sid} className="bg-white border border-gray-200 rounded-xl overflow-hidden dark:bg-gray-900 dark:border-gray-800">
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{songName}</span>
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-gray-800">
                    {songRecs.map((rec) => (
                      <div key={rec.url} className="px-4 py-2.5 flex items-center gap-3">
                        <span className="text-xs text-gray-600 dark:text-gray-400 shrink-0">{rec.name}</span>
                        <span className="text-xs text-gray-300 dark:text-gray-600">{(rec.size / 1024).toFixed(0)} KB</span>
                        <audio src={rec.url} controls className="h-7 flex-1 min-w-0" />
                        <a
                          href={rec.url}
                          download={`${songName} - ${rec.name}.webm`}
                          className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors shrink-0 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                        >
                          Baixar
                        </a>
                        <button onClick={() => removeRecording(rec.url)} className="text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400 shrink-0">×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

    </div>
  )
}
