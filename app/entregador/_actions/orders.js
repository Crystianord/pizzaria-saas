'use server'
import { createServiceClient } from '@/lib/supabase-service'

export async function marcarEntregue(orderId, token) {
  if (!orderId || !token) return { error: 'Dados inválidos.' }

  const supabase = createServiceClient('marcarEntregue')

  const { data: entregador, error: eErr } = await supabase
    .from('entregadores')
    .select('id')
    .eq('token', token)
    .eq('ativo', true)
    .single()

  if (eErr || !entregador) return { error: 'Token inválido.' }

  const { error } = await supabase
    .from('orders')
    .update({ status: 'entregue' })
    .eq('id', orderId)
    .eq('entregador_id', entregador.id)
    .eq('status', 'a_caminho')

  if (error) return { error: 'Erro ao atualizar pedido.' }

  return { success: true }
}
