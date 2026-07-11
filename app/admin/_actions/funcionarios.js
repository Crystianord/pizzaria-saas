/**
 * SERVER ACTIONS — Funcionários e Folha de Pagamento
 *
 * Gerencia os funcionários da pizzaria e o sistema de pagamento por diária.
 *
 * Conceitos de negócio:
 *
 *   Funcionário (funcionarios):
 *     - Tem uma diária fixa (valor_diaria)
 *     - Tem período de pagamento (semanal, quinzenal, mensal)
 *     - Pode estar ativo (trabalhando) ou inativo (desligado/afastado)
 *
 *   Intercorrência (intercorrencias):
 *     - Ajustes sobre a diária base de um funcionário
 *     - Pode ser positiva (acréscimo: ex. "Hora extra R$30") ou negativa (desconto: ex. "Falta R$50")
 *     - O campo 'ajuste' é o valor final: positivo para acréscimo, negativo para desconto
 *
 *   Cálculo da folha (FolhaClient.js:83-85):
 *     bruto   = diasTrabalhados × valor_diaria
 *     ajustes = sum(intercorrencias.ajuste)   ← positivo soma, negativo subtrai
 *     total   = bruto + ajustes
 *
 *   Exemplo: 5 dias × R$100 + R$50 (hora extra) - R$30 (falta) = R$520
 *
 * Segurança:
 *   - ctx() centraliza autenticação e resolução do store_id
 *   - Intercorrências verificam que o funcionário pertence à loja do admin
 *     (evita que admin crie intercorrência em funcionário de outra loja)
 */

'use server'
import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { toE164 } from '@/lib/phone'

// O telefone é opcional aqui, mas quando informado precisa ser válido: é por ele
// que o entregador recebe a notificação de entrega atribuída.
function normalizaTelefone(raw) {
  const bruto = (raw || '').toString().trim()
  if (!bruto) return { telefone: null }

  const e164 = toE164(bruto)
  if (!e164) return { erro: 'Telefone inválido. Use DDD + número, ex: (62) 98189-5453.' }
  return { telefone: e164 }
}

/**
 * ctx — Helper interno: autenticação + resolução da loja.
 *
 * Todas as funções deste arquivo chamam ctx() para garantir:
 *   1. Usuário está autenticado
 *   2. store_id e storeSlug são do admin logado (não vêm do cliente)
 *
 * Lança erro se não autenticado — o chamador não precisa verificar manualmente.
 *
 * @returns {{ supabase, storeId: string, storeSlug: string }}
 */
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

// ─── CRUD Funcionários ────────────────────────────────────────────────────────

/**
 * createFuncionario — Cadastra um novo funcionário na loja.
 *
 * @param {Object} prevState - Estado anterior (useActionState)
 * @param {FormData} formData - Campos:
 *   - nome: nome completo
 *   - cargo: cargo/função (opcional)
 *   - telefone: contato (opcional)
 *   - periodo_pagamento: 'semanal' | 'quinzenal' | 'mensal'
 *   - valor_diaria: valor em reais por dia trabalhado
 *
 * Erros são logados com [createFuncionario] para facilitar debugging em produção.
 */
export async function createFuncionario(prevState, formData) {
  try {
    const { supabase, storeId, storeSlug } = await ctx()

    const tel = normalizaTelefone(formData.get('telefone'))
    if (tel.erro) return { error: tel.erro }

    const { error } = await supabase.from('funcionarios').insert({
      store_id:          storeId,
      nome:              formData.get('nome'),
      cargo:             formData.get('cargo')    || null,
      telefone:          tel.telefone,
      periodo_pagamento: formData.get('periodo_pagamento') || 'semanal',
      valor_diaria:      parseFloat(formData.get('valor_diaria')) || 0,
      ativo: true,
    })
    if (error) {
      console.error('[createFuncionario] Supabase error:', error)
      return { error: `Erro ao cadastrar funcionário: ${error.message}` }
    }
    revalidatePath(`/admin/${storeSlug}/funcionarios`)
    return { success: true }
  } catch (e) {
    console.error('[createFuncionario] Exception:', e)
    return { error: `Erro inesperado: ${e?.message ?? e}` }
  }
}

/**
 * updateFuncionario — Edita os dados de um funcionário existente.
 *
 * Não altera o status ativo/inativo — para isso usar toggleFuncionario.
 *
 * @param {string} id        - UUID do funcionário
 * @param {Object} fields    - Campos a atualizar (nome, cargo, telefone, periodo_pagamento, valor_diaria)
 * @param {string} storeSlug - Slug da loja (para revalidar cache)
 */
export async function updateFuncionario(id, fields, storeSlug) {
  const { supabase, storeId } = await ctx()

  const tel = normalizaTelefone(fields.telefone)
  if (tel.erro) return { error: tel.erro }

  await supabase.from('funcionarios')
    .update({
      nome:              fields.nome,
      cargo:             fields.cargo    || null,
      telefone:          tel.telefone,
      periodo_pagamento: fields.periodo_pagamento,
      valor_diaria:      parseFloat(fields.valor_diaria) || 0,
    })
    .eq('id', id)
    .eq('store_id', storeId)  // garante que o admin só edita funcionários da sua loja
  revalidatePath(`/admin/${storeSlug}/funcionarios`)
  return { success: true }
}

/**
 * toggleFuncionario — Ativa ou desativa um funcionário.
 *
 * Funcionário inativo:
 *   - Não aparece nas listagens principais
 *   - O histórico de intercorrências e folhas passadas é preservado
 *   - Não é deletado do banco (preservação de histórico financeiro)
 *
 * @param {string} id        - UUID do funcionário
 * @param {boolean} ativo    - Estado atual (será invertido)
 * @param {string} storeSlug - Slug da loja
 */
export async function toggleFuncionario(id, ativo, storeSlug) {
  const { supabase, storeId } = await ctx()
  await supabase.from('funcionarios')
    .update({ ativo: !ativo })
    .eq('id', id)
    .eq('store_id', storeId)
  revalidatePath(`/admin/${storeSlug}/funcionarios`)
  return { success: true }
}

// ─── Intercorrências ──────────────────────────────────────────────────────────

/**
 * createIntercorrencia — Registra um ajuste (positivo ou negativo) na folha de um funcionário.
 *
 * Tipos:
 *   - 'acrescimo' → o campo 'ajuste' no banco fica positivo (+valor)
 *     Ex: hora extra R$30 → ajuste = +30
 *   - 'desconto' → o campo 'ajuste' no banco fica negativo (-valor)
 *     Ex: falta injustificada R$50 → ajuste = -50
 *
 * A FolhaClient.js soma todos os 'ajuste' do período para calcular o total a pagar.
 *
 * Segurança importante:
 *   Verificamos que o funcionário pertence à loja do admin ANTES de inserir.
 *   Sem isso, um admin poderia criar intercorrência em funcionário de outra loja.
 *
 * @param {Object} prevState - Estado anterior (useActionState)
 * @param {FormData} formData - Campos:
 *   - funcionario_id: UUID do funcionário
 *   - tipo: 'acrescimo' | 'desconto'
 *   - valor: valor absoluto do ajuste (sempre positivo; o sinal é calculado pelo tipo)
 *   - data: data do evento (YYYY-MM-DD)
 *   - descricao: motivo do ajuste (ex: "Hora extra no sábado")
 */
export async function createIntercorrencia(prevState, formData) {
  try {
    const { supabase, storeId, storeSlug } = await ctx()
    const tipo          = formData.get('tipo')  // 'desconto' | 'acrescimo'
    const valor         = parseFloat(formData.get('valor')) || 0
    const ajuste        = tipo === 'desconto' ? -valor : valor  // sinal aplicado aqui
    const funcionarioId = formData.get('funcionario_id')

    // Verificação de ownership: o funcionário deve pertencer a esta loja
    // Sem isso, o admin poderia registrar intercorrência em funcionário de outra pizzaria
    const { data: func } = await supabase
      .from('funcionarios')
      .select('id')
      .eq('id', funcionarioId)
      .eq('store_id', storeId)
      .single()
    if (!func) return { error: 'Funcionário não encontrado.' }

    const { data, error } = await supabase
      .from('intercorrencias')
      .insert({
        store_id:       storeId,
        funcionario_id: funcionarioId,
        data:           formData.get('data'),
        descricao:      formData.get('descricao'),
        ajuste,  // valor com sinal: positivo = acréscimo, negativo = desconto
      })
      .select()
      .single()

    if (error) return { error: 'Erro ao registrar intercorrência.' }
    revalidatePath(`/admin/${storeSlug}/funcionarios/folha`)
    return { success: true, intercorrencia: data }
  } catch {
    return { error: 'Erro inesperado.' }
  }
}

/**
 * deleteIntercorrencia — Remove um ajuste da folha de pagamento.
 *
 * Ao deletar, o total da folha é recalculado automaticamente na próxima renderização
 * (FolhaClient.js recalcula a soma sempre que intercorrências mudam).
 *
 * @param {string} id - UUID da intercorrência a remover
 */
export async function deleteIntercorrencia(id) {
  const { supabase, storeId, storeSlug } = await ctx()
  await supabase.from('intercorrencias')
    .delete()
    .eq('id', id)
    .eq('store_id', storeId)  // proteção cross-store
  revalidatePath(`/admin/${storeSlug}/funcionarios/folha`)
  return { success: true }
}
