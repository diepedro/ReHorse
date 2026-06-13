'use client'

import { useEffect, useState } from 'react'
import { readClientStorage, writeClientStorage } from '@/lib/client-storage'

export default function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const saved = readClientStorage('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = saved ? saved === 'dark' : prefersDark
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    writeClientStorage('theme', next ? 'dark' : 'light')
  }

  return (
    <button
      onClick={toggle}
      title={dark ? 'Modo claro' : 'Modo escuro'}
      aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      className="party-icon-button"
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M10 2.25a.75.75 0 0 1 .75.75v1.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM10 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM10 15.75a.75.75 0 0 1 .75.75V18a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75ZM17.75 10a.75.75 0 0 1-.75.75h-1.25a.75.75 0 0 1 0-1.5H17a.75.75 0 0 1 .75.75ZM4.25 10a.75.75 0 0 1-.75.75H2.25a.75.75 0 0 1 0-1.5H3.5a.75.75 0 0 1 .75.75ZM15.48 4.52a.75.75 0 0 1 0 1.06l-.88.88a.75.75 0 1 1-1.06-1.06l.88-.88a.75.75 0 0 1 1.06 0ZM6.46 13.54a.75.75 0 0 1 0 1.06l-.88.88a.75.75 0 0 1-1.06-1.06l.88-.88a.75.75 0 0 1 1.06 0ZM15.48 15.48a.75.75 0 0 1-1.06 0l-.88-.88a.75.75 0 0 1 1.06-1.06l.88.88a.75.75 0 0 1 0 1.06ZM6.46 6.46a.75.75 0 0 1-1.06 0l-.88-.88a.75.75 0 1 1 1.06-1.06l.88.88a.75.75 0 0 1 0 1.06Z" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 0 1 .44.837 7 7 0 0 0 8.264 8.264.75.75 0 0 1 .837.44 7.5 7.5 0 1 1-9.54-9.54Zm-1.36 1.986a6 6 0 1 0 9.915 9.915A8.5 8.5 0 0 1 6.095 3.99Z" clipRule="evenodd" />
    </svg>
  )
}
