import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ProductForm from '../../../ProductForm'

export default async function EditProductPage({ params }) {
  const { 'store-slug': storeSlug, 'product-id': productId } = await params
  const supabase  = await createClient()

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('slug', storeSlug)
    .single()

  if (!store) redirect(`/admin/${storeSlug}`)

  const [{ data: product }, { data: categories }] = await Promise.all([
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
      </main>
    </div>
  )
}
