'use client'

import Link from 'next/link'
import { usePathname, useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { Band, BandMember } from '@/lib/types'
import ThemeToggle from '@/components/ThemeToggle'
import { BandContext } from '@/contexts/BandContext'

export default function BandLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const params = useParams()
  const router = useRouter()
  const inviteCode = params.inviteCode as string

  const { data: session } = useSession()
  const [band, setBand] = useState<Band | null>(null)
  const [currentMember, setCurrentMember] = useState<BandMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [savingName, setSavingName] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

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
    const res = await fetch(`/api/bands/${inviteCode}`)
    if (!res.ok) { router.push('/'); return }
    const data: Band = await res.json()
    setBand(data)

    const memberId = localStorage.getItem(`band_${inviteCode}`)
    if (memberId) {
      const found = data.members.find((m) => m.id === memberId) ?? null
      setCurrentMember(found)
    }

    localStorage.setItem('last_band', inviteCode)
    localStorage.setItem(`band_name_${inviteCode}`, data.name)
    setLoading(false)
  }, [inviteCode, router])

  useEffect(() => { fetchBand() }, [fetchBand])
  useEffect(() => { if (editingName) nameInputRef.current?.focus() }, [editingName])

  async function saveName() {
    const trimmed = nameValue.trim()
    if (!trimmed || !currentMember || trimmed === currentMember.displayName) {
      setEditingName(false); return
    }
    setSavingName(true)
    const res = await fetch(`/api/bands/${inviteCode}/members/${currentMember.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: trimmed }),
    })
    if (res.ok) {
      localStorage.setItem(`member_name_${inviteCode}`, trimmed)
      setCurrentMember((m) => m ? { ...m, displayName: trimmed } : m)
    }
    setSavingName(false)
    setEditingName(false)
  }

  function startEdit() {
    setNameValue(currentMember?.displayName ?? '')
    setEditingName(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!band) return null

  const isAdmin = session?.user?.id && band?.createdBy === session.user.id
  const sessionName = session?.user?.name
  const suggestAccountName = sessionName && currentMember && sessionName !== currentMember.displayName

  const tabs = [
    { href: `/band/${inviteCode}/rehearsals`, label: 'Ensaios' },
    { href: `/band/${inviteCode}/songs`, label: 'Músicas' },
    { href: `/band/${inviteCode}/suggestions`, label: 'Sugestões' },
    { href: `/band/${inviteCode}/insights`, label: 'Análise' },
    { href: `/band/${inviteCode}/ensaio`, label: '🎸 Ensaiar' },
    ...(isAdmin ? [{ href: `/band/${inviteCode}/settings`, label: 'Ajustes' }] : []),
  ]
  const joinLabel = isAdmin ? 'Escolher slot' : 'Entrar na banda'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2 min-w-0">
              <Link href={session?.user?.id ? '/dashboard' : '/'} className="text-gray-400 hover:text-gray-600 shrink-0 transition-colors" title={session?.user?.id ? 'Minhas bandas' : 'Início'}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
                </svg>
              </Link>
              <span className="font-bold tracking-tight truncate dark:text-gray-100">{band.name}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isInstallable && (
                <div className="relative">
                  <button
                    onClick={handleInstall}
                    title="Instalar aplicativo"
                    className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
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
                      className="w-32 text-sm px-2 py-0.5 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900"
                    />
                    {suggestAccountName && (
                      <button
                        onClick={() => setNameValue(sessionName)}
                        className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                        title="Usar nome da sua conta"
                      >
                        Usar "{sessionName}"
                      </button>
                    )}
                    <button onClick={saveName} disabled={savingName} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">✓</button>
                    <button onClick={() => setEditingName(false)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                  </div>
                ) : (
                  <button onClick={startEdit} className="flex items-center gap-2 group min-w-0" title="Alterar seu nome na banda" aria-label={`Alterar seu nome na banda: ${currentMember.displayName}`}>
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: currentMember.color }} />
                    <span className="text-sm font-medium block max-w-[7rem] truncate">{currentMember.displayName}</span>
                    <span className="text-gray-400 group-hover:text-gray-600 text-xs transition-colors">✎</span>
                  </button>
                )
              ) : (
                <Link
                  href={`/join/${inviteCode}`}
                  className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  {joinLabel}
                </Link>
              )}
            </div>
          </div>

          <nav className="flex flex-wrap sm:flex-nowrap gap-1 -mb-px overflow-x-auto sm:scrollbar-none" aria-label="Seções da banda">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-3 sm:px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors ${
                    isActive
                      ? 'bg-gray-50 text-gray-900 border border-gray-200 border-b-gray-50 -mb-px dark:bg-gray-950 dark:text-gray-100 dark:border-gray-800 dark:border-b-gray-950'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300'
                  }`}
                >
                  {tab.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Guest/admin slot banner */}
      {!currentMember && isAdmin && (
        <div className="bg-blue-50 border-b border-blue-200 dark:bg-blue-950 dark:border-blue-900 px-4 py-2.5 text-center">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            Você administra esta banda.{' '}
            <Link href={`/join/${inviteCode}`} className="font-semibold underline">
              Escolha seu slot para participar dos ensaios e músicas →
            </Link>
          </p>
        </div>
      )}

      {!currentMember && !isAdmin && (
        <div className="bg-amber-50 border-b border-amber-200 dark:bg-amber-950 dark:border-amber-900 px-4 py-2.5 text-center">
          <p className="text-xs text-amber-800">
            Você está visualizando como <strong>convidado</strong>.{' '}
            <Link href={`/join/${inviteCode}`} className="font-semibold underline">
              Escolha seu slot para interagir →
            </Link>
          </p>
        </div>
      )}

      {/* Nudge: member but no account */}
      {currentMember && !session?.user && (
        <div className="bg-blue-50 border-b border-blue-200 dark:bg-blue-950 dark:border-blue-900 px-4 py-2.5 text-center">
          <p className="text-xs text-blue-800">
            Você está como <strong>{currentMember.displayName}</strong> neste dispositivo.{' '}
            <Link href="/auth/register" className="font-semibold underline">
              Crie uma conta para acessar de qualquer lugar →
            </Link>
          </p>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 dark:bg-gray-950">
        <BandContext.Provider value={{ band, currentMember, isAdmin: !!isAdmin, refetch: fetchBand }}>
          <div className="page-enter">
            {children}
          </div>
        </BandContext.Provider>
      </main>
    </div>
  )
}
