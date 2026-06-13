'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { readClientStorage, writeClientStorage } from '@/lib/client-storage'

export default function LgpdBanner() {
  const [visible, setVisible] = useState(false)
  const pathname = usePathname()
  const authScreen = pathname.startsWith('/auth')

  useEffect(() => {
    if (!readClientStorage('lgpd_ok')) setVisible(true)
  }, [])

  function accept() {
    writeClientStorage('lgpd_ok', '1')
    window.dispatchEvent(new Event('lgpd:accepted'))
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className={`fixed left-3 right-3 z-50 rounded-lg border border-slate-200/80 bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur sm:max-w-xs dark:border-white/10 dark:bg-slate-950/95 ${authScreen ? 'bottom-3 sm:top-4 sm:bottom-auto sm:left-4 sm:right-auto' : 'bottom-24 sm:bottom-4 sm:left-auto sm:right-4'}`}>
      <p className="text-[11px] leading-relaxed text-gray-600 sm:text-xs dark:text-gray-300">
        O ReHorse usa cookies de sessão e armazenamento local para manter você conectado.
        Nenhum dado é compartilhado com terceiros.{' '}
        <Link href="/privacidade" className="font-medium underline hover:text-gray-900 dark:hover:text-white">Política de privacidade</Link>.
      </p>
      <button
        onClick={accept}
        className="party-button mt-2 w-full px-4 py-1.5 text-xs sm:w-auto"
      >
        Entendi
      </button>
    </div>
  )
}
