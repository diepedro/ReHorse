'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import QrCode from '@/components/QrCode'
import BandHistoryPanel from '@/components/BandHistoryPanel'
import { useToast } from '@/components/ToastProvider'
import { useBand } from '@/contexts/BandContext'
import { firstAvailableMemberColor, isColorBlocked, MEMBER_COLORS } from '@/lib/member-colors'
import { removeClientStorage, writeClientStorage } from '@/lib/client-storage'
import { cachedJson } from '@/lib/client-cache'

interface NotificationRecipient {
  id: number
  displayName: string
  status: string
  error: string | null
  sentAt: string | null
  receivedAt: string | null
  openedAt: string | null
}

interface NotificationHistoryItem {
  id: number
  title: string
  body: string
  createdAt: string
  stats: {
    targets: number
    sent: number
    received: number
    opened: number
    failed: number
    noSubscription: number
  }
  recipients: NotificationRecipient[]
}

export default function SettingsPage() {
  const params = useParams()
  const router = useRouter()
  const inviteCode = params.inviteCode as string
  const toast = useToast()
  const { band, currentMember, isAdmin, readOnly, refetch } = useBand()

  const searchParams = useSearchParams()
  const isNew = searchParams.get('new') === '1'

  const [copied, setCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberColor, setNewMemberColor] = useState<string>(MEMBER_COLORS[0])
  const [addingMember, setAddingMember] = useState(false)
  const [savingColor, setSavingColor] = useState<string | null>(null)
  const [editingColorMemberId, setEditingColorMemberId] = useState<string | null>(null)
  const [editingMemberNameId, setEditingMemberNameId] = useState<string | null>(null)
  const [memberNameDraft, setMemberNameDraft] = useState('')
  const [savingMemberNameId, setSavingMemberNameId] = useState<string | null>(null)
  const [notificationTitle, setNotificationTitle] = useState('')
  const [notificationMessage, setNotificationMessage] = useState('')
  const [sendingNotification, setSendingNotification] = useState(false)
  const [notificationHistory, setNotificationHistory] = useState<NotificationHistoryItem[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const [deletingNotificationId, setDeletingNotificationId] = useState<number | null>(null)

  const sortedMembers = useMemo(
    () => [...band.members].sort((a, b) => a.sortOrder - b.sortOrder),
    [band.members],
  )

  useEffect(() => {
    const available = firstAvailableMemberColor(sortedMembers)
    if (isColorBlocked(sortedMembers, newMemberColor)) setNewMemberColor(available)
  }, [newMemberColor, sortedMembers])

  const fetchNotificationHistory = useCallback(async () => {
    if (!isAdmin) return
    setLoadingNotifications(true)
    const data = await cachedJson<NotificationHistoryItem[]>(`/api/bands/${inviteCode}/notifications`, 0).catch(() => null)
    setLoadingNotifications(false)
    if (!data) return
    setNotificationHistory(data)
  }, [inviteCode, isAdmin])

  useEffect(() => {
    fetchNotificationHistory()
  }, [fetchNotificationHistory])

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
    if (!isAdmin || readOnly) return
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
    if (!isAdmin || readOnly) return
    const res = await fetch(`/api/bands/${inviteCode}/members/${memberId}`, { method: 'DELETE' })
    if (!res.ok) { toast('Nao foi possivel remover o membro.', 'error'); return }
    toast('Membro removido.', 'success')
    refetch()
  }

  async function resetMemberClaim(memberId: string, memberName: string) {
    if (!isAdmin || readOnly) return
    if (!window.confirm(`Liberar entrada de "${memberName}"?`)) return

    const res = await fetch(`/api/bands/${inviteCode}/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resetClaim', actorMemberId: currentMember?.id ?? null }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      toast(data?.error ?? 'Nao foi possivel liberar a entrada.', 'error')
      return
    }

    if (currentMember?.id === memberId) {
      removeClientStorage(`band_${inviteCode}`)
      removeClientStorage(`member_name_${inviteCode}`)
      toast('Entrada liberada. Escolha seu slot novamente.', 'success')
      router.push(`/join/${inviteCode}`)
      return
    }

    toast('Entrada liberada. Envie o link de convite novamente.', 'success')
    refetch()
  }

  function startEditMemberName(memberId: string, displayName: string) {
    setEditingMemberNameId(memberId)
    setMemberNameDraft(displayName)
  }

  function cancelEditMemberName() {
    setEditingMemberNameId(null)
    setMemberNameDraft('')
  }

  async function saveMemberName(memberId: string, previousName: string) {
    if (!isAdmin || readOnly) return
    const displayName = memberNameDraft.trim()
    if (!displayName) {
      toast('Informe um nome para o membro.', 'error')
      return
    }
    if (displayName === previousName) {
      cancelEditMemberName()
      return
    }

    setSavingMemberNameId(memberId)
    const res = await fetch(`/api/bands/${inviteCode}/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, actorMemberId: currentMember?.id ?? null }),
    })
    setSavingMemberNameId(null)

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      toast(data?.error ?? 'Nao foi possivel salvar o nome.', 'error')
      return
    }

    if (currentMember?.id === memberId) {
      writeClientStorage(`member_name_${inviteCode}`, displayName)
    }
    toast('Nome do membro atualizado.', 'success')
    cancelEditMemberName()
    refetch()
  }

  async function switchSlotOnThisDevice() {
    if (!currentMember || readOnly) return
    if (!window.confirm('Trocar o slot salvo neste dispositivo?')) return

    const res = await fetch(`/api/bands/${inviteCode}/members/${currentMember.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resetClaim', actorMemberId: currentMember.id }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      toast(data?.error ?? 'Nao foi possivel liberar seu slot.', 'error')
      return
    }

    removeClientStorage(`band_${inviteCode}`)
    removeClientStorage(`member_name_${inviteCode}`)
    toast('Slot liberado. Escolha novamente.', 'success')
    router.push(`/join/${inviteCode}`)
  }

  async function addMember(e: FormEvent) {
    e.preventDefault()
    if (!isAdmin || readOnly || !newMemberName.trim()) return
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
    if (!currentMember || readOnly || isColorBlocked(sortedMembers, color, currentMember.id)) return
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
    setEditingColorMemberId(null)
    refetch()
  }

  async function sendNotification(e: FormEvent) {
    e.preventDefault()
    if (!isAdmin || readOnly || !notificationMessage.trim()) return

    setSendingNotification(true)
    const res = await fetch(`/api/bands/${inviteCode}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: notificationTitle.trim(),
        message: notificationMessage.trim(),
      }),
    })
    setSendingNotification(false)

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      toast(data?.error ?? 'Nao foi possivel enviar a notificacao.', 'error')
      return
    }

    const sent = Number(data?.result?.sent ?? 0)
    const subscriptions = Number(data?.result?.subscriptions ?? 0)
    if (subscriptions === 0) {
      toast('Nenhum membro com notificacoes push ativas.', 'info')
    } else if (sent === 0) {
      toast('Nenhuma notificacao foi entregue.', 'error')
    } else {
      toast(`Notificacao enviada para ${sent} dispositivo(s).`, 'success')
      setNotificationTitle('')
      setNotificationMessage('')
    }
    fetchNotificationHistory()
  }

  async function deleteNotification(notificationId: number) {
    if (!isAdmin || readOnly || deletingNotificationId) return
    if (!window.confirm('Apagar esta notificacao enviada?')) return

    setDeletingNotificationId(notificationId)
    const res = await fetch(`/api/bands/${inviteCode}/notifications?id=${notificationId}`, {
      method: 'DELETE',
    })
    setDeletingNotificationId(null)

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      toast(data?.error ?? 'Nao foi possivel apagar a notificacao.', 'error')
      return
    }

    setNotificationHistory((items) => items.filter((item) => item.id !== notificationId))
    toast('Notificacao apagada.', 'success')
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

      <div>
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
        <div className="mt-3 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setShowQr((value) => !value)}
            className="party-button-secondary w-full justify-center sm:w-fit"
          >
            {showQr ? 'Ocultar QR code' : 'Mostrar QR code'}
          </button>
          {showQr && (
            <div className="flex justify-center rounded-lg bg-gray-50 p-3 dark:bg-gray-950 sm:p-4">
              <QrCode value={inviteUrl} size={260} fill />
            </div>
          )}
        </div>
      </section>

      {isAdmin && (
        <section className="bg-white border border-gray-200 rounded-lg p-5 dark:bg-gray-900 dark:border-gray-800">
          <div className="mb-4">
            <h3 className="text-sm font-semibold dark:text-gray-100">Notificacao para a banda</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Envia um push para membros que ja ativaram notificacoes neste dispositivo.
            </p>
          </div>
          <form onSubmit={sendNotification} className="space-y-3">
            <input
              type="text"
              value={notificationTitle}
              onChange={(e) => setNotificationTitle(e.target.value.slice(0, 80))}
              placeholder={`Aviso - ${band.name}`}
              maxLength={80}
              disabled={readOnly}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            />
            <textarea
              value={notificationMessage}
              onChange={(e) => setNotificationMessage(e.target.value.slice(0, 240))}
              placeholder="Mensagem para os membros"
              maxLength={240}
              rows={4}
              disabled={readOnly}
              className="w-full resize-none px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {notificationMessage.length}/240
              </span>
              <button
                type="submit"
                disabled={readOnly || !notificationMessage.trim() || sendingNotification}
                className="w-full sm:w-auto text-sm px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
              >
                {readOnly ? 'Indisponivel offline' : sendingNotification ? 'Enviando...' : 'Enviar notificacao'}
              </button>
            </div>
          </form>

          <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Ultimas notificacoes
              </h4>
              <button
                type="button"
                onClick={fetchNotificationHistory}
                disabled={loadingNotifications}
                className="text-xs font-medium text-gray-500 hover:text-gray-900 disabled:opacity-40 dark:text-gray-400 dark:hover:text-gray-100"
              >
                Atualizar
              </button>
            </div>
            {notificationHistory.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {loadingNotifications ? 'Carregando...' : 'Nenhuma notificacao enviada ainda.'}
              </p>
            ) : (
              <div className="space-y-3">
                {notificationHistory.map((notification) => (
                  <details key={notification.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{notification.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{notification.body}</p>
                          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">{formatDateTime(notification.createdAt)}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-center sm:min-w-48">
                          <Metric label="enviadas" value={notification.stats.sent} />
                          <Metric label="recebidas" value={notification.stats.received} />
                          <Metric label="abertas" value={notification.stats.opened} />
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            deleteNotification(notification.id)
                          }}
                          disabled={readOnly || deletingNotificationId === notification.id}
                          className="self-start rounded-md px-2 py-1 text-xs font-medium text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:text-gray-500 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                        >
                          {deletingNotificationId === notification.id ? 'Apagando...' : 'Apagar'}
                        </button>
                      </div>
                    </summary>
                    <div className="mt-3 space-y-1 border-t border-gray-200 pt-3 dark:border-gray-800">
                      {notification.recipients.map((recipient) => (
                        <div key={recipient.id} className="flex items-center justify-between gap-3 rounded-md bg-white px-2.5 py-2 text-xs dark:bg-gray-900">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-800 dark:text-gray-100">{recipient.displayName}</p>
                            {recipient.error && (
                              <p className="truncate text-[11px] text-red-500 dark:text-red-300">{recipient.error}</p>
                            )}
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${statusClass(recipient.status)}`}>
                            {statusLabel(recipient.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="bg-white border border-gray-200 rounded-lg p-5 dark:bg-gray-900 dark:border-gray-800">
        <h3 className="text-sm font-semibold mb-4 dark:text-gray-100">Membros</h3>
        {currentMember && (
          <div className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-900/60 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-amber-950 dark:text-amber-100">
                Voce esta como {currentMember.displayName}
              </p>
            </div>
            <button
              type="button"
              onClick={switchSlotOnThisDevice}
              disabled={readOnly}
              className="shrink-0 text-xs font-medium text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-100"
            >
              Trocar slot neste dispositivo
            </button>
          </div>
        )}
        <div className="space-y-2">
          {sortedMembers.map((m) => (
            <div key={m.id} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-950">
              <div className="flex min-h-10 items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {currentMember?.id === m.id && !readOnly ? (
                    <button
                      type="button"
                      onClick={() => setEditingColorMemberId((id) => id === m.id ? null : m.id)}
                      className="h-5 w-5 rounded-full shrink-0 ring-2 ring-white transition-transform hover:scale-110 dark:ring-gray-900"
                      style={{ backgroundColor: m.color }}
                      title="Alterar sua cor"
                    />
                  ) : (
                    <span
                      className="h-4 w-4 rounded-full shrink-0 ring-2 ring-white dark:ring-gray-900"
                      style={{ backgroundColor: m.color }}
                    />
                  )}
                  {editingMemberNameId === m.id ? (
                    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="text"
                        value={memberNameDraft}
                        onChange={(e) => setMemberNameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveMemberName(m.id, m.displayName)
                          if (e.key === 'Escape') cancelEditMemberName()
                        }}
                        maxLength={30}
                        disabled={savingMemberNameId === m.id}
                        className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => saveMemberName(m.id, m.displayName)}
                          disabled={savingMemberNameId === m.id}
                          className="text-xs font-medium text-emerald-700 hover:text-emerald-900 disabled:opacity-40 dark:text-emerald-300 dark:hover:text-emerald-100"
                        >
                          {savingMemberNameId === m.id ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditMemberName}
                          disabled={savingMemberNameId === m.id}
                          className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-40 dark:text-gray-500 dark:hover:text-gray-200"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
                {isAdmin && !readOnly && editingMemberNameId !== m.id && (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => startEditMemberName(m.id, m.displayName)}
                      className="text-xs text-gray-400 transition-colors hover:text-blue-600 dark:text-gray-600 dark:hover:text-blue-300"
                    >
                      Editar nome
                    </button>
                    {m.claimed && (
                      <button
                        onClick={() => resetMemberClaim(m.id, m.displayName)}
                        className="text-xs text-gray-400 transition-colors hover:text-amber-600 dark:text-gray-600 dark:hover:text-amber-300"
                      >
                        Liberar entrada
                      </button>
                    )}
                    <button
                      onClick={() => removeMember(m.id)}
                      className="text-xs text-gray-400 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>
              {currentMember?.id === m.id && !readOnly && editingColorMemberId === m.id && (
                <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-800">
                  <ColorGrid
                    members={sortedMembers}
                    targetMemberId={currentMember.id}
                    selectedColor={currentMember.color}
                    savingColor={savingColor}
                    onSelect={changeOwnColor}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {isAdmin && !readOnly && sortedMembers.length < 12 && (
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

      {isAdmin && !readOnly && (
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

      <BandHistoryPanel inviteCode={inviteCode} type="member" title="Historico de ajustes e membros" />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white px-2 py-1 dark:bg-gray-900">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-[10px] text-gray-400 dark:text-gray-500">{label}</p>
    </div>
  )
}

function statusLabel(status: string) {
  if (status === 'opened') return 'abriu'
  if (status === 'received') return 'recebeu'
  if (status === 'sent') return 'enviada'
  if (status === 'failed') return 'falhou'
  if (status === 'no_subscription') return 'sem push'
  return status
}

function statusClass(status: string) {
  if (status === 'opened') return 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
  if (status === 'received') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
  if (status === 'sent') return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300'
  if (status === 'failed') return 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
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
