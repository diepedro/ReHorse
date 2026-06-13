'use client'

import { useCallback, useEffect, useState } from 'react'
import { readClientStorage } from '@/lib/client-storage'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(Array.from(raw).map((c) => c.charCodeAt(0)))
}

export default function PushSubscriber() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [requesting, setRequesting] = useState(false)

  const saveSub = useCallback(async (sub: PushSubscription) => {
    const json = sub.toJSON()
    const context = getBandMemberContext()
    await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys, ...context }),
    })
  }, [])

  const subscribeSilently = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        await saveSub(existing)
        setShowPrompt(false)
        return
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })
      await saveSub(sub)
      setShowPrompt(false)
    } catch {
      // Browser permission or push setup can fail without blocking the app.
    }
  }, [saveSub])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (!('Notification' in window)) return
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return

    let cancelled = false

    function syncPromptState() {
      if (cancelled) return

      if (Notification.permission === 'granted') {
        subscribeSilently()
        return
      }

      if (Notification.permission === 'default' && readClientStorage('lgpd_ok')) {
        setShowPrompt(true)
      } else {
        setShowPrompt(false)
      }
    }

    syncPromptState()
    window.addEventListener('lgpd:accepted', syncPromptState)
    window.addEventListener('focus', syncPromptState)

    return () => {
      cancelled = true
      window.removeEventListener('lgpd:accepted', syncPromptState)
      window.removeEventListener('focus', syncPromptState)
    }
  }, [subscribeSilently])

  async function requestAndSubscribe() {
    setRequesting(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        await subscribeSilently()
      } else {
        setShowPrompt(false)
      }
    } catch {
      setShowPrompt(false)
    } finally {
      setRequesting(false)
    }
  }

  if (!showPrompt) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 px-4 py-5 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-permission-title"
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-200">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M10 2a6 6 0 00-6 6v2.586l-.707.707A1 1 0 004 13h12a1 1 0 00.707-1.707L16 10.586V8a6 6 0 00-6-6z" />
              <path d="M10 18a3 3 0 002.83-2H7.17A3 3 0 0010 18z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="push-permission-title" className="text-base font-semibold text-slate-950 dark:text-slate-100">
              Ative as notificacoes
            </h2>
            <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
              Assim a banda recebe avisos quando entram sugestoes, nudges e lembretes de ensaio.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={requestAndSubscribe}
            disabled={requesting}
            className="party-button w-full justify-center"
          >
            {requesting ? 'Ativando...' : 'Ativar notificacoes'}
          </button>
          <button
            type="button"
            onClick={() => setShowPrompt(false)}
            disabled={requesting}
            className="party-button-secondary w-full justify-center"
          >
            Continuar sem notificacoes
          </button>
        </div>
      </div>
    </div>
  )
}

function getBandMemberContext() {
  const inviteCode = readClientStorage('last_band')
  if (!inviteCode) return {}

  const memberId = readClientStorage(`band_${inviteCode}`)
  if (!memberId) return {}

  return { inviteCode, memberId }
}
