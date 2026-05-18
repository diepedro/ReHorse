'use client'

import { createContext, useContext } from 'react'
import type { Band, BandMember } from '@/lib/types'

interface BandContextValue {
  band: Band
  currentMember: BandMember | null
  isAdmin: boolean
  refetch: () => void
}

export const BandContext = createContext<BandContextValue | null>(null)

export function useBand() {
  const ctx = useContext(BandContext)
  if (!ctx) throw new Error('useBand must be used inside BandLayout')
  return ctx
}
