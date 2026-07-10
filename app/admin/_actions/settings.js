/**
 * SERVER ACTIONS — Configurações da Loja
 *
 * Salva todas as configurações operacionais e visuais da pizzaria.
 * Uma única função (updateStoreSettings) atualiza a tabela 'stores'
 * com todos os campos de configuração de uma vez.
 *
 * O que é configurável:
 *
 *   OPERACIONAL:
 *   - horario: objeto JSON com os dias da semana e horários de abertura/fechamento
 *              Ex: { seg: { ativo: true, abertura: '18:00', fechamento: '23:00' }, ... }
 *   - bairros_atendidos: array de strings com os bairros que a pizzaria entrega
 *              Ex: ['Centro', 'Plano Piloto', 'Asa Norte']
 *              Vazio = aceita qualquer bairro
 *   - taxa_entrega: valor em reais cobrado por entrega (0 = grátis)
 *
 *   CARDÁPIO:
 *   - meia_a_meia_enabled: boolean — habilita o botão "Montar meia a meia" no cardápio
 *   - meia_a_meia_rule: 'avg' (média dos preços) ou 'max' (maior dos dois preços)
 *
 *   VISUAL:
 *   - paleta_id: ID da paleta de cores (ex: 'vermelho', 'azul', 'verde')
 *                Definidas em lib/paletas.js — controla a cor dos botões e destaques
 *   - imagem_fundo_url: URL da imagem de fundo do cardápio público (Supabase Storage)
 *
 * Importante: as configurações só têm efeito visual após um reload completo do
 * cardápio público (app/[store-slug]/page.js busca paleta_id a cada requisição).
 */

'use server'
import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

/**
 * getStoreContext — Helper: resolve store_id e storeSlug do admin autenticado.
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

/**
 * updateStoreSettings — Salva todas as configurações da loja de uma vez.
 *
 * Chamado pelo SettingsForm.js quando o admin clica em "Salvar configurações".
 * Trata os campos do formulário e monta o objeto de atualização para a tabela 'stores'.
 *
 * Processamento especial:
 *
 *   bairros_atendidos:
 *     Recebe uma string separada por vírgulas ("Centro, Asa Norte, Taguatinga")
 *     e converte para array: ['Centro', 'Asa Norte', 'Taguatinga'].
 *     Strings vazias são filtradas com .filter(Boolean).
 *
 *   horario:
 *     Para cada dia da semana (seg/ter/qua/qui/sex/sab/dom), lê três campos:
 *       - horario_{dia}_ativo: checkbox (open? sim/não)
 *       - horario_{dia}_abertura: hora de abertura (ex: "18:00")
 *       - horario_{dia}_fechamento: hora de fechamento (ex: "23:00")
 *     Monta um objeto JSON com a estrutura esperada pelo cardápio público.
 *     Dias com ativo=false têm abertura e fechamento nulos.
 *
 *   imagem_fundo_url:
 *     Só atualiza se o campo não for vazio (null = não sobrescreve imagem atual).
 *     Usa spread condicional: ...(imagemFundo !== null && { imagem_fundo_url: imagemFundo })
 *
 * @param {Object} prevState - Estado anterior (useActionState)
 * @param {FormData} formData - Todos os campos do formulário de configurações
 */
export async function updateStoreSettings(prevState, formData) {
  const supabase = await createClient()
  const { storeId, storeSlug } = await getStoreContext(supabase)

  // ── Bairros atendidos ──────────────────────────────────────────────────────
  // Input: "Centro, Asa Norte, Taguatinga"
  // Output: ['Centro', 'Asa Norte', 'Taguatinga']
  const bairrosRaw = formData.get('bairros_atendidos') || ''
  const bairros    = bairrosRaw.split(',').map(b => b.trim()).filter(Boolean)

  // ── Horário de funcionamento ───────────────────────────────────────────────
  // Percorre os 7 dias e monta o objeto horario
  // Dias desmarcados ficam com abertura/fechamento null (loja fechada naquele dia)
  const dias = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']
  const horario = {}
  for (const dia of dias) {
    const ativo = formData.get(`horario_${dia}_ativo`) === 'on'
    horario[dia] = {
      ativo,
      abertura:   ativo ? (formData.get(`horario_${dia}_abertura`)   || null) : null,
      fechamento: ativo ? (formData.get(`horario_${dia}_fechamento`) || null) : null,
    }
  }

  // ── Imagem de fundo ────────────────────────────────────────────────────────
  // Se o campo vier vazio (admin não escolheu nova imagem), não sobrescreve
  const imagemFundo = formData.get('imagem_fundo_url') || null

  const { error } = await supabase.from('stores').update({
    meia_a_meia_enabled: formData.get('meia_a_meia_enabled') === 'on',
    meia_a_meia_rule:    formData.get('meia_a_meia_rule') || 'max',
    horario,
    taxa_entrega:        parseFloat(formData.get('taxa_entrega') || 0),
    bairros_atendidos:   bairros,
    paleta_id:           formData.get('paleta_id') || 'vermelho',

    // Spread condicional: só inclui imagem_fundo_url se um valor foi enviado
    ...(imagemFundo !== null && { imagem_fundo_url: imagemFundo }),
  }).eq('id', storeId)

  if (error) return { error: 'Erro ao salvar configurações.' }

  // Invalida o cache da página de settings para mostrar os valores atualizados
  revalidatePath(`/admin/${storeSlug}/settings`)
  return { success: true }
}
