'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import type { Band, BandMember } from '@/lib/types'
import { writeClientStorage } from '@/lib/client-storage'
import { cachedJsonWithMeta } from '@/lib/client-cache'
import { useOfflineReadOnly } from '@/lib/use-offline-readonly'

export default function JoinPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const inviteCode = params.inviteCode as string
  const { data: session, status } = useSession()
  const currentUserId = session?.user?.id ?? null

  const [band, setBand] = useState<Band | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [staleInviteData, setStaleInviteData] = useState(false)
  const offlineReadOnly = useOfflineReadOnly(staleInviteData)

  const storageKey = `band_${inviteCode}`

  const continueAsMember = useCallback((member: BandMember, replace = false) => {
    const storedMember = writeClientStorage(storageKey, member.id)
    writeClientStorage(`member_name_${inviteCode}`, member.displayName)

    const fallbackQuery = storedMember ? '' : `?memberId=${encodeURIComponent(member.id)}`
    const href = `/band/${inviteCode}/rehearsals${fallbackQuery}`
    if (replace) router.replace(href)
    else router.push(href)
  }, [inviteCode, router, storageKey])

  const signInHref = useMemo(
    () => `/auth/signin?callbackUrl=${encodeURIComponent(`/join/${inviteCode}`)}`,
    [inviteCode],
  )

  const fetchBand = useCallback(async () => {
    try {
      const result = await cachedJsonWithMeta<Band>(`/api/bands/${inviteCode}`, 0)
      setBand(result.data)
      setStaleInviteData(result.stale)
      setLoading(false)
    } catch {
      setError('Nao foi possivel carregar o convite. Tente novamente.')
      setLoading(false)
    }
  }, [inviteCode])

  useEffect(() => {
    fetchBand()
  }, [fetchBand])

  useEffect(() => {
    if (!band || !currentUserId) return
    const claimMemberId = searchParams.get('claimMemberId')
    if (!claimMemberId || claiming) return

    const member = band.members.find((m) => m.id === claimMemberId)
    if (member) claimSlot(member)
    // claimSlot intentionally stays outside deps to avoid retrying while it mutates state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [band, currentUserId, claiming, searchParams])

  useEffect(() => {
    window.addEventListener('online', fetchBand)
    return () => window.removeEventListener('online', fetchBand)
  }, [fetchBand])

  async function claimSlot(member: BandMember) {
    if (offlineReadOnly) {
      setError('Modo offline: entre no slot quando a conexao voltar.')
      return
    }
    if (member.claimedBy && member.claimedBy === currentUserId) {
      continueAsMember(member)
      return
    }
    if (member.claimed && !currentUserId) {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(`/join/${inviteCode}?claimMemberId=${member.id}`)}`)
      return
    }
    if (claiming || status === 'loading') return
    setClaiming(member.id)
    setError('')

    const res = await fetch(`/api/bands/${inviteCode}/members/${member.id}/claim`, {
      method: 'POST',
    }).catch(() => null)

    if (!res) {
      setError('Nao foi possivel entrar. Verifique a conexao e tente novamente.')
      setClaiming(null)
      return
    }

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(
        data?.error === 'Member slot already claimed'
          ? 'Entre na sua conta para assumir esse slot.'
          : 'Nao foi possivel entrar. Tente novamente.',
      )
      setClaiming(null)
      fetchBand()
      return
    }

    continueAsMember(member)
  }

  const sortedMembers = useMemo(
    () => [...(band?.members ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [band?.members],
  )
  const claimedCount = sortedMembers.filter((m) => m.claimed).length
  const allClaimed = sortedMembers.length > 0 && claimedCount === sortedMembers.length
  const hasClaimedSlots = sortedMembers.some((m) => m.claimed)

  if (loading) {
    return (
      <div className="party-bg flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 dark:border-slate-700 dark:border-t-cyan-300" />
      </div>
    )
  }

  if (error && !band) {
    return (
      <div className="party-bg flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <div className="party-card max-w-sm">
          <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
          <Link href="/" className="party-button-secondary mt-4 inline-flex">
            Voltar ao inicio
          </Link>
        </div>
      </div>
    )
  }

  if (!band) return null

  return (
    <div className="party-bg min-h-screen px-4 py-6">
      <main className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col justify-center space-y-5">
        <div>
          <Link
            href={`/band/${inviteCode}/rehearsals`}
            className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Voltar
          </Link>
          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-cyan-300">
            Convite para
          </p>
          <h1 className="party-title mt-1 text-3xl">{band.name}</h1>
          <p className="party-subtle mt-2 text-sm">Escolha seu slot para participar das musicas, votos e ensaios.</p>
        </div>

        <div className="party-card-soft flex items-center justify-between gap-3 text-sm">
          <span className="text-slate-600 dark:text-slate-300">
            {claimedCount} de {sortedMembers.length} slot{sortedMembers.length !== 1 ? 's' : ''} ocupados
          </span>
          {allClaimed && <span className="font-semibold text-amber-700 dark:text-amber-300">Banda cheia</span>}
        </div>

        {offlineReadOnly && (
          <div className="party-alert text-sm">
            <p>
              <strong>Modo offline.</strong> Este convite foi carregado dos dados salvos. Entrar como membro exige conexao.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {!allClaimed && !currentUserId && hasClaimedSlots && (
          <div className="party-alert text-sm">
            <p>
              Quer assumir um slot ocupado?{' '}
              <Link href={signInHref} className="font-semibold text-blue-700 underline dark:text-blue-200">
                Entre primeiro
              </Link>
              .
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {sortedMembers.map((member) => {
            const claimedByCurrentUser = !!currentUserId && member.claimedBy === currentUserId
            const replaceableClaimedSlot = !!currentUserId && member.claimed
            const disabled = claiming !== null || offlineReadOnly || status === 'loading'
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => claimSlot(member)}
                disabled={disabled}
                className={`group rounded-lg border p-4 text-left transition-all ${
                  disabled
                    ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-500'
                    : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-cyan-300/50'
                }`}
              >
                <span className="mb-3 block h-2 w-12 rounded-full" style={{ backgroundColor: member.color }} />
                <span className="block truncate text-base font-semibold text-slate-950 dark:text-slate-100">
                  {member.displayName}
                </span>
                <span className="mt-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  {claiming === member.id
                    ? 'Entrando...'
                    : claimedByCurrentUser
                    ? 'Seu slot'
                    : replaceableClaimedSlot
                    ? 'Assumir slot'
                    : status === 'loading'
                    ? 'Verificando login...'
                    : member.claimed
                    ? 'Entrar para assumir'
                    : offlineReadOnly
                    ? 'Disponivel online'
                    : 'Entrar como membro'}
                </span>
              </button>
            )
          })}
        </div>

        {allClaimed && (
          <div className="party-card text-sm text-slate-600 dark:text-slate-300">
            {currentUserId
              ? 'Todos os slots estao ocupados. Toque no slot que deseja assumir.'
              : (
                <>
                  Todos os slots ja estao ocupados.{' '}
                  <Link href={signInHref} className="font-semibold text-blue-700 underline dark:text-blue-200">
                    Entre para assumir um slot
                  </Link>
                  .
                </>
              )}
          </div>
        )}

        <p className="text-center text-xs text-slate-500 dark:text-slate-500">
          Sua identidade fica salva neste navegador.
        </p>
      </main>
    </div>
  )
}
