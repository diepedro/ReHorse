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
    <div className="party-bg flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-cyan-200 transition-colors hover:text-white">
            ← Voltar
          </Link>
          <h1 className="party-title text-4xl">Entrar</h1>
        </div>

        {/* Local account quick-access */}
        {localAccount && (
          <div className="party-card">
            <p className="party-subtle mb-2 text-xs font-bold">Conta salva neste dispositivo</p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-white">{localAccount.name}</span>
              <button
                onClick={handleLocal}
                disabled={loading}
                className="party-button px-3 py-1.5 text-xs"
              >
                {loading ? '...' : 'Continuar'}
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="party-segment flex">
          {(['email', 'recovery'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError('') }}
              className={`flex-1 text-sm ${
                tab === t ? 'party-segment-item party-segment-item-active' : 'party-segment-item hover:text-white'
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
              className="party-input w-full py-3"
            />
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className="party-input w-full py-3"
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              type="submit" disabled={!email.trim() || !password || loading}
              className="party-button w-full py-3"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRecovery} className="space-y-4">
            <input
              autoFocus type="text" value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="XXXXXX-XXXXXX-XXXXXX"
              className="party-input w-full py-3 font-mono tracking-wider"
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              type="submit" disabled={!code.trim() || loading}
              className="party-button w-full py-3"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        )}

        <p className="party-subtle text-center text-xs">
          Não tem conta?{' '}
          <Link href="/auth/register" className="font-bold text-cyan-200 transition-colors hover:text-white">
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
