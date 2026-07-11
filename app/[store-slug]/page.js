import { createClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import { getPaleta } from '@/lib/paletas'
import { isOpen } from '@/lib/horario'
import MenuClient from './MenuClient'

export default async function StorePage({ params }) {
  const { 'store-slug': storeSlug } = await params
  const supabase = await createClient()

  const { data: store } = await supabase
    .from('stores')
    .select('id, nome, slug, paleta_id, imagem_fundo_url, horario, taxa_entrega, bairros_atendidos, meia_a_meia_enabled, meia_a_meia_rule')
    .eq('slug', storeSlug)
    .single()

  if (!store) notFound()

  const [catResult, prodResult, promoResult] = await Promise.all([
    supabase
      .from('categories')
      .select('id, nome, ordem')
      .eq('store_id', store.id)
      .order('ordem', { ascending: true }),
    supabase
      .from('products')
      .select('id, nome, foto_url, category_id, ativo, product_variants(id, nome, preco, ordem, ativo)')
      .eq('store_id', store.id)
      .eq('ativo', true)
      .order('nome', { ascending: true }),
    supabase
      .from('promotions')
      .select('*')
      .eq('store_id', store.id)
      .eq('ativo', true),
  ])

  const categories = catResult.data ?? []
  const promotions = promoResult.data ?? []
  const products   = (prodResult.data ?? []).map(p => ({
    ...p,
    promotions: promotions.filter(pr => pr.product_id === p.id),
  }))


  const paleta = getPaleta(store.paleta_id)
  const aberto = isOpen(store.horario)

  return (
    <MenuClient
      store={store}
      paleta={paleta}
      aberto={aberto}
      categories={categories ?? []}
      products={products ?? []}
    />
  )
}
