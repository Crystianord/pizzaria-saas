/**
 * FASE 2 — LAYOUT PROTEGIDO DO PAINEL ADMIN
 *
 * O que faz:
 *   Protege todas as páginas dentro da pasta (protected)/.
 *   Se o usuário não estiver logado, redireciona para /admin/login.
 *
 * Por que a pasta se chama (protected) com parênteses?
 *   Parênteses no Next.js criam um "Route Group" — uma pasta organizacional
 *   que NÃO aparece na URL. Ou seja:
 *     app/admin/(protected)/[store-slug]/page.js → URL: /admin/minha-pizzaria
 *     app/admin/login/page.js                   → URL: /admin/login
 *
 *   Isso é ESSENCIAL para evitar um loop infinito:
 *     ❌ SEM Route Group: layout de /admin/ cobre /admin/login → usuário não logado
 *        acessa /admin/login → layout detecta sem sessão → redireciona para /admin/login
 *        → loop infinito
 *     ✅ COM Route Group: /admin/login está FORA do (protected) → não é afetado
 *        por este layout → sem loop
 *
 * O que este layout NÃO faz:
 *   Não protege /admin/login — essa página está fora deste grupo.
 */

import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export default async function AdminProtectedLayout({ children }) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()

  if (error || !data?.user) {
    redirect('/admin/login')
  }

  return <>{children}</>
}
