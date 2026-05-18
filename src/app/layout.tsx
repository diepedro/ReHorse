import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ToastProvider from '@/components/ToastProvider'
import SessionProviderWrapper from '@/components/SessionProviderWrapper'
import SessionSaver from '@/components/SessionSaver'
import ErrorBoundary from '@/components/ErrorBoundary'
import LgpdBanner from '@/components/LgpdBanner'
import PwaInstaller from '@/components/PwaInstaller'
import PushSubscriber from '@/components/PushSubscriber'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ReHorse',
  description: 'Organizador de ensaios da banda',
  icons: { icon: '/favicon.svg' },
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'ReHorse' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme:dark)').matches;if(d)document.documentElement.classList.add('dark')})()` }} />
        <meta name="theme-color" content="#030712" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={`${inter.className} bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100 min-h-screen`}>
        <ErrorBoundary>
          <SessionProviderWrapper>
            <SessionSaver />
            <ToastProvider>{children}</ToastProvider>
            <LgpdBanner />
            <PwaInstaller />
            <PushSubscriber />
          </SessionProviderWrapper>
        </ErrorBoundary>
      </body>
    </html>
  )
}
