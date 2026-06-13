'use client'

import { useEffect, useState } from 'react'
import {
  getStoredOfflineStatus,
  OFFLINE_STATUS_EVENT,
  type OfflineStatusDetail,
} from './offline-events'

function readBrowserOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function readStoredReadOnly() {
  return getStoredOfflineStatus()?.readOnly ?? false
}

export function useOfflineReadOnly(forceReadOnly = false) {
  const [readOnly, setReadOnly] = useState(false)

  useEffect(() => {
    const refresh = () => {
      setReadOnly(readBrowserOffline() || readStoredReadOnly())
    }

    const handleStatus = (event: Event) => {
      const detail = (event as CustomEvent<OfflineStatusDetail>).detail
      setReadOnly(readBrowserOffline() || !!detail?.readOnly)
    }

    refresh()
    window.addEventListener('online', refresh)
    window.addEventListener('offline', refresh)
    window.addEventListener(OFFLINE_STATUS_EVENT, handleStatus)

    return () => {
      window.removeEventListener('online', refresh)
      window.removeEventListener('offline', refresh)
      window.removeEventListener(OFFLINE_STATUS_EVENT, handleStatus)
    }
  }, [])

  return forceReadOnly || readOnly
}
