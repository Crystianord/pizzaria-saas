import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ProductForm from '../../../ProductForm'
import GruposDoProduto from '../../../GruposDoProduto'

export default async function EditProductPage({ params }) {
  const { 'store-slug': storeSlug, 'product-id': productId } = await params
  const supabase  = await createClient()

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('slug', storeSlug)
    .single()

  if (!store) redirect(`/admin/${storeSlug}`)

  const [{ data: product }, { data: categories }, { data: vinculos }, { data: grupos }] = await Promise.all([
    supabase
      .from('products')
      .select('id, nome, category_id, foto_url, ativo, product_variants(id, nome, preco, ordem, ativo)')
      .eq('id', productId)
      .eq('store_id', store.id)
      .single(),
    supabase
      .from('categories')
      .select('id, nome')
      .eq('store_id', store.id)
      .order('ordem', { ascending: true }),
    supabase
      .from('product_option_groups')
      .select('id, group_id, min_selecao, max_selecao, ordem, option_groups(id, nome, tipo, option_items(id, ativo))')
      .eq('product_id', productId)
      .eq('store_id', store.id)
      .order('ordem', { ascending: true }),
    supabase
      .from('option_groups')
      .select('id, nome, tipo, ativo')
      .eq('store_id', store.id)
      .order('ordem', { ascending: true }),
  ])

  if (!product) redirect(`/admin/${storeSlug}/catalog`)

  const activeVariants = product.product_variants
    ?.filter(v => v.ativo)
    .sort((a, b) => a.ordem - b.ordem) ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <a href={`/admin/${storeSlug}/catalog`} className="text-gray-400 hover:text-gray-600 text-sm">
            ← Produtos
          </a>
          <h1 className="text-xl font-bold text-gray-900">Editar produto</h1>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-6">
        <ProductForm
          categories={categories ?? []}
          storeId={store.id}
          storeSlug={storeSlug}
          product={product}
          variants={activeVariants}
        />

        <GruposDoProduto
          productId={product.id}
          storeSlug={storeSlug}
          vinculos={vinculos ?? []}
          gruposDisponiveis={grupos ?? []}
        />
      </main>
    </div>
  )
}
