import { createClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import OpcoesClient from './OpcoesClient'

export default async function OpcoesPage({ params }) {
  const { 'store-slug': storeSlug } = await params
  const supabase = await createClient()

  const { data: store } = await supabase
    .from('stores')
    .select('id, nome, slug')
    .eq('slug', storeSlug)
    .single()

  if (!store) notFound()

  const { data: grupos } = await supabase
    .from('option_groups')
    .select('id, nome, tipo, ativo, ordem, option_items(id, nome, descricao, preco_extra, ordem, ativo)')
    .eq('store_id', store.id)
    .order('ordem', { ascending: true })

  // Quantos produtos usam cada grupo — o cliente precisa saber antes de excluir
  const { data: vinculos } = await supabase
    .from('product_option_groups')
    .select('group_id')
    .eq('store_id', store.id)

  const usoPorGrupo = {}
  for (const v of vinculos ?? []) {
    usoPorGrupo[v.group_id] = (usoPorGrupo[v.group_id] ?? 0) + 1
  }

  return (
    <OpcoesClient
      storeSlug={storeSlug}
      grupos={grupos ?? []}
      usoPorGrupo={usoPorGrupo}
    />
  )
}
