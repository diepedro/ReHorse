'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function LgpdBanner() {
  const [visible, setVisible] = useState(false)

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
    <div className="fixed bottom-0 inset-x-0 z-50 bg-gray-900 border-t border-gray-700 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <p className="text-xs text-gray-300 max-w-2xl">
        O ReHorse usa cookies de sessão e armazenamento local para manter você conectado.
        Nenhum dado é compartilhado com terceiros.{' '}
        <Link href="/privacidade" className="underline hover:text-white">Política de privacidade</Link>.
      </p>
      <button
        onClick={accept}
        className="shrink-0 px-4 py-1.5 bg-white text-gray-900 font-semibold text-xs rounded-lg hover:bg-gray-100 transition-colors"
      >
        Entendi
      </button>
    </div>
  )
}
