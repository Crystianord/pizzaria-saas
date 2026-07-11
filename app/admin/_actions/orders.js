/**
 * SERVER ACTIONS — Pedidos do Painel Admin
 *
 * Este arquivo gerencia os pedidos do lado do admin autenticado.
 * Não confundir com app/store/_actions/orders.js (que é para o cliente público).
 *
 * Duas responsabilidades distintas:
 *   1. createOrderManual  → admin cria pedido manualmente (cliente ligou)
 *   2. updateOrderStatus  → admin move o pedido pelo funil de status
 *
 * Fluxo de status dos pedidos (máquina de estados):
 *   novo → em_preparo → a_caminho → entregue
 *          ↘__________________________↗
 *              cancelado (de qualquer estado, exceto 'entregue')
 *
 * Segurança:
 *   - Todas as funções exigem usuário autenticado (getUser)
 *   - O store_id é sempre buscado no banco (nunca vem do cliente)
 *   - O RLS do Supabase garante que o admin só acessa sua própria loja
 *   - Preços são re-validados no banco para pedidos manuais
 */

'use server'
import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { toE164 } from '@/lib/phone'

// Whitelist de status válidos — bloqueia qualquer string arbitrária vinda do cliente
const VALID_STATUSES = ['novo', 'em_preparo', 'a_caminho', 'entregue', 'cancelado']

// Mesmos limites do pedido público (app/store/_actions/orders.js). O admin é
// confiável, mas o banco tem CHECK de tamanho — sem o clamp, um texto longo
// derruba o insert com erro de constraint em vez de uma mensagem clara.
const MAX_NOME     = 100
const MAX_ENDERECO = 200
const MAX_BAIRRO   = 60
const MAX_OBS      = 500

function clamp(str, max) {
  return (str || '').toString().trim().slice(0, max)
}

/**
 * createOrderManual — Cria um pedido manualmente via painel admin.
 *
 * Usado quando o cliente liga para a pizzaria e o dono cadastra o pedido
 * diretamente no painel, sem precisar do site público.
 *
 * Segurança chave:
 *   - Re-busca os preços das variantes no banco (não confia no preço enviado pelo frontend)
 *   - Se a variante não existir ou não pertencer à loja, o item é ignorado (item.preco cai de volta)
 *   - O store_id é resolvido via auth (admin_stores), nunca vem do formulário
 *
 * @param {Object} prevState - Estado anterior do formulário (obrigatório com useActionState)
 * @param {FormData} formData - Dados do formulário:
 *   - cliente_nome, cliente_tel, tipo_entrega (entrega/retirada)
 *   - endereco, bairro (se entrega)
 *   - taxa_entrega, observacoes
 *   - items_json: JSON serializado com [{variantId, productId, nomeProduto, nomeVariante, preco, quantidade}]
 */
export async function createOrderManual(prevState, formData) {
  const supabase = await createClient()

  // 1. Verificar autenticação — sem sessão, sem acesso
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  // 2. Descobrir qual loja este admin gerencia (via admin_stores)
  //    Nunca confiar no store_id vindo do formulário — sempre resolver pelo user_id
  const { data: adminStore } = await supabase
    .from('admin_stores')
    .select('store_id, stores(slug)')
    .eq('user_id', user.id)
    .single()

  if (!adminStore) return { error: 'Loja não encontrada.' }

  const storeId   = adminStore.store_id
  const storeSlug = adminStore.stores.slug
  const tipoEntrega = formData.get('tipo_entrega')
  const taxaEntrega = parseFloat(formData.get('taxa_entrega') || '0')

  const clienteNome = clamp(formData.get('cliente_nome'), MAX_NOME)
  const endereco    = tipoEntrega === 'entrega' ? clamp(formData.get('endereco'), MAX_ENDERECO) : null
  const bairro      = tipoEntrega === 'entrega' ? clamp(formData.get('bairro'),   MAX_BAIRRO)   : null
  const observacoes = clamp(formData.get('observacoes'), MAX_OBS) || null

  if (!clienteNome) return { error: 'Nome do cliente obrigatório.' }

  // Mesmo formato do pedido público: E.164, para o telefone ser uma chave
  // confiável entre pedido e conversa de WhatsApp.
  const telE164 = toE164(formData.get('cliente_tel'))
  if (!telE164) return { error: 'Telefone inválido. Use DDD + número, ex: (62) 98189-5453.' }

  // 3. Parsear items_json com guarda contra JSON malformado
  let items
  try {
    items = JSON.parse(formData.get('items_json'))
  } catch {
    return { error: 'Erro ao processar itens.' }
  }

  if (!items?.length) return { error: 'Adicione ao menos um item.' }

  // 4. Re-buscar preços oficiais no banco
  //    O admin pode ter digitado um preço diferente no frontend — ignoramos isso.
  //    Buscamos o preço real da tabela product_variants.
  const variantIds = items.filter(i => i.variantId).map(i => i.variantId)
  const priceMap = {}
  if (variantIds.length > 0) {
    const { data: dbVariants } = await supabase
      .from('product_variants')
      .select('id, preco')
      .in('id', variantIds)
      .eq('store_id', storeId)  // garante que a variante pertence a esta loja
    for (const v of (dbVariants ?? [])) priceMap[v.id] = Number(v.preco)
  }

  // 5. Substituir preços do cliente pelos preços do banco
  //    Se a variante não foi encontrada no banco, o item.preco original é mantido
  //    (cobre casos de itens sem variantId, como taxas avulsas)
  const resolvedItems = items.map(item => ({
    ...item,
    preco: item.variantId != null && priceMap[item.variantId] != null
      ? priceMap[item.variantId]
      : Number(item.preco),
  }))

  // 6. Calcular totais no servidor (nunca do cliente)
  const subtotal = resolvedItems.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const total    = subtotal + (tipoEntrega === 'entrega' ? taxaEntrega : 0)

  // 7. Inserir pedido principal
  const { data: order, error: oErr } = await supabase
    .from('orders')
    .insert({
      store_id:     storeId,
      status:       'novo',
      cliente_nome: clienteNome,
      cliente_tel:  telE164,
      tipo_entrega: tipoEntrega,
      endereco,
      bairro,
      taxa_entrega: tipoEntrega === 'entrega' ? taxaEntrega : 0,
      subtotal,
      total,
      observacoes,
    })
    .select('id')
    .single()

  if (oErr) return { error: 'Erro ao criar pedido.' }

  // 8. Inserir itens do pedido (vinculados ao pedido criado acima)
  const orderItems = resolvedItems.map(item => ({
    order_id:       order.id,
    store_id:       storeId,
    product_id:     item.productId   ?? null,
    variant_id:     item.variantId   ?? null,
    nome_produto:   item.nomeProduto,
    nome_variante:  item.nomeVariante ?? null,
    quantidade:     item.quantidade,
    preco_unitario: item.preco,
    eh_meia_meia:   false,
    subtotal:       item.preco * item.quantidade,
  }))

  const { error: iErr } = await supabase.from('order_items').insert(orderItems)
  if (iErr) return { error: 'Pedido criado, mas falha ao salvar itens.' }

  // 9. Invalidar cache do painel e redirecionar para a fila de pedidos
  revalidatePath(`/admin/${storeSlug}/pedidos`)
  redirect(`/admin/${storeSlug}/pedidos`)
}

/**
 * updateOrderStatus — Move um pedido pelo funil de status.
 *
 * Chamado pelo PedidosClient.js quando o admin clica em:
 *   - "Iniciar preparo" (novo → em_preparo)
 *   - "Saiu para entrega" (em_preparo → a_caminho, com entregador)
 *   - "Cancelar" (qualquer status → cancelado)
 *
 * Segurança:
 *   - Status é validado contra a whitelist VALID_STATUSES
 *   - O pedido é atualizado somente se pertencer à loja do admin autenticado
 *     (cláusula .eq('store_id', adminStore.store_id) previne cross-store attack)
 *
 * @param {string} orderId       - UUID do pedido
 * @param {string} status        - Novo status (validado contra VALID_STATUSES)
 * @param {string} storeSlug     - Slug da loja (para revalidar o cache da página)
 * @param {string|null} entregadorId   - UUID do entregador (apenas ao ir 'a_caminho')
 * @param {string|null} entregadorNome - Nome do entregador (denormalizável para exibição)
 */
export async function updateOrderStatus(orderId, status, storeSlug, entregadorId = null, entregadorNome = null) {
  // Rejeitar status não permitido antes de qualquer query no banco
  if (!VALID_STATUSES.includes(status)) return { error: 'Status inválido.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  // Resolver store_id do admin autenticado para garantir isolamento entre lojas
  const { data: adminStore } = await supabase
    .from('admin_stores')
    .select('store_id')
    .eq('user_id', user.id)
    .single()

  if (!adminStore) return { error: 'Loja não encontrada.' }

  // Montar objeto de atualização — só inclui entregador se foi passado
  const updates = { status }
  if (entregadorId)   updates.funcionario_id  = entregadorId
  if (entregadorNome) updates.entregador_nome = entregadorNome

  const { error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', orderId)
    .eq('store_id', adminStore.store_id)  // <-- isolamento: admin só muda pedido da sua loja

  if (error) return { error: 'Erro ao atualizar status.' }

  // Invalida o cache do painel de pedidos para refletir o novo status imediatamente
  revalidatePath(`/admin/${storeSlug}/pedidos`)
  return { success: true }
}
