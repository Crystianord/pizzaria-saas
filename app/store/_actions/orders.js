'use server'

/**
 * createOrder — Server Action para pedidos do site público.
 *
 * Princípio de segurança: NUNCA confie no cliente.
 *
 *   - Preço de cada item vem do banco (product_variants.preco) com promoção
 *     aplicada server-side. O cliente envia variantId/quantidade, jamais preco.
 *   - Taxa de entrega vem de stores.taxa_entrega. O cliente envia tipo_entrega
 *     (entrega ou retirada), jamais taxa.
 *   - Bairro é validado contra stores.bairros_atendidos quando configurado.
 *   - Textos (nome, telefone, endereço, observações) têm limite de tamanho.
 *   - Quantidade tem limite de 1..99.
 *   - Número máximo de itens por pedido: 30.
 *   - Usa Service Role para o INSERT — a tabela orders não aceita mais INSERT
 *     anônimo direto via RLS (ver supabase/migrations/001-security-fixes.sql).
 *
 * Se algo falha entre o insert de orders e o insert de order_items, fazemos
 * rollback manual do order para não deixar pedido órfão sem itens.
 */

import { createServiceClient } from '@/lib/supabase-service'
import { toE164 } from '@/lib/phone'
import { buildOrderItems, toOrderItemRows, clamp, round2 } from '@/lib/order-items'

// ─── Limites dos campos do formulário ──────────────────────────
// (os limites dos itens vivem em lib/order-items.js)
const MAX_NOME     = 100
const MAX_TEL      = 20
const MAX_ENDERECO = 200
const MAX_BAIRRO   = 60
const MAX_OBS      = 500

// ─── Action ────────────────────────────────────────────────────
export async function createOrder(prevState, formData) {
  const supabase = createServiceClient('createOrder')

  // ── 1. Coletar e sanitizar inputs do cliente ───────────────
  const storeId     = formData.get('store_id')
  const tipoEntrega = formData.get('tipo_entrega')
  const clienteNome = clamp(formData.get('cliente_nome'), MAX_NOME)
  const clienteTel  = clamp(formData.get('cliente_tel'),  MAX_TEL)
  const endereco    = tipoEntrega === 'entrega' ? clamp(formData.get('endereco'), MAX_ENDERECO) : null
  const bairro      = tipoEntrega === 'entrega' ? clamp(formData.get('bairro'),   MAX_BAIRRO)   : null
  const observacoes = clamp(formData.get('observacoes'), MAX_OBS) || null

  if (!storeId)                                       return { error: 'Loja não informada.' }
  if (!clienteNome)                                   return { error: 'Nome obrigatório.' }
  if (!clienteTel)                                    return { error: 'Telefone obrigatório.' }
  if (!['entrega', 'retirada'].includes(tipoEntrega)) return { error: 'Tipo de entrega inválido.' }

  // Guardamos o telefone em E.164 (5562981895453). É a chave que liga o pedido
  // à conversa de WhatsApp — sem um formato único, o mesmo cliente vira vários.
  const telE164 = toE164(clienteTel)
  if (!telE164) return { error: 'Telefone inválido. Use DDD + número, ex: (62) 98189-5453.' }

  if (tipoEntrega === 'entrega' && (!endereco || !bairro)) {
    return { error: 'Endereço e bairro obrigatórios para entrega.' }
  }

  // ── 2. Validar que a loja existe e buscar config oficial ───
  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .select('id, taxa_entrega, bairros_atendidos, meia_a_meia_enabled, meia_a_meia_rule, horario')
    .eq('id', storeId)
    .single()
  if (storeErr || !store) return { error: 'Loja não encontrada.' }

  // ── 3. Bairro atendido? ────────────────────────────────────
  if (tipoEntrega === 'entrega'
      && Array.isArray(store.bairros_atendidos)
      && store.bairros_atendidos.length > 0
      && !store.bairros_atendidos.includes(bairro)) {
    return { error: 'Bairro fora da área de entrega deste restaurante.' }
  }

  // ── 4. Parsear items_json com guarda ───────────────────────
  let items
  try {
    items = JSON.parse(formData.get('items_json'))
  } catch {
    return { error: 'Erro ao processar itens do pedido.' }
  }

  // ── 5. Validar itens e calcular preços (servidor é a fonte da verdade) ──
  // Toda a lógica vive em lib/order-items.js, compartilhada com o pedido
  // manual do admin — antes as duas estavam duplicadas e divergiam.
  const { orderItems, error: itemsErr } = await buildOrderItems(supabase, storeId, items, store)
  if (itemsErr) return { error: itemsErr }

  // ── 6. Totais ──────────────────────────────────────────────
  const subtotal    = round2(orderItems.reduce((s, i) => s + i.preco * i.quantidade, 0))
  const taxaEntrega = tipoEntrega === 'entrega' ? round2(Number(store.taxa_entrega) || 0) : 0
  const total       = round2(subtotal + taxaEntrega)

  if (subtotal <= 0 || total <= 0) return { error: 'Pedido inválido.' }

  // ── 7. Insert do pedido ────────────────────────────────────
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      store_id:     storeId,
      status:       'novo',
      cliente_nome: clienteNome,
      cliente_tel:  telE164,
      tipo_entrega: tipoEntrega,
      endereco,
      bairro,
      taxa_entrega: taxaEntrega,
      subtotal,
      total,
      observacoes,
    })
    .select('id')
    .single()

  if (orderError) {
    console.error('[createOrder] orderError:', orderError.code, orderError.message)
    return { error: 'Erro ao criar pedido. Tente novamente.' }
  }

  // ── 8. Insert dos itens (rollback se falhar) ───────────────
  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(toOrderItemRows(orderItems, order.id, storeId))
  if (itemsError) {
    console.error('[createOrder] itemsError:', itemsError.code, itemsError.message)
    // Rollback manual: apaga o pedido órfão para não poluir a fila do admin
    await supabase.from('orders').delete().eq('id', order.id)
    return { error: 'Erro ao salvar itens do pedido. Tente novamente.' }
  }

  return { success: true, orderId: order.id }
}
