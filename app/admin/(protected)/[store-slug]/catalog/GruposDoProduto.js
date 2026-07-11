'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ListChecks, Trash2, Plus, Check } from 'lucide-react'
import { attachGroup, updateAttachment, detachGroup } from '@/app/admin/_actions/opcoes'

/**
 * Vincula grupos de opções a um produto, com o mínimo/máximo de escolhas.
 *
 * O min/max mora aqui (no vínculo) e não no grupo: é o que deixa o mesmo grupo
 * de 27 sabores ser "escolha 1" numa pizza e "escolha 5" num combo.
 */

function VinculoRow({ vinculo, onChanged }) {
  const [min, setMin] = useState(String(vinculo.min_selecao))
  const [max, setMax] = useState(String(vinculo.max_selecao))
  const [erro, setErro] = useState(null)
  const [salvo, setSalvo] = useState(false)
  const [isPending, startTransition] = useTransition()

  const sujo = min !== String(vinculo.min_selecao) || max !== String(vinculo.max_selecao)

  function salvar() {
    setErro(null)
    startTransition(async () => {
      const r = await updateAttachment(vinculo.id, min, max)
      if (r?.error) { setErro(r.error); return }
      setSalvo(true)
      setTimeout(() => setSalvo(false), 1500)
      onChanged()
    })
  }

  function remover() {
    startTransition(async () => {
      await detachGroup(vinculo.id)
      onChanged()
    })
  }

  const grupo = vinculo.option_groups
  const nOpcoes = (grupo?.option_items ?? []).filter(o => o.ativo).length

  return (
    <div className="border border-gray-200 rounded-xl p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800">{grupo?.nome}</p>
          <p className="text-xs text-gray-400">
            {nOpcoes} {nOpcoes === 1 ? 'opção' : 'opções'}
            {grupo?.tipo === 'adicional' && ' · adicionais pagos'}
          </p>
        </div>
        <button
          onClick={remover}
          disabled={isPending}
          className="p-1.5 text-gray-300 hover:text-red-600 flex-shrink-0"
          title="Desvincular"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-end gap-3 mt-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Mínimo</label>
          <input
            type="number" min="0"
            value={min}
            onChange={e => setMin(e.target.value)}
            className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Máximo</label>
          <input
            type="number" min="1"
            value={max}
            onChange={e => setMax(e.target.value)}
            className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {sujo && (
          <button
            onClick={salvar}
            disabled={isPending}
            className="bg-orange-500 text-white text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-50"
          >
            {isPending ? '...' : 'Salvar'}
          </button>
        )}

        {salvo && !sujo && (
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium pb-2">
            <Check className="w-3.5 h-3.5" /> Salvo
          </span>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-2">
        {min === max
          ? `O cliente escolhe exatamente ${min}.`
          : Number(min) === 0
            ? `Opcional — até ${max}.`
            : `O cliente escolhe de ${min} a ${max}.`}
      </p>

      {erro && <p className="text-xs text-red-600 mt-1">{erro}</p>}
    </div>
  )
}

export default function GruposDoProduto({ productId, storeSlug, vinculos, gruposDisponiveis }) {
  const router = useRouter()
  const [erro, setErro] = useState(null)
  const [isPending, startTransition] = useTransition()

  const onChanged = () => router.refresh()

  const jaVinculados = new Set(vinculos.map(v => v.group_id))
  const disponiveis  = gruposDisponiveis.filter(g => g.ativo && !jaVinculados.has(g.id))

  function vincular(groupId) {
    setErro(null)
    startTransition(async () => {
      // Padrão sensato: escolha obrigatória de 1. O admin ajusta depois.
      const r = await attachGroup(productId, groupId, 1, 1)
      if (r?.error) { setErro(r.error); return }
      onChanged()
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-6">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-orange-500" />
          Opções deste produto
        </h2>
        <Link
          href={`/admin/${storeSlug}/catalog/opcoes`}
          className="text-xs text-orange-600 hover:text-orange-700 font-medium"
        >
          Gerenciar grupos
        </Link>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Sabores e adicionais que o cliente escolhe ao pedir este produto.
      </p>

      {erro && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">{erro}</p>
      )}

      {vinculos.length > 0 ? (
        <div className="space-y-3">
          {vinculos.map(v => (
            <VinculoRow key={v.id} vinculo={v} onChanged={onChanged} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl px-4 py-6 text-center">
          Nenhum grupo vinculado. Este produto vai direto para o carrinho.
        </p>
      )}

      {disponiveis.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Adicionar grupo
          </p>
          <div className="flex flex-wrap gap-2">
            {disponiveis.map(g => (
              <button
                key={g.id}
                onClick={() => vincular(g.id)}
                disabled={isPending}
                className="flex items-center gap-1 text-sm border border-gray-300 hover:border-orange-400 hover:bg-orange-50 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5 text-orange-500" />
                {g.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {gruposDisponiveis.length === 0 && (
        <p className="text-xs text-gray-400 mt-4 pt-4 border-t border-gray-100">
          Você ainda não criou nenhum grupo.{' '}
          <Link href={`/admin/${storeSlug}/catalog/opcoes`} className="text-orange-600 font-medium">
            Criar o primeiro
          </Link>
        </p>
      )}
    </div>
  )
}
