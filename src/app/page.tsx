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
      <div className="party-bg flex min-h-screen items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-700 border-t-gray-300 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="party-bg flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-10">
        {/* Brand */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 mb-4">
            <span className="text-4xl">🎸</span>
            <h1 className="party-title text-5xl">ReHorse</h1>
          </div>
          <p className="party-subtle text-sm">Coordene ensaios, músicas e disponibilidade da banda.</p>
        </div>

        <div className="space-y-4">
          {/* Joined bands from this device — only for users without an account */}
          {!session?.user && bands.length > 0 && (
            <div className="space-y-2">
              {bands.map((b, i) => (
                <button
                  key={b.inviteCode}
                  onClick={() => router.push(`/band/${b.inviteCode}/rehearsals`)}
                  className="party-card block w-full text-left px-5 py-3.5"
                >
                  <p className="party-subtle mb-0.5 text-xs">{i === 0 ? 'Continuar como' : 'Também entrar como'}</p>
                  <p className="text-sm font-black text-white">
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
              className="party-button block w-full text-center py-3.5"
            >
              Minhas bandas ({session.user.name})
            </Link>
          ) : (
            <div className="flex gap-2">
              <Link
                href="/auth/register"
                className="party-button flex-1 text-center py-3"
              >
                Criar conta
              </Link>
              <Link
                href="/auth/signin"
                className="party-button-secondary flex-1 text-center py-3"
              >
                Entrar
              </Link>
            </div>
          )}

          {/* Join via invite code */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/12" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#080914] px-3 text-indigo-200/70">ou entre com convite</span>
            </div>
          </div>

          <form onSubmit={handleJoin} className="space-y-3">
            <input
              type="text" value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="Código do convite (ex: REHORSE-1234)"
              className="party-input w-full py-3"
            />
            <button
              type="submit" disabled={!code.trim()}
              className="party-button-secondary w-full py-3"
            >
              Entrar na banda
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
