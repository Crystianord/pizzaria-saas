'use client'
import { useState, useTransition } from 'react'
import {
  toggleProductActive,
  updateVariantPrice,
  setPromotion,
  removePromotion,
} from '@/app/admin/_actions/catalog'
import { UtensilsCrossed } from 'lucide-react'

// ─── Inline Price Edit ────────────────────────────────────────

function VariantPrice({ variant }) {
  const [editing, setEditing]   = useState(false)
  const [value, setValue]       = useState(String(parseFloat(variant.preco).toFixed(2)))
  const [original]              = useState(String(parseFloat(variant.preco).toFixed(2)))
  const [isPending, startTransition] = useTransition()

  function save() {
    const num = parseFloat(value.replace(',', '.'))
    if (isNaN(num) || num <= 0) {
      setValue(original)
      setEditing(false)
      return
    }
    startTransition(async () => {
      await updateVariantPrice(variant.id, num)
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-xs text-gray-500">{variant.nome}</span>
        <input
          className="w-20 border border-orange-400 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setValue(original); setEditing(false) } }}
          autoFocus
        />
      </span>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      disabled={isPending}
      title="Clique para editar o preço"
      className="text-sm text-gray-700 hover:text-orange-600 hover:underline decoration-dotted transition-colors"
    >
      {variant.nome} R${parseFloat(variant.preco).toFixed(2)}
    </button>
  )
}

// ─── Painel de Promoção ───────────────────────────────────────

function PromotionPanel({ product, activePromo, onClose }) {
  const [type, setType]   = useState(activePromo?.tipo || 'pct')
  const [value, setValue] = useState(
    activePromo
      ? String(activePromo.tipo === 'pct' ? activePromo.desconto_pct : activePromo.desconto_fixo)
      : ''
  )
  const [isPending, startTransition] = useTransition()

  function save() {
    const num = parseFloat(value.replace(',', '.'))
    if (isNaN(num) || num <= 0) return
    startTransition(async () => {
      await setPromotion(product.id, type, num)
      onClose()
    })
  }

  function remove() {
    startTransition(async () => {
      await removePromotion(product.id)
      onClose()
    })
  }

  return (
    <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
      <h4 className="font-medium text-gray-900 mb-3 text-sm">
        Promoção — {product.nome}
      </h4>
      <div className="flex flex-wrap gap-2 mb-3">
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
        >
          <option value="pct">% de desconto</option>
          <option value="fixo">R$ fixo de desconto</option>
        </select>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={type === 'pct' ? '10' : '5.00'}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-24 focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
          <span className="text-sm text-gray-500">{type === 'pct' ? '%' : 'R$'}</span>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={save}
          disabled={isPending || !value}
          className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm px-3 py-1.5 rounded transition-colors"
        >
          {isPending ? 'Salvando...' : 'Salvar promoção'}
        </button>
        {activePromo && (
          <button
            onClick={remove}
            disabled={isPending}
            className="text-red-600 hover:bg-red-50 border border-red-200 text-sm px-3 py-1.5 rounded transition-colors"
          >
            Remover promoção
          </button>
        )}
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 text-sm px-3 py-1.5"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Linha de Produto ─────────────────────────────────────────

function ProductRow({ product, activePromo, storeSlug }) {
  const [promoOpen, setPromoOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => {
      await toggleProductActive(product.id)
    })
  }

  const hasPromo = !!activePromo

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-start gap-4">

        {/* Foto */}
        <div className="w-14 h-14 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
          {product.foto_url ? (
            <img
              src={product.foto_url}
              alt={product.nome}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><UtensilsCrossed className="w-6 h-6 text-gray-300" /></div>
          )}
        </div>

        {/* Dados */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <h3 className="font-semibold text-gray-900">{product.nome}</h3>
            {hasPromo && (
              <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">
                Promoção ativa
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-2">
            {product.categories?.nome ?? 'Sem categoria'}
          </p>

          {/* Variantes — editáveis inline */}
          <div className="flex flex-wrap gap-3">
            {product.product_variants?.length > 0
              ? product.product_variants
                  .sort((a, b) => a.ordem - b.ordem)
                  .map(v => <VariantPrice key={v.id} variant={v} />)
              : <span className="text-sm text-gray-400 italic">Sem tamanhos cadastrados</span>
            }
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          <button
            onClick={() => setPromoOpen(prev => !prev)}
            className={`text-xs px-2.5 py-1.5 rounded border transition-colors ${
              hasPromo
                ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                : 'border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-600'
            }`}
          >
            ☆ promo
          </button>

          <button
            onClick={toggle}
            disabled={isPending}
            className={`text-xs px-2.5 py-1.5 rounded border transition-colors disabled:opacity-50 ${
              product.ativo
                ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                : 'border-gray-200 text-gray-400 hover:border-gray-300'
            }`}
          >
            {product.ativo ? '● ativo' : '○ inativo'}
          </button>

          <a
            href={`/admin/${storeSlug}/catalog/products/${product.id}/edit`}
            className="text-xs px-2.5 py-1.5 rounded border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800 transition-colors"
          >
            Editar
          </a>
        </div>
      </div>

      {promoOpen && (
        <PromotionPanel
          product={product}
          activePromo={activePromo}
          onClose={() => setPromoOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Lista Principal ──────────────────────────────────────────

export default function ProductsClient({ products, promotions, storeSlug }) {
  if (products.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <UtensilsCrossed className="w-10 h-10 mx-auto mb-4 text-gray-300" />
        <p className="text-lg font-medium text-gray-600">Nenhum produto ainda</p>
        <p className="text-sm mt-1">Adicione o primeiro produto usando o botão acima.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {products.map(product => (
        <ProductRow
          key={product.id}
          product={product}
          activePromo={promotions.find(p => p.product_id === product.id) ?? null}
          storeSlug={storeSlug}
        />
      ))}
    </div>
  )
}
