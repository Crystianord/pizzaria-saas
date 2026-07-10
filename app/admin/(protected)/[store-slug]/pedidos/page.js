import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import PedidosClient from './PedidosClient'
import { Phone } from 'lucide-react'

export default async function PedidosPage({ params }) {
  const { 'store-slug': storeSlug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: adminStore } = await supabase
    .from('admin_stores')
    .select('store_id, stores(nome)')
    .eq('user_id', user.id)
    .single()

  if (!adminStore) redirect('/admin/login')

  const [{ data: orders }, { data: entregadores }] = await Promise.all([
    supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('store_id', adminStore.store_id)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('funcionarios')
      .select('id, nome, telefone, token')
      .eq('store_id', adminStore.store_id)
      .eq('faz_entrega', true)
      .eq('ativo', true)
      .eq('disponivel', true)
      .order('nome'),
  ])

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return (
    <div className="flex flex-col h-full">
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <h1 className="text-lg font-bold text-slate-900">Pedidos</h1>
          <a
            href={`/admin/${storeSlug}/pedidos/novo`}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
          >
            <Phone className="w-4 h-4" /> Pedido por ligação
          </a>
        </div>
      </header>
      <main className="max-w-6xl mx-auto w-full px-6 py-6">
        <PedidosClient
          initialOrders={orders ?? []}
          storeId={adminStore.store_id}
          storeSlug={storeSlug}
          storeName={adminStore.stores?.nome ?? storeSlug}
          entregadores={entregadores ?? []}
          baseUrl={baseUrl}
        />
      </main>
    </div>
  )
}
