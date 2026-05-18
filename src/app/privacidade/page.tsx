import Link from 'next/link'

export const metadata = { title: 'Privacidade — ReHorse' }

export default function PrivacidadePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-6 text-sm text-gray-700">
      <Link href="/" className="text-gray-400 hover:text-gray-700 text-xs">← Voltar</Link>
      <h1 className="text-2xl font-bold text-gray-900">Política de Privacidade</h1>
      <p className="text-gray-500 text-xs">Última atualização: março de 2026</p>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">Dados coletados</h2>
        <p>O ReHorse coleta apenas os dados necessários para o funcionamento do serviço:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Nome de usuário (obrigatório para criação de conta)</li>
          <li>E-mail (opcional, usado apenas para login)</li>
          <li>Dados de disponibilidade e repertório inseridos voluntariamente</li>
          <li>Cookies de sessão para manter o login ativo</li>
          <li>Dados salvos no localStorage do navegador (bandas acessadas, preferências)</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">Como os dados são usados</h2>
        <p>Os dados são usados exclusivamente para fornecer a funcionalidade do ReHorse. Nenhum dado é vendido, compartilhado com terceiros ou usado para fins publicitários.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">Acesso e exclusão</h2>
        <p>Você pode excluir sua conta a qualquer momento nas configurações do perfil. A exclusão remove permanentemente todos os seus dados do sistema.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">Segurança</h2>
        <p>Senhas são armazenadas com hash criptográfico (scrypt). Dados de banda são privados e acessíveis apenas por quem possui o código de convite.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">Contato</h2>
        <p>Dúvidas sobre privacidade? Entre em contato pelo repositório do projeto.</p>
      </section>
    </div>
  )
}
