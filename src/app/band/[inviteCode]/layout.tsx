'use client'

import Link from 'next/link'
import { usePathname, useParams, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { Band, BandMember } from '@/lib/types'
import ThemeToggle from '@/components/ThemeToggle'
import { BandContext } from '@/contexts/BandContext'
import BrandMark from '@/components/BrandMark'
import { readClientStorage, writeClientStorage } from '@/lib/client-storage'
import { cachedJsonWithMeta } from '@/lib/client-cache'
import { useOfflineReadOnly } from '@/lib/use-offline-readonly'

export default function BandLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = params.inviteCode as string
  const memberIdFromUrl = searchParams.get('memberId')

  const { data: session } = useSession()
  const [band, setBand] = useState<Band | null>(null)
  const [currentMember, setCurrentMember] = useState<BandMember | null>(null)
  const [memberQueryFallback, setMemberQueryFallback] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [staleBandData, setStaleBandData] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const offlineReadOnly = useOfflineReadOnly(staleBandData)

  // PWA install
  const [installPrompt, setInstallPrompt] = useState<Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [isInstallable, setIsInstallable] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as { standalone?: boolean }).standalone === true
    if (standalone) return // já instalado

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    if (isIos) { setIsInstallable(true); return }

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as never)
      setIsInstallable(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    if (isIos) { setShowIosHint((v) => !v); return }
    if (!installPrompt) return
    await (installPrompt as { prompt: () => Promise<void> }).prompt()
    setIsInstallable(false)
    setInstallPrompt(null)
  }

  const fetchBand = useCallback(async () => {
    let data: Band
    try {
      const result = await cachedJsonWithMeta<Band>(`/api/bands/${inviteCode}`, 0)
      data = result.data
      setStaleBandData(result.stale)
    } catch {
      router.push('/')
      return
    }

    setBand(data)

    const storedMemberId = readClientStorage(`band_${inviteCode}`)
    const memberId = storedMemberId ?? memberIdFromUrl
    if (memberId) {
      const found = data.members.find((m) => m.id === memberId) ?? null
      setCurrentMember(found)
      setMemberQueryFallback(!storedMemberId && !!memberIdFromUrl && !!found)
      if (found && !storedMemberId) {
        writeClientStorage(`band_${inviteCode}`, found.id)
        writeClientStorage(`member_name_${inviteCode}`, found.displayName)
      }
    } else {
      setCurrentMember(null)
      setMemberQueryFallback(false)
    }

    writeClientStorage('last_band', inviteCode)
    writeClientStorage(`band_name_${inviteCode}`, data.name)
    setLoading(false)
  }, [inviteCode, memberIdFromUrl, router])

  useEffect(() => { fetchBand() }, [fetchBand])
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.addEventListener('online', fetchBand)
    return () => window.removeEventListener('online', fetchBand)
  }, [fetchBand])
  useEffect(() => { if (editingName) nameInputRef.current?.focus() }, [editingName])

  useEffect(() => {
    if (!currentMember) return
    if (offlineReadOnly) return
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    let cancelled = false

    async function syncPushMember() {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (!sub || cancelled) return

      const json = sub.toJSON()
      await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: json.keys,
          inviteCode,
          memberId: currentMember!.id,
        }),
      })
    }

    syncPushMember().catch(() => {
      // Push sync is best-effort and should not block band navigation.
    })

    return () => {
      cancelled = true
    }
  }, [currentMember, inviteCode, offlineReadOnly])

  const tabs = useMemo(() => [
    { href: `/band/${inviteCode}/rehearsals`, label: 'Ensaios' },
    { href: `/band/${inviteCode}/songs`, label: 'Músicas' },
    { href: `/band/${inviteCode}/suggestions`, label: 'Sugestões' },
    { href: `/band/${inviteCode}/insights`, label: 'Análise' },
    { href: `/band/${inviteCode}/ensaio`, label: 'Ensaiar' },
    { href: `/band/${inviteCode}/settings`, label: 'Ajustes' },
  ], [inviteCode])

  const mobileTabs = useMemo(() => [
    { href: `/band/${inviteCode}/rehearsals`, label: 'Ensaios' },
    { href: `/band/${inviteCode}/songs`, label: 'Músicas' },
    { href: `/band/${inviteCode}/suggestions`, label: 'Sug.' },
    { href: `/band/${inviteCode}/insights`, label: 'Anl.' },
    { href: `/band/${inviteCode}/ensaio`, label: 'Ensaiar' },
    { href: `/band/${inviteCode}/settings`, label: 'Ajustes' },
  ], [inviteCode])

  useEffect(() => {
    for (const tab of tabs) router.prefetch(tab.href)
  }, [router, tabs])

  async function saveName() {
    if (offlineReadOnly) {
      setEditingName(false)
      return
    }
    const trimmed = nameValue.trim()
    if (!trimmed || !currentMember || trimmed === currentMember.displayName) {
      setEditingName(false); return
    }
    setSavingName(true)
    const res = await fetch(`/api/bands/${inviteCode}/members/${currentMember.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: trimmed, actorMemberId: currentMember.id }),
    })
    if (res.ok) {
      writeClientStorage(`member_name_${inviteCode}`, trimmed)
      setCurrentMember((m) => m ? { ...m, displayName: trimmed } : m)
    }
    setSavingName(false)
    setEditingName(false)
  }

  function startEdit() {
    if (offlineReadOnly) return
    setNameValue(currentMember?.displayName ?? '')
    setEditingName(true)
  }

  if (loading) {
    return (
      <div className="party-bg min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!band) return null

  const isAdmin = session?.user?.id && band?.createdBy === session.user.id
  const sessionName = session?.user?.name
  const suggestAccountName = sessionName && currentMember && sessionName !== currentMember.displayName

  const joinLabel = isAdmin ? 'Escolher slot' : 'Entrar na banda'
  const withMemberFallback = (href: string) => {
    if (!memberQueryFallback || !currentMember) return href
    return `${href}?memberId=${encodeURIComponent(currentMember.id)}`
  }

  return (
    <div className="party-bg min-h-screen">
      <header className="party-topbar">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex min-h-14 items-center justify-between gap-2 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Link href={session?.user?.id ? '/dashboard' : '/'} className="text-gray-400 hover:text-gray-600 shrink-0 transition-colors" title={session?.user?.id ? 'Minhas bandas' : 'Início'}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
                </svg>
              </Link>
              <BrandMark size="sm" />
              <span className="party-title truncate text-base">{band.name}</span>
            </div>

            <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
              {isInstallable && (
                <div className="relative">
                  <button
                    onClick={handleInstall}
                    title="Instalar aplicativo"
                    className="party-icon-button sm:w-auto sm:px-2.5 sm:text-xs"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 256 256">
                      <path d="M240,136v64a16,16,0,0,1-16,16H32a16,16,0,0,1-16-16V136a16,16,0,0,1,16-16H80a8,8,0,0,1,0,16H32v64H224V136H176a8,8,0,0,1,0-16h48A16,16,0,0,1,240,136Zm-117.66-2.34a8,8,0,0,0,11.32,0l48-48a8,8,0,0,0-11.32-11.32L136,108.69V32a8,8,0,0,0-16,0v76.69L85.66,74.34A8,8,0,0,0,74.34,85.66Z"/>
                    </svg>
                    <span className="hidden sm:inline">Instalar app</span>
                  </button>
                  {showIosHint && (
                    <div className="absolute right-0 top-10 w-64 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-xl z-50 border border-gray-700">
                      <p className="font-semibold mb-1">Instalar no iPhone/iPad</p>
                      <p className="text-gray-300 leading-relaxed">
                        Toque em <strong className="text-white">Compartilhar</strong> <span className="text-base">⎙</span> na barra do Safari e depois em{' '}
                        <strong className="text-white">"Adicionar à Tela de Início"</strong>.
                      </p>
                      <button onClick={() => setShowIosHint(false)} className="mt-2 text-gray-400 hover:text-white">Fechar</button>
                    </div>
                  )}
                </div>
              )}
              <ThemeToggle />
              {currentMember ? (
                editingName ? (
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: currentMember.color }} />
                    <input
                      ref={nameInputRef}
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                      maxLength={30}
                      disabled={savingName}
                      className="party-input w-32 px-2 py-1 text-sm"
                    />
                    {suggestAccountName && (
                      <button
                        onClick={() => setNameValue(sessionName)}
                        className="whitespace-nowrap text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                        title="Usar nome da sua conta"
                      >
                        Usar "{sessionName}"
                      </button>
                    )}
                    <button onClick={saveName} disabled={savingName} className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200">✓</button>
                    <button onClick={() => setEditingName(false)} className="text-xs text-rose-500 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-200">✕</button>
                  </div>
                ) : (
                  <button onClick={startEdit} disabled={offlineReadOnly} className={`group flex min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ${offlineReadOnly ? 'cursor-default opacity-80' : ''}`} title={offlineReadOnly ? 'Indisponivel no modo offline' : 'Alterar seu nome na banda'} aria-label={`Alterar seu nome na banda: ${currentMember.displayName}`}>
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: currentMember.color }} />
                    <span className="block max-w-[5.5rem] truncate text-sm font-medium sm:max-w-[7rem]">{currentMember.displayName}</span>
                    {!offlineReadOnly && <span className="text-slate-400 transition-colors group-hover:text-slate-700 text-xs dark:group-hover:text-slate-200">✎</span>}
                  </button>
                )
              ) : (
                <Link
                  href={`/join/${inviteCode}`}
                  className="party-button max-w-[7.5rem] truncate px-3 py-1.5 text-xs sm:max-w-none"
                >
                  {joinLabel}
                </Link>
              )}
            </div>
          </div>

          <nav className="hidden sm:flex sm:flex-nowrap gap-1 -mb-px overflow-x-auto sm:scrollbar-none" aria-label="Seções da banda">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href
              return (
                <Link
                  key={tab.href}
                  href={withMemberFallback(tab.href)}
                  className={`whitespace-nowrap ${
                    isActive
                      ? 'party-tab party-tab-active'
                      : 'party-tab'
                  }`}
                >
                  {tab.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      {offlineReadOnly && (
        <div className="party-alert">
          <p>
            <strong>Modo offline.</strong> Mostrando dados salvos neste dispositivo. Edicoes ficam bloqueadas ate reconectar.{' '}
            <button
              type="button"
              onClick={fetchBand}
              className="font-semibold text-blue-700 underline dark:text-blue-200"
            >
              Tentar atualizar
            </button>
          </p>
        </div>
      )}

      {/* Guest/admin slot banner */}
      {!currentMember && isAdmin && (
        <div className="party-alert">
          <p>
            Você administra esta banda.{' '}
            <Link href={`/join/${inviteCode}`} className="font-semibold text-blue-700 underline dark:text-blue-200">
              Escolha seu slot para participar dos ensaios e músicas →
            </Link>
          </p>
        </div>
      )}

      {!currentMember && !isAdmin && (
        <div className="party-alert">
          <p>
            Você está visualizando como <strong>convidado</strong>.{' '}
            <Link href={`/join/${inviteCode}`} className="font-semibold text-amber-800 underline dark:text-amber-200">
              Escolha seu slot para interagir →
            </Link>
          </p>
        </div>
      )}

      {/* Nudge: member but no account */}
      {currentMember && !session?.user && (
        <div className="party-alert">
          <p>
            Você está como <strong>{currentMember.displayName}</strong> neste dispositivo.{' '}
            <Link href="/auth/register" className="font-semibold text-blue-700 underline dark:text-blue-200">
              Crie uma conta para acessar de qualquer lugar →
            </Link>
          </p>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-6 pb-28 sm:pb-6">
        <BandContext.Provider value={{ band, currentMember, isAdmin: !!isAdmin, readOnly: offlineReadOnly, refetch: fetchBand }}>
          <div className="page-enter">
            {children}
          </div>
        </BandContext.Provider>
      </main>

      <nav className="party-bottom-nav sm:hidden fixed bottom-0 left-0 right-0 z-30 border-t backdrop-blur" aria-label="Seções principais">
        <div className="grid grid-cols-6">
          {mobileTabs.map((tab) => {
            const isActive = pathname === tab.href
            return (
              <Link
                key={tab.href}
                href={withMemberFallback(tab.href)}
                className={`flex min-h-14 items-center justify-center px-0.5 text-[10px] font-semibold transition-colors ${
                  isActive
                    ? 'text-cyan-700 dark:text-cyan-200'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                <span className={`rounded-lg px-2 py-1 ${isActive ? 'bg-cyan-50 ring-1 ring-cyan-200 dark:bg-cyan-300/10 dark:ring-cyan-300/20' : ''}`}>
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
