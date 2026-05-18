'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const PRESET_COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // emerald
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#6B7280', // gray
  '#1D4ED8', // dark blue
]

interface MemberRow {
  id: string
  displayName: string
  color: string
}

function uid() {
  return Math.random().toString(36).slice(2)
}

export default function CreateBandPage() {
  const router = useRouter()
  const [bandName, setBandName] = useState('')
  const [members, setMembers] = useState<MemberRow[]>([
    { id: uid(), displayName: '', color: PRESET_COLORS[0] },
    { id: uid(), displayName: '', color: PRESET_COLORS[1] },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [openColorPicker, setOpenColorPicker] = useState<string | null>(null)

  function addMember() {
    if (members.length >= 12) return
    const nextColor = PRESET_COLORS[members.length % PRESET_COLORS.length]
    setMembers((prev) => [...prev, { id: uid(), displayName: '', color: nextColor }])
  }

  function removeMember(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id))
  }

  function updateMember(id: string, field: 'displayName' | 'color', value: string) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const trimmedName = bandName.trim()
    const validMembers = members.filter((m) => m.displayName.trim())

    if (!trimmedName) return setError('Dê um nome para a banda.')
    if (validMembers.length === 0) return setError('Adicione pelo menos um membro.')

    setLoading(true)

    const res = await fetch('/api/bands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: trimmedName,
        members: validMembers.map((m) => ({
          displayName: m.displayName.trim(),
          color: m.color,
        })),
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Erro ao criar banda.')
      setLoading(false)
      return
    }

    const { inviteCode } = await res.json()
    router.push(`/band/${inviteCode}/settings?new=1`)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            ← Minhas bandas
          </Link>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold mb-8 dark:text-gray-100">Criar banda</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 -mt-4 mb-8">Você pode adicionar mais membros depois nas configurações da banda.</p>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Band name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nome da banda
            </label>
            <input
              autoFocus
              type="text"
              value={bandName}
              onChange={(e) => setBandName(e.target.value)}
              placeholder="Ex: Os Tremendos"
              maxLength={60}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
            />
          </div>

          {/* Members */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Membros <span className="text-gray-400 dark:text-gray-500 font-normal">({members.length}/12)</span>
            </label>
            <div className="space-y-2">
              {members.map((member, i) => (
                <div key={member.id} className="flex items-center gap-2">
                  {/* Color picker */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setOpenColorPicker(openColorPicker === member.id ? null : member.id)}
                      className="w-9 h-9 rounded-full border-2 border-white shadow ring-1 ring-gray-200 dark:ring-gray-700 transition-transform hover:scale-110"
                      style={{ backgroundColor: member.color }}
                      title="Escolher cor"
                    />
                    {openColorPicker === member.id && (
                      <div className="absolute top-11 left-0 z-10 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-2 grid grid-cols-4 gap-1.5">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => { updateMember(member.id, 'color', c); setOpenColorPicker(null) }}
                            className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${member.color === c ? 'ring-2 ring-offset-1 ring-gray-700 scale-110' : ''}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <input
                    type="text"
                    value={member.displayName}
                    onChange={(e) => updateMember(member.id, 'displayName', e.target.value)}
                    placeholder={`Membro ${i + 1}`}
                    maxLength={30}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
                  />

                  <button
                    type="button"
                    onClick={() => removeMember(member.id)}
                    disabled={members.length <= 1}
                    className="text-gray-300 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-1"
                    title="Remover"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {members.length < 12 && (
              <button
                type="button"
                onClick={addMember}
                className="mt-3 text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                + Adicionar membro
              </button>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Criando...' : 'Criar banda'}
          </button>
        </form>
      </main>
    </div>
  )
}
