import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import RelatorioClient from './RelatorioClient'

export default async function RelatorioEntregadoresPage({ params }) {
  const { 'store-slug': storeSlug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: adminStore } = await supabase
    .from('admin_stores')
    .select('store_id')
    .eq('user_id', user.id)
    .single()

  if (!adminStore) redirect('/admin/login')

  const trintaDiasAtras = new Date()
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30)

  const [{ data: entregadores }, { data: orders }] = await Promise.all([
    supabase
      .from('funcionarios')
      .select('id, nome, telefone')
      .eq('store_id', adminStore.store_id)
      .eq('faz_entrega', true)
      .order('nome'),
    supabase
      .from('orders')
      .select('id, funcionario_id, entregador_nome, taxa_entrega, total, created_at')
      .eq('store_id', adminStore.store_id)
      .eq('status', 'entregue')
      .eq('tipo_entrega', 'entrega')
      .not('funcionario_id', 'is', null)
      .gte('created_at', trintaDiasAtras.toISOString())
      .order('created_at', { ascending: false }),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <a href={`/admin/${storeSlug}/entregadores`} className="text-gray-400 hover:text-gray-600 text-sm">
            ← Entregadores
          </a>
          <h1 className="text-xl font-bold text-gray-900">Relatório de entregas</h1>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-6">
        <RelatorioClient
          entregadores={entregadores ?? []}
          orders={orders ?? []}
        />
      </main>
    </div>
  )
}
