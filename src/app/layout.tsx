import type { Metadata, Viewport } from 'next'
import './globals.css'
import ToastProvider from '@/components/ToastProvider'
import SessionProviderWrapper from '@/components/SessionProviderWrapper'
import SessionSaver from '@/components/SessionSaver'
import ErrorBoundary from '@/components/ErrorBoundary'
import LgpdBanner from '@/components/LgpdBanner'
import PwaInstaller from '@/components/PwaInstaller'
import PushSubscriber from '@/components/PushSubscriber'

export const metadata: Metadata = {
  title: 'ReHorse',
  description: 'Organizador de ensaios da banda',
  icons: {
    icon: '/icons/rehorse-favicon-32.png?v=20260602',
    apple: '/icons/rehorse-apple-touch.png?v=20260602',
  },
  manifest: '/manifest.json?v=20260602',
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
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme:dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){if(window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches)document.documentElement.classList.add('dark')}})()` }} />
        <meta name="theme-color" content="#030712" />
        <link rel="apple-touch-icon" href="/icons/rehorse-apple-touch.png?v=20260602" />
      </head>
      <body className="party-bg min-h-screen">
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
