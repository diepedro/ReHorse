'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useToast } from '@/components/ToastProvider'
import VoteBar from '@/components/VoteBar'
import { useBand } from '@/contexts/BandContext'
import type { Suggestion } from '@/lib/types'
import { cachedJson, invalidateCache } from '@/lib/client-cache'

export default function SuggestionsPage() {
  const { inviteCode } = useParams() as { inviteCode: string }
  const toast = useToast()
  const { band, currentMember, isAdmin, readOnly } = useBand()

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [newName, setNewName] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [nudgingId, setNudgingId] = useState<number | null>(null)

  const fetchSuggestions = useCallback(async () => {
    try {
      setSuggestions(await cachedJson<Suggestion[]>(`/api/bands/${inviteCode}/suggestions`))
    } catch {
      toast('Erro ao carregar sugestoes.', 'error')
    }
  }, [inviteCode, toast])

  useEffect(() => {
    fetchSuggestions()
  }, [fetchSuggestions])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (readOnly || !newName.trim() || !currentMember) return

    const res = await fetch(`/api/bands/${inviteCode}/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), bandMemberId: currentMember.id }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      toast(data?.error ?? 'Erro ao adicionar sugestao.', 'error')
      return
    }

    invalidateCache(`/api/bands/${inviteCode}/suggestions`)
    toast('Sugestao adicionada!', 'success')
    setNewName('')
    setShowInput(false)
    fetchSuggestions()
  }

  async function handleVote(suggestionId: number, vote: 'yes' | 'no') {
    if (readOnly) return
    if (!currentMember) return

    const res = await fetch(`/api/bands/${inviteCode}/suggestions/vote`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestionId, bandMemberId: currentMember.id, vote }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      toast(data?.error ?? 'Erro ao votar.', 'error')
      return
    }

    const data = await res.json()
    invalidateCache(`/api/bands/${inviteCode}/suggestions`)
    if (data.promoted) {
      toast('Musica aprovada e adicionada ao repertorio.', 'success')
      setTimeout(fetchSuggestions, 400)
    } else {
      fetchSuggestions()
    }
  }

  async function handleDelete(id: number) {
    if (readOnly) return
    if (!currentMember && !isAdmin) return

    const query = currentMember ? `?id=${id}&bandMemberId=${currentMember.id}` : `?id=${id}`
    const res = await fetch(`/api/bands/${inviteCode}/suggestions${query}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      toast(data?.error ?? 'Erro ao remover sugestao.', 'error')
      return
    }

    invalidateCache(`/api/bands/${inviteCode}/suggestions`)
    setDeletingId(null)
    fetchSuggestions()
  }

  async function handleNudge(id: number) {
    if (readOnly || !currentMember || nudgingId) return

    setNudgingId(id)
    const res = await fetch(`/api/bands/${inviteCode}/suggestions/nudge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestionId: id, bandMemberId: currentMember.id }),
    })
    setNudgingId(null)

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      toast(data?.error ?? 'Erro ao enviar nudge.', 'error')
      return
    }

    const copied = typeof data?.whatsappText === 'string'
      ? await copyToClipboard(data.whatsappText)
      : false
    const sent = Number(data?.result?.sent ?? 0)
    const subscriptions = Number(data?.result?.subscriptions ?? 0)

    if (!copied) {
      toast('Lembrete enviado. Nao consegui copiar o texto para WhatsApp.', 'info')
    } else if (subscriptions === 0) {
      toast('Texto para WhatsApp copiado. Pendentes sem push ativo.', 'info')
    } else if (sent === 0) {
      toast('Texto para WhatsApp copiado. Push nao entregue.', 'info')
    } else {
      toast('Push enviado e texto para WhatsApp copiado.', 'success')
    }
  }

  const sortedMembers = [...band.members].sort((a, b) => a.sortOrder - b.sortOrder)
  const canInteract = !!currentMember && !readOnly
  const canDeleteAsAdmin = isAdmin && !readOnly

  return (
    <div>
      <h2 className="party-title mb-4 text-2xl">Sugestoes de musicas</h2>

      {suggestions.length === 0 && !showInput && (
        <div className="party-card text-center py-12 text-slate-500 dark:text-slate-400">
          <p className="text-sm font-semibold text-slate-950 dark:text-slate-100">Nenhuma sugestao ainda.</p>
          <p className="party-subtle mt-1 text-xs">
            {readOnly ? 'Sugestoes salvas para consulta offline.' : currentMember ? 'Seja o primeiro a sugerir uma musica!' : 'Entre como membro para sugerir e votar.'}
          </p>
          {canInteract && (
            <button onClick={() => setShowInput(true)} className="party-button mt-4">
              Sugerir musica
            </button>
          )}
        </div>
      )}

      {!currentMember && !readOnly && (
        <div className="party-card-soft mb-3 text-sm text-slate-600 dark:text-slate-300">
          Entre como membro para sugerir musicas e votar nas proximas escolhas da banda.
        </div>
      )}

      <div className="space-y-2">
        {suggestions.map((s) => {
          const suggester = band.members.find((m) => m.id === s.suggestedBy)
          const myVote = currentMember ? s.votes[currentMember.id] : undefined
          const pendingMembers = sortedMembers.filter((m) => m.id !== s.suggestedBy && !s.votes[m.id])
          const canNudge = canInteract && currentMember?.id === s.suggestedBy && pendingMembers.length > 0
          const canRemove = (currentMember?.id === s.suggestedBy && !readOnly) || canDeleteAsAdmin

          return (
            <div key={s.id} className="party-card p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-slate-950 dark:text-slate-100">{s.name}</span>
                    {suggester && (
                      <span className="party-subtle text-xs">
                        por <span style={{ color: suggester.color }} className="font-medium">{suggester.displayName}</span>
                      </span>
                    )}
                  </div>

                  <VoteBar members={sortedMembers} votes={s.votes} />

                  {canInteract && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleVote(s.id, 'yes')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                          myVote === 'yes'
                            ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-800'
                            : 'bg-gray-100 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400'
                        }`}
                      >
                        Sim
                      </button>
                      <button
                        onClick={() => handleVote(s.id, 'no')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                          myVote === 'no'
                            ? 'bg-red-100 text-red-700 ring-1 ring-red-300 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-800'
                            : 'bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400'
                        }`}
                      >
                        Nao
                      </button>
                    </div>
                  )}
                </div>

                {(canNudge || canRemove) && (
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {canNudge && (
                      <button
                        onClick={() => handleNudge(s.id)}
                        disabled={nudgingId === s.id}
                        className="group rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-right shadow-sm transition-all hover:border-amber-300 hover:bg-amber-50 hover:shadow disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/70 dark:hover:border-amber-700 dark:hover:bg-amber-950/30"
                        title={`Envia push para quem tiver notificacoes ativas e copia o texto para WhatsApp: ${pendingMembers.map((m) => m.displayName).join(', ')}`}
                      >
                        <span className="block text-[11px] font-semibold text-slate-500 group-hover:text-amber-700 dark:text-slate-400 dark:group-hover:text-amber-300">
                          {nudgingId === s.id ? 'Enviando...' : 'Lembrar'}
                        </span>
                        <span className="block whitespace-nowrap text-[10px] font-normal text-slate-400 group-hover:text-amber-600 dark:text-slate-500 dark:group-hover:text-amber-300">
                          copia texto
                        </span>
                      </button>
                    )}

                    {canRemove && (deletingId === s.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(s.id)} className="px-2 py-1 text-xs font-medium text-red-500 hover:text-red-700">
                          Remover
                        </button>
                        <button onClick={() => setDeletingId(null)} className="px-1 py-1 text-xs text-gray-400 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-400">
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingId(s.id)}
                        className="p-1 text-gray-300 transition-colors hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400"
                        title="Remover sugestao"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {canInteract && (
        <>
          {showInput ? (
            <form onSubmit={handleAdd} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome da musica"
                className="party-input flex-1 py-2.5"
              />
              <button type="submit" className="party-button">
                Sugerir
              </button>
              <button type="button" onClick={() => { setShowInput(false); setNewName('') }} className="party-button-secondary">
                Cancelar
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowInput(true)}
              className="party-button mt-4"
            >
              + Sugerir musica
            </button>
          )}
        </>
      )}
    </div>
  )
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall back to execCommand for browsers with stricter clipboard handling.
    }
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.cssText = 'position:fixed;top:0;left:0;opacity:0.01'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    return copied
  } catch {
    return false
  }
}
