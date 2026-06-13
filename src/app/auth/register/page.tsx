'use client'

import { Suspense, useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import BrandMark from '@/components/BrandMark'

interface LocalBand {
  inviteCode: string
  bandName: string
  memberName: string
  memberId: string
}

type Step = 'form' | 'code' | 'merge'

function RegisterForm() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard'

  const [step, setStep] = useState<Step>('form')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [userId, setUserId] = useState('')
  const [hasEmail, setHasEmail] = useState(false)
  const [localBands, setLocalBands] = useState<LocalBand[]>([])
  const [selectedMerge, setSelectedMerge] = useState<Set<string>>(new Set())
  const [merging, setMerging] = useState(false)

  useEffect(() => {
    const found: LocalBand[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith('band_') || key.startsWith('band_name_')) continue
      const inviteCode = key.slice(5)
      const memberId = localStorage.getItem(key) ?? ''
      found.push({
        inviteCode,
        bandName: localStorage.getItem(`band_name_${inviteCode}`) ?? inviteCode,
        memberName: localStorage.getItem(`member_name_${inviteCode}`) ?? 'Membro',
        memberId,
      })
    }
    setLocalBands(found)
    setSelectedMerge(new Set(found.map((b) => b.memberId)))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) return
    if (email.trim() && !password.trim()) {
      setError('Informe uma senha para usar com o e-mail.')
      return
    }
    setLoading(true)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim() || undefined,
        password: password || undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Erro ao criar conta.'); setLoading(false); return }
    setRecoveryCode(data.recoveryCode)
    setUserId(data.userId)
    setHasEmail(!!email.trim())
    setStep('code')
    setLoading(false)
  }

  async function handleContinueFromCode() {
    const result = await signIn('anonymous', { existingId: userId, redirect: false })
    if (result?.error) { setError('Erro ao entrar. Use o código de recuperação.'); return }
    if (localBands.length > 0) {
      setStep('merge')
    } else {
      window.location.href = callbackUrl
    }
  }

  async function handleMerge() {
    setMerging(true)
    if (selectedMerge.size > 0) {
      await fetch('/api/auth/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberIds: Array.from(selectedMerge) }),
      })
    }
    window.location.href = callbackUrl
  }

  async function copyCode() {
    await navigator.clipboard.writeText(recoveryCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  if (step === 'form') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 px-4">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center">
            <Link href="/" className="inline-flex items-center gap-2 mb-6 text-gray-400 hover:text-white text-sm transition-colors">
              ← Voltar
            </Link>
            <h1 className="text-2xl font-bold text-white">Criar conta</h1>
            <p className="text-gray-500 text-sm mt-2">Gerencie suas bandas de qualquer dispositivo.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                Nome <span className="text-red-400">*</span>
              </label>
              <input
                autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Como você quer ser chamado" maxLength={40}
                className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                E-mail <span className="text-gray-600">(opcional — para recuperar senha)</span>
              </label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20 text-sm"
              />
            </div>

            {email.trim() && (
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">
                  Senha <span className="text-red-400">*</span>
                </label>
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20 text-sm"
                />
              </div>
            )}

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <button
              type="submit" disabled={!name.trim() || loading}
              className="w-full px-6 py-3 rounded-xl bg-white text-gray-900 font-semibold text-sm hover:bg-gray-100 disabled:opacity-40 transition-colors"
            >
              {loading ? 'Criando...' : 'Criar conta'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-600">
            Já tem conta?{' '}
            <Link href="/auth/signin" className="text-gray-400 hover:text-white transition-colors">
              Entrar →
            </Link>
          </p>
        </div>
      </div>
    )
  }

  if (step === 'code') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="text-4xl mb-4">🔑</div>
            <h1 className="text-2xl font-bold text-white">Código de recuperação</h1>
            <p className="text-gray-400 text-sm mt-2">
              Use este código para acessar sua conta de qualquer dispositivo.
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 text-center space-y-4">
            <p className="font-mono text-lg font-bold text-white tracking-widest">{recoveryCode}</p>
            <button
              onClick={copyCode}
              className={`text-sm px-4 py-2 rounded-lg transition-colors ${
                copied ? 'bg-emerald-900/50 text-emerald-400' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {copied ? '✓ Copiado!' : 'Copiar código'}
            </button>
          </div>

          {!hasEmail ? (
            <div className="bg-amber-950/50 border border-amber-800/50 rounded-xl p-4">
              <p className="text-xs text-amber-400">
                ⚠️ Você não cadastrou e-mail. Este código é a única forma de recuperar sua conta em outro dispositivo. Guarde-o em um lugar seguro.
              </p>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-400">
                💡 Você poderá entrar com e-mail e senha, ou usar este código como alternativa.
              </p>
            </div>
          )}

          {error && <p className="text-red-400 text-xs text-center">{error}</p>}

          <button
            onClick={handleContinueFromCode}
            className="w-full px-6 py-3 rounded-xl bg-white text-gray-900 font-semibold text-sm hover:bg-gray-100 transition-colors"
          >
            Já salvei — Continuar
          </button>
        </div>
      </div>
    )
  }

  // step === 'merge'
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <BrandMark size="lg" className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">Vincular bandas</h1>
          <p className="text-gray-400 text-sm mt-2">
            Encontramos bandas que você acessou neste dispositivo. Selecione quais vincular à sua nova conta.
          </p>
        </div>

        <div className="space-y-2">
          {localBands.map((b) => (
            <label
              key={b.memberId}
              className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                selectedMerge.has(b.memberId)
                  ? 'bg-gray-800 border-gray-600'
                  : 'bg-gray-900 border-gray-800 opacity-60'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedMerge.has(b.memberId)}
                onChange={(e) => {
                  setSelectedMerge((prev) => {
                    const next = new Set(prev)
                    e.target.checked ? next.add(b.memberId) : next.delete(b.memberId)
                    return next
                  })
                }}
                className="w-4 h-4 accent-white"
              />
              <div>
                <p className="text-white text-sm font-medium">{b.memberName}</p>
                <p className="text-gray-500 text-xs">{b.bandName}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="space-y-2">
          <button
            onClick={handleMerge}
            disabled={merging}
            className="w-full px-6 py-3 rounded-xl bg-white text-gray-900 font-semibold text-sm hover:bg-gray-100 disabled:opacity-40 transition-colors"
          >
            {merging
              ? 'Vinculando...'
              : selectedMerge.size > 0
              ? `Vincular ${selectedMerge.size} banda${selectedMerge.size > 1 ? 's' : ''}`
              : 'Continuar sem vincular'}
          </button>
          {selectedMerge.size > 0 && (
            <button
              onClick={() => { setSelectedMerge(new Set()); window.location.href = callbackUrl }}
              className="w-full text-xs text-gray-600 hover:text-gray-400 transition-colors py-1"
            >
              Pular — não vincular nenhuma
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}
