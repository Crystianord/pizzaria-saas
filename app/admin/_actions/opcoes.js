/**
 * SERVER ACTIONS — Grupos de opções e adicionais
 *
 * Um grupo ("Escolha seu Sabor!", "Adicione Mais Sabor!") vive no nível da LOJA
 * e é reutilizado por vários produtos. O mínimo e o máximo de escolhas ficam no
 * vínculo produto↔grupo, não no grupo — é isso que permite os mesmos 27 sabores
 * servirem tanto um produto "escolha 1" quanto um "escolha 5" sem duplicar nada.
 *
 * Segurança: toda operação é escopada por store_id (via getStoreContext), e o
 * RLS do Supabase garante que o admin só toca na própria loja.
 */

'use server'
import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

async function getStoreContext(supabase) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado.')

  const { data } = await supabase
    .from('admin_stores')
    .select('store_id, stores(slug)')
    .eq('user_id', user.id)
    .single()

  return { storeId: data.store_id, storeSlug: data.stores.slug }
}

function revalidar(slug) {
  revalidatePath(`/admin/${slug}/catalog/opcoes`)
  revalidatePath(`/admin/${slug}/catalog`)
}

// ─── GRUPOS ───────────────────────────────────────────────────────────────────

export async function createGroup(prevState, formData) {
  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)

  const nome = (formData.get('nome') || '').toString().trim()
  const tipo = formData.get('tipo') === 'adicional' ? 'adicional' : 'escolha'

  if (!nome) return { error: 'Dê um nome ao grupo.' }

  const { error } = await supabase.from('option_groups').insert({
    store_id: storeId,
    nome,
    tipo,
    ordem: 99,
    ativo: true,
  })

  if (error) return { error: 'Erro ao criar grupo.' }

  revalidar(storeSlug)
  return { success: true }
}

export async function updateGroup(groupId, nome, tipo) {
  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)

  if (!nome?.trim()) return { error: 'Dê um nome ao grupo.' }

  await supabase
    .from('option_groups')
    .update({ nome: nome.trim(), tipo: tipo === 'adicional' ? 'adicional' : 'escolha' })
    .eq('id', groupId)
    .eq('store_id', storeId)

  revalidar(storeSlug)
  return { success: true }
}

export async function toggleGroup(groupId, ativo) {
  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)

  await supabase
    .from('option_groups')
    .update({ ativo })
    .eq('id', groupId)
    .eq('store_id', storeId)

  revalidar(storeSlug)
}

export async function deleteGroup(groupId) {
  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)

  // Um grupo em uso por algum produto não pode sumir sem aviso — o cardápio
  // ficaria com um produto que não dá mais para configurar.
  const { count } = await supabase
    .from('product_option_groups')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('store_id', storeId)

  if (count > 0) {
    return { error: `Este grupo está em uso por ${count} produto(s). Desvincule antes de excluir.` }
  }

  await supabase.from('option_groups').delete().eq('id', groupId).eq('store_id', storeId)

  revalidar(storeSlug)
  return { success: true }
}

// ─── OPÇÕES DENTRO DO GRUPO ───────────────────────────────────────────────────

export async function addOption(groupId, nome, descricao, precoExtra) {
  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)

  const nomeLimpo = (nome || '').toString().trim()
  if (!nomeLimpo) return { error: 'Dê um nome à opção.' }

  const preco = parseFloat(precoExtra)
  const precoFinal = isNaN(preco) || preco < 0 ? 0 : preco

  const { error } = await supabase.from('option_items').insert({
    group_id:    groupId,
    store_id:    storeId,
    nome:        nomeLimpo,
    descricao:   (descricao || '').toString().trim() || null,
    preco_extra: precoFinal,
    ordem:       99,
    ativo:       true,
  })

  if (error) return { error: 'Erro ao adicionar opção.' }

  revalidar(storeSlug)
  return { success: true }
}

export async function updateOption(optionId, nome, descricao, precoExtra) {
  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)

  const nomeLimpo = (nome || '').toString().trim()
  if (!nomeLimpo) return { error: 'Dê um nome à opção.' }

  const preco = parseFloat(precoExtra)

  await supabase
    .from('option_items')
    .update({
      nome:        nomeLimpo,
      descricao:   (descricao || '').toString().trim() || null,
      preco_extra: isNaN(preco) || preco < 0 ? 0 : preco,
    })
    .eq('id', optionId)
    .eq('store_id', storeId)

  revalidar(storeSlug)
  return { success: true }
}

export async function removeOption(optionId) {
  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)

  await supabase.from('option_items').delete().eq('id', optionId).eq('store_id', storeId)

  revalidar(storeSlug)
}

// ─── VÍNCULO PRODUTO ↔ GRUPO ──────────────────────────────────────────────────

/**
 * O min/max vive aqui, e não no grupo: é o que permite o mesmo grupo de sabores
 * ser "escolha 1" num produto e "escolha 5" em outro.
 */
export async function attachGroup(productId, groupId, minSelecao, maxSelecao) {
  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)

  const min = Math.max(0, parseInt(minSelecao) || 0)
  const max = Math.max(1, parseInt(maxSelecao) || 1)

  if (max < min) return { error: 'O máximo não pode ser menor que o mínimo.' }

  const { error } = await supabase.from('product_option_groups').insert({
    product_id:  productId,
    group_id:    groupId,
    store_id:    storeId,
    min_selecao: min,
    max_selecao: max,
    ordem:       99,
  })

  if (error) {
    // UNIQUE(product_id, group_id)
    if (error.code === '23505') return { error: 'Este grupo já está neste produto.' }
    return { error: 'Erro ao vincular grupo.' }
  }

  revalidatePath(`/admin/${storeSlug}/catalog`)
  return { success: true }
}

export async function updateAttachment(attachmentId, minSelecao, maxSelecao) {
  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)

  const min = Math.max(0, parseInt(minSelecao) || 0)
  const max = Math.max(1, parseInt(maxSelecao) || 1)

  if (max < min) return { error: 'O máximo não pode ser menor que o mínimo.' }

  await supabase
    .from('product_option_groups')
    .update({ min_selecao: min, max_selecao: max })
    .eq('id', attachmentId)
    .eq('store_id', storeId)

  revalidatePath(`/admin/${storeSlug}/catalog`)
  return { success: true }
}

export async function detachGroup(attachmentId) {
  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)

  await supabase
    .from('product_option_groups')
    .delete()
    .eq('id', attachmentId)
    .eq('store_id', storeId)

  revalidatePath(`/admin/${storeSlug}/catalog`)
}
