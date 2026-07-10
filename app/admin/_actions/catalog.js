/**
 * SERVER ACTIONS — Catálogo (Produtos, Variantes, Categorias, Promoções)
 *
 * Gerencia tudo que aparece no cardápio público da pizzaria.
 * Cada função só afeta os dados da loja do admin autenticado (isolamento via store_id).
 *
 * Estrutura do catálogo (hierarquia):
 *   categorias
 *     └─ produtos (foto, nome, ativo)
 *          └─ variantes (tamanho P/M/G + preço individual)
 *               └─ promoções (desconto percentual ou fixo sobre o preço da variante)
 *
 * Padrão comum a todas as funções:
 *   1. getStoreContext(supabase) — descobre qual loja o admin gerencia
 *   2. Opera apenas nos registros com store_id = storeId
 *   3. Chama revalidatePath para invalidar o cache do Next.js
 *      (sem isso, a página continuaria mostrando dados velhos do cache)
 */

'use server'
import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

/**
 * getStoreContext — Helper interno: descobre a loja do admin autenticado.
 *
 * Centralizamos aqui para não repetir o mesmo par de queries em cada função.
 * Retorna { storeId, storeSlug } que são usados em praticamente toda operação do catálogo.
 *
 * @param {SupabaseClient} supabase - Client já inicializado com a sessão do usuário
 * @returns {{ storeId: string, storeSlug: string }}
 */
async function getStoreContext(supabase) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
    .from('admin_stores')
    .select('store_id, stores(slug)')
    .eq('user_id', user.id)
    .single()
  return { storeId: data.store_id, storeSlug: data.stores.slug }
}

// ─── PRODUTOS ─────────────────────────────────────────────────────────────────

/**
 * createProduct — Cria um produto com suas variantes de tamanho.
 *
 * O produto é criado primeiro (INSERT em 'products'), depois as variantes são
 * inseridas em lote (INSERT em 'product_variants').
 * Se a inserção das variantes falhar, o produto permanece no banco sem tamanhos
 * — retornamos um aviso para o admin corrigir, mas não fazemos rollback do produto.
 *
 * @param {Object} prevState - Estado anterior (useActionState)
 * @param {FormData} formData - Campos:
 *   - nome: nome do produto
 *   - category_id: UUID da categoria
 *   - foto_url: URL da imagem no Supabase Storage (opcional)
 *   - variant_nome[]: array de nomes de tamanho (ex: ["P", "M", "G"])
 *   - variant_preco[]: array de preços correspondentes (ex: ["25.90", "32.90", "39.90"])
 */
export async function createProduct(prevState, formData) {
  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)

  // Cria o produto base (sem preço próprio — preço mora nas variantes)
  const { data: product, error } = await supabase
    .from('products')
    .insert({
      store_id:    storeId,
      nome:        formData.get('nome'),
      category_id: formData.get('category_id'),
      foto_url:    formData.get('foto_url') || null,
      preco:       0,  // campo legado — preço real fica nas variantes
      ativo:       true,
    })
    .select('id')
    .single()

  if (error) return { error: 'Erro ao criar produto. Verifique os campos e tente novamente.' }

  // Coleta os arrays paralelos de nomes e preços das variantes
  const variantNames  = formData.getAll('variant_nome')
  const variantPrices = formData.getAll('variant_preco')

  // Filtra variantes inválidas (nome vazio ou preço <= 0) antes de inserir
  const variants = variantNames
    .map((nome, i) => ({
      product_id: product.id,
      store_id:   storeId,
      nome,
      preco: parseFloat(variantPrices[i]),
      ordem: i,       // ordem de exibição no cardápio
      ativo: true,
    }))
    .filter(v => v.nome && !isNaN(v.preco) && v.preco > 0)

  if (variants.length > 0) {
    const { error: varErr } = await supabase.from('product_variants').insert(variants)
    if (varErr) return { error: 'Produto criado, mas houve erro ao salvar os tamanhos.' }
  }

  revalidatePath(`/admin/${storeSlug}/catalog`)
  return { success: true }
}

/**
 * updateProduct — Edita os dados básicos de um produto (nome, categoria, foto).
 *
 * Não altera variantes — para mudar preços, usar updateVariantPrice ou addVariant.
 * A cláusula .eq('store_id', storeId) garante que o admin não edita produto de outra loja.
 */
export async function updateProduct(prevState, formData) {
  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)
  const productId = formData.get('product_id')

  const { error } = await supabase
    .from('products')
    .update({
      nome:        formData.get('nome'),
      category_id: formData.get('category_id'),
      foto_url:    formData.get('foto_url') || null,
    })
    .eq('id', productId)
    .eq('store_id', storeId)  // proteção: admin não edita produto de outra loja

  if (error) return { error: 'Erro ao atualizar produto.' }

  revalidatePath(`/admin/${storeSlug}/catalog`)
  return { success: true }
}

/**
 * toggleProductActive — Ativa ou desativa um produto no cardápio.
 *
 * Produtos desativados não aparecem no cardápio público (app/[store-slug]/page.js
 * filtra por .eq('ativo', true)). Útil para produtos temporariamente indisponíveis.
 *
 * O estado atual é lido do banco antes de inverter (toggle pattern),
 * evitando race conditions de estado desatualizado no client.
 */
export async function toggleProductActive(productId) {
  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)

  // Lê estado atual no banco (não confia no estado que o cliente enviou)
  const { data } = await supabase
    .from('products')
    .select('ativo')
    .eq('id', productId)
    .eq('store_id', storeId)
    .single()

  if (!data) return  // produto não encontrado nesta loja — ignorar silenciosamente

  await supabase
    .from('products')
    .update({ ativo: !data.ativo })
    .eq('id', productId)
    .eq('store_id', storeId)

  revalidatePath(`/admin/${storeSlug}/catalog`)
}

// ─── VARIANTES ────────────────────────────────────────────────────────────────

/**
 * updateVariantPrice — Atualiza o preço de uma variante (tamanho) específica.
 *
 * Lança erro (throw) em vez de retornar { error } porque este método é chamado
 * de forma direta (não via useActionState), e o cliente trata o erro via try/catch.
 *
 * @param {string} variantId - UUID da variante
 * @param {number|string} newPrice - Novo preço (será convertido com parseFloat)
 */
export async function updateVariantPrice(variantId, newPrice) {
  const price = parseFloat(newPrice)
  if (isNaN(price) || price <= 0) throw new Error('Preço inválido')

  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)

  await supabase
    .from('product_variants')
    .update({ preco: price })
    .eq('id', variantId)
    .eq('store_id', storeId)

  revalidatePath(`/admin/${storeSlug}/catalog`)
}

/**
 * addVariant — Adiciona um novo tamanho/variante a um produto existente.
 *
 * @param {string} productId - UUID do produto pai
 * @param {string} nome      - Nome do tamanho (ex: "G", "Família", "500ml")
 * @param {number} preco     - Preço da nova variante
 */
export async function addVariant(productId, nome, preco) {
  const price = parseFloat(preco)
  if (!nome || isNaN(price) || price <= 0) return { error: 'Nome e preço são obrigatórios.' }

  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)

  await supabase.from('product_variants').insert({
    product_id: productId,
    store_id:   storeId,
    nome,
    preco:  price,
    ordem:  99,   // ao final da lista — o admin pode reordenar depois
    ativo:  true,
  })

  revalidatePath(`/admin/${storeSlug}/catalog`)
}

/**
 * removeVariant — Remove um tamanho/variante de um produto.
 *
 * Regra de negócio: um produto precisa ter ao menos 1 variante ativa.
 * Se o admin tentar remover a última variante, a ação é bloqueada com mensagem de erro.
 * Isso evita produtos sem preço no cardápio público.
 *
 * @param {string} variantId  - UUID da variante a remover
 * @param {string} productId  - UUID do produto pai (para verificar quantas variantes restam)
 */
export async function removeVariant(variantId, productId) {
  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)

  // Conta variantes ativas antes de apagar
  const { count } = await supabase
    .from('product_variants')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId)
    .eq('ativo', true)

  if (count <= 1) return { error: 'O produto precisa ter pelo menos um tamanho.' }

  await supabase
    .from('product_variants')
    .delete()
    .eq('id', variantId)
    .eq('store_id', storeId)

  revalidatePath(`/admin/${storeSlug}/catalog`)
}

// ─── PROMOÇÕES ────────────────────────────────────────────────────────────────

/**
 * setPromotion — Define uma promoção ativa em um produto.
 *
 * Lógica de negócio:
 *   1. Desativa TODAS as promoções ativas deste produto (garante que só existe 1 ativa)
 *   2. Cria uma nova promoção com o tipo e valor informados
 *
 * Tipos de promoção:
 *   - 'pct'  → percentual (ex: 10% de desconto) — desconto_pct = 10
 *   - 'fixo' → valor fixo (ex: R$5 de desconto) — desconto_fixo = 5
 *
 * O cálculo do preço final acontece em app/store/_actions/orders.js (função precoComPromo),
 * sempre no servidor, garantindo que o desconto não pode ser manipulado pelo cliente.
 *
 * @param {string} productId - UUID do produto
 * @param {'pct'|'fixo'} type - Tipo de desconto
 * @param {number|string} value - Valor do desconto (percentual ou fixo)
 */
export async function setPromotion(productId, type, value) {
  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)

  // Desativa promoções antigas antes de criar a nova (evita promoções duplicadas)
  await supabase.from('promotions')
    .update({ ativo: false })
    .eq('store_id', storeId)
    .eq('product_id', productId)
    .eq('ativo', true)

  // Cria promoção nova e ativa
  await supabase.from('promotions').insert({
    store_id:      storeId,
    product_id:    productId,
    tipo:          type,
    desconto_pct:  type === 'pct'  ? parseFloat(value) : null,
    desconto_fixo: type === 'fixo' ? parseFloat(value) : null,
    ativo:         true,
    label:         'Promoção do dia',
  })

  revalidatePath(`/admin/${storeSlug}/catalog`)
}

/**
 * removePromotion — Desativa a promoção ativa de um produto.
 *
 * Não apaga o registro do banco — apenas marca ativo = false.
 * Isso preserva o histórico de promoções passadas para auditoria futura.
 */
export async function removePromotion(productId) {
  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)

  await supabase.from('promotions')
    .update({ ativo: false })
    .eq('store_id', storeId)
    .eq('product_id', productId)
    .eq('ativo', true)

  revalidatePath(`/admin/${storeSlug}/catalog`)
}

// ─── CATEGORIAS ───────────────────────────────────────────────────────────────

/**
 * createCategory — Cria uma nova categoria no catálogo.
 *
 * A ordem (campo 'ordem') determina a sequência de exibição no cardápio.
 * Novas categorias são inseridas ao final (nextOrdem = max(ordem) + 1).
 */
export async function createCategory(prevState, formData) {
  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)

  const nome = formData.get('nome')?.trim()
  if (!nome) return { error: 'Nome da categoria é obrigatório.' }

  // Calcula a próxima posição de ordem (ao final da lista)
  const { data: cats } = await supabase
    .from('categories')
    .select('ordem')
    .eq('store_id', storeId)
    .order('ordem', { ascending: false })
    .limit(1)

  const nextOrdem = cats?.[0] ? cats[0].ordem + 1 : 0

  const { error } = await supabase.from('categories').insert({
    store_id: storeId,
    nome,
    ordem: nextOrdem,
  })

  if (error) return { error: 'Erro ao criar categoria.' }

  revalidatePath(`/admin/${storeSlug}/catalog/categories`)
  revalidatePath(`/admin/${storeSlug}/catalog/setup`)
  return { success: true }
}

/**
 * updateCategory — Renomeia uma categoria existente.
 */
export async function updateCategory(categoryId, nome) {
  const nomeTrimmed = nome?.trim()
  if (!nomeTrimmed) return { error: 'Nome não pode ser vazio.' }

  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)

  await supabase.from('categories')
    .update({ nome: nomeTrimmed })
    .eq('id', categoryId)
    .eq('store_id', storeId)

  revalidatePath(`/admin/${storeSlug}/catalog/categories`)
  revalidatePath(`/admin/${storeSlug}/catalog`)
}

/**
 * deleteCategory — Apaga uma categoria do catálogo.
 *
 * Regra de negócio: categoria só pode ser excluída se não tiver produtos vinculados.
 * Isso protege contra deleção acidental que deixaria produtos órfãos sem categoria.
 *
 * @param {string} categoryId - UUID da categoria a excluir
 */
export async function deleteCategory(categoryId) {
  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)

  // Verifica se existem produtos nesta categoria antes de apagar
  const { count } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId)
    .eq('store_id', storeId)

  if (count > 0) {
    return { error: 'Remova ou mova os produtos desta categoria antes de excluí-la.' }
  }

  await supabase.from('categories')
    .delete()
    .eq('id', categoryId)
    .eq('store_id', storeId)

  revalidatePath(`/admin/${storeSlug}/catalog/categories`)
  revalidatePath(`/admin/${storeSlug}/catalog/setup`)
}

/**
 * reorderCategory — Move uma categoria uma posição acima ou abaixo.
 *
 * Estratégia de reordenação: swap do campo 'ordem' entre a categoria selecionada
 * e seu vizinho (acima ou abaixo). Simples e sem gaps na numeração.
 *
 * @param {string} categoryId - UUID da categoria a mover
 * @param {'up'|'down'} direction - Direção do movimento
 */
export async function reorderCategory(categoryId, direction) {
  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)

  // Carrega todas as categorias ordenadas para encontrar o vizinho a trocar
  const { data: cats } = await supabase
    .from('categories')
    .select('id, ordem')
    .eq('store_id', storeId)
    .order('ordem', { ascending: true })

  const idx     = cats.findIndex(c => c.id === categoryId)
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1

  // Se já está no topo (up) ou no final (down), não faz nada
  if (swapIdx < 0 || swapIdx >= cats.length) return

  // Troca os valores de 'ordem' entre os dois registros
  const a = cats[idx], b = cats[swapIdx]
  await supabase.from('categories').update({ ordem: b.ordem }).eq('id', a.id)
  await supabase.from('categories').update({ ordem: a.ordem }).eq('id', b.id)

  revalidatePath(`/admin/${storeSlug}/catalog/categories`)
  revalidatePath(`/admin/${storeSlug}/catalog/setup`)
}

// ─── WIZARD (Setup inicial) ───────────────────────────────────────────────────

/**
 * completeWizardSetup — Finaliza o wizard de configuração inicial do catálogo.
 *
 * Ao criar uma nova loja, o admin passa por um wizard que configura:
 *   - Se meia a meia está habilitado
 *   - A regra de preço do meia a meia ('avg' = média ou 'max' = maior preço)
 *
 * Ao final, marca catalog_setup_done = true para não exibir o wizard novamente.
 * Redireciona para o catálogo completo.
 */
export async function completeWizardSetup(prevState, formData) {
  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)

  const enabled = formData.get('meia_a_meia_enabled') === 'on'
  const rule    = formData.get('meia_a_meia_rule') || 'max'

  await supabase.from('stores').update({
    catalog_setup_done:  true,
    meia_a_meia_enabled: enabled,
    meia_a_meia_rule:    rule,
  }).eq('id', storeId)

  redirect(`/admin/${storeSlug}/catalog`)
}
