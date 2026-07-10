import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import SettingsForm from './SettingsForm'

export default async function SettingsPage({ params }) {
  const { 'store-slug': storeSlug } = await params
  const supabase  = await createClient()

  const { data: store } = await supabase
    .from('stores')
    .select('id, nome, meia_a_meia_enabled, meia_a_meia_rule, horario, taxa_entrega, bairros_atendidos, paleta_id, imagem_fundo_url')
    .eq('slug', storeSlug)
    .single()

  if (!store) redirect(`/admin/${storeSlug}`)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <a href={`/admin/${storeSlug}`} className="text-gray-400 hover:text-gray-600 text-sm">
            ← Painel
          </a>
          <h1 className="text-xl font-bold text-gray-900">Configurações da loja</h1>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-6">
        <SettingsForm store={store} storeSlug={storeSlug} />
      </main>
    </div>
  )
}
