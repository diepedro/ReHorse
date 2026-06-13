'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Band } from '@/lib/types'
import ThemeToggle from '@/components/ThemeToggle'
import BrandMark from '@/components/BrandMark'
import { cachedJsonWithMeta } from '@/lib/client-cache'
import { useOfflineReadOnly } from '@/lib/use-offline-readonly'

interface BandEntry extends Band {
  role: 'admin' | 'member' | 'local'
}

function LogoutModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(data => {
      if (data?.recoveryCode) setRecoveryCode(data.recoveryCode)
    })
  }, [])

  async function copyCode() {
    if (!recoveryCode) return
    await navigator.clipboard.writeText(recoveryCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Sair da conta</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Guarde seu código de recuperação antes de sair. Você precisará dele para acessar sua conta em outro dispositivo ou se perder o acesso.
          </p>
        </div>

        {recoveryCode ? (
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Código de recuperação</p>
            <p className="font-mono text-lg font-bold tracking-widest text-gray-900 dark:text-gray-100 text-center">{recoveryCode}</p>
            <button
              onClick={copyCode}
              className="w-full text-sm py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {copied ? '✓ Copiado!' : 'Copiar código'}
            </button>
          </div>
        ) : (
          <div className="h-24 bg-gray-50 dark:bg-gray-800 rounded-xl animate-pulse" />
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-gray-900 dark:bg-gray-700 text-white text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
          >
            Sair mesmo assim
          </button>
        </div>
      </div>
    </div>
  )
}

function AbsorbCard({ onDone, onDismiss }: { onDone: () => void; onDismiss: () => void }) {
  const [detectedId, setDetectedId] = useState<string | null>(null)
  const [detectedName, setDetectedName] = useState<string | null>(null)
  const [recoveryCode, setRecoveryCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showManual, setShowManual] = useState(false)

  useEffect(() => {
    const id = localStorage.getItem('creator_id')
    const name = localStorage.getItem('creator_name')
    if (id && name) { setDetectedId(id); setDetectedName(name) }
  }, [])

  async function absorb(body: Record<string, string>) {
    setLoading(true); setError('')
    const res = await fetch('/api/auth/absorb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Erro ao vincular.'); setLoading(false); return }
    localStorage.removeItem('creator_id')
    localStorage.removeItem('creator_name')
    onDone()
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">Vincular conta anterior</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            Se você criou bandas como visitante antes de criar esta conta, vincule aqui para recuperar o acesso de admin.
          </p>
        </div>
        <button onClick={onDismiss} className="text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 text-lg leading-none shrink-0" title="Fechar">×</button>
      </div>

      {detectedId && !showManual ? (
        <div className="flex items-center justify-between gap-3 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-900/50 rounded-lg px-3 py-2.5">
          <span className="text-sm text-gray-700 dark:text-gray-300">Conta detectada: <strong>{detectedName}</strong></span>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => absorb({ oldUserId: detectedId })}
              disabled={loading}
              className="text-xs px-3 py-1.5 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Vinculando...' : 'Vincular'}
            </button>
            <button onClick={() => setShowManual(true)} className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300">
              Outro
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
            placeholder="Código de recuperação da conta anterior"
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-amber-200 dark:border-amber-900/50 bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono"
          />
          <button
            onClick={() => absorb({ recoveryCode })}
            disabled={!recoveryCode.trim() || loading}
            className="text-sm px-3 py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:opacity-40 transition-colors"
          >
            {loading ? '...' : 'Vincular'}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [bandList, setBandList] = useState<BandEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [showAbsorb, setShowAbsorb] = useState(false)
  const [staleDashboardData, setStaleDashboardData] = useState(false)
  const offlineReadOnly = useOfflineReadOnly(staleDashboardData)

  useEffect(() => {
    const id = localStorage.getItem('creator_id')
    const dismissed = localStorage.getItem('absorb_dismissed')
    if (id && id !== session?.user?.id && !dismissed) setShowAbsorb(true)
  }, [session?.user?.id])

  const fetchBands = useCallback(async () => {
    // 1. Bands from the API (created + claimed-by-userId)
    let apiBands: BandEntry[] = []
    let staleData = false
    try {
      const result = await cachedJsonWithMeta<BandEntry[]>('/api/bands', 0)
      apiBands = result.data
      staleData = result.stale
    } catch {
      staleData = true
    }
    // Normalise to lowercase for case-insensitive dedup (invite codes are uppercase in DB
    // but users may have joined using a mixed-case URL or typed code)
    const apiCodesLower = new Set(apiBands.map((b) => b.inviteCode.toLowerCase()))

    // 2. Bands saved in localStorage (joined via invite code while unauthenticated)
    const localCodes: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('band_') && !key.startsWith('band_name_')) {
        const code = key.slice(5)
        if (!apiCodesLower.has(code.toLowerCase())) {
          localCodes.push(code)
        }
        // Note: keep band_${code} even when in API — band layout uses it to identify member slot
      }
    }

    // Fetch each local band
    const localBands = await Promise.all(
      localCodes.map(async (code) => {
        try {
          const result = await cachedJsonWithMeta<Band>(`/api/bands/${code}`, 0)
          staleData = staleData || result.stale
          return { ...result.data, role: 'local' as const }
        } catch {
          return null
        }
      })
    )

    setStaleDashboardData(staleData)
    setBandList([...apiBands, ...localBands.filter(Boolean) as BandEntry[]])
    setLoading(false)
  }, [])

  useEffect(() => { fetchBands() }, [fetchBands])
  useEffect(() => {
    window.addEventListener('online', fetchBands)
    return () => window.removeEventListener('online', fetchBands)
  }, [fetchBands])

  function copyLink(code: string) {
    const url = `${window.location.origin}/join/${code}`
    try {
      const el = document.createElement('input')
      el.value = url
      el.style.cssText = 'position:fixed;top:0;left:0;opacity:0.01'
      document.body.appendChild(el)
      el.focus()
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    } catch {
      navigator.clipboard?.writeText(url)
    }
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="party-bg min-h-screen">
      {showLogoutModal && (
        <LogoutModal
          onCancel={() => setShowLogoutModal(false)}
          onConfirm={() => signOut({ callbackUrl: '/' })}
        />
      )}
      <header className="party-topbar">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandMark size="sm" />
            <span className="party-title text-lg">ReHorse</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle />
            <Link href="/perfil" className="hidden text-sm font-semibold text-slate-600 transition-colors hover:text-slate-950 sm:block dark:text-slate-300 dark:hover:text-white">{session?.user?.name}</Link>
            <button onClick={() => setShowLogoutModal(true)} className="text-xs font-semibold text-slate-500 transition-colors hover:text-slate-950 dark:text-slate-400 dark:hover:text-white">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="party-title text-2xl">Minhas bandas</h2>
            <p className="party-subtle mt-1 text-sm">Convites, integrantes e ensaios em um lugar.</p>
          </div>
          <Link
            href="/dashboard/create"
            aria-disabled={offlineReadOnly}
            className={`party-button shrink-0 ${offlineReadOnly ? 'pointer-events-none opacity-50' : ''}`}
          >
            + Nova banda
          </Link>
        </div>

        {offlineReadOnly && (
          <div className="party-alert mb-6">
            <p>
              <strong>Modo offline.</strong> Mostrando bandas salvas neste dispositivo. Criar ou entrar em uma banda nova exige conexao.
            </p>
          </div>
        )}

        {showAbsorb && (
          <div className="mb-6">
            <AbsorbCard
              onDone={() => {
                localStorage.setItem('absorb_dismissed', '1')
                setShowAbsorb(false)
                fetchBands()
              }}
              onDismiss={() => {
                localStorage.setItem('absorb_dismissed', '1')
                localStorage.removeItem('creator_id')
                localStorage.removeItem('creator_name')
                setShowAbsorb(false)
              }}
            />
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); const t = joinCode.trim(); if (t) router.push(`/join/${t}`) }}
          className="mb-6 flex flex-col gap-2 sm:flex-row"
        >
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Entrar por código de convite"
            className="party-input min-w-0 flex-1"
          />
          <button
            type="submit"
            disabled={!joinCode.trim()}
            className="party-button-secondary"
          >
            Entrar
          </button>
        </form>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="party-card h-24 animate-pulse" />)}
          </div>
        ) : bandList.length === 0 ? (
          <div className="party-card text-center py-12 text-slate-500 dark:text-slate-400">
            <BrandMark size="xl" className="mx-auto mb-4" />
            <p className="text-sm">Você ainda não tem nenhuma banda.</p>
            <Link href="/dashboard/create" className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:underline dark:text-blue-300">
              Criar sua primeira banda →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {bandList.map((band) => (
              <div key={band.id} className="party-card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="truncate text-base font-semibold text-slate-950 dark:text-slate-100">{band.name}</span>
                    {band.role === 'admin' && (
                      <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-200">admin</span>
                    )}
                    {band.role === 'local' && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200" title="Entre pela página do convite para vincular ao seu perfil">
                        convite local
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1">
                      {band.members.slice(0, 8).map((m) => (
                        <span key={m.id} className="h-5 w-5 rounded-full border-2 border-white shadow-sm dark:border-slate-900" style={{ backgroundColor: m.color }} title={m.displayName} />
                      ))}
                    </div>
                    <span className="party-subtle text-xs">{band.members.length} membro{band.members.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
                  <button onClick={() => copyLink(band.inviteCode)} className="party-button-secondary flex-1 px-3 py-1.5 text-xs sm:flex-none">
                    {copied === band.inviteCode ? '✓ Copiado' : 'Copiar link'}
                  </button>
                  <Link href={`/band/${band.inviteCode}/rehearsals`} className="party-button flex-1 px-3 py-1.5 text-center text-xs sm:flex-none">
                    Abrir
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
