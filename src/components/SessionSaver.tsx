'use client'

import { useSession } from 'next-auth/react'
import { useEffect } from 'react'
import { readClientStorage, writeClientStorage } from '@/lib/client-storage'

export default function SessionSaver() {
  const { data: session } = useSession()

  useEffect(() => {
    if (session?.user?.id) {
      const existing = readClientStorage('creator_id')
      const dismissed = readClientStorage('absorb_dismissed')
      // Don't recreate creator_id if user already dismissed or completed the absorb flow.
      // Only set if no prior account stored, or it matches current session.
      if (!dismissed && (!existing || existing === session.user.id)) {
        writeClientStorage('creator_id', session.user.id)
        writeClientStorage('creator_name', session.user.name ?? '')
      }
    }
  }, [session])

  return null
}
