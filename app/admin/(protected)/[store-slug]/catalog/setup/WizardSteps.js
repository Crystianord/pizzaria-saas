'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createCategory,
  deleteCategory,
  reorderCategory,
  createProduct,
  setPromotion,
  completeWizardSetup,
} from '@/app/admin/_actions/catalog'
import ImageUpload from '@/components/ImageUpload'

// ─── Step 1: Categorias ───────────────────────────────────────

function Step1({ categories, storeSlug, onNext }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [newName, setNewName] = useState('')
  const [error, setError] = useState(null)

  function addCategory() {
    if (!newName.trim()) return
    const fd = new FormData()
    fd.append('nome', newName.trim())
    setError(null)
    startTransition(async () => {
      const res = await createCategory(null, fd)
      if (res?.error) { setError(res.error); return }
      setNewName('')
      router.refresh()
    })
  }

  function reorder(id, dir) {
    startTransition(async () => {
      await reorderCategory(id, dir)
      router.refresh()
    })
  }

  function remove(id) {
    startTransition(async () => {
      const res = await deleteCategory(id)
      if (res?.error) { setError(res.error); return }
      router.refresh()
    })
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Categorias do cardápio</h2>
      <p className="text-gray-500 text-sm mb-6">
        Crie as categorias do seu cardápio (ex: Tradicionais, Especiais, Bebidas).
        Use ↑↓ para definir a ordem no site.
      </p>

      {/* Lista de categorias */}
      <div className="space-y-2 mb-4">
        {categories.length === 0 && (
          <p className="text-gray-400 text-sm italic py-4 text-center">
            Nenhuma categoria ainda. Adicione a primeira abaixo.
          </p>
        )}
        {categories.map((cat, idx) => (
          <div key={cat.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-3">
            <div className="flex flex-col gap-0.5 mr-1">
              <button
                onClick={() => reorder(cat.id, 'up')}
                disabled={idx === 0 || isPending}
                className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs leading-none"
              >▲</button>
              <button
                onClick={() => reorder(cat.id, 'down')}
                disabled={idx === categories.length - 1 || isPending}
                className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs leading-none"
              >▼</button>
            </div>
            <span className="flex-1 font-medium text-gray-800">{cat.nome}</span>
            <button
              onClick={() => remove(cat.id)}
              disabled={isPending}
              className="text-red-400 hover:text-red-600 text-sm disabled:opacity-50"
            >
              excluir
            </button>
          </div>
        ))}
      </div>

      {/* Adicionar categoria */}
      <div className="flex gap-2 mb-2">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addCategory()}
          placeholder="Nome da categoria"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <button
          onClick={addCategory}
          disabled={isPending || !newName.trim()}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
        >
          + Adicionar
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mt-1">{error}</p>}

      <div className="mt-8 flex justify-end">
        <button
          onClick={onNext}
          disabled={categories.length === 0}
          className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-200 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          Avançar →
        </button>
      </div>
    </div>
  )
}

// ─── Step 2: Produtos ─────────────────────────────────────────

function VariantRow({ variant, onRemove, canRemove }) {
  return (
    <div className="flex items-center gap-2">
      <input
        name="variant_nome"
        value={variant.nome}
        onChange={e => onRemove('nome', e.target.value)}
        placeholder="Ex: M"
        className="w-20 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
        readOnly
      />
      <span className="text-gray-400 text-sm">R$</span>
      <input
        name="variant_preco"
        value={variant.preco}
        onChange={e => onRemove('preco', e.target.value)}
        type="number"
        step="0.01"
        min="0.01"
        placeholder="0.00"
        className="w-24 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
        readOnly
      />
      <button
        type="button"
        onClick={() => canRemove && onRemove()}
        disabled={!canRemove}
        className="text-red-400 hover:text-red-600 disabled:opacity-20 text-sm"
      >
        remover
      </button>
    </div>
  )
}

function ProductForm({ categories, storeId, onProductAdded }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [variants, setVariants] = useState([
    { nome: 'P', preco: '' },
    { nome: 'M', preco: '' },
    { nome: 'G', preco: '' },
  ])
  const [fotoUrl, setFotoUrl] = useState('')
  const [error, setError] = useState(null)

  function addVariant() {
    setVariants(v => [...v, { nome: '', preco: '' }])
  }

  function removeVariant(idx) {
    if (variants.length <= 1) return
    setVariants(v => v.filter((_, i) => i !== idx))
  }

  function updateVariant(idx, field, value) {
    setVariants(v => v.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const form = e.target
    const fd = new FormData(form)
    // Append variants manualmente
    fd.delete('variant_nome')
    fd.delete('variant_preco')
    variants.forEach(v => {
      fd.append('variant_nome', v.nome)
      fd.append('variant_preco', v.preco)
    })
    if (fotoUrl) fd.set('foto_url', fotoUrl)

    setError(null)
    startTransition(async () => {
      const res = await createProduct(null, fd)
      if (res?.error) { setError(res.error); return }
      form.reset()
      setVariants([{ nome: 'P', preco: '' }, { nome: 'M', preco: '' }, { nome: 'G', preco: '' }])
      setFotoUrl('')
      router.refresh()
      onProductAdded?.()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
          <input
            name="nome"
            required
            placeholder="Ex: Calabresa"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
          <select
            name="category_id"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Selecione...</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Foto (opcional)</label>
        <ImageUpload storeId={storeId} onUploadComplete={url => setFotoUrl(url || '')} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tamanhos e preços *
        </label>
        <div className="space-y-2">
          {variants.map((v, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                value={v.nome}
                onChange={e => updateVariant(idx, 'nome', e.target.value)}
                placeholder="Tamanho"
                className="w-20 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
              <span className="text-gray-400 text-sm">R$</span>
              <input
                value={v.preco}
                onChange={e => updateVariant(idx, 'preco', e.target.value)}
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                className="w-28 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
              <button
                type="button"
                onClick={() => removeVariant(idx)}
                disabled={variants.length <= 1}
                className="text-red-400 hover:text-red-600 disabled:opacity-20 text-sm"
              >
                remover
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addVariant}
          className="mt-2 text-sm text-orange-600 hover:text-orange-700"
        >
          + Adicionar tamanho
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        {isPending ? 'Salvando...' : '+ Adicionar produto'}
      </button>
    </form>
  )
}

function Step2({ categories, products, storeId, onNext }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Produtos do cardápio</h2>
      <p className="text-gray-500 text-sm mb-6">
        Adicione pelo menos um produto com seus tamanhos e preços.
      </p>

      {/* Produtos já adicionados */}
      {products.length > 0 && (
        <div className="mb-4 space-y-2">
          {products.map(p => (
            <div key={p.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
              <span className="text-green-500">✓</span>
              <span className="font-medium text-gray-800">{p.nome}</span>
              <span className="text-sm text-gray-400">
                {p.product_variants?.map(v => `${v.nome} R$${parseFloat(v.preco).toFixed(2)}`).join(' / ')}
              </span>
            </div>
          ))}
        </div>
      )}

      <ProductForm categories={categories} storeId={storeId} />

      <div className="mt-8 flex justify-end">
        <button
          onClick={onNext}
          disabled={products.length === 0}
          className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-200 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          Avançar →
        </button>
      </div>
    </div>
  )
}

// ─── Step 3: Promoção ─────────────────────────────────────────

function Step3({ products, onNext, onSkip }) {
  const [selectedId, setSelectedId] = useState('')
  const [type, setType]             = useState('pct')
  const [value, setValue]           = useState('')
  const [isPending, startTransition] = useTransition()

  function save() {
    if (!selectedId || !value) { onNext(); return }
    const num = parseFloat(value)
    if (isNaN(num) || num <= 0) { onNext(); return }
    startTransition(async () => {
      await setPromotion(selectedId, type, num)
      onNext()
    })
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Promoção do dia</h2>
      <p className="text-gray-500 text-sm mb-6">
        Quer destacar algum produto com desconto? (opcional — você pode configurar depois)
      </p>

      <div className="space-y-3 mb-6">
        {products.map(p => (
          <label
            key={p.id}
            className={`flex items-center gap-3 bg-white border rounded-lg px-4 py-3 cursor-pointer transition-colors ${
              selectedId === p.id ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="promo_product"
              value={p.id}
              checked={selectedId === p.id}
              onChange={() => setSelectedId(p.id)}
              className="text-orange-500"
            />
            <div>
              <span className="font-medium text-gray-800">{p.nome}</span>
              <span className="text-sm text-gray-400 ml-2">
                {p.product_variants?.map(v => `${v.nome} R$${parseFloat(v.preco).toFixed(2)}`).join(' / ')}
              </span>
            </div>
          </label>
        ))}
      </div>

      {selectedId && (
        <div className="flex gap-2 mb-2">
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="pct">% de desconto</option>
            <option value="fixo">R$ fixo</option>
          </select>
          <input
            type="number"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={type === 'pct' ? '10' : '5.00'}
            className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <span className="flex items-center text-sm text-gray-500">{type === 'pct' ? '%' : 'R$'}</span>
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <button
          onClick={onSkip}
          className="text-gray-500 hover:text-gray-700 text-sm px-4 py-2.5"
        >
          Pular
        </button>
        <button
          onClick={save}
          disabled={isPending}
          className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          {isPending ? 'Salvando...' : 'Avançar →'}
        </button>
      </div>
    </div>
  )
}

// ─── Step 4: Meia a meia ──────────────────────────────────────

function Step4() {
  const [enabled, setEnabled] = useState(true)
  const [rule, setRule]       = useState('max')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e) {
    e.preventDefault()
    const fd = new FormData()
    if (enabled) fd.append('meia_a_meia_enabled', 'on')
    fd.append('meia_a_meia_rule', rule)
    startTransition(async () => {
      await completeWizardSetup(null, fd)
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Meia a meia</h2>
      <p className="text-gray-500 text-sm mb-6">
        Seu restaurante aceita pedidos de meia a meia?
      </p>

      <div className="space-y-3 mb-6">
        <label className={`flex items-center gap-3 bg-white border rounded-lg px-4 py-3 cursor-pointer transition-colors ${!enabled ? 'border-orange-400 bg-orange-50' : 'border-gray-200'}`}>
          <input
            type="radio"
            checked={!enabled}
            onChange={() => setEnabled(false)}
            className="text-orange-500"
          />
          <span className="font-medium text-gray-800">Não</span>
        </label>

        <label className={`flex items-start gap-3 bg-white border rounded-lg px-4 py-3 cursor-pointer transition-colors ${enabled ? 'border-orange-400 bg-orange-50' : 'border-gray-200'}`}>
          <input
            type="radio"
            checked={enabled}
            onChange={() => setEnabled(true)}
            className="text-orange-500 mt-0.5"
          />
          <div className="flex-1">
            <span className="font-medium text-gray-800">Sim</span>
            {enabled && (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-gray-600 font-medium">Regra de preço:</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="meia_rule"
                    value="max"
                    checked={rule === 'max'}
                    onChange={() => setRule('max')}
                    className="text-orange-500"
                  />
                  <span className="text-sm text-gray-700">Preço do sabor mais caro</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="meia_rule"
                    value="avg"
                    checked={rule === 'avg'}
                    onChange={() => setRule('avg')}
                    className="text-orange-500"
                  />
                  <span className="text-sm text-gray-700">Média dos dois sabores</span>
                </label>
              </div>
            )}
          </div>
        </label>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          {isPending ? 'Salvando...' : '✓ Concluir setup'}
        </button>
      </div>
    </form>
  )
}

// ─── Wizard Principal ─────────────────────────────────────────

const STEPS = ['Categorias', 'Produtos', 'Promoção', 'Meia a meia']

export default function WizardSteps({ categories, products, storeId, storeSlug }) {
  const [step, setStep] = useState(0)

  return (
    <div>
      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold transition-colors ${
              idx < step ? 'bg-green-500 text-white' :
              idx === step ? 'bg-orange-500 text-white' :
              'bg-gray-200 text-gray-500'
            }`}>
              {idx < step ? '✓' : idx + 1}
            </div>
            <span className={`text-sm ${idx === step ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
              {label}
            </span>
            {idx < STEPS.length - 1 && (
              <div className={`w-8 h-px ${idx < step ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Conteúdo do step atual */}
      {step === 0 && (
        <Step1
          categories={categories}
          storeSlug={storeSlug}
          onNext={() => setStep(1)}
        />
      )}
      {step === 1 && (
        <Step2
          categories={categories}
          products={products}
          storeId={storeId}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <Step3
          products={products}
          onNext={() => setStep(3)}
          onSkip={() => setStep(3)}
        />
      )}
      {step === 3 && <Step4 />}
    </div>
  )
}
