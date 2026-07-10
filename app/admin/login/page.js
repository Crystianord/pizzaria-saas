/**
 * FASE 2 — PÁGINA DE LOGIN DO ADMIN
 *
 * O que faz:
 *   1. Verifica se o admin já está logado.
 *   2. Se já estiver logado → busca a store dele e redireciona para o dashboard.
 *   3. Se não estiver logado → exibe o formulário de login (LoginForm).
 *
 * Por que verificar sessão aqui também?
 *   O layout (protected)/layout.js já protege as páginas autenticadas.
 *   Mas essa página de login está FORA do grupo protegido (é /admin/login).
 *   Então se um admin já logado acessar /admin/login diretamente, ele veria
 *   o formulário de novo — o que é confuso. Essa verificação redireciona
 *   para o dashboard nesse caso.
 *
 * Server Component:
 *   Esta página roda 100% no servidor. O formulário em si fica no LoginForm.js
 *   (que é Client Component, pois precisa de interatividade).
 */

import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import LoginForm from './LoginForm'
import { Pizza } from 'lucide-react'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  if (data?.user) {
    const { data: adminStore } = await supabase
      .from('admin_stores')
      .select('stores(slug)')
      .eq('user_id', data.user.id)
      .single()

    if (adminStore?.stores?.slug) {
      redirect(`/admin/${adminStore.stores.slug}`)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">

      {/* Brilho decorativo de fundo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-orange-500 opacity-10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-600 opacity-10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">

        {/* Logo / ícone */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30 mb-4">
            <Pizza className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Painel Admin
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Acesse sua pizzaria
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          <LoginForm />
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          © {new Date().getFullYear()} Pizzaria SaaS
        </p>
      </div>
    </main>
  )
}
