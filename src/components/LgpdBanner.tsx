'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function LgpdBanner() {
  const [visible, setVisible] = useState(false)
  const pathname = usePathname()
  const authScreen = pathname.startsWith('/auth')

  useEffect(() => {
    if (!localStorage.getItem('lgpd_ok')) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem('lgpd_ok', '1')
    window.dispatchEvent(new Event('lgpd:accepted'))
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className={`fixed left-3 right-3 z-50 rounded-xl border border-gray-200 bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur sm:max-w-xs dark:border-gray-800 dark:bg-[#111827]/95 ${authScreen ? 'bottom-3 sm:top-4 sm:bottom-auto sm:left-4 sm:right-auto' : 'bottom-20 sm:bottom-4 sm:left-auto sm:right-4'}`}>
      <p className="text-[11px] leading-relaxed text-gray-600 sm:text-xs dark:text-gray-300">
        O ReHorse usa cookies de sessão e armazenamento local para manter você conectado.
        Nenhum dado é compartilhado com terceiros.{' '}
        <Link href="/privacidade" className="font-medium underline hover:text-gray-900 dark:hover:text-white">Política de privacidade</Link>.
      </p>
      <button
        onClick={accept}
        className="mt-2 w-full rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gray-700 sm:w-auto dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-white"
      >
        Entendi
      </button>
    </div>
  )
}
