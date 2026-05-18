'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import QrCode from '@/components/QrCode'
import { useToast } from '@/components/ToastProvider'
import { useBand } from '@/contexts/BandContext'
import { firstAvailableMemberColor, isColorBlocked, MEMBER_COLORS } from '@/lib/member-colors'

export default function SettingsPage() {
  const params = useParams()
  const router = useRouter()
  const inviteCode = params.inviteCode as string
  const toast = useToast()
  const { band, currentMember, isAdmin, refetch } = useBand()

  const searchParams = useSearchParams()
  const isNew = searchParams.get('new') === '1'

  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberColor, setNewMemberColor] = useState<string>(MEMBER_COLORS[0])
  const [addingMember, setAddingMember] = useState(false)
  const [savingColor, setSavingColor] = useState<string | null>(null)

  const sortedMembers = useMemo(
    () => [...band.members].sort((a, b) => a.sortOrder - b.sortOrder),
    [band.members],
  )

  useEffect(() => {
    const available = firstAvailableMemberColor(sortedMembers)
    if (isColorBlocked(sortedMembers, newMemberColor)) setNewMemberColor(available)
  }, [newMemberColor, sortedMembers])

  const inviteUrl = typeof window === 'undefined'
    ? ''
    : `${window.location.origin}/join/${inviteCode}`

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
    if (!isAdmin) return
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
    if (!isAdmin) return
    const res = await fetch(`/api/bands/${inviteCode}/members/${memberId}`, { method: 'DELETE' })
    if (!res.ok) { toast('Nao foi possivel remover o membro.', 'error'); return }
    toast('Membro removido.', 'success')
    refetch()
  }

  async function addMember(e: FormEvent) {
    e.preventDefault()
    if (!isAdmin || !newMemberName.trim()) return
    setAddingMember(true)

    const res = await fetch(`/api/bands/${inviteCode}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: newMemberName.trim(), color: newMemberColor }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      toast(data?.error ?? 'Nao foi possivel adicionar membro.', 'error')
      setAddingMember(false)
      return
    }

    toast('Membro adicionado!', 'success')
    setNewMemberName('')
    setAddingMember(false)
    refetch()
  }

  async function changeOwnColor(color: string) {
    if (!currentMember || isColorBlocked(sortedMembers, color, currentMember.id)) return
    setSavingColor(color)
    const res = await fetch(`/api/bands/${inviteCode}/members/${currentMember.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color, actorMemberId: currentMember.id }),
    })
    setSavingColor(null)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      toast(data?.error ?? 'Nao foi possivel alterar sua cor.', 'error')
      return
    }
    toast('Cor atualizada.', 'success')
    refetch()
  }

  return (
    <div className="max-w-2xl space-y-6">
      {isNew && isAdmin && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3 dark:bg-emerald-950/50 dark:border-emerald-900">
          <span className="text-2xl">🎉</span>
          <div>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Banda criada com sucesso!</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
              Compartilhe o link de convite com os membros da banda.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div>
          <Link
            href={`/band/${inviteCode}/rehearsals`}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            Voltar
          </Link>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-gray-950 dark:text-gray-100">Ajustes</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{band.name}</p>
        </div>
        <Link
          href={`/band/${inviteCode}/history`}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900"
        >
          Historico
        </Link>
      </div>

      <section className="bg-white border border-gray-200 rounded-lg p-5 dark:bg-gray-900 dark:border-gray-800">
        <h3 className="text-sm font-semibold mb-3 dark:text-gray-100">Link de convite</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={inviteUrl}
            className="min-w-0 flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-600 focus:outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
          />
          <button
            onClick={copyLink}
            className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <div className="mt-4 flex justify-center rounded-lg bg-gray-50 p-4 dark:bg-gray-950">
          <QrCode value={inviteUrl} size={160} />
        </div>
      </section>

      {currentMember && (
        <section className="bg-white border border-gray-200 rounded-lg p-5 dark:bg-gray-900 dark:border-gray-800">
          <h3 className="text-sm font-semibold mb-3 dark:text-gray-100">Sua cor</h3>
          <ColorGrid
            members={sortedMembers}
            targetMemberId={currentMember.id}
            selectedColor={currentMember.color}
            savingColor={savingColor}
            onSelect={changeOwnColor}
          />
        </section>
      )}

      <section className="bg-white border border-gray-200 rounded-lg p-5 dark:bg-gray-900 dark:border-gray-800">
        <h3 className="text-sm font-semibold mb-4 dark:text-gray-100">Membros</h3>
        <div className="space-y-2">
          {sortedMembers.map((m) => (
            <div key={m.id} className="flex min-h-10 items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-950">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-4 w-4 rounded-full shrink-0 ring-2 ring-white dark:ring-gray-900"
                  style={{ backgroundColor: m.color }}
                />
                <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{m.displayName}</span>
                {currentMember?.id === m.id && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium dark:bg-blue-950 dark:text-blue-300">
                    voce
                  </span>
                )}
                {m.claimed && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-medium dark:bg-emerald-950 dark:text-emerald-300">
                    entrou
                  </span>
                )}
              </div>
              {isAdmin && (
                <button
                  onClick={() => removeMember(m.id)}
                  className="text-xs text-gray-400 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors"
                >
                  Remover
                </button>
              )}
            </div>
          ))}
        </div>

        {isAdmin && sortedMembers.length < 12 && (
          <form onSubmit={addMember} className="mt-4 space-y-3 border-t border-gray-100 pt-4 dark:border-gray-800">
            <input
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="Nome do novo membro"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            />
            <ColorGrid
              members={sortedMembers}
              selectedColor={newMemberColor}
              savingColor={addingMember ? newMemberColor : null}
              onSelect={setNewMemberColor}
            />
            <button
              type="submit"
              disabled={!newMemberName.trim() || addingMember}
              className="w-full sm:w-auto text-sm px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              {addingMember ? 'Adicionando...' : 'Adicionar membro'}
            </button>
          </form>
        )}
      </section>

      {isAdmin && (
        <section className="bg-white border border-red-100 rounded-lg p-5 dark:bg-gray-900 dark:border-red-900/50">
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
              <div className="flex flex-col gap-2 sm:flex-row">
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
        </section>
      )}
    </div>
  )
}

function ColorGrid({
  members,
  targetMemberId,
  selectedColor,
  savingColor,
  onSelect,
}: {
  members: Array<{ id: string; color: string }>
  targetMemberId?: string
  selectedColor: string
  savingColor: string | null
  onSelect: (color: string) => void
}) {
  return (
    <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
      {MEMBER_COLORS.map((color) => {
        const blocked = isColorBlocked(members, color, targetMemberId)
        const selected = selectedColor.toUpperCase() === color
        const saving = savingColor === color
        return (
          <button
            key={color}
            type="button"
            disabled={blocked || saving}
            onClick={() => onSelect(color)}
            title={blocked ? 'Cor ja usada por outro membro' : color}
            className={`relative h-9 rounded-lg border transition-all ${
              selected ? 'border-gray-900 ring-2 ring-gray-900/20 dark:border-white dark:ring-white/20' : 'border-white/70 dark:border-gray-700'
            } ${blocked ? 'cursor-not-allowed opacity-25' : 'hover:scale-105'}`}
            style={{ backgroundColor: color }}
          >
            {selected && <span className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-white shadow" />}
          </button>
        )
      })}
    </div>
  )
}
