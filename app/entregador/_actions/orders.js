'use server'
import { createServiceClient } from '@/lib/supabase-service'

export async function marcarEntregue(orderId, token) {
  if (!orderId || !token) return { error: 'Dados inválidos.' }

  const supabase = createServiceClient('marcarEntregue')

  // A migration 004 unificou `entregadores` em `funcionarios` (faz_entrega=true)
  // e trocou orders.entregador_id por orders.funcionario_id.
  const { data: entregador, error: eErr } = await supabase
    .from('funcionarios')
    .select('id')
    .eq('token', token)
    .eq('faz_entrega', true)
    .eq('ativo', true)
    .single()

  if (eErr || !entregador) return { error: 'Token inválido.' }

  // `count` é o que diferencia "atualizei" de "não casei com nada". Sem ele o
  // update de zero linhas passava como sucesso e o entregador via a entrega
  // sumir da tela sem que o pedido mudasse de status.
  const { count, error } = await supabase
    .from('orders')
    .update({ status: 'entregue' }, { count: 'exact' })
    .eq('id', orderId)
    .eq('funcionario_id', entregador.id)
    .eq('status', 'a_caminho')

  if (error) return { error: 'Erro ao atualizar pedido.' }
  if (!count) return { error: 'Pedido não encontrado ou já finalizado.' }

  return { success: true }
}
