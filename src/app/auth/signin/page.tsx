'use client'

import { Suspense, useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

type Tab = 'email' | 'recovery'

function SignInForm() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard'

  const [tab, setTab] = useState<Tab>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [localAccount, setLocalAccount] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    const id = localStorage.getItem('creator_id')
    const name = localStorage.getItem('creator_name')
    if (id && name) setLocalAccount({ id, name })
  }, [])

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await signIn('email-password', { email: email.trim(), password, callbackUrl, redirect: false })
    if (result?.error) { setError('E-mail ou senha incorretos.'); setLoading(false) }
    else if (result?.url) { window.location.href = result.url }
  }

  async function handleRecovery(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await signIn('recovery-code', { code: code.trim(), callbackUrl, redirect: false })
    if (result?.error) { setError('Código inválido.'); setLoading(false) }
    else if (result?.url) { window.location.href = result.url }
  }

  async function handleLocal() {
    if (!localAccount) return
    setLoading(true)
    const result = await signIn('anonymous', { existingId: localAccount.id, callbackUrl, redirect: false })
    if (result?.error) {
      localStorage.removeItem('creator_id'); localStorage.removeItem('creator_name')
      setLocalAccount(null); setLoading(false)
    } else if (result?.url) { window.location.href = result.url }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 text-gray-400 hover:text-white text-sm transition-colors">
            ← Voltar
          </Link>
          <h1 className="text-2xl font-bold text-white">Entrar</h1>
        </div>

        {/* Local account quick-access */}
        {localAccount && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">Conta salva neste dispositivo</p>
            <div className="flex items-center justify-between">
              <span className="text-white text-sm font-medium">{localAccount.name}</span>
              <button
                onClick={handleLocal}
                disabled={loading}
                className="text-xs px-3 py-1.5 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"
              >
                {loading ? '...' : 'Continuar'}
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          {(['email', 'recovery'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError('') }}
              className={`flex-1 pb-2.5 text-sm font-medium transition-colors ${
                tab === t ? 'text-white border-b-2 border-white -mb-px' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'email' ? 'E-mail e senha' : 'Código de recuperação'}
            </button>
          ))}
        </div>

        {tab === 'email' ? (
          <form onSubmit={handleEmail} className="space-y-4">
            <input
              autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20 text-sm"
            />
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20 text-sm"
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              type="submit" disabled={!email.trim() || !password || loading}
              className="w-full px-6 py-3 rounded-xl bg-white text-gray-900 font-semibold text-sm hover:bg-gray-100 disabled:opacity-40 transition-colors"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRecovery} className="space-y-4">
            <input
              autoFocus type="text" value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="XXXXXX-XXXXXX-XXXXXX"
              className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20 text-sm font-mono tracking-wider"
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              type="submit" disabled={!code.trim() || loading}
              className="w-full px-6 py-3 rounded-xl bg-white text-gray-900 font-semibold text-sm hover:bg-gray-100 disabled:opacity-40 transition-colors"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-gray-600">
          Não tem conta?{' '}
          <Link href="/auth/register" className="text-gray-400 hover:text-white transition-colors">
            Criar conta →
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}
