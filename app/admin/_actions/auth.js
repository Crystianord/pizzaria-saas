/**
 * FASE 2 — SERVER ACTIONS DE AUTENTICAÇÃO
 *
 * O que são Server Actions:
 *   Funções que rodam 100% no servidor, mas podem ser chamadas de Client Components
 *   como se fossem funções normais. O Next.js cuida de criar um endpoint seguro
 *   nos bastidores — você não vê, não precisa criar API route.
 *
 * Por que a pasta se chama _actions?
 *   O underscore (_) diz ao Next.js que essa pasta NÃO é uma rota pública.
 *   Sem o underscore, o Next.js tentaria criar uma página para /admin/actions/auth
 *   o que não faz sentido.
 *
 * Proteção CSRF:
 *   Server Actions no Next.js têm proteção automática contra CSRF (ataques onde
 *   outro site tenta chamar ações em nome do usuário). Não precisamos adicionar
 *   nada manual para isso.
 */

'use server'

import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

/**
 * signIn — faz o login do admin
 *
 * Recebe: prevState (estado anterior do formulário, obrigatório com useActionState)
 *         formData (os campos do formulário: email e password)
 *
 * Retorna: { error: 'mensagem' } se der errado
 *          redireciona para o dashboard se der certo
 */
export async function signIn(prevState, formData) {
  const supabase = await createClient()

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  // Se houver erro (senha errada, email não existe, etc.), devolvemos
  // uma mensagem genérica. Não especificamos se foi o email ou a senha
  // que errou — isso é uma boa prática de segurança (não dá dica ao atacante).
  if (error || !authData?.user) {
    return { error: 'Email ou senha inválidos.' }
  }

  // signInWithPassword já retorna o user junto com a resposta.
  // Usamos diretamente em vez de chamar getUser() de novo (economiza um request).
  const user = authData.user

  // Busca qual pizzaria esse admin gerencia.
  // A tabela admin_stores tem: user_id → store_id → stores(slug)
  // O RLS do Supabase garante que cada admin só vê sua própria linha.
  const { data: adminStore } = await supabase
    .from('admin_stores')
    .select('stores(slug)')
    .eq('user_id', user.id)
    .single()
  // Segurança extra: se o usuário está autenticado mas não tem store associada
  // (ex: você criou o usuário no Supabase mas esqueceu de inserir em admin_stores),
  // mostramos uma mensagem clara em vez de um erro 500 genérico.
  if (!adminStore?.stores?.slug) {
    return { error: 'Admin não configurado. Contate o suporte.' }
  }

  // ATENÇÃO: redirect() funciona lançando um erro especial internamente.
  // NUNCA coloque redirect() dentro de um try/catch — o catch vai engolir
  // esse erro e o redirecionamento não vai acontecer.
  redirect(`/admin/${adminStore.stores.slug}`)
}

/**
 * signOut — faz o logout do admin
 *
 * Invalida a sessão no servidor e redireciona para a página de login.
 */
export async function signOut() {
  const supabase = await createClient()

  // Decisão de MVP: ignoramos erros de signOut (ex: queda de rede).
  // Se der erro, o cookie vai expirar naturalmente e o layout vai
  // redirecionar para o login na próxima requisição.
  await supabase.auth.signOut()

  redirect('/admin/login')
}
