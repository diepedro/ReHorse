'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import type { Band, BandMember } from '@/lib/types'

export default function JoinPage() {
  const params = useParams()
  const router = useRouter()
  const inviteCode = params.inviteCode as string

  const [band, setBand] = useState<Band | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [error, setError] = useState('')

  const storageKey = `band_${inviteCode}`

  const fetchBand = useCallback(async () => {
    const res = await fetch(`/api/bands/${inviteCode}`)
    if (!res.ok) {
      setError('Banda não encontrada. Verifique o link.')
      setLoading(false)
      return
    }
    const data: Band = await res.json()
    setBand(data)
    setLoading(false)
  }, [inviteCode])

  useEffect(() => {
    // If already claimed a slot in this band, go directly to it
    const existing = localStorage.getItem(storageKey)
    if (existing) {
      router.replace(`/band/${inviteCode}/rehearsals`)
      return
    }
    fetchBand()
  }, [fetchBand, inviteCode, storageKey, router])

  async function claimSlot(member: BandMember) {
    setClaiming(member.id)

    const res = await fetch(`/api/bands/${inviteCode}/members/${member.id}/claim`, {
      method: 'POST',
    })

    if (!res.ok) {
      setError('Não foi possível entrar. Tente novamente.')
      setClaiming(null)
      return
    }

    localStorage.setItem(storageKey, member.id)
    localStorage.setItem(`member_name_${inviteCode}`, member.displayName)
    router.push(`/band/${inviteCode}/rehearsals`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-6 h-6 border-2 border-gray-700 border-t-gray-300 rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !band) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 px-4">
        <p className="text-red-400 text-sm mb-4">{error || 'Banda não encontrada.'}</p>
        <Link href="/" className="text-gray-400 hover:text-white text-sm transition-colors">
          ← Voltar ao início
        </Link>
      </div>
    )
  }

  const sortedMembers = [...band.members].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Band info */}
        <div className="text-center">
          <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Convite para</p>
          <h1 className="text-3xl font-bold text-white">{band.name}</h1>
          <p className="text-gray-400 text-sm mt-2">Quem é você nessa banda?</p>
          <p className="text-gray-600 text-xs mt-1">
            {band.members.filter(m => m.claimed).length} de {band.members.length} slot{band.members.length !== 1 ? 's' : ''} ocupado{band.members.filter(m => m.claimed).length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Member slots */}
        <div className="grid grid-cols-2 gap-3">
          {sortedMembers.map((member) => (
            <button
              key={member.id}
              onClick={() => claimSlot(member)}
              disabled={claiming !== null}
              className={`relative rounded-xl p-5 text-center transition-all ${
                claiming === member.id
                  ? 'scale-95 opacity-70'
                  : 'hover:scale-105 hover:shadow-lg active:scale-95 cursor-pointer'
              }`}
              style={{ backgroundColor: member.claimed ? '#1f2937' : member.color }}
            >
              <span className={`block font-semibold text-lg ${member.claimed ? 'text-gray-400' : 'text-white'}`}>
                {member.displayName}
              </span>
              {member.claimed && claiming !== member.id && (
                <span className="block text-xs text-gray-500 mt-1">clique para entrar</span>
              )}
              {claiming === member.id && (
                <span className="block text-xs text-white/70 mt-1">entrando...</span>
              )}
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-gray-600">
          Sua identidade fica salva neste navegador.
        </p>
      </div>
    </div>
  )
}
