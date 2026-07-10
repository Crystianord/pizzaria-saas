import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import EntregadoresClient from './EntregadoresClient'
import { BarChart2 } from 'lucide-react'

export default async function EntregadoresPage({ params }) {
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

  const { data: entregadores } = await supabase
    .from('funcionarios')
    .select('*')
    .eq('store_id', adminStore.store_id)
    .eq('faz_entrega', true)
    .order('nome', { ascending: true })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:3000`

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <a href={`/admin/${storeSlug}`} className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</a>
            <h1 className="text-xl font-bold text-gray-900">Entregadores</h1>
          </div>
          <a
            href={`/admin/${storeSlug}/entregadores/relatorio`}
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 border border-gray-200 hover:border-orange-400 hover:text-orange-600 px-4 py-2 rounded-xl transition-colors"
          >
            <BarChart2 className="w-4 h-4" /> Relatório
          </a>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-6">
        <EntregadoresClient
          entregadores={entregadores ?? []}
          storeSlug={storeSlug}
          baseUrl={baseUrl}
        />
      </main>
    </div>
  )
}
