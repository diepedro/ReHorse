'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

interface BandEntry {
  inviteCode: string
  bandName: string
  memberName: string | null
}

export default function LandingPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [code, setCode] = useState('')
  const [bands, setBands] = useState<BandEntry[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const found: BandEntry[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith('band_') || key.startsWith('band_name_')) continue
      const inviteCode = key.slice(5)
      found.push({
        inviteCode,
        bandName: localStorage.getItem(`band_name_${inviteCode}`) ?? inviteCode,
        memberName: localStorage.getItem(`member_name_${inviteCode}`),
      })
    }
    const last = localStorage.getItem('last_band')
    found.sort((a, b) => (a.inviteCode === last ? -1 : b.inviteCode === last ? 1 : 0))
    setBands(found)
    setReady(true)
  }, [])

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim()
    if (trimmed) router.push(`/join/${trimmed}`)
  }

  if (!ready || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-6 h-6 border-2 border-gray-700 border-t-gray-300 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-10">
        {/* Brand */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 mb-4">
            <span className="text-4xl">🎸</span>
            <h1 className="text-4xl font-bold tracking-tight text-white">ReHorse</h1>
          </div>
          <p className="text-gray-400 text-sm">Coordene ensaios, músicas e disponibilidade da banda.</p>
        </div>

        <div className="space-y-4">
          {/* Joined bands from this device — only for users without an account */}
          {!session?.user && bands.length > 0 && (
            <div className="space-y-2">
              {bands.map((b, i) => (
                <button
                  key={b.inviteCode}
                  onClick={() => router.push(`/band/${b.inviteCode}/rehearsals`)}
                  className="block w-full text-left px-5 py-3.5 rounded-xl bg-gray-800 border border-gray-700 hover:border-gray-500 transition-colors"
                >
                  <p className="text-xs text-gray-500 mb-0.5">{i === 0 ? 'Continuar como' : 'Também entrar como'}</p>
                  <p className="text-white font-semibold text-sm">
                    {b.memberName ?? 'Visitante'} · {b.bandName}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Account section */}
          {session?.user ? (
            <Link
              href="/dashboard"
              className="block w-full text-center px-6 py-3.5 rounded-xl bg-white text-gray-900 font-semibold text-sm hover:bg-gray-100 transition-colors"
            >
              Minhas bandas ({session.user.name})
            </Link>
          ) : (
            <div className="flex gap-2">
              <Link
                href="/auth/register"
                className="flex-1 text-center px-4 py-3 rounded-xl bg-white text-gray-900 font-semibold text-sm hover:bg-gray-100 transition-colors"
              >
                Criar conta
              </Link>
              <Link
                href="/auth/signin"
                className="flex-1 text-center px-4 py-3 rounded-xl border border-gray-700 text-gray-300 text-sm hover:border-gray-500 hover:text-white transition-colors"
              >
                Entrar
              </Link>
            </div>
          )}

          {/* Join via invite code */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-gray-950 px-3 text-gray-500">ou entre com convite</span>
            </div>
          </div>

          <form onSubmit={handleJoin} className="space-y-3">
            <input
              type="text" value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="Código do convite (ex: REHORSE-1234)"
              className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20 text-sm"
            />
            <button
              type="submit" disabled={!code.trim()}
              className="w-full px-6 py-3 rounded-xl bg-gray-800 text-white font-medium text-sm hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Entrar na banda
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
