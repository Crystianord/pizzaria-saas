'use server'
import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'

async function ctx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado.')
  const { data } = await supabase
    .from('admin_stores')
    .select('store_id, stores(slug)')
    .eq('user_id', user.id)
    .single()
  return { supabase, storeId: data.store_id, storeSlug: data.stores.slug }
}

export async function createEntregador(prevState, formData) {
  const { supabase, storeId, storeSlug } = await ctx()

  const nome     = formData.get('nome')?.trim()
  const telefone = formData.get('telefone')?.trim()

  if (!nome || !telefone) return { error: 'Nome e telefone são obrigatórios.' }

  const { error } = await supabase.from('funcionarios').insert({
    store_id:          storeId,
    nome,
    telefone,
    cargo:             'Entregador',
    periodo_pagamento: 'semanal',
    valor_diaria:      0,
    faz_entrega:       true,
    token:             randomUUID(),
    valor_por_entrega: 0,
    modo_pagamento:    'por_entrega',
    disponivel:        false,
    ativo:             true,
  })

  if (error) return { error: 'Erro ao cadastrar entregador.' }

  revalidatePath(`/admin/${storeSlug}/entregadores`)
  return { success: true }
}

export async function updateEntregador(id, nome, telefone, storeSlug) {
  const { supabase, storeId } = await ctx()

  await supabase.from('funcionarios')
    .update({ nome: nome.trim(), telefone: telefone.trim() })
    .eq('id', id)
    .eq('store_id', storeId)
    .eq('faz_entrega', true)

  revalidatePath(`/admin/${storeSlug}/entregadores`)
}

export async function toggleEntregador(id, ativo, storeSlug) {
  const { supabase, storeId } = await ctx()

  await supabase.from('funcionarios')
    .update({ ativo: !ativo })
    .eq('id', id)
    .eq('store_id', storeId)
    .eq('faz_entrega', true)

  revalidatePath(`/admin/${storeSlug}/entregadores`)
}

export async function toggleDisponivel(id, disponivel, storeSlug) {
  const { supabase, storeId } = await ctx()

  await supabase.from('funcionarios')
    .update({ disponivel: !disponivel })
    .eq('id', id)
    .eq('store_id', storeId)
    .eq('faz_entrega', true)

  revalidatePath(`/admin/${storeSlug}/entregadores`)
  revalidatePath(`/admin/${storeSlug}/pedidos`)
}
