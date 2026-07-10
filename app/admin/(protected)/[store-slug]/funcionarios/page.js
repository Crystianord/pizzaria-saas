import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import FuncionariosClient from './FuncionariosClient'
import { Wallet } from 'lucide-react'

export default async function FuncionariosPage({ params }) {
  const { 'store-slug': storeSlug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: adminStore } = await supabase
    .from('admin_stores').select('store_id').eq('user_id', user.id).single()
  if (!adminStore) redirect('/admin/login')

  const { data: funcionarios } = await supabase
    .from('funcionarios')
    .select('*')
    .eq('store_id', adminStore.store_id)
    .order('nome')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <a href={`/admin/${storeSlug}`} className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</a>
            <h1 className="text-xl font-bold text-gray-900">Funcionários</h1>
          </div>
          <a
            href={`/admin/${storeSlug}/funcionarios/folha`}
            className="flex items-center gap-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Wallet className="w-4 h-4" /> Folha de pagamento
          </a>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-6">
        <FuncionariosClient funcionarios={funcionarios ?? []} storeSlug={storeSlug} />
      </main>
    </div>
  )
}
