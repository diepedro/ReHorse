'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export interface MusicTrack {
  id: string
  trackName: string
  artistName: string
  artworkUrl: string
  previewUrl: string | null
  externalUrl: string
  source: 'spotify' | 'itunes'
  durationMs: number | null
}

interface Props {
  songName: string
  onSelect: (track: MusicTrack) => void
  onClose: () => void
  selectLabel?: string
}

export default function MusicSearchModal({ songName, onSelect, onClose, selectLabel = 'Vincular' }: Props) {
  const [query, setQuery] = useState(songName)
  const [results, setResults] = useState<MusicTrack[]>([])
  const [loading, setLoading] = useState(false)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/music-search?q=${encodeURIComponent(q)}`)
      if (res.ok) setResults(await res.json())
      else setResults([])
    } catch {
      setResults([])
    }
    setLoading(false)
  }, [])

  // Auto-search on open
  useEffect(() => {
    inputRef.current?.focus()
    if (songName.trim()) search(songName)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced live search
  function handleChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 350)
  }

  function togglePreview(track: MusicTrack) {
    if (!track.previewUrl) return
    if (previewing === track.id) {
      audioRef.current?.pause()
      setPreviewing(null)
      return
    }
    if (audioRef.current) audioRef.current.pause()
    const audio = new Audio(track.previewUrl)
    audio.play().catch(() => {})
    audio.onended = () => setPreviewing(null)
    audioRef.current = audio
    setPreviewing(track.id)
  }

  function handleSelect(track: MusicTrack) {
    audioRef.current?.pause()
    onSelect(track)
  }

  useEffect(() => () => {
    audioRef.current?.pause()
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-0 sm:px-4 pb-0 sm:pb-0" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg flex flex-col max-h-[85vh] sm:max-h-[75vh]">
        {/* Search bar */}
        <div className="flex items-center gap-2 p-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
              placeholder="Buscar música ou artista..."
              className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
            />
            {loading && (
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin shrink-0" />
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xl leading-none">×</button>
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {results.length === 0 && !loading && (
            <div className="py-12 text-center">
              <p className="text-gray-400 dark:text-gray-500 text-sm">
                {query.trim() ? 'Nenhum resultado.' : 'Digite para buscar...'}
              </p>
            </div>
          )}

          {results.map((track) => (
            <div key={track.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
              {track.artworkUrl ? (
                <img src={track.artworkUrl} alt={track.trackName} className="w-10 h-10 rounded-lg shrink-0 object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-lg shrink-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-300 text-lg">♪</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{track.trackName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{track.artistName}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => togglePreview(track)}
                  disabled={!track.previewUrl}
                  className={`w-7 h-7 flex items-center justify-center rounded-full text-xs transition-colors ${
                    previewing === track.id
                      ? 'bg-emerald-500 text-white'
                      : track.previewUrl
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  }`}
                  title={track.previewUrl ? 'Pré-escuta 30s' : 'Sem pré-escuta disponível'}
                >
                  {previewing === track.id ? '⏸' : '▶'}
                </button>
                <button
                  onClick={() => handleSelect(track)}
                  className="text-xs px-3 py-1.5 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors font-medium"
                >
                  {selectLabel}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-center gap-1.5">
          <span className="text-xs text-gray-400 dark:text-gray-500">via iTunes · pré-escuta 30s</span>
        </div>
      </div>
    </div>
  )
}
