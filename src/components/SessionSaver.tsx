'use client'

import { useSession } from 'next-auth/react'
import { useEffect } from 'react'

export default function SessionSaver() {
  const { data: session } = useSession()

  useEffect(() => {
    if (session?.user?.id) {
      const existing = localStorage.getItem('creator_id')
      const dismissed = localStorage.getItem('absorb_dismissed')
      // Don't recreate creator_id if user already dismissed or completed the absorb flow.
      // Only set if no prior account stored, or it matches current session.
      if (!dismissed && (!existing || existing === session.user.id)) {
        localStorage.setItem('creator_id', session.user.id)
        localStorage.setItem('creator_name', session.user.name ?? '')
      }
    }
  }, [session])

  return null
}
