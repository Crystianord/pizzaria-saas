import Link from 'next/link'
import {
  UtensilsCrossed,
  MessageCircle,
  LayoutGrid,
  Bell,
  Printer,
  Bike,
  Users,
  DollarSign,
  Store,
} from 'lucide-react'
import { FadeInUp } from './_components/LandingAnimations'

const CONTACT_WHATSAPP = '5562981895453'
const WHATSAPP_LINK = `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(
  'Olá! Quero saber mais sobre o Cardapp para meu restaurante.'
)}`

const FEATURES = [
  {
    icon: LayoutGrid,
    title: 'Cardápio digital',
    description: 'Cadastre produtos, categorias, variações e promoções. Seu cliente monta o pedido direto pelo celular.',
  },
  {
    icon: Bell,
    title: 'Pedidos em tempo real',
    description: 'Acompanhe pedidos chegando ao vivo, sem atualizar a página, e mude o status com um clique.',
  },
  {
    icon: Printer,
    title: 'Comanda térmica',
    description: 'Imprima a comanda em impressora térmica direto do navegador, sem programas extras.',
  },
  {
    icon: Bike,
    title: 'Controle de entregadores',
    description: 'Gerencie turnos, defina quem está de rota e acompanhe relatórios de entregas por entregador.',
  },
  {
    icon: Users,
    title: 'Funcionários e folha de pagamento',
    description: 'Cadastre sua equipe e deixe o sistema calcular a folha de pagamento automaticamente.',
  },
  {
    icon: DollarSign,
    title: 'Financeiro',
    description: 'Tenha visão do financeiro do seu restaurante sem precisar de planilha paralela.',
  },
]

function Logo({ className = 'w-10 h-10' }) {
  return (
    <div className={`${className} bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30 shrink-0`}>
      <UtensilsCrossed className="w-1/2 h-1/2 text-white" />
    </div>
  )
}

function WhatsAppButton({ className = '' }) {
  return (
    <a
      href={WHATSAPP_LINK}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5 active:translate-y-0 ${className}`}
    >
      <MessageCircle className="w-5 h-5" />
      Falar no WhatsApp
    </a>
  )
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-x-hidden">
      {/* Header */}
      <header className="relative max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-xl font-bold text-white tracking-tight">Cardapp</span>
        </div>
        <Link
          href="/admin/login"
          className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
        >
          Entrar
        </Link>
      </header>

      {/* Hero */}
      <section className="relative px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-orange-500 opacity-10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-600 opacity-10 rounded-full blur-3xl" />
        </div>

        <FadeInUp className="relative max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-tight">
            Gestão completa para o seu restaurante, do pedido à entrega
          </h1>
          <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
            Cardápio digital, painel de pedidos em tempo real, comanda térmica, controle de
            entregadores e financeiro — tudo em um só sistema, feito para restaurantes que
            vendem por delivery.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <WhatsAppButton className="w-full sm:w-auto" />
            <Link
              href="/admin/login"
              className="w-full sm:w-auto text-center text-slate-300 hover:text-white font-medium py-3 px-6 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors"
            >
              Já tenho conta — Entrar
            </Link>
          </div>
        </FadeInUp>
      </section>

      {/* Features */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <FadeInUp once className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Tudo que seu restaurante precisa para vender mais e perder menos tempo
          </h2>
        </FadeInUp>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon
            return (
              <FadeInUp
                key={feature.title}
                once
                delay={i * 0.08}
                className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30 mb-4">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-white font-semibold mb-1.5">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
              </FadeInUp>
            )
          })}
        </div>
      </section>

      {/* Loja própria */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <FadeInUp once className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 sm:p-10 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30 shrink-0">
            <Store className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg mb-1.5">
              Cada restaurante ganha sua própria página
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Seu restaurante tem um link próprio onde os clientes fazem pedidos e acompanham
              a entrega em tempo real, sem precisar instalar nada.
            </p>
          </div>
        </FadeInUp>
      </section>

      {/* CTA final */}
      <section className="relative px-4 sm:px-6 lg:px-8 pb-20">
        <FadeInUp once className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-6">
            Pronto para organizar o delivery do seu restaurante?
          </h2>
          <WhatsAppButton />
        </FadeInUp>
      </section>

      {/* Footer */}
      <footer className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-t border-slate-800">
        <p className="text-center text-slate-600 text-xs">
          © {new Date().getFullYear()} Cardapp
        </p>
      </footer>
    </main>
  )
}
