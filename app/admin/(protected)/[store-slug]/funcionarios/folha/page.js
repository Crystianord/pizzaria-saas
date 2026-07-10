import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import FolhaClient from './FolhaClient'

export default async function FolhaPage({ params }) {
  const { 'store-slug': storeSlug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: adminStore } = await supabase
    .from('admin_stores').select('store_id').eq('user_id', user.id).single()
  if (!adminStore) redirect('/admin/login')

  const sessantaDiasAtras = new Date()
  sessantaDiasAtras.setDate(sessantaDiasAtras.getDate() - 60)

  const [{ data: funcionarios }, { data: intercorrencias }] = await Promise.all([
    supabase
      .from('funcionarios')
      .select('id, nome, cargo, telefone, periodo_pagamento, valor_diaria, ativo')
      .eq('store_id', adminStore.store_id)
      .eq('ativo', true)
      .order('nome'),
    supabase
      .from('intercorrencias')
      .select('id, funcionario_id, data, descricao, ajuste, created_at')
      .eq('store_id', adminStore.store_id)
      .gte('data', sessantaDiasAtras.toISOString().split('T')[0])
      .order('data', { ascending: false }),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <a href={`/admin/${storeSlug}/funcionarios`} className="text-gray-400 hover:text-gray-600 text-sm">← Funcionários</a>
            <h1 className="text-xl font-bold text-gray-900">Folha de pagamento</h1>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-6">
        <FolhaClient
          funcionarios={funcionarios ?? []}
          intercorrencias={intercorrencias ?? []}
          storeSlug={storeSlug}
        />
      </main>
    </div>
  )
}
