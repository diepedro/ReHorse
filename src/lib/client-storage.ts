export function readClientStorage(key: string): string | null {
  return readStorageArea('localStorage', key) ?? readStorageArea('sessionStorage', key)
}

export function writeClientStorage(key: string, value: string): boolean {
  const wroteLocal = writeStorageArea('localStorage', key, value)
  const wroteSession = writeStorageArea('sessionStorage', key, value)
  return wroteLocal || wroteSession
}

export function removeClientStorage(key: string) {
  removeStorageArea('localStorage', key)
  removeStorageArea('sessionStorage', key)
}

function readStorageArea(areaName: 'localStorage' | 'sessionStorage', key: string) {
  if (typeof window === 'undefined') return null
  try {
    return window[areaName].getItem(key)
  } catch {
    return null
  }
}

function writeStorageArea(areaName: 'localStorage' | 'sessionStorage', key: string, value: string) {
  if (typeof window === 'undefined') return false
  try {
    window[areaName].setItem(key, value)
    return true
  } catch {
    return false
  }
}

function removeStorageArea(areaName: 'localStorage' | 'sessionStorage', key: string) {
  if (typeof window === 'undefined') return
  try {
    window[areaName].removeItem(key)
  } catch {
    // Storage may be unavailable on some Safari/iOS privacy modes.
  }
}
