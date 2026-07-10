import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ProductsClient from './ProductsClient'

export default async function CatalogPage({ params }) {
  const { 'store-slug': storeSlug } = await params
  const supabase  = await createClient()

  // Busca a store e verifica wizard
  const { data: store } = await supabase
    .from('stores')
    .select('id, nome, catalog_setup_done')
    .eq('slug', storeSlug)
    .single()

  if (!store) redirect(`/admin/${storeSlug}`)

  // Wizard obrigatório na primeira vez
  if (!store.catalog_setup_done) {
    redirect(`/admin/${storeSlug}/catalog/setup`)
  }

  // Busca produtos com variantes e categorias
  const { data: products } = await supabase
    .from('products')
    .select(`
      id, nome, foto_url, preco, ativo,
      categories(id, nome),
      product_variants(id, nome, preco, ordem, ativo)
    `)
    .eq('store_id', store.id)
    .order('nome', { ascending: true })

  // Busca promoções ativas
  const { data: promotions } = await supabase
    .from('promotions')
    .select('id, product_id, tipo, desconto_pct, desconto_fixo, label')
    .eq('store_id', store.id)
    .eq('ativo', true)

  return (
    <div className="flex flex-col h-full">

      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">Produtos</h1>
          <div className="flex items-center gap-3">
            <Link
              href={`/admin/${storeSlug}/catalog/categories`}
              className="text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg px-3 py-2 transition-colors"
            >
              Categorias
            </Link>
            <Link
              href={`/admin/${storeSlug}/catalog/products/new`}
              className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              + Novo produto
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full px-6 py-6">
        {(products?.length ?? 0) > 0 && (
          <p className="text-xs text-slate-400 mb-4">
            Clique em qualquer preço para editá-lo diretamente.
          </p>
        )}
        <ProductsClient
          products={products ?? []}
          promotions={promotions ?? []}
          storeSlug={storeSlug}
        />
      </main>
    </div>
  )
}
