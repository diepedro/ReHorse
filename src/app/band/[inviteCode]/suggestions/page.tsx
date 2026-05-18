'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useToast } from '@/components/ToastProvider'
import VoteBar from '@/components/VoteBar'
import { useBand } from '@/contexts/BandContext'
import type { Suggestion } from '@/lib/types'

export default function SuggestionsPage() {
  const { inviteCode } = useParams() as { inviteCode: string }
  const toast = useToast()
  const { band, currentMember, isAdmin } = useBand()

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [newName, setNewName] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const fetchSuggestions = useCallback(async () => {
    const res = await fetch(`/api/bands/${inviteCode}/suggestions`)
    if (res.ok) setSuggestions(await res.json())
  }, [inviteCode])

  useEffect(() => {
    fetchSuggestions()
  }, [fetchSuggestions])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !currentMember) return

    const res = await fetch(`/api/bands/${inviteCode}/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), bandMemberId: currentMember.id }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      toast(data?.error ?? 'Erro ao adicionar sugestão.', 'error')
      return
    }

    toast('Sugestão adicionada!', 'success')
    setNewName('')
    setShowInput(false)
    fetchSuggestions()
  }

  async function handleVote(suggestionId: number, vote: 'yes' | 'no') {
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
    if (data.promoted) {
      toast('Música aprovada e adicionada ao repertório.', 'success')
      setTimeout(fetchSuggestions, 400)
    } else {
      fetchSuggestions()
    }
  }

  async function handleDecision(id: number, action: 'promote' | 'reject') {
    const res = await fetch(`/api/bands/${inviteCode}/suggestions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      toast(data?.error ?? 'Erro ao atualizar sugestão.', 'error')
      return
    }

    toast(action === 'promote' ? 'Música adicionada ao repertório.' : 'Sugestão rejeitada.', 'success')
    fetchSuggestions()
  }

  async function handleDelete(id: number) {
    if (!currentMember && !isAdmin) return

    const query = currentMember ? `?id=${id}&bandMemberId=${currentMember.id}` : `?id=${id}`
    const res = await fetch(`/api/bands/${inviteCode}/suggestions${query}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      toast(data?.error ?? 'Erro ao remover sugestão.', 'error')
      return
    }

    setDeletingId(null)
    fetchSuggestions()
  }

  const sortedMembers = [...band.members].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Sugestões de músicas</h2>

      {suggestions.length === 0 && !showInput && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-4xl mb-3">💡</p>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-500">Nenhuma sugestão ainda.</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Seja o primeiro a sugerir uma música!</p>
        </div>
      )}

      <div className="space-y-3">
        {suggestions.map((s) => {
          const suggester = band.members.find((m) => m.id === s.suggestedBy)
          const myVote = currentMember ? s.votes[currentMember.id] : undefined
          const yesCount = Object.values(s.votes).filter((v) => v === 'yes').length
          const noCount = Object.values(s.votes).filter((v) => v === 'no').length
          const threshold = Math.max(1, Math.ceil(band.members.length * 0.7))

          return (
            <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-4 dark:bg-gray-900 dark:border-gray-800">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{s.name}</span>
                    {suggester && (
                      <span className="text-xs text-gray-400">
                        por <span style={{ color: suggester.color }} className="font-medium">{suggester.displayName}</span>
                      </span>
                    )}
                  </div>

                  <VoteBar members={sortedMembers} votes={s.votes} />

                  {currentMember && (
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <button
                        onClick={() => handleVote(s.id, 'yes')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                          myVote === 'yes'
                            ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-800'
                            : 'bg-gray-100 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400'
                        }`}
                      >
                        Sim
                      </button>
                      <button
                        onClick={() => handleVote(s.id, 'no')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                          myVote === 'no'
                            ? 'bg-red-100 text-red-700 ring-1 ring-red-300 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-800'
                            : 'bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400'
                        }`}
                      >
                        Não
                      </button>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {yesCount}/{threshold} para aprovar · {noCount} não
                      </span>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleDecision(s.id, 'promote')}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400"
                      >
                        Aprovar e adicionar
                      </button>
                      <button
                        onClick={() => handleDecision(s.id, 'reject')}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                      >
                        Rejeitar
                      </button>
                    </div>
                  )}
                </div>

                {(currentMember?.id === s.suggestedBy || isAdmin) && (
                  <div className="shrink-0">
                    {deletingId === s.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(s.id)} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1">
                          Remover
                        </button>
                        <button onClick={() => setDeletingId(null)} className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-400 px-1 py-1">
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingId(s.id)}
                        className="text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400 transition-colors p-1"
                        title="Remover sugestão"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {currentMember && (
        <>
          {showInput ? (
            <form onSubmit={handleAdd} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome da música"
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
              />
              <button type="submit" className="px-4 py-2.5 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors">
                Sugerir
              </button>
              <button type="button" onClick={() => { setShowInput(false); setNewName('') }} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
                Cancelar
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowInput(true)}
              className="mt-4 px-4 py-2.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-900/30"
            >
              + Sugerir música
            </button>
          )}
        </>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
        A sugestão vai automaticamente para o repertório quando atingir 70% de aprovação. Admins também podem aprovar manualmente.
      </p>
    </div>
  )
}
