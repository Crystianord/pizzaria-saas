'use client'
import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createProduct, updateProduct, addVariant, removeVariant } from '@/app/admin/_actions/catalog'
import ImageUpload from '@/components/ImageUpload'

const PRESETS = [
  {
    grupo: 'Pizza',
    tamanhos: ['P', 'M', 'G', 'GG'],
  },
  {
    grupo: 'Bebida',
    tamanhos: ['200ml', '300ml', '350ml', '500ml', '600ml', '1L', '1,5L', '2L'],
  },
  {
    grupo: 'Porção',
    tamanhos: ['Meia', 'Inteira', 'Pequena', 'Grande', 'Família'],
  },
  {
    grupo: 'Outros',
    tamanhos: ['Unidade', 'Kg', '100g', 'Porção'],
  },
]

export default function ProductForm({ categories, storeId, storeSlug, product, variants: initialVariants }) {
  const router      = useRouter()
  const isEditing   = !!product
  const [isPending, startTransition] = useTransition()
  const precoRef    = useRef(null)

  const [fotoUrl, setFotoUrl]     = useState(product?.foto_url || '')
  const [error, setError]         = useState(null)
  const [success, setSuccess]     = useState(false)
  const [variantError, setVariantError] = useState(null)

  // ── Modo criação: variantes locais ────────────────────────────────────────
  const [variants, setVariants] = useState(
    initialVariants?.length > 0
      ? initialVariants
      : []
  )

  function addLocalVariant(nome = '') {
    setVariants(v => [...v, { nome, preco: '', _key: Math.random() }])
  }

  function removeLocalVariant(idx) {
    setVariants(v => v.filter((_, i) => i !== idx))
  }

  function updateLocalVariant(idx, field, value) {
    setVariants(v => v.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function addPresetLocal(nome) {
    if (variants.some(v => v.nome === nome)) return
    const key = Math.random()
    setVariants(v => [...v, { nome, preco: '', _key: key }])
    setTimeout(() => {
      document.getElementById(`preco-local-${key}`)?.focus()
    }, 50)
  }

  // ── Modo edição: adicionar via Server Action ──────────────────────────────
  const [newNome, setNewNome]   = useState('')
  const [newPreco, setNewPreco] = useState('')

  function presetEditMode(nome) {
    setNewNome(nome)
    setTimeout(() => precoRef.current?.focus(), 50)
  }

  function addExistingVariant() {
    if (!newNome.trim() || !newPreco) {
      setVariantError('Informe o tamanho e o preço.')
      return
    }
    startTransition(async () => {
      const res = await addVariant(product.id, newNome.trim(), parseFloat(newPreco))
      if (res?.error) { setVariantError(res.error); return }
      setNewNome(''); setNewPreco(''); setVariantError(null)
      router.refresh()
    })
  }

  function removeExistingVariant(variantId) {
    startTransition(async () => {
      const res = await removeVariant(variantId, product.id)
      if (res?.error) { setVariantError(res.error); return }
      router.refresh()
    })
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  function handleSubmit(e) {
    e.preventDefault()
    const fd = new FormData(e.target)
    if (fotoUrl) fd.set('foto_url', fotoUrl)

    if (!isEditing) {
      const valid = variants.filter(v => v.nome.trim() && parseFloat(v.preco) > 0)
      if (valid.length === 0) {
        setError('Adicione pelo menos um tamanho com preço.')
        return
      }
      fd.delete('variant_nome')
      fd.delete('variant_preco')
      valid.forEach(v => {
        fd.append('variant_nome', v.nome.trim())
        fd.append('variant_preco', v.preco)
      })
    }

    setError(null)
    startTransition(async () => {
      const action = isEditing ? updateProduct : createProduct
      const res = await action(null, fd)
      if (res?.error) { setError(res.error); return }
      if (isEditing) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } else {
        router.push(`/admin/${storeSlug}/catalog`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      {isEditing && <input type="hidden" name="product_id" value={product.id} />}

      {/* Nome */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nome do produto *</label>
        <input
          name="nome"
          required
          defaultValue={product?.nome || ''}
          placeholder="Ex: Refrigerante 2L"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {/* Categoria */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
        <select
          name="category_id"
          required
          defaultValue={product?.category_id || ''}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">Selecione uma categoria...</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </div>

      {/* Foto */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Foto do produto</label>
        <ImageUpload
          storeId={storeId}
          currentUrl={product?.foto_url}
          onUploadComplete={url => setFotoUrl(url || '')}
        />
      </div>

      {/* ── Tamanhos e preços ─────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Tamanhos e preços *</label>

        {/* Presets */}
        <div className="space-y-2 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Tamanhos pré-definidos</p>
          {PRESETS.map(group => (
            <div key={group.grupo}>
              <p className="text-xs text-gray-400 mb-1">{group.grupo}</p>
              <div className="flex flex-wrap gap-1.5">
                {group.tamanhos.map(t => {
                  const jaAdicionado = isEditing
                    ? initialVariants?.some(v => v.nome === t)
                    : variants.some(v => v.nome === t)
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => isEditing ? presetEditMode(t) : addPresetLocal(t)}
                      disabled={jaAdicionado}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        jaAdicionado
                          ? 'bg-orange-100 border-orange-300 text-orange-600 cursor-default'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-orange-400 hover:text-orange-600'
                      }`}
                    >
                      {jaAdicionado ? '✓ ' : '+ '}{t}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Lista de tamanhos */}
        {isEditing ? (
          <div className="space-y-2">
            {initialVariants?.length === 0 && (
              <p className="text-xs text-gray-400 italic py-2">Nenhum tamanho cadastrado ainda.</p>
            )}
            {initialVariants?.sort((a, b) => a.ordem - b.ordem).map(v => (
              <div key={v.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                <span className="w-24 text-sm font-semibold text-gray-800">{v.nome}</span>
                <span className="text-gray-300">|</span>
                <span className="text-sm text-gray-600">R$ {parseFloat(v.preco).toFixed(2)}</span>
                <button
                  type="button"
                  onClick={() => removeExistingVariant(v.id)}
                  disabled={isPending || initialVariants.length <= 1}
                  className="ml-auto text-xs text-red-400 hover:text-red-600 disabled:opacity-20"
                >
                  remover
                </button>
              </div>
            ))}

            {/* Adicionar novo tamanho (edit mode) */}
            <div className="border-t border-gray-100 pt-3 mt-3">
              <p className="text-xs text-gray-500 mb-2">Adicionar tamanho personalizado ou pelo preset acima:</p>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  value={newNome}
                  onChange={e => setNewNome(e.target.value)}
                  placeholder="Tamanho"
                  className="w-28 border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 text-sm">R$</span>
                  <input
                    ref={precoRef}
                    value={newPreco}
                    onChange={e => setNewPreco(e.target.value)}
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0,00"
                    className="w-28 border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={addExistingVariant}
                  disabled={isPending || !newNome.trim() || !newPreco}
                  className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-200 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  {isPending ? '...' : 'Salvar'}
                </button>
              </div>
              {variantError && <p className="text-red-500 text-xs mt-1">{variantError}</p>}
            </div>
          </div>
        ) : (
          // Modo criação
          <div className="space-y-2">
            {variants.length === 0 && (
              <p className="text-xs text-gray-400 italic">Selecione um tamanho acima ou adicione manualmente.</p>
            )}
            {variants.map((v, idx) => (
              <div key={v._key ?? idx} className="flex items-center gap-2">
                <input
                  value={v.nome}
                  onChange={e => updateLocalVariant(idx, 'nome', e.target.value)}
                  placeholder="Tamanho"
                  id={`nome-local-${v._key ?? idx}`}
                  className="w-28 border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <span className="text-gray-400 text-sm">R$</span>
                <input
                  id={`preco-local-${v._key ?? idx}`}
                  value={v.preco}
                  onChange={e => updateLocalVariant(idx, 'preco', e.target.value)}
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  className="w-28 border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  type="button"
                  onClick={() => removeLocalVariant(idx)}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  remover
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addLocalVariant()}
              className="text-sm text-orange-600 hover:text-orange-700 font-medium"
            >
              + Tamanho personalizado
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
          Produto atualizado com sucesso.
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          {isPending ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar produto'}
        </button>
        <a href={`/admin/${storeSlug}/catalog`} className="text-gray-600 hover:text-gray-800 px-4 py-2.5 text-sm">
          Cancelar
        </a>
      </div>
    </form>
  )
}
