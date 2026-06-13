export const OFFLINE_STATUS_EVENT = 'rehorse:offline-status'
export const OFFLINE_STATUS_KEY = 'rehorse_offline_status'

export type OfflineStatusReason = 'browser-offline' | 'api-cache' | 'api-error' | 'network'

export interface OfflineStatusDetail {
  readOnly: boolean
  reason: OfflineStatusReason
  updatedAt: number
}

export function publishOfflineStatus(readOnly: boolean, reason: OfflineStatusReason) {
  if (typeof window === 'undefined') return

  const detail: OfflineStatusDetail = {
    readOnly,
    reason,
    updatedAt: Date.now(),
  }

  try {
    window.sessionStorage.setItem(OFFLINE_STATUS_KEY, JSON.stringify(detail))
  } catch {
    // Session storage may be unavailable in restricted browser modes.
  }

  window.dispatchEvent(new CustomEvent<OfflineStatusDetail>(OFFLINE_STATUS_EVENT, { detail }))
}

export function getStoredOfflineStatus(): OfflineStatusDetail | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(OFFLINE_STATUS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as OfflineStatusDetail
  } catch {
    return null
  }
}
