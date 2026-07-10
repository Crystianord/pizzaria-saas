import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import WizardSteps from './WizardSteps'

export default async function SetupPage({ params }) {
  const { 'store-slug': storeSlug } = await params
  const supabase  = await createClient()

  const { data: store } = await supabase
    .from('stores')
    .select('id, nome, catalog_setup_done')
    .eq('slug', storeSlug)
    .single()

  if (!store) redirect(`/admin/${storeSlug}`)
  if (store.catalog_setup_done) redirect(`/admin/${storeSlug}/catalog`)

  // Dados iniciais para o wizard
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase
      .from('categories')
      .select('id, nome, ordem')
      .eq('store_id', store.id)
      .order('ordem', { ascending: true }),
    supabase
      .from('products')
      .select('id, nome, product_variants(id, nome, preco, ordem)')
      .eq('store_id', store.id)
      .order('nome', { ascending: true }),
  ])

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-12 px-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-2xl p-8">
        <div className="mb-8">
          <p className="text-sm text-orange-600 font-medium mb-1">Setup inicial</p>
          <h1 className="text-2xl font-bold text-gray-900">Vamos configurar seu cardápio</h1>
          <p className="text-gray-500 text-sm mt-1">Você só faz isso uma vez. Leva menos de 10 minutos.</p>
        </div>

        <WizardSteps
          categories={categories ?? []}
          products={products ?? []}
          storeId={store.id}
          storeSlug={storeSlug}
        />
      </div>
    </div>
  )
}
