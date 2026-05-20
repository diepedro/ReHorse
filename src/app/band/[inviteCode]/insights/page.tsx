'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useBand } from '@/contexts/BandContext'
import BandHistoryPanel from '@/components/BandHistoryPanel'

interface InsightsData {
  personal: string[]
  general: string[]
  suggestions: string[]
  stats: {
    totalSongs: number
    songsFull: number
    songsPartial: number
    songsNone: number
    availCount: number
  } | null
}

export default function InsightsPage() {
  const { inviteCode } = useParams() as { inviteCode: string }
  const { currentMember } = useBand()
  const [data, setData] = useState<InsightsData | null>(null)

  const fetchInsights = useCallback(async () => {
    if (!currentMember) return
    const res = await fetch(`/api/bands/${inviteCode}/insights?memberId=${currentMember.id}`)
    if (res.ok) setData(await res.json())
  }, [inviteCode, currentMember])

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  if (!currentMember) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">
        Entre como membro para ver sua análise.
      </div>
    )
  }

  if (!data) return null

  const hasStats = data.stats !== null && data.stats.totalSongs > 0
  const totalSongs = data.stats?.totalSongs ?? 0
  const fullPct = totalSongs > 0 ? Math.round((data.stats!.songsFull / totalSongs) * 100) : 0
  const partialPct = totalSongs > 0 ? Math.round((data.stats!.songsPartial / totalSongs) * 100) : 0

  return (
    <div className="space-y-6">
      <h2 className="party-title text-2xl">Análise</h2>
      <p className="party-subtle mb-6 text-sm">Disponibilidade e presença dos membros nos ensaios.</p>

      {data.suggestions.length > 0 && (
        <div className="party-card border-cyan-300/30">
          <h3 className="mb-3 text-sm font-black text-cyan-200">Sugestões pra você</h3>
          <ul className="space-y-2">
            {data.suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-indigo-100">
                <span className="mt-0.5 text-yellow-300">→</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stats */}
      {hasStats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Músicas" value={data.stats!.totalSongs} />
            <StatCard label="Tiradas" value={data.stats!.songsFull} subtitle={`de ${totalSongs}`} color="text-emerald-600" />
            <StatCard label="Parcial" value={data.stats!.songsPartial} color="text-amber-600" />
            <StatCard label="Dias livres" value={data.stats!.availCount} color="text-blue-600" />
          </div>

          {/* Progress bars */}
          <div className="party-card">
            <h3 className="mb-4 text-sm font-black" style={{ color: currentMember.color }}>
              Seu progresso
            </h3>
            <div className="space-y-3">
              <ProgressRow
                label="Tiradas"
                value={data.stats!.songsFull}
                total={totalSongs}
                color={currentMember.color}
              />
              <ProgressRow
                label="Parcial"
                value={data.stats!.songsPartial}
                total={totalSongs}
                color="#F59E0B"
              />
            </div>
          </div>
        </>
      )}

      {data.personal.length > 0 && (
        <div className="party-card">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-white">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentMember.color }} />
            Para você, {currentMember.displayName}
          </h3>
          <ul className="space-y-2">
            {data.personal.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-indigo-100">
                <span className="mt-0.5 text-yellow-300">•</span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.general.length > 0 && (
        <div className="party-card">
          <h3 className="mb-3 text-sm font-black text-white">Visão geral da banda</h3>
          <ul className="space-y-2">
            {data.general.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-indigo-100">
                <span className="mt-0.5 text-cyan-300">•</span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasStats && data.personal.length === 0 && data.general.length === 0 && data.suggestions.length === 0 && (
        <div className="party-card text-center py-12 text-indigo-200">
          Nenhum dado disponível ainda — comece preenchendo as outras abas!
        </div>
      )}

      <BandHistoryPanel inviteCode={inviteCode} title="Historico recente da banda" />
    </div>
  )
}

function StatCard({ label, value, subtitle, color }: {
  label: string; value: number; subtitle?: string; color?: string
}) {
  return (
    <div className="party-card relative overflow-hidden p-4">
      <div className="absolute -right-5 -top-6 h-16 w-16 rounded-full bg-pink-500/15" />
      <div className={`relative text-3xl font-black ${color ?? 'text-white'}`}>{value}</div>
      <div className="party-subtle relative mt-0.5 text-xs font-bold">
        {label}
        {subtitle && <span className="text-indigo-200/70"> {subtitle}</span>}
      </div>
    </div>
  )
}

function ProgressRow({ label, value, total, color }: {
  label: string; value: number; total: number; color: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs font-bold text-indigo-100">
        <span>{label}</span>
        <span>{value}/{total} ({pct}%)</span>
      </div>
      <div className="party-progress-track">
        <div
          className="party-progress-fill"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
