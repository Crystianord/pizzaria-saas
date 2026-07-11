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

// ─── Limites ───────────────────────────────────────────────────
const MAX_NOME       = 100
const MAX_TEL        = 20
const MAX_ENDERECO   = 200
const MAX_BAIRRO     = 60
const MAX_OBS        = 500
const MAX_ITEMS      = 30
const MAX_QTD_ITEM   = 99
const MAX_NOME_PROD  = 200
const MAX_NOME_VAR   = 80

// ─── Helpers ───────────────────────────────────────────────────
function clamp(str, max) {
  return (str || '').toString().trim().slice(0, max)
}

function precoComPromo(precoBase, promo) {
  if (!promo) return precoBase
  if (promo.tipo === 'pct')  return Math.max(0, precoBase * (1 - (promo.desconto_pct || 0) / 100))
  if (promo.tipo === 'fixo') return Math.max(0, precoBase - (promo.desconto_fixo || 0))
  return precoBase
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

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
  if (!Array.isArray(items) || items.length === 0) return { error: 'Carrinho vazio.' }
  if (items.length > MAX_ITEMS) return { error: 'Pedido muito grande (máx. 30 itens).' }

  // ── 5. Coletar IDs únicos para batch lookup ────────────────
  const variantIds = [...new Set(
    items.filter(i => !i.ehMeiaMeia && i.variantId).map(i => i.variantId)
  )]
  const meiaProductIds = [...new Set(
    items.flatMap(i => i.ehMeiaMeia
      ? [i.meiaMetaInfo?.sabor1?.productId, i.meiaMetaInfo?.sabor2?.productId].filter(Boolean)
      : []
    )
  )]
  const allProductIds = new Set(meiaProductIds)

  // ── 6. Buscar variants do banco (preço oficial) ────────────
  let variantsByid = new Map()
  if (variantIds.length > 0) {
    const { data: variants, error: vErr } = await supabase
      .from('product_variants')
      .select('id, product_id, nome, preco, ativo')
      .in('id', variantIds)
      .eq('store_id', storeId)
      .eq('ativo', true)
    if (vErr) return { error: 'Erro ao validar produtos.' }
    variantsByid = new Map((variants || []).map(v => [v.id, v]))
    for (const v of variants || []) allProductIds.add(v.product_id)
  }

  // ── 7. Buscar variants para meia-a-meia (por tamanho) ──────
  // Resolve no servidor — não confia no client para preço/disponibilidade
  let meiaVariantsByKey = new Map()  // key = `${product_id}|${nome}`
  if (meiaProductIds.length > 0) {
    const meiaTamanhos = [...new Set(
      items.filter(i => i.ehMeiaMeia && i.nomeVariante).map(i => i.nomeVariante)
    )]
    if (meiaTamanhos.length > 0) {
      const { data: meiaVariants, error: mErr } = await supabase
        .from('product_variants')
        .select('id, product_id, nome, preco, ativo')
        .in('product_id', meiaProductIds)
        .in('nome', meiaTamanhos)
        .eq('store_id', storeId)
        .eq('ativo', true)
      if (mErr) return { error: 'Erro ao validar sabores de meia-a-meia.' }
      meiaVariantsByKey = new Map(
        (meiaVariants || []).map(v => [`${v.product_id}|${v.nome}`, v])
      )
    }
  }

  // ── 8. Buscar promoções ativas ─────────────────────────────
  let promosByProductId = new Map()
  if (allProductIds.size > 0) {
    const { data: promos } = await supabase
      .from('promotions')
      .select('product_id, tipo, desconto_pct, desconto_fixo')
      .eq('store_id', storeId)
      .eq('ativo', true)
      .in('product_id', [...allProductIds])
    promosByProductId = new Map((promos || []).map(p => [p.product_id, p]))
  }

  // ── 9. Construir orderItems com preços do servidor ─────────
  const orderItems = []

  for (const item of items) {
    const quantidade = Math.max(1, Math.min(Number(item.quantidade) || 1, MAX_QTD_ITEM))

    if (item.ehMeiaMeia) {
      if (!store.meia_a_meia_enabled) {
        return { error: 'Meia-a-meia não está habilitado neste restaurante.' }
      }
      const meta = item.meiaMetaInfo
      const tamanho = clamp(item.nomeVariante, MAX_NOME_VAR)
      if (!meta?.sabor1?.productId || !meta?.sabor2?.productId || !tamanho) {
        return { error: 'Meia-a-meia inválido.' }
      }
      const v1 = meiaVariantsByKey.get(`${meta.sabor1.productId}|${tamanho}`)
      const v2 = meiaVariantsByKey.get(`${meta.sabor2.productId}|${tamanho}`)
      if (!v1 || !v2) return { error: `Sabor indisponível no tamanho ${tamanho}.` }

      const p1    = precoComPromo(Number(v1.preco), promosByProductId.get(v1.product_id))
      const p2    = precoComPromo(Number(v2.preco), promosByProductId.get(v2.product_id))
      const regra = store.meia_a_meia_rule || 'max'
      const preco = round2(regra === 'avg' ? (p1 + p2) / 2 : Math.max(p1, p2))

      orderItems.push({
        productId:    null,
        variantId:    null,
        nomeProduto:  clamp(item.nomeProduto, MAX_NOME_PROD) || 'Meia a meia',
        nomeVariante: tamanho,
        preco,
        quantidade,
        ehMeiaMeia:   true,
        meiaMetaInfo: {
          sabor1: { productId: meta.sabor1.productId, nome: meta.sabor1.nome?.toString().slice(0, MAX_NOME_PROD), fotoUrl: meta.sabor1.fotoUrl?.toString().slice(0, 500) || null },
          sabor2: { productId: meta.sabor2.productId, nome: meta.sabor2.nome?.toString().slice(0, MAX_NOME_PROD), fotoUrl: meta.sabor2.fotoUrl?.toString().slice(0, 500) || null },
          regra,
        },
      })
    } else {
      const variant = variantsByid.get(item.variantId)
      if (!variant) return { error: 'Produto indisponível ou inativo.' }

      const preco = round2(
        precoComPromo(Number(variant.preco), promosByProductId.get(variant.product_id))
      )

      orderItems.push({
        productId:    variant.product_id,
        variantId:    variant.id,
        nomeProduto:  clamp(item.nomeProduto, MAX_NOME_PROD) || '',
        nomeVariante: clamp(variant.nome, MAX_NOME_VAR),
        preco,
        quantidade,
        ehMeiaMeia:   false,
        meiaMetaInfo: null,
      })
    }
  }

  // ── 10. Totais (servidor é a fonte da verdade) ─────────────
  const subtotal    = round2(orderItems.reduce((s, i) => s + i.preco * i.quantidade, 0))
  const taxaEntrega = tipoEntrega === 'entrega' ? round2(Number(store.taxa_entrega) || 0) : 0
  const total       = round2(subtotal + taxaEntrega)

  if (subtotal <= 0 || total <= 0) return { error: 'Pedido inválido.' }

  // ── 11. Insert do pedido ───────────────────────────────────
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

  // ── 12. Insert dos itens (rollback se falhar) ──────────────
  const itemsToInsert = orderItems.map(i => ({
    order_id:       order.id,
    store_id:       storeId,
    product_id:     i.productId,
    variant_id:     i.variantId,
    nome_produto:   i.nomeProduto,
    nome_variante:  i.nomeVariante,
    quantidade:     i.quantidade,
    preco_unitario: i.preco,
    eh_meia_meia:   i.ehMeiaMeia,
    meia_meia_info: i.meiaMetaInfo,
    subtotal:       round2(i.preco * i.quantidade),
  }))

  const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert)
  if (itemsError) {
    console.error('[createOrder] itemsError:', itemsError.code, itemsError.message)
    // Rollback manual: apaga o pedido órfão para não poluir a fila do admin
    await supabase.from('orders').delete().eq('id', order.id)
    return { error: 'Erro ao salvar itens do pedido. Tente novamente.' }
  }

  return { success: true, orderId: order.id }
}
