'use client'

import { useEffect, useState } from 'react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(Array.from(raw).map((c) => c.charCodeAt(0)))
}

export default function PushSubscriber() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return

    let timer: ReturnType<typeof setTimeout> | null = null

    function maybeShowPrompt() {
      const permission = Notification.permission

      if (permission === 'granted') {
        subscribeSilently()
        return
      }

      if (
        permission === 'default' &&
        localStorage.getItem('lgpd_ok') &&
        !localStorage.getItem('push_dismissed')
      ) {
        timer = setTimeout(() => setShowBanner(true), 4000)
      }
    }

    maybeShowPrompt()
    window.addEventListener('lgpd:accepted', maybeShowPrompt)

    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('lgpd:accepted', maybeShowPrompt)
    }
  }, [])

  async function subscribeSilently() {
    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) return

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })
      await saveSub(sub)
    } catch {
      // Browser permission or push setup can fail without blocking the app.
    }
  }

  async function requestAndSubscribe() {
    setShowBanner(false)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        localStorage.setItem('push_dismissed', '1')
        return
      }
      await subscribeSilently()
    } catch {
      // Ignore notification permission quirks.
    }
  }

  async function saveSub(sub: PushSubscription) {
    const json = sub.toJSON()
    await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
    })
  }

  function dismiss() {
    localStorage.setItem('push_dismissed', '1')
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-16 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 bg-gray-900 border border-gray-700 rounded-2xl p-4 shadow-xl">
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0">🔔</span>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold">Ativar notificações</p>
          <p className="text-gray-400 text-xs mt-1">
            Saiba quando chegam sugestões, votações e lembretes de ensaio.
          </p>
        </div>
        <button onClick={dismiss} className="text-gray-500 hover:text-gray-300 text-lg leading-none shrink-0" aria-label="Fechar notificações">×</button>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={dismiss} className="text-xs text-gray-500 hover:text-gray-300 px-2">
          Agora não
        </button>
        <button
          onClick={requestAndSubscribe}
          className="text-xs bg-white text-gray-900 font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Ativar
        </button>
      </div>
    </div>
  )
}
