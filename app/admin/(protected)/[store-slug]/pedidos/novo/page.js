import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import PedidoManualClient from './PedidoManualClient'

export default async function NovoPedidoPage({ params }) {
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

  const [{ data: store }, { data: categories }, { data: products }] = await Promise.all([
    supabase
      .from('stores')
      .select('id, nome, taxa_entrega, bairros_atendidos')
      .eq('id', adminStore.store_id)
      .single(),
    supabase
      .from('categories')
      .select('id, nome, ordem')
      .eq('store_id', adminStore.store_id)
      .order('ordem', { ascending: true }),
    supabase
      .from('products')
      .select('id, nome, category_id, foto_url, preco, product_variants(id, nome, preco, ordem, ativo)')
      .eq('store_id', adminStore.store_id)
      .eq('ativo', true)
      .order('nome', { ascending: true }),
  ])

  const productsWithVariants = (products ?? []).map(p => ({
    ...p,
    product_variants: (p.product_variants ?? [])
      .filter(v => v.ativo)
      .sort((a, b) => a.ordem - b.ordem),
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-5 py-4 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href={`/admin/${storeSlug}/pedidos`} className="text-gray-400 hover:text-gray-600 text-sm">
              ← Pedidos
            </a>
            <h1 className="text-lg font-bold text-gray-900">Novo pedido manual</h1>
          </div>
          <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">Pedido por ligação</span>
        </div>
      </header>

      <PedidoManualClient
        storeId={store.id}
        storeSlug={storeSlug}
        taxaEntrega={store.taxa_entrega ?? 0}
        bairros={store.bairros_atendidos ?? []}
        categories={categories ?? []}
        products={productsWithVariants}
      />
    </div>
  )
}
