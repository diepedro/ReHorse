'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PushNotificationToggle from '@/components/PushNotificationToggle'

interface Me {
  id: string
  name: string
  email: string | null
  recoveryCode: string | null
  hasPassword: boolean
}

export default function PerfilPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.ok ? r.json() : null).then(setMe)
  }, [])

  async function deleteAccount() {
    setDeleting(true)
    const res = await fetch('/api/auth/me', { method: 'DELETE' })
    if (res.ok) {
      localStorage.clear()
      signOut({ callbackUrl: '/' })
    } else {
      setDeleting(false)
    }
  }

  function copyCode() {
    if (!me?.recoveryCode) return
    try {
      const el = document.createElement('input')
      el.value = me.recoveryCode
      el.style.cssText = 'position:fixed;top:0;left:0;opacity:0.01'
      document.body.appendChild(el)
      el.focus(); el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    } catch { navigator.clipboard?.writeText(me.recoveryCode) }
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Link href="/auth/signin" className="text-blue-600 hover:underline text-sm">Entrar →</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">← Dashboard</Link>
          <span className="font-semibold text-sm dark:text-gray-100">Meu perfil</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Account info */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 dark:bg-gray-900 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Conta</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Nome</span>
              <span className="font-medium dark:text-gray-100">{me?.name ?? session.user.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">E-mail</span>
              <span className="font-medium dark:text-gray-100">{me?.email ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Senha</span>
              <span className="text-gray-400 dark:text-gray-500 text-xs">{me?.hasPassword ? 'Definida' : 'Não definida'}</span>
            </div>
          </div>
        </div>

        {/* Recovery code */}
        {me?.recoveryCode && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 dark:bg-gray-900 dark:border-gray-800">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Código de recuperação</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Use para acessar sua conta em outro dispositivo ou se esquecer a senha.</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3 dark:bg-gray-800 dark:border-gray-700">
              <code className="font-mono text-sm tracking-widest text-gray-900 dark:text-gray-100">{me.recoveryCode}</code>
              <button onClick={copyCode} className="text-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 shrink-0 transition-colors">
                {copiedCode ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400">⚠ Guarde em lugar seguro. Não é possível recuperá-lo se perder.</p>
          </div>
        )}

        {/* Notifications */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 dark:bg-gray-900 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notificações</h2>
          <PushNotificationToggle />
        </div>

        {/* Danger zone */}
        <div className="bg-white border border-red-100 rounded-xl p-5 space-y-3 dark:bg-gray-900 dark:border-red-900/50">
          <h2 className="text-sm font-semibold text-red-600 dark:text-red-400">Zona de perigo</h2>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-sm px-4 py-2 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              Excluir conta
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-red-600 dark:text-red-400">Isso vai excluir sua conta e todos os dados. Bandas criadas por você também serão excluídas.</p>
              <div className="flex gap-2">
                <button onClick={deleteAccount} disabled={deleting} className="text-sm px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
                  {deleting ? 'Excluindo...' : 'Sim, excluir'}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="text-sm px-4 py-2 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
