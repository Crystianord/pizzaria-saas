/**
 * Montagem e validação dos itens de um pedido — server-side.
 *
 * Usado pelos DOIS caminhos de criação de pedido (site público e pedido manual
 * do admin), que antes duplicavam essa lógica com validações diferentes: o
 * manual não aplicava promoção e caía no preço enviado pelo cliente se a
 * variante sumisse do banco.
 *
 * ── A invariante de segurança ──────────────────────────────────────────────
 * O cliente manda APENAS IDs e quantidades. Nome e preço saem sempre do banco.
 * Se um dia alguém adicionar um campo de preço vindo do payload aqui, o cliente
 * passa a poder comprar pizza por R$ 0,01.
 *
 * ── A fórmula de preço ────────────────────────────────────────────────────
 *   base   = variante ? variante.preco : produto.preco
 *   extras = Σ preco_extra das opções escolhidas
 *   preço  = round2( promo(base + extras) )      ← a promoção incide sobre TUDO
 *
 * `MenuClient.js` precisa calcular exatamente o mesmo, ou o cliente vê o preço
 * mudar entre o carrinho e o checkout.
 */

export const MAX_ITEMS       = 30
export const MAX_QTD_ITEM    = 99
export const MAX_OPCOES_ITEM = 20   // teto de opções escolhidas por item
export const MAX_NOME_PROD   = 200
export const MAX_NOME_VAR    = 80

export function clamp(str, max) {
  return (str || '').toString().trim().slice(0, max)
}

export function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

export function precoComPromo(precoBase, promo) {
  if (!promo) return precoBase
  if (promo.tipo === 'pct')  return Math.max(0, precoBase * (1 - (promo.desconto_pct  || 0) / 100))
  if (promo.tipo === 'fixo') return Math.max(0, precoBase - (promo.desconto_fixo || 0))
  return precoBase
}

/**
 * Valida os itens do carrinho e devolve as linhas prontas para order_items.
 *
 * @param {object}   supabase  cliente com permissão de leitura no catálogo
 * @param {string}   storeId
 * @param {Array}    items     items_json vindo do cliente
 * @param {object}   store     { meia_a_meia_enabled, meia_a_meia_rule }
 * @returns {Promise<{ orderItems?: Array, error?: string }>}
 */
export async function buildOrderItems(supabase, storeId, items, store) {
  if (!Array.isArray(items) || items.length === 0) return { error: 'Carrinho vazio.' }
  if (items.length > MAX_ITEMS) return { error: `Pedido muito grande (máx. ${MAX_ITEMS} itens).` }

  // ── Coleta de IDs para os batch lookups ──────────────────────────────────
  const variantIds = [...new Set(items.filter(i => !i.ehMeiaMeia && i.variantId).map(i => i.variantId))]
  const produtoIds = [...new Set(items.filter(i => !i.ehMeiaMeia && i.productId).map(i => i.productId))]
  const meiaProductIds = [...new Set(items.flatMap(i => i.ehMeiaMeia
    ? [i.meiaMetaInfo?.sabor1?.productId, i.meiaMetaInfo?.sabor2?.productId].filter(Boolean)
    : []))]
  const opcaoIds = [...new Set(items.flatMap(i => (i.opcoes || []).flatMap(o => o.itemIds || [])))]

  if (opcaoIds.length > items.length * MAX_OPCOES_ITEM) {
    return { error: 'Opções demais no pedido.' }
  }

  const allProductIds = new Set([...produtoIds, ...meiaProductIds])

  // ── Produtos (preço base quando não há variante) ─────────────────────────
  let produtosById = new Map()
  if (allProductIds.size > 0) {
    const { data, error } = await supabase
      .from('products')
      .select('id, nome, preco, ativo')
      .in('id', [...allProductIds])
      .eq('store_id', storeId)
      .eq('ativo', true)
    if (error) return { error: 'Erro ao validar produtos.' }
    produtosById = new Map((data || []).map(p => [p.id, p]))
  }

  // ── Variantes ────────────────────────────────────────────────────────────
  let variantsById = new Map()
  if (variantIds.length > 0) {
    const { data, error } = await supabase
      .from('product_variants')
      .select('id, product_id, nome, preco, ativo')
      .in('id', variantIds)
      .eq('store_id', storeId)
      .eq('ativo', true)
    if (error) return { error: 'Erro ao validar produtos.' }
    variantsById = new Map((data || []).map(v => [v.id, v]))
    for (const v of data || []) allProductIds.add(v.product_id)
  }

  // ── Variantes da meia-a-meia (resolvidas por tamanho) ────────────────────
  let meiaVariantsByKey = new Map()
  if (meiaProductIds.length > 0) {
    const tamanhos = [...new Set(items.filter(i => i.ehMeiaMeia && i.nomeVariante).map(i => i.nomeVariante))]
    if (tamanhos.length > 0) {
      const { data, error } = await supabase
        .from('product_variants')
        .select('id, product_id, nome, preco, ativo')
        .in('product_id', meiaProductIds)
        .in('nome', tamanhos)
        .eq('store_id', storeId)
        .eq('ativo', true)
      if (error) return { error: 'Erro ao validar sabores de meia-a-meia.' }
      meiaVariantsByKey = new Map((data || []).map(v => [`${v.product_id}|${v.nome}`, v]))
    }
  }

  // ── Grupos de opção anexados aos produtos do carrinho ────────────────────
  // Guarda o vínculo produto→grupo: é ele que impede o cliente de mandar uma
  // opção de um grupo que não pertence ao produto que ele está comprando.
  let gruposPorProduto = new Map()  // productId -> Map(groupId -> { min, max, nome })
  if (allProductIds.size > 0) {
    const { data, error } = await supabase
      .from('product_option_groups')
      .select('product_id, group_id, min_selecao, max_selecao, ordem, option_groups(nome, ativo)')
      .in('product_id', [...allProductIds])
      .eq('store_id', storeId)
      .order('ordem', { ascending: true })
    if (error) return { error: 'Erro ao validar opções.' }

    for (const g of data || []) {
      if (!g.option_groups?.ativo) continue
      if (!gruposPorProduto.has(g.product_id)) gruposPorProduto.set(g.product_id, new Map())
      gruposPorProduto.get(g.product_id).set(g.group_id, {
        min:  g.min_selecao,
        max:  g.max_selecao,
        nome: g.option_groups.nome,
      })
    }
  }

  // ── Opções escolhidas (nome e preço vêm daqui, nunca do cliente) ─────────
  let opcoesById = new Map()
  if (opcaoIds.length > 0) {
    const { data, error } = await supabase
      .from('option_items')
      .select('id, group_id, nome, preco_extra, ativo')
      .in('id', opcaoIds)
      .eq('store_id', storeId)
      .eq('ativo', true)
    if (error) return { error: 'Erro ao validar opções.' }
    opcoesById = new Map((data || []).map(o => [o.id, o]))
  }

  // ── Promoções ativas ─────────────────────────────────────────────────────
  let promosByProductId = new Map()
  if (allProductIds.size > 0) {
    const { data } = await supabase
      .from('promotions')
      .select('product_id, tipo, desconto_pct, desconto_fixo')
      .eq('store_id', storeId)
      .eq('ativo', true)
      .in('product_id', [...allProductIds])
    promosByProductId = new Map((data || []).map(p => [p.product_id, p]))
  }

  // ── Montagem ─────────────────────────────────────────────────────────────
  const orderItems = []

  for (const item of items) {
    const quantidade = Math.max(1, Math.min(Number(item.quantidade) || 1, MAX_QTD_ITEM))

    // ---- Meia a meia (fluxo antigo, preservado) ----
    if (item.ehMeiaMeia) {
      if (!store.meia_a_meia_enabled) return { error: 'Meia-a-meia não está habilitado neste restaurante.' }

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
          sabor1: { productId: meta.sabor1.productId, nome: clamp(meta.sabor1.nome, MAX_NOME_PROD), fotoUrl: meta.sabor1.fotoUrl?.toString().slice(0, 500) || null },
          sabor2: { productId: meta.sabor2.productId, nome: clamp(meta.sabor2.nome, MAX_NOME_PROD), fotoUrl: meta.sabor2.fotoUrl?.toString().slice(0, 500) || null },
          regra,
        },
        opcoesInfo: null,
      })
      continue
    }

    // ---- Item normal (com ou sem variante, com ou sem opções) ----
    const variant = item.variantId ? variantsById.get(item.variantId) : null
    if (item.variantId && !variant) return { error: 'Produto indisponível ou inativo.' }

    const productId = variant ? variant.product_id : item.productId
    const produto   = produtosById.get(productId)
    if (!produto) return { error: 'Produto indisponível ou inativo.' }

    // Sem variante → o preço é o do próprio produto (combos, bebidas)
    const base = variant ? Number(variant.preco) : Number(produto.preco)
    if (!(base > 0)) return { error: `Produto sem preço: ${produto.nome}.` }

    // ---- Opções: valida grupo por grupo ----
    const gruposDoProduto = gruposPorProduto.get(productId) || new Map()
    const enviadas = new Map()  // groupId -> itemIds[]
    for (const o of item.opcoes || []) {
      if (!o?.groupId) continue
      enviadas.set(o.groupId, [...new Set(o.itemIds || [])])
    }

    let extras = 0
    const opcoesInfo = []

    for (const [groupId, regra] of gruposDoProduto) {
      const escolhidas = enviadas.get(groupId) || []

      if (escolhidas.length < regra.min) {
        return { error: `"${produto.nome}": escolha ao menos ${regra.min} em "${regra.nome}".` }
      }
      if (escolhidas.length > regra.max) {
        return { error: `"${produto.nome}": no máximo ${regra.max} em "${regra.nome}".` }
      }

      const itens = []
      for (const opcaoId of escolhidas) {
        const opcao = opcoesById.get(opcaoId)
        if (!opcao) return { error: 'Opção indisponível.' }

        // A opção precisa ser DESTE grupo. Sem esta checagem, o cliente poderia
        // mandar o id de um adicional caro de outro produto e pagar menos.
        if (opcao.group_id !== groupId) return { error: 'Opção inválida para este produto.' }

        extras += Number(opcao.preco_extra) || 0
        itens.push({ nome: opcao.nome, preco_extra: Number(opcao.preco_extra) || 0 })
      }

      if (itens.length > 0) opcoesInfo.push({ grupo: regra.nome, itens })
    }

    // Opções enviadas para um grupo que não pertence a este produto
    for (const groupId of enviadas.keys()) {
      if (!gruposDoProduto.has(groupId)) return { error: 'Opção inválida para este produto.' }
    }

    const preco = round2(precoComPromo(base + extras, promosByProductId.get(productId)))

    orderItems.push({
      productId,
      variantId:    variant ? variant.id : null,
      nomeProduto:  clamp(produto.nome, MAX_NOME_PROD),
      nomeVariante: variant ? clamp(variant.nome, MAX_NOME_VAR) : null,
      preco,
      quantidade,
      ehMeiaMeia:   false,
      meiaMetaInfo: null,
      opcoesInfo:   opcoesInfo.length ? opcoesInfo : null,
    })
  }

  return { orderItems }
}

/** Converte o resultado de buildOrderItems em linhas prontas para o insert. */
export function toOrderItemRows(orderItems, orderId, storeId) {
  return orderItems.map(i => ({
    order_id:       orderId,
    store_id:       storeId,
    product_id:     i.productId,
    variant_id:     i.variantId,
    nome_produto:   i.nomeProduto,
    nome_variante:  i.nomeVariante,
    quantidade:     i.quantidade,
    preco_unitario: i.preco,
    eh_meia_meia:   i.ehMeiaMeia,
    meia_meia_info: i.meiaMetaInfo,
    opcoes_info:    i.opcoesInfo,
    subtotal:       round2(i.preco * i.quantidade),
  }))
}
