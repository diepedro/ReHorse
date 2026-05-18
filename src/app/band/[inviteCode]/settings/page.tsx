'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useToast } from '@/components/ToastProvider'
import Link from 'next/link'
import QrCode from '@/components/QrCode'
import type { Band } from '@/lib/types'

const PRESET_COLORS = [
  '#3B82F6','#EF4444','#10B981','#F59E0B',
  '#8B5CF6','#EC4899','#14B8A6','#F97316',
  '#06B6D4','#84CC16','#6B7280','#1D4ED8',
]

export default function SettingsPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const inviteCode = params.inviteCode as string
  const toast = useToast()

  const searchParams = useSearchParams()
  const isNew = searchParams.get('new') === '1'

  const [band, setBand] = useState<Band | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberColor, setNewMemberColor] = useState(PRESET_COLORS[0])
  const [addingMember, setAddingMember] = useState(false)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const colorPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setColorPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchBand = useCallback(async () => {
    const res = await fetch(`/api/bands/${inviteCode}`)
    if (!res.ok) { router.push('/dashboard'); return }
    setBand(await res.json())
    setLoading(false)
  }, [inviteCode, router])

  useEffect(() => {
    fetchBand()
  }, [fetchBand])

  if (loading) return null
  if (!band || !session) return null
  if (band.createdBy !== session.user.id) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">
        Apenas o criador da banda pode acessar as configurações.
      </div>
    )
  }

  const inviteUrl = `${window.location.origin}/join/${inviteCode}`

  function copyLink() {
    try {
      const el = document.createElement('input')
      el.value = inviteUrl
      el.style.cssText = 'position:fixed;top:0;left:0;opacity:0.01'
      document.body.appendChild(el)
      el.focus()
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    } catch {
      navigator.clipboard?.writeText(inviteUrl)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function deleteBand() {
    setDeleting(true)
    const res = await fetch(`/api/bands/${inviteCode}`, { method: 'DELETE' })
    if (!res.ok) {
      toast('Erro ao deletar banda.', 'error')
      setDeleting(false)
      return
    }
    router.push('/dashboard')
  }

  async function removeMember(memberId: string) {
    const res = await fetch(`/api/bands/${inviteCode}/members/${memberId}`, { method: 'DELETE' })
    if (!res.ok) { toast('Não foi possível remover o membro.', 'error'); return }
    toast('Membro removido.', 'success')
    fetchBand()
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    if (!newMemberName.trim()) return
    setAddingMember(true)

    const res = await fetch(`/api/bands/${inviteCode}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: newMemberName.trim(), color: newMemberColor }),
    })

    if (!res.ok) {
      toast('Não foi possível adicionar membro.', 'error')
      setAddingMember(false)
      return
    }

    toast('Membro adicionado!', 'success')
    setNewMemberName('')
    setAddingMember(false)
    fetchBand()
  }

  const sortedMembers = [...band.members].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="max-w-xl space-y-8">
      {isNew && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 dark:bg-emerald-950 dark:border-emerald-800">
          <span className="text-2xl">🎉</span>
          <div>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Banda criada com sucesso!</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
              Compartilhe o link de convite abaixo com os membros da sua banda. Cada pessoa escolhe seu slot ao entrar.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Link
          href={`/band/${inviteCode}/rehearsals`}
          className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          ← Voltar
        </Link>
        <h2 className="text-lg font-semibold dark:text-gray-100">Configurações — {band.name}</h2>
      </div>

      {/* Invite link */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 dark:bg-gray-900 dark:border-gray-800">
        <h3 className="text-sm font-semibold mb-3 dark:text-gray-100">Link de convite</h3>
        <div className="flex gap-2">
          <input
            readOnly
            value={inviteUrl}
            className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-600 focus:outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
          />
          <button
            onClick={copyLink}
            className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors shrink-0"
          >
            {copied ? '✓' : 'Copiar'}
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Compartilhe este link com os membros da banda.
        </p>
        <div className="mt-4 flex justify-center">
          <QrCode value={inviteUrl} size={160} />
        </div>
      </div>

      {/* Members */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 dark:bg-gray-900 dark:border-gray-800">
        <h3 className="text-sm font-semibold mb-4 dark:text-gray-100">Membros</h3>
        <div className="space-y-2 mb-4">
          {sortedMembers.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: m.color }}
                />
                <span className="text-sm dark:text-gray-100">{m.displayName}</span>
                {m.claimed && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-medium dark:bg-emerald-900/30 dark:text-emerald-400">
                    entrou
                  </span>
                )}
              </div>
              <button
                onClick={() => removeMember(m.id)}
                className="text-xs text-gray-400 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors"
              >
                Remover
              </button>
            </div>
          ))}
        </div>

        {/* Add member inline */}
        {sortedMembers.length < 12 && (
          <form onSubmit={addMember} className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="relative shrink-0" ref={colorPickerRef}>
              <button
                type="button"
                onClick={() => setColorPickerOpen((o) => !o)}
                className="w-8 h-8 rounded-full border-2 border-white shadow ring-1 ring-gray-200 hover:scale-110 transition-transform"
                style={{ backgroundColor: newMemberColor }}
                title="Escolher cor"
              />
              {colorPickerOpen && (
                <div className="absolute top-10 left-0 z-20 bg-white rounded-xl shadow-lg border border-gray-200 p-2 grid grid-cols-4 gap-1.5 dark:bg-gray-900 dark:border-gray-700">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setNewMemberColor(c); setColorPickerOpen(false) }}
                      className={`w-7 h-7 rounded-full hover:scale-110 transition-transform ${newMemberColor === c ? 'ring-2 ring-offset-1 ring-gray-700 scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              )}
            </div>
            <input
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="Nome do novo membro"
              className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            />
            <button
              type="submit"
              disabled={!newMemberName.trim() || addingMember}
              className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              Adicionar
            </button>
          </form>
        )}
      </div>

      {/* Danger zone */}
      <div className="bg-white border border-red-100 rounded-xl p-5 dark:bg-gray-900 dark:border-red-900/50">
        <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3">Zona de perigo</h3>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-sm px-4 py-2 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            Deletar banda
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-red-600 dark:text-red-400">
              Isso vai deletar a banda e todos os dados permanentemente. Tem certeza?
            </p>
            <div className="flex gap-2">
              <button
                onClick={deleteBand}
                disabled={deleting}
                className="text-sm px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deletando...' : 'Sim, deletar'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-sm px-4 py-2 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
