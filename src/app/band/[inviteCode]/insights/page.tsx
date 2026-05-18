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
      <h2 className="text-lg font-semibold dark:text-gray-100">Análise</h2>
      <p className="text-sm text-gray-500 mb-6 dark:text-gray-400">Disponibilidade e presença dos membros nos ensaios.</p>

      {data.suggestions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 dark:bg-blue-950/30 dark:border-blue-900">
          <h3 className="text-sm font-semibold text-blue-800 mb-3 dark:text-blue-300">Sugestões pra você</h3>
          <ul className="space-y-2">
            {data.suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-blue-700 dark:text-blue-400">
                <span className="text-blue-400 dark:text-blue-500 mt-0.5">→</span>
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
          <div className="bg-white border border-gray-200 rounded-xl p-5 dark:bg-gray-900 dark:border-gray-800">
            <h3 className="text-sm font-semibold mb-4" style={{ color: currentMember.color }}>
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
        <div className="bg-white border border-gray-200 rounded-xl p-5 dark:bg-gray-900 dark:border-gray-800">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 dark:text-gray-100">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentMember.color }} />
            Para você, {currentMember.displayName}
          </h3>
          <ul className="space-y-2">
            {data.personal.map((insight, i) => (
              <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                <span className="text-gray-300 dark:text-gray-600 mt-0.5">•</span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.general.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 dark:bg-gray-900 dark:border-gray-800">
          <h3 className="text-sm font-semibold mb-3 dark:text-gray-100">Visão geral da banda</h3>
          <ul className="space-y-2">
            {data.general.map((insight, i) => (
              <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                <span className="text-gray-300 dark:text-gray-600 mt-0.5">•</span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasStats && data.personal.length === 0 && data.general.length === 0 && data.suggestions.length === 0 && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
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
    <div className="bg-white border border-gray-200 rounded-xl p-4 dark:bg-gray-900 dark:border-gray-800">
      <div className={`text-2xl font-bold ${color ?? 'text-gray-900 dark:text-gray-100'}`}>{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
        {label}
        {subtitle && <span className="text-gray-400 dark:text-gray-500"> {subtitle}</span>}
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
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>{label}</span>
        <span>{value}/{total} ({pct}%)</span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
