'use client'

import { useEffect, useRef, useState } from 'react'
import type { BandMember } from '@/lib/types'

interface SongReference {
  id: number
  type: 'youtube' | 'spotify' | 'itunes'
  refId: string
  title: string
}

interface SongComment {
  id: number
  authorId: string | null
  content: string
  createdAt: string
}

interface SongDetail {
  id: number
  name: string
  bpm: number | null
  tonality: string | null
  notes: string | null
  references: SongReference[]
  comments: SongComment[]
}

interface Props {
  songId: number
  inviteCode: string
  currentMember: BandMember | null
  allMembers: BandMember[]
  isAdmin: boolean
  onClose: () => void
}

function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0]
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v')
  } catch { /* not a URL, treat as bare ID */ }
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim()
  return null
}

function parseSpotifyId(url: string): { id: string; subtype: string } | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('spotify.com')) {
      const parts = u.pathname.split('/').filter(Boolean)
      if (parts.length >= 2) return { subtype: parts[0], id: parts[1] }
    }
  } catch {}
  return null
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function SongDetailDrawer({ songId, inviteCode, currentMember, allMembers, isAdmin, onClose }: Props) {
  const [song, setSong] = useState<SongDetail | null>(null)
  const [bpm, setBpm] = useState('')
  const [tonality, setTonality] = useState('')
  const [notes, setNotes] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)
  const [refUrl, setRefUrl] = useState('')
  const [refTitle, setRefTitle] = useState('')
  const [addingRef, setAddingRef] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/bands/${inviteCode}/songs/${songId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: SongDetail | null) => {
        if (!data) return
        setSong(data)
        setBpm(data.bpm != null ? String(data.bpm) : '')
        setTonality(data.tonality ?? '')
        setNotes(data.notes ?? '')
      })
  }, [songId, inviteCode])

  async function saveMeta() {
    setSavingMeta(true)
    await fetch(`/api/bands/${inviteCode}/songs/${songId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bpm: bpm ? parseInt(bpm) : null,
        tonality: tonality || null,
        notes: notes || null,
      }),
    })
    setSavingMeta(false)
  }

  async function addReference(e: React.FormEvent) {
    e.preventDefault()
    const url = refUrl.trim()
    if (!url) return

    let type: 'youtube' | 'spotify' | null = null
    let refId = ''
    let title = refTitle.trim() || url

    const ytId = parseYouTubeId(url)
    if (ytId) { type = 'youtube'; refId = ytId }
    else {
      const sp = parseSpotifyId(url)
      if (sp) { type = 'spotify'; refId = `${sp.subtype}/${sp.id}` }
    }

    if (!type) { alert('URL inválida. Use um link do YouTube ou Spotify.'); return }

    setAddingRef(true)
    const res = await fetch(`/api/bands/${inviteCode}/songs/${songId}/references`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, refId, title }),
    })
    if (res.ok) {
      const ref = await res.json()
      setSong((s) => s ? { ...s, references: [...s.references, ref] } : s)
      setRefUrl('')
      setRefTitle('')
    }
    setAddingRef(false)
  }

  async function removeReference(id: number) {
    await fetch(`/api/bands/${inviteCode}/songs/${songId}/references`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setSong((s) => s ? { ...s, references: s.references.filter((r) => r.id !== id) } : s)
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim()) return
    setPostingComment(true)
    const res = await fetch(`/api/bands/${inviteCode}/songs/${songId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: commentText.trim(), memberId: currentMember?.id ?? null }),
    })
    if (res.ok) {
      const comment = await res.json()
      setSong((s) => s ? { ...s, comments: [comment, ...s.comments] } : s)
      setCommentText('')
    }
    setPostingComment(false)
  }

  async function deleteComment(id: number) {
    await fetch(`/api/bands/${inviteCode}/songs/${songId}/comments`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setSong((s) => s ? { ...s, comments: s.comments.filter((c) => c.id !== id) } : s)
  }

  function memberName(authorId: string | null) {
    if (!authorId) return 'Anônimo'
    return allMembers.find((m) => m.id === authorId)?.displayName ?? 'Membro'
  }

  function memberColor(authorId: string | null) {
    return allMembers.find((m) => m.id === authorId)?.color ?? '#6B7280'
  }

  const canEdit = !!currentMember || isAdmin

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={drawerRef}
        className="relative z-10 w-full max-w-md bg-white shadow-2xl flex flex-col h-full overflow-y-auto dark:bg-gray-900"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 truncate pr-4">
            {song?.name ?? '...'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none shrink-0">×</button>
        </div>

        {!song ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="p-5 space-y-6">
            {/* Metadata */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">Informações</h3>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">BPM</label>
                    <input
                      type="number"
                      min="20" max="300"
                      value={bpm}
                      onChange={(e) => setBpm(e.target.value)}
                      onBlur={saveMeta}
                      disabled={!canEdit}
                      placeholder="—"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Tom</label>
                    <input
                      type="text"
                      value={tonality}
                      onChange={(e) => setTonality(e.target.value)}
                      onBlur={saveMeta}
                      disabled={!canEdit}
                      placeholder="Ex: Am, C#"
                      maxLength={20}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Notas / observações</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={saveMeta}
                    disabled={!canEdit}
                    placeholder="Arranjo, letras, referências..."
                    rows={3}
                    maxLength={2000}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                  />
                </div>
                {savingMeta && <p className="text-xs text-gray-400 dark:text-gray-500">Salvando...</p>}
              </div>
            </section>

            {/* References */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">Referências</h3>

              {song.references.length > 0 && (
                <div className="space-y-3 mb-3">
                  {song.references.map((ref) => (
                    <div key={ref.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{ref.title}</span>
                        {canEdit && (
                          <button onClick={() => removeReference(ref.id)} className="text-gray-300 hover:text-red-400 shrink-0 text-xs">×</button>
                        )}
                      </div>
                      {ref.type === 'youtube' && (
                        <div className="aspect-video rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                          <iframe
                            src={`https://www.youtube.com/embed/${ref.refId}`}
                            title={ref.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="w-full h-full"
                          />
                        </div>
                      )}
                      {ref.type === 'spotify' && (
                        <iframe
                          src={`https://open.spotify.com/embed/${ref.refId}`}
                          height="80"
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                          className="w-full rounded-xl border border-gray-200 dark:border-gray-700"
                        />
                      )}
                      {ref.type === 'itunes' && (
                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                          <div className="text-2xl">🎵</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate dark:text-gray-100">{ref.title}</p>
                            <p className="text-xs text-gray-500">iTunes</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {canEdit && (
                <form onSubmit={addReference} className="space-y-2">
                  <input
                    type="text"
                    value={refUrl}
                    onChange={(e) => setRefUrl(e.target.value)}
                    placeholder="Link do YouTube ou Spotify"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={refTitle}
                      onChange={(e) => setRefTitle(e.target.value)}
                      placeholder="Título (opcional)"
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                    />
                    <button
                      type="submit"
                      disabled={!refUrl.trim() || addingRef}
                      className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
                    >
                      {addingRef ? '...' : 'Adicionar'}
                    </button>
                  </div>
                </form>
              )}
            </section>

            {/* Comments */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">Comentários</h3>

              {(currentMember || isAdmin) && (
                <form onSubmit={postComment} className="space-y-2 mb-4">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Deixe um comentário..."
                    rows={2}
                    maxLength={500}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                  />
                  <button
                    type="submit"
                    disabled={!commentText.trim() || postingComment}
                    className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
                  >
                    {postingComment ? 'Postando...' : 'Comentar'}
                  </button>
                </form>
              )}

              {song.comments.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Nenhum comentário ainda.</p>
              ) : (
                <div className="space-y-3">
                  {song.comments.map((c) => (
                    <div key={c.id} className="bg-gray-50 rounded-xl px-4 py-3 dark:bg-gray-800">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: memberColor(c.authorId) }} />
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{memberName(c.authorId)}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{fmtDate(c.createdAt)}</span>
                        </div>
                        {isAdmin && (
                          <button onClick={() => deleteComment(c.id)} className="text-gray-300 hover:text-red-400 text-xs">×</button>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
