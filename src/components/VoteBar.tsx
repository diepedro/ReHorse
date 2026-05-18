'use client'

import type { BandMember } from '@/lib/types'

interface VoteBarProps {
  members: BandMember[]
  votes: Record<string, string>
}

export default function VoteBar({ members, votes }: VoteBarProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {members.map((m) => {
        const vote = votes[m.id]
        return (
          <div key={m.id} className="flex items-center gap-1" title={`${m.displayName}: ${vote === 'yes' ? 'sim' : vote === 'no' ? 'não' : 'sem voto'}`}>
            <span
              className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-bold transition-all"
              style={
                vote === 'yes'
                  ? { backgroundColor: m.color, borderColor: m.color, color: '#fff' }
                  : vote === 'no'
                  ? { backgroundColor: 'transparent', borderColor: m.color, color: m.color }
                  : { backgroundColor: 'transparent', borderColor: '#D1D5DB', color: '#9CA3AF' }
              }
            >
              {vote === 'yes' ? '✓' : vote === 'no' ? '✕' : '?'}
            </span>
            <span className="text-xs text-gray-400 hidden sm:block">{m.displayName}</span>
          </div>
        )
      })}
    </div>
  )
}
