import { createClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'

export default async function StoreLayout({ children, params }) {
  const { 'store-slug': storeSlug } = await params
  const supabase = await createClient()

  const { data: store } = await supabase
    .from('stores')
    .select('id, nome, slug')
    .eq('slug', storeSlug)
    .single()

  if (!store) notFound()

  return <>{children}</>
}
