import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import CategoriesClient from './CategoriesClient'

export default async function CategoriesPage({ params }) {
  const { 'store-slug': storeSlug } = await params
  const supabase  = await createClient()

  const { data: store } = await supabase
    .from('stores')
    .select('id, nome')
    .eq('slug', storeSlug)
    .single()

  if (!store) redirect(`/admin/${storeSlug}`)

  const { data: categories } = await supabase
    .from('categories')
    .select('id, nome, ordem')
    .eq('store_id', store.id)
    .order('ordem', { ascending: true })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href={`/admin/${storeSlug}/catalog`} className="text-gray-400 hover:text-gray-600 text-sm">
              ← Produtos
            </a>
            <h1 className="text-xl font-bold text-gray-900">Categorias</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6">
        <CategoriesClient
          categories={categories ?? []}
          storeSlug={storeSlug}
        />
      </main>
    </div>
  )
}
