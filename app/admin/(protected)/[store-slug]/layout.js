import { createClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import { signOut } from '@/app/admin/_actions/auth'
import NavSidebar from './NavSidebar'
export default async function StoreLayout({ children, params }) {
  const { 'store-slug': storeSlug } = await params
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/admin/login')

  // Verifica que o slug pertence ao admin autenticado.
  // Consulta via admin_stores (join com stores) para garantir ownership.
  const { data: adminStore } = await supabase
    .from('admin_stores')
    .select('stores(nome, slug)')
    .eq('user_id', user.id)
    .single()

  if (adminStore?.stores?.slug !== storeSlug) notFound()

  const store = adminStore?.stores

  const navItems = [
    { href: `/admin/${storeSlug}`,                          iconName: 'LayoutDashboard', label: 'Dashboard',    exact: true },
    { href: `/admin/${storeSlug}/pedidos`,                  iconName: 'ClipboardList',   label: 'Pedidos' },
    { href: `/admin/${storeSlug}/catalog`,                  iconName: 'Pizza',           label: 'Produtos' },
    { href: `/admin/${storeSlug}/catalog/categories`,       iconName: 'FolderOpen',      label: 'Categorias' },
    { href: `/admin/${storeSlug}/catalog/opcoes`,           iconName: 'ListChecks',      label: 'Opções' },
    { href: `/admin/${storeSlug}/entregadores`,             iconName: 'Bike',            label: 'Entregadores' },
    { href: `/admin/${storeSlug}/entregadores/relatorio`,   iconName: 'BarChart2',       label: 'Rel. Entregas' },
    { href: `/admin/${storeSlug}/funcionarios`,             iconName: 'Users',           label: 'Funcionários' },
    { href: `/admin/${storeSlug}/funcionarios/folha`,       iconName: 'Wallet',          label: 'Folha' },
    { href: `/admin/${storeSlug}/financeiro`,               iconName: 'TrendingUp',      label: 'Financeiro' },
    { href: `/admin/${storeSlug}/settings`,                 iconName: 'Settings',        label: 'Configurações' },
    { href: `/${storeSlug}`,                                iconName: 'Globe',           label: 'Ver site', external: true },
  ]

  return (
    <div className="flex min-h-screen bg-slate-950">
      <NavSidebar
        storeName={store?.nome ?? storeSlug}
        userEmail={user.email}
        navItems={navItems}
        signOut={signOut}
      />
      <div className="flex-1 flex flex-col min-w-0 lg:pt-0 pt-14">
        <main className="flex-1 bg-slate-50 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
