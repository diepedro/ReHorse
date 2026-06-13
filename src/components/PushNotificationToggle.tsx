'use client'

import { useEffect, useState } from 'react'
import { readClientStorage } from '@/lib/client-storage'

export default function PushNotificationToggle() {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if ('Notification' in window && 'serviceWorker' in navigator) {
      setSupported(true)
      setPermission(Notification.permission)
      // Check if already subscribed
      navigator.serviceWorker.ready.then((reg) =>
        reg.pushManager.getSubscription().then((sub) => setSubscribed(!!sub))
      )
    }
  }, [])

  async function subscribe() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') { setLoading(false); return }

      // VAPID public key — set via env var NEXT_PUBLIC_VAPID_PUBLIC_KEY
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) { setLoading(false); return }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sub.toJSON(), ...getBandMemberContext() }),
      })
      setSubscribed(true)
    } catch (e) {
      console.error('Push subscribe error:', e)
    }
    setLoading(false)
  }

  async function unsubscribe() {
    setLoading(true)
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await fetch('/api/push', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      })
      await sub.unsubscribe()
    }
    setSubscribed(false)
    setLoading(false)
  }

  if (!supported) return null

  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-gray-900">Notificações push</p>
        <p className="text-xs text-gray-500">
          {permission === 'denied' ? 'Bloqueado pelo navegador' : subscribed ? 'Ativo' : 'Receba avisos de ensaios e novidades'}
        </p>
      </div>
      {permission !== 'denied' && (
        <button
          onClick={subscribed ? unsubscribe : subscribe}
          disabled={loading}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
            subscribed
              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              : 'bg-gray-900 text-white hover:bg-gray-700'
          } disabled:opacity-40`}
        >
          {loading ? '...' : subscribed ? 'Desativar' : 'Ativar'}
        </button>
      )}
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

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i)
  }
  return output.buffer
}
