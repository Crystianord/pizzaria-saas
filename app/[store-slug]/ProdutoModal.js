'use client'
import { useState, useMemo } from 'react'
import { Search, Check, Plus, Minus } from 'lucide-react'
import { precoComPromo, round2 } from '@/lib/order-items'

/**
 * Modal de configuração do produto — onde o cliente escolhe sabores e adicionais.
 *
 * O preço aqui tem que bater EXATAMENTE com o que lib/order-items.js calcula no
 * servidor, senão o cliente vê o valor mudar ao finalizar. Por isso a fórmula
 * (`precoComPromo(base + extras)`) é importada de lá, e não reescrita.
 */

const fmt = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// A partir de ~8 opções rolar a lista vira um problema — o cardápio real tem 27 sabores.
const MIN_OPCOES_PARA_BUSCAR = 8

function Grupo({ grupo, escolhidas, onToggle, paleta }) {
  const [busca, setBusca] = useState('')

  const opcoes = useMemo(() => {
    const ativas = (grupo.opcoes || []).filter(o => o.ativo)
    if (!busca.trim()) return ativas
    const q = busca.toLowerCase()
    return ativas.filter(o =>
      o.nome.toLowerCase().includes(q) ||
      (o.descricao || '').toLowerCase().includes(q)
    )
  }, [grupo.opcoes, busca])

  const n = escolhidas.size
  const completo = n >= grupo.min
  const cheio    = n >= grupo.max

  const dica = grupo.min === grupo.max
    ? `Escolha ${grupo.min}`
    : grupo.min > 0
      ? `Escolha de ${grupo.min} a ${grupo.max}`
      : `Até ${grupo.max} (opcional)`

  const restam = grupo.min - n

  return (
    <div className="border-t border-gray-100 pt-4">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="font-bold text-gray-900 text-sm">{grupo.nome}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{dica}</p>
        </div>

        {grupo.min > 0 && (
          <span
            className="text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap"
            style={completo
              ? { backgroundColor: '#dcfce7', color: '#15803d' }
              : { backgroundColor: '#fef3c7', color: '#b45309' }}
          >
            {completo ? 'Pronto' : `Falta ${restam}`}
          </span>
        )}
      </div>

      {(grupo.opcoes || []).filter(o => o.ativo).length >= MIN_OPCOES_PARA_BUSCAR && (
        <div className="relative my-3">
          <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar neste grupo"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': paleta.primaria + '55' }}
          />
        </div>
      )}

      <div className="space-y-1.5 mt-2">
        {opcoes.length === 0 && (
          <p className="text-xs text-gray-400 py-2">Nenhuma opção encontrada.</p>
        )}

        {opcoes.map(o => {
          const marcada  = escolhidas.has(o.id)
          // Num grupo cheio, quem não está marcado fica bloqueado — exceto quando
          // max=1, onde escolher outro simplesmente troca a seleção.
          const travada = !marcada && cheio && grupo.max > 1

          return (
            <button
              key={o.id}
              type="button"
              disabled={travada}
              onClick={() => onToggle(grupo.id, o.id)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${
                travada ? 'opacity-40 cursor-not-allowed' : 'hover:border-gray-300'
              }`}
              style={marcada
                ? { borderColor: paleta.primaria, backgroundColor: paleta.primaria + '0d' }
                : { borderColor: '#e5e7eb' }}
            >
              <span
                className="w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0"
                style={marcada
                  ? { backgroundColor: paleta.primaria, borderColor: paleta.primaria }
                  : { borderColor: '#d1d5db' }}
              >
                {marcada && <Check className="w-3.5 h-3.5 text-white" />}
              </span>

              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-gray-800">{o.nome}</span>
                {o.descricao && (
                  <span className="block text-xs text-gray-400 leading-snug">{o.descricao}</span>
                )}
              </span>

              {o.preco_extra > 0 && (
                <span className="text-xs font-semibold whitespace-nowrap" style={{ color: paleta.primaria }}>
                  + {fmt(o.preco_extra)}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function ProdutoModal({ product, grupos, promo, paleta, onAdd, onClose }) {
  const [selecao, setSelecao] = useState(() => new Map(grupos.map(g => [g.id, new Set()])))
  const [quantidade, setQuantidade] = useState(1)

  const base = Number(product.preco) || 0

  function toggle(groupId, itemId) {
    setSelecao(prev => {
      const novo = new Map(prev)
      const grupo = grupos.find(g => g.id === groupId)
      const atual = new Set(novo.get(groupId))

      if (atual.has(itemId)) {
        atual.delete(itemId)
      } else if (grupo.max === 1) {
        atual.clear()          // rádio: escolher outro troca
        atual.add(itemId)
      } else if (atual.size < grupo.max) {
        atual.add(itemId)
      }

      novo.set(groupId, atual)
      return novo
    })
  }

  const extras = useMemo(() => {
    let soma = 0
    for (const g of grupos) {
      for (const id of selecao.get(g.id) || []) {
        const o = g.opcoes.find(x => x.id === id)
        if (o) soma += Number(o.preco_extra) || 0
      }
    }
    return soma
  }, [selecao, grupos])

  // Mesma fórmula do servidor: a promoção incide sobre base + adicionais.
  const precoUnit = round2(precoComPromo(base + extras, promo))
  const precoSemPromo = base + extras
  const temPromo = precoUnit < precoSemPromo

  const faltando = grupos.filter(g => (selecao.get(g.id)?.size || 0) < g.min)
  const podeAdicionar = faltando.length === 0

  function adicionar() {
    if (!podeAdicionar) return

    const opcoes = grupos
      .map(g => ({ groupId: g.id, itemIds: [...(selecao.get(g.id) || [])] }))
      .filter(o => o.itemIds.length > 0)

    // Só para exibir no carrinho — o servidor reconstrói tudo a partir dos IDs.
    const resumo = grupos
      .map(g => {
        const itens = [...(selecao.get(g.id) || [])]
          .map(id => g.opcoes.find(x => x.id === id))
          .filter(Boolean)
        return itens.length ? { grupo: g.nome, itens: itens.map(i => ({ nome: i.nome, preco_extra: Number(i.preco_extra) || 0 })) } : null
      })
      .filter(Boolean)

    onAdd({
      productId:    product.id,
      variantId:    null,
      nomeProduto:  product.nome,
      nomeVariante: null,
      preco:        precoUnit,
      quantidade,
      ehMeiaMeia:   false,
      meiaMetaInfo: null,
      opcoes,
      opcoesResumo: resumo,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white w-full sm:max-w-lg h-[92vh] sm:h-auto sm:max-h-[88vh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="font-bold text-gray-900 leading-tight">{product.nome}</h2>
            {product.descricao && (
              <p className="text-xs text-gray-400 mt-1 leading-snug">{product.descricao}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-gray-500 text-2xl leading-none flex-shrink-0"
          >
            ×
          </button>
        </div>

        {/* Grupos */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-1">
          {grupos.map(g => (
            <Grupo
              key={g.id}
              grupo={g}
              escolhidas={selecao.get(g.id) || new Set()}
              onToggle={toggle}
              paleta={paleta}
            />
          ))}
        </div>

        {/* Rodapé */}
        <div className="border-t border-gray-100 px-5 py-4 bg-white">
          <div className="flex items-center gap-3">

            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-2 py-1.5 flex-shrink-0">
              <button
                onClick={() => setQuantidade(q => Math.max(1, q - 1))}
                className="text-gray-400 hover:text-gray-700 disabled:opacity-30"
                disabled={quantidade <= 1}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold w-5 text-center">{quantidade}</span>
              <button
                onClick={() => setQuantidade(q => Math.min(99, q + 1))}
                className="text-gray-400 hover:text-gray-700"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={adicionar}
              disabled={!podeAdicionar}
              className="flex-1 flex items-center justify-between px-4 py-3 rounded-xl text-white font-semibold text-sm transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: paleta.primaria }}
            >
              <span>
                {podeAdicionar
                  ? 'Adicionar'
                  : `Escolha ${faltando[0].nome.toLowerCase().includes('sabor') ? 'o sabor' : 'as opções'}`}
              </span>
              <span className="flex items-baseline gap-1.5">
                {temPromo && (
                  <span className="text-xs line-through opacity-60">{fmt(precoSemPromo * quantidade)}</span>
                )}
                <span>{fmt(precoUnit * quantidade)}</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
