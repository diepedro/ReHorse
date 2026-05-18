import Link from 'next/link'

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <section className="w-full max-w-sm text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-2xl">
          RH
        </div>
        <div>
          <h1 className="text-2xl font-bold">Sem conexão</h1>
          <p className="mt-2 text-sm leading-6 text-gray-400">
            O ReHorse não conseguiu carregar esta tela agora. Quando a internet voltar, tente abrir a banda novamente.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-gray-950 transition-colors hover:bg-gray-100"
        >
          Voltar ao início
        </Link>
      </section>
    </main>
  )
}
