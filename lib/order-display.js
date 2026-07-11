/**
 * Descrição textual de um item de pedido — uma única implementação, usada pela
 * comanda da cozinha, pelo painel, pelo entregador e pelo acompanhamento do cliente.
 *
 * Existe porque a comanda tinha a própria versão disso, lendo
 * `meia_meia_info.metade_a` / `.metade_b` / `.tamanho`, enquanto o servidor sempre
 * gravou `{ sabor1, sabor2, regra }`. Toda comanda de pizza meia-a-meia saía na
 * cozinha como "2x [undefined] / [undefined] (undefined)".
 *
 * Se o formato do snapshot mudar, muda aqui — e em nenhum outro lugar.
 */

/** Ex.: "Calabresa / Portuguesa (Grande)" ou "Pizza Grande — 1 Sabor" */
export function descreveItem(item) {
  if (item.eh_meia_meia && item.meia_meia_info) {
    const { sabor1, sabor2 } = item.meia_meia_info
    const metades = [sabor1?.nome, sabor2?.nome].filter(Boolean).join(' / ')
    const tamanho = item.nome_variante ? ` (${item.nome_variante})` : ''
    return metades ? `${metades}${tamanho}` : item.nome_produto
  }

  const variante = item.nome_variante ? ` (${item.nome_variante})` : ''
  return `${item.nome_produto}${variante}`
}

/** Linhas das opções escolhidas: ["Calabresa", "ADD Bacon"] */
export function linhasDeOpcoes(item) {
  return (item.opcoes_info ?? []).map(g => g.itens.map(o => o.nome).join(', '))
}
