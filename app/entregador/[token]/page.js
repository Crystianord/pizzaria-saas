import { createServiceClient } from '@/lib/supabase-service'
import { notFound } from 'next/navigation'
import EntregadorClient from './EntregadorClient'

export default async function EntregadorPage({ params }) {
  const { token } = await params
  const supabase  = createServiceClient()

  const { data: entregador } = await supabase
    .from('funcionarios')
    .select('id, nome, store_id')
    .eq('token', token)
    .eq('faz_entrega', true)
    .eq('ativo', true)
    .single()

  if (!entregador) notFound()

  const { data: orders } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('funcionario_id', entregador.id)
    .eq('status', 'a_caminho')
    .order('created_at', { ascending: false })

  return (
    <EntregadorClient
      entregador={entregador}
      initialOrders={orders ?? []}
      token={token}
    />
  )
}
