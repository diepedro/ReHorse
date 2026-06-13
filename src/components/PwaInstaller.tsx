'use client'

import { useEffect, useRef, useState } from 'react'
import { readClientStorage, writeClientStorage } from '@/lib/client-storage'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isMobile() {
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent) || window.innerWidth < 768
}

function isInStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (('standalone' in window.navigator) && (window.navigator as { standalone?: boolean }).standalone === true)
  )
}

export default function PwaInstaller() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIos, setShowIos] = useState(false)
  const [visits, setVisits] = useState(0)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const refreshingRef = useRef(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(registration.waiting)
        }

        registration.addEventListener('updatefound', () => {
          const nextWorker = registration.installing
          if (!nextWorker) return

          nextWorker.addEventListener('statechange', () => {
            if (nextWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(nextWorker)
            }
          })
        })
      }).catch(() => {})

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshingRef.current) return
        refreshingRef.current = true
        window.location.reload()
      })
    }

    if (readClientStorage('pwa_dismissed')) return
    if (isInStandaloneMode()) return

    const v = parseInt(readClientStorage('pwa_visits') ?? '0', 10) + 1
    writeClientStorage('pwa_visits', String(v))
    setVisits(v)

    if (isIos() && isMobile() && v >= 1) {
      setShowIos(true)
      return
    }

    const handler = (event: Event) => {
      event.preventDefault()
      setPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    writeClientStorage('pwa_dismissed', '1')
    setPrompt(null)
    setShowIos(false)
  }

  async function install() {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setPrompt(null)
  }

  function applyUpdate() {
    waitingWorker?.postMessage({ type: 'SKIP_WAITING' })
  }

  if (waitingWorker) {
    return (
      <div className="fixed bottom-24 left-3 right-3 z-40 flex items-center gap-3 rounded-lg border border-white/10 bg-slate-950/95 p-3 shadow-xl backdrop-blur sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xs font-bold text-white">RH</span>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold">Atualização disponível</p>
          <p className="text-gray-400 text-xs">Recarregue para usar a versão mais recente.</p>
        </div>
        <button
          onClick={applyUpdate}
          className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100"
        >
          Atualizar
        </button>
      </div>
    )
  }

  if (showIos) {
    return (
      <div className="fixed bottom-24 left-3 right-3 z-40 rounded-lg border border-white/10 bg-slate-950/95 p-3 shadow-xl backdrop-blur sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xs font-bold text-white">RH</span>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold">Instalar ReHorse</p>
            <p className="text-gray-400 text-xs mt-1">
              Toque em <strong className="text-gray-200">Compartilhar</strong> e depois em{' '}
              <strong className="text-gray-200">Adicionar à Tela de Início</strong>.
            </p>
          </div>
          <button onClick={dismiss} className="text-gray-500 hover:text-gray-300 text-lg leading-none shrink-0">×</button>
        </div>
      </div>
    )
  }

  if (!prompt || visits < (isMobile() ? 1 : 2)) return null

  return (
    <div className="fixed bottom-24 left-3 right-3 z-40 flex items-center gap-3 rounded-lg border border-white/10 bg-slate-950/95 p-3 shadow-xl backdrop-blur sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xs font-bold text-white">RH</span>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold">Instalar ReHorse</p>
        <p className="text-gray-400 text-xs">Acesse direto da tela inicial.</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={dismiss} className="text-xs text-gray-500 hover:text-gray-300 px-2">Agora não</button>
        <button onClick={install} className="text-xs bg-white text-gray-900 font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">Instalar</button>
      </div>
    </div>
  )
}
