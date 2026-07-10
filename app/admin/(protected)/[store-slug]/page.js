import { createClient } from '@/lib/supabase-server'
import { ClipboardList, Plus, Phone, Globe, Pizza, Bike } from 'lucide-react'

export default async function DashboardPage({ params }) {
  const { 'store-slug': storeSlug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: store } = await supabase
    .from('stores')
    .select('id, nome, slug')
    .eq('slug', storeSlug)
    .single()

  // Contagens rápidas para os cards de stats
  const [{ count: totalProducts }, { count: totalOrders }, { count: activeDeliverers }] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('store_id', store?.id ?? ''),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('store_id', store?.id ?? ''),
    supabase.from('entregadores').select('id', { count: 'exact', head: true }).eq('store_id', store?.id ?? '').eq('ativo', true),
  ])

  const quickLinks = [
    {
      href:  `/admin/${storeSlug}/pedidos`,
      icon:  ClipboardList,
      label: 'Ver pedidos',
      color: 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/25',
    },
    {
      href:  `/admin/${storeSlug}/catalog/products/new`,
      icon:  Plus,
      label: 'Novo produto',
      color: 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700',
    },
    {
      href:  `/admin/${storeSlug}/pedidos/novo`,
      icon:  Phone,
      label: 'Pedido por ligação',
      color: 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700',
    },
    {
      href:  `/${storeSlug}`,
      icon:  Globe,
      label: 'Ver cardápio',
      color: 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700',
      external: true,
    },
  ]

  const stats = [
    { label: 'Produtos cadastrados', value: totalProducts ?? 0, icon: Pizza },
    { label: 'Pedidos registrados',  value: totalOrders    ?? 0, icon: ClipboardList },
    { label: 'Entregadores ativos',  value: activeDeliverers ?? 0, icon: Bike },
  ]

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">

      {/* Boas-vindas */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Olá, {user?.email?.split('@')[0]}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Bem-vindo ao painel de <span className="font-medium text-slate-700">{store?.nome ?? storeSlug}</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border border-slate-200 px-6 py-5 flex items-center gap-4">
            <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
              <stat.icon className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Ações rápidas */}
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Ações rápidas
        </h2>
        <div className="flex flex-wrap gap-3">
          {quickLinks.map(link => (
            <a
              key={link.href}
              href={link.href}
              target={link.external ? '_blank' : undefined}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm ${link.color}`}
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </a>
          ))}
        </div>
      </div>

    </div>
  )
}
