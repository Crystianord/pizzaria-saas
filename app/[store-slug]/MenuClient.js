'use client'
import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { UtensilsCrossed } from 'lucide-react'
import { createOrder } from '@/app/store/_actions/orders'

// ─── helpers ────────────────────────────────────────────────────────────────

const PALAVRAS_SEM_MEIA = ['bebida', 'drink', 'refri', 'suco', 'água', 'agua', 'cerveja', 'vinho', 'sobremesa', 'doce', 'açaí', 'acai', 'sorvete']

function categoriaPermiteMeiaMeia(nomeCategoria) {
  const nome = (nomeCategoria || '').toLowerCase()
  return !PALAVRAS_SEM_MEIA.some(p => nome.includes(p))
}

function precoFinal(variant, product) {
  const promo = product.promotions?.find(p => p.ativo)
  if (!promo) return variant.preco
  if (promo.tipo === 'pct')  return Math.max(0, variant.preco * (1 - promo.desconto_pct / 100))
  if (promo.tipo === 'fixo') return Math.max(0, variant.preco - promo.desconto_fixo)
  return variant.preco
}

function calcMeiaPrice(p1, p2, variantNome, regra) {
  const v1 = p1.product_variants?.find(v => v.nome === variantNome && v.ativo)
  const v2 = p2.product_variants?.find(v => v.nome === variantNome && v.ativo)
  if (!v1 || !v2) return null
  const price1 = precoFinal(v1, p1)
  const price2 = precoFinal(v2, p2)
  return regra === 'avg' ? (price1 + price2) / 2 : Math.max(price1, price2)
}

function fmt(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function uid() {
  return Math.random().toString(36).slice(2)
}

// ─── sub-components ─────────────────────────────────────────────────────────

function Badge({ aberto }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${aberto ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${aberto ? 'bg-green-500' : 'bg-red-500'}`} />
      {aberto ? 'Aberto' : 'Fechado'}
    </span>
  )
}

function PromoTag({ product }) {
  const promo = product.promotions?.find(p => p.ativo)
  if (!promo) return null
  const label = promo.tipo === 'pct' ? `-${promo.desconto_pct}%` : `-${fmt(promo.desconto_fixo)}`
  return (
    <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full z-10">
      {label}
    </span>
  )
}

function ProductCard({ product, onAdd, paleta, onMeiaClick, meiaEnabled, permiteMeiaMeia }) {
  const activeVariants = product.product_variants
    ?.filter(v => v.ativo)
    .sort((a, b) => a.ordem - b.ordem) ?? []

  const [selected, setSelected] = useState(activeVariants[0]?.id ?? null)
  const variant = activeVariants.find(v => v.id === selected) ?? activeVariants[0]

  if (!variant) return null

  const preco = precoFinal(variant, product)
  const hasPromo = product.promotions?.some(p => p.ativo)

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col">
      <div className="relative">
        {product.foto_url ? (
          <img
            src={product.foto_url}
            alt={product.nome}
            className="w-full h-44 object-cover"
          />
        ) : (
          <div className="w-full h-44 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <UtensilsCrossed className="w-12 h-12 text-gray-300" />
          </div>
        )}
        <PromoTag product={product} />
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-2">{product.nome}</h3>

        {activeVariants.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {activeVariants.map(v => (
              <button
                key={v.id}
                onClick={() => setSelected(v.id)}
                className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                style={selected === v.id
                  ? { backgroundColor: paleta.primaria, borderColor: paleta.primaria, color: '#fff' }
                  : { borderColor: '#e5e7eb', color: '#6b7280' }
                }
              >
                {v.nome}
              </button>
            ))}
          </div>
        )}

        <div className="mt-auto">
          <div className="flex items-center justify-between">
            <div>
              {hasPromo && <p className="text-xs text-gray-400 line-through">{fmt(variant.preco)}</p>}
              <p className="font-bold text-lg" style={{ color: paleta.primaria }}>{fmt(preco)}</p>
            </div>
            <button
              onClick={() => onAdd({ product, variant, preco })}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:scale-95"
              style={{ backgroundColor: paleta.primaria }}
            >
              + Adicionar
            </button>
          </div>

          {meiaEnabled && permiteMeiaMeia && activeVariants.length > 0 && (
            <button
              onClick={() => onMeiaClick(product)}
              className="mt-2 w-full text-xs py-1.5 rounded-lg border transition-colors"
              style={{ borderColor: paleta.primaria, color: paleta.primaria }}
            >
              Montar meia a meia
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Meia a meia modal ───────────────────────────────────────────────────────

function MeiaModal({ products, regra, paleta, onAdd, onClose }) {
  const [step, setStep]     = useState(1)
  const [size, setSize]     = useState(null)
  const [sabor1, setSabor1] = useState(null)

  const allSizes = [...new Set(
    products.flatMap(p => p.product_variants?.filter(v => v.ativo).map(v => v.nome) ?? [])
  )]

  const productsWithSize = (s) =>
    products.filter(p => p.product_variants?.some(v => v.nome === s && v.ativo))

  function handleSabor2(p2) {
    const preco = calcMeiaPrice(sabor1, p2, size, regra)
    if (preco === null) return
    onAdd({
      nomeProduto: `${sabor1.nome} / ${p2.nome}`,
      nomeVariante: size,
      preco,
      variantId: null,
      productId: null,
      ehMeiaMeia: true,
      meiaMetaInfo: {
        sabor1: { productId: sabor1.id, nome: sabor1.nome, fotoUrl: sabor1.foto_url },
        sabor2: { productId: p2.id,     nome: p2.nome,     fotoUrl: p2.foto_url },
        regra,
      },
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-gray-900">
            {step === 1 ? 'Escolha o tamanho' : step === 2 ? 'Primeiro sabor' : 'Segundo sabor'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {allSizes.map(s => (
                <button
                  key={s}
                  onClick={() => { setSize(s); setStep(2) }}
                  className="py-4 rounded-xl border-2 font-semibold text-sm transition-colors hover:opacity-90"
                  style={{ borderColor: paleta.primaria, color: paleta.primaria }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              {productsWithSize(size).map(p => (
                <button
                  key={p.id}
                  onClick={() => { setSabor1(p); setStep(3) }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-gray-300 text-left transition-colors"
                >
                  {p.foto_url
                    ? <img src={p.foto_url} alt={p.nome} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    : <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0"><UtensilsCrossed className="w-5 h-5 text-gray-300" /></div>
                  }
                  <span className="font-medium text-sm text-gray-800">{p.nome}</span>
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-2">
              {productsWithSize(size).filter(p => p.id !== sabor1.id).map(p => {
                const preco = calcMeiaPrice(sabor1, p, size, regra)
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSabor2(p)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-gray-300 text-left transition-colors"
                  >
                    {p.foto_url
                      ? <img src={p.foto_url} alt={p.nome} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      : <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0"><UtensilsCrossed className="w-5 h-5 text-gray-300" /></div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-800">{p.nome}</p>
                      {preco !== null && <p className="text-xs text-gray-500">{fmt(preco)}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Cart drawer ─────────────────────────────────────────────────────────────

function CartDrawer({ items, store, paleta, onClose, onQty, onRemove }) {
  const router = useRouter()
  const [step, setStep]             = useState('cart')  // 'cart' | 'checkout'
  const [tipoEntrega, setTipoEntrega] = useState('entrega')
  const [pending, setPending]       = useState(false)
  const [error, setError]           = useState(null)

  const subtotal   = items.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const taxa       = tipoEntrega === 'entrega' ? (store.taxa_entrega ?? 0) : 0
  const total      = subtotal + taxa
  const bairros    = store.bairros_atendidos ?? []

  async function handleSubmit(e) {
    e.preventDefault()
    setPending(true)
    setError(null)

    const fd = new FormData(e.target)

    if (tipoEntrega === 'entrega') {
      const rua         = fd.get('rua')?.trim()         || ''
      const quadra      = fd.get('quadra')?.trim()      || ''
      const lote        = fd.get('lote')?.trim()        || ''
      const numero      = fd.get('numero')?.trim()      || ''
      const complemento = fd.get('complemento')?.trim() || ''
      const partes = [
        rua,
        quadra && `Quadra ${quadra}`,
        lote   && `Lote ${lote}`,
        numero && `Nº ${numero}`,
        complemento,
      ].filter(Boolean)
      fd.set('endereco', partes.join(', '))
      fd.delete('rua'); fd.delete('quadra'); fd.delete('lote')
      fd.delete('numero'); fd.delete('complemento')
    }

    fd.set('store_id', store.id)
    fd.set('taxa_entrega', String(taxa))
    fd.set('items_json', JSON.stringify(items.map(i => ({
      productId:    i.productId,
      variantId:    i.variantId,
      nomeProduto:  i.nomeProduto,
      nomeVariante: i.nomeVariante,
      preco:        i.preco,
      quantidade:   i.quantidade,
      ehMeiaMeia:   i.ehMeiaMeia,
      meiaMetaInfo: i.meiaMetaInfo,
    }))))

    const result = await createOrder(null, fd)
    setPending(false)
    if (result.error) { setError(result.error); return }
    router.push(`/${store.slug}/pedido/${result.orderId}`)
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md h-full flex flex-col shadow-2xl">

        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-lg text-gray-900">
            {step === 'cart' ? 'Seu pedido' : 'Finalizar pedido'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {step === 'cart' && (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {items.map(item => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 leading-snug">{item.nomeProduto}</p>
                    {item.nomeVariante && <p className="text-xs text-gray-500">{item.nomeVariante}</p>}
                    <p className="text-sm font-semibold mt-0.5" style={{ color: paleta.primaria }}>{fmt(item.preco)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => onQty(item.id, item.quantidade - 1)} className="w-7 h-7 rounded-full border border-gray-300 text-gray-600 font-bold text-sm flex items-center justify-center hover:bg-gray-50">−</button>
                    <span className="w-5 text-center text-sm font-semibold">{item.quantidade}</span>
                    <button onClick={() => onQty(item.id, item.quantidade + 1)} className="w-7 h-7 rounded-full text-white text-sm font-bold flex items-center justify-center" style={{ backgroundColor: paleta.primaria }}>+</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-5 border-t space-y-4">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span><span>{fmt(subtotal)}</span>
              </div>
              <button
                onClick={() => setStep('checkout')}
                className="w-full py-3.5 rounded-xl font-bold text-white text-base transition-opacity hover:opacity-90"
                style={{ backgroundColor: paleta.primaria }}
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {step === 'checkout' && (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Nome</label>
                <input name="cliente_nome" required placeholder="Seu nome" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2" style={{ '--tw-ring-color': paleta.primaria }} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">WhatsApp / Telefone</label>
                <input name="cliente_tel" required placeholder="(00) 00000-0000" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Tipo de entrega</label>
                <div className="grid grid-cols-2 gap-2">
                  {['entrega', 'retirada'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipoEntrega(t)}
                      className="py-2.5 rounded-xl border-2 text-sm font-semibold capitalize transition-colors"
                      style={tipoEntrega === t
                        ? { backgroundColor: paleta.primaria, borderColor: paleta.primaria, color: '#fff' }
                        : { borderColor: '#e5e7eb', color: '#6b7280' }}
                    >
                      {t === 'entrega' ? 'Entrega' : 'Retirada'}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="tipo_entrega" value={tipoEntrega} />
              </div>

              {tipoEntrega === 'entrega' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Rua / Avenida *</label>
                      <input
                        name="rua"
                        required
                        placeholder="Ex: Rua das Flores"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Quadra *</label>
                      <input
                        name="quadra"
                        required
                        placeholder="Ex: 5"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Lote *</label>
                      <input
                        name="lote"
                        required
                        placeholder="Ex: 12"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Número *</label>
                      <input
                        name="numero"
                        required
                        placeholder="Ex: 42"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Complemento</label>
                      <input
                        name="complemento"
                        placeholder="Apto, casa... (opcional)"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                  </div>

                  {bairros.length > 0 ? (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                        Bairro <span className="text-red-500">*</span>
                      </label>
                      <select name="bairro" required className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
                        <option value="">Selecione...</option>
                        {bairros.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                        Bairro <span className="text-red-500">*</span>
                      </label>
                      <input
                        name="bairro"
                        required
                        placeholder="Ex: Centro"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                  )}

                  <div className="flex justify-between text-sm bg-gray-50 rounded-xl px-4 py-3">
                    <span className="text-gray-600">Taxa de entrega</span>
                    <span className="font-semibold">{taxa === 0 ? 'Grátis' : fmt(taxa)}</span>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Observações (opcional)</label>
                <textarea name="observacoes" placeholder="Sem cebola, caprichar no molho..." rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none" />
              </div>

              <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1">
                <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                {tipoEntrega === 'entrega' && <div className="flex justify-between text-sm text-gray-600"><span>Entrega</span><span>{taxa === 0 ? 'Grátis' : fmt(taxa)}</span></div>}
                <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200"><span>Total</span><span>{fmt(total)}</span></div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            </div>

            <div className="p-5 border-t flex gap-3">
              <button type="button" onClick={() => setStep('cart')} className="flex-1 py-3 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700">Voltar</button>
              <button type="submit" disabled={pending} className="flex-1 py-3 rounded-xl font-bold text-white text-sm transition-opacity hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: paleta.primaria }}>
                {pending ? 'Enviando...' : 'Fazer pedido'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function MenuClient({ store, paleta, aberto, categories, products }) {
  const [cart, setCart]             = useState([])
  const [cartOpen, setCartOpen]     = useState(false)
  const [meiaProduct, setMeiaProduct] = useState(null)
  const [activeCategory, setActiveCategory] = useState(null)
  const catRefs = useRef({})

  const productsByCategory = categories
    .map(cat => ({
      ...cat,
      products: products.filter(p => p.category_id === cat.id),
      permiteMeiaMeia: categoriaPermiteMeiaMeia(cat.nome),
    }))
    .filter(cat => cat.products.length > 0)

  const meiaEligibleProducts = products.filter(p => {
    const cat = productsByCategory.find(c => c.id === p.category_id)
    return cat?.permiteMeiaMeia ?? true
  })

  function addToCart({ product, variant, preco, nomeProduto, nomeVariante, variantId, productId, ehMeiaMeia, meiaMetaInfo }) {
    const isFullItem = product !== undefined
    const item = isFullItem
      ? {
          id:          uid(),
          productId:   product.id,
          variantId:   variant.id,
          nomeProduto: product.nome,
          nomeVariante: variant.nome,
          preco,
          quantidade:  1,
          ehMeiaMeia:  false,
          meiaMetaInfo: null,
        }
      : {
          id:          uid(),
          productId,
          variantId,
          nomeProduto,
          nomeVariante,
          preco,
          quantidade:  1,
          ehMeiaMeia:  true,
          meiaMetaInfo,
        }

    setCart(prev => [...prev, item])
    setCartOpen(true)
  }

  function setQty(itemId, qty) {
    if (qty <= 0) setCart(prev => prev.filter(i => i.id !== itemId))
    else setCart(prev => prev.map(i => i.id === itemId ? { ...i, quantidade: qty } : i))
  }

  const totalItems = cart.reduce((s, i) => s + i.quantidade, 0)

  return (
    <div className="min-h-screen" style={{ backgroundColor: paleta.fundo, color: paleta.texto }}>

      {/* Hero / Header */}
      <div
        className="relative w-full flex flex-col items-center justify-center py-16 px-4 text-center overflow-hidden"
        style={store.imagem_fundo_url
          ? { backgroundImage: `url(${store.imagem_fundo_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: `linear-gradient(135deg, ${paleta.primaria} 0%, ${paleta.hover} 100%)` }
        }
      >
        {store.imagem_fundo_url && (
          <div className="absolute inset-0 bg-black/50" />
        )}
        <div className="relative z-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white drop-shadow-md tracking-tight">{store.nome}</h1>
          <div className="mt-3">
            <Badge aberto={aberto} />
          </div>
        </div>
      </div>

      {/* Category tabs — só categorias com produtos */}
      {productsByCategory.length > 0 && (
        <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-100 shadow-sm">
          <div className="flex overflow-x-auto gap-0 px-4 scrollbar-hide max-w-5xl mx-auto">
            {productsByCategory.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id)
                  catRefs.current[cat.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className="whitespace-nowrap px-4 py-3.5 text-sm font-semibold border-b-2 transition-colors flex-shrink-0"
                style={activeCategory === cat.id
                  ? { borderColor: paleta.primaria, color: paleta.primaria }
                  : { borderColor: 'transparent', color: '#9ca3af' }
                }
              >
                {cat.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Products */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10 pb-32">
        {productsByCategory.map(cat => (
          cat.products.length === 0 ? null : (
            <section key={cat.id} ref={el => { catRefs.current[cat.id] = el }}>
              <h2 className="text-xl font-bold mb-4" style={{ color: paleta.texto }}>{cat.nome}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cat.products.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    paleta={paleta}
                    meiaEnabled={store.meia_a_meia_enabled}
                    permiteMeiaMeia={cat.permiteMeiaMeia}
                    onAdd={addToCart}
                    onMeiaClick={setMeiaProduct}
                  />
                ))}
              </div>
            </section>
          )
        ))}
      </main>

      {/* Floating cart button */}
      {totalItems > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl text-white font-bold text-sm transition-transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: paleta.primaria }}
        >
          <span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-xs font-extrabold">{totalItems}</span>
          <span>Ver pedido</span>
          <span className="ml-1">{fmt(cart.reduce((s, i) => s + i.preco * i.quantidade, 0))}</span>
        </button>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <CartDrawer
          items={cart}
          store={store}
          paleta={paleta}
          onClose={() => setCartOpen(false)}
          onQty={setQty}
          onRemove={id => setCart(prev => prev.filter(i => i.id !== id))}
        />
      )}

      {/* Meia a meia modal */}
      {meiaProduct && (
        <MeiaModal
          products={meiaEligibleProducts}
          regra={store.meia_a_meia_rule ?? 'max'}
          paleta={paleta}
          onAdd={addToCart}
          onClose={() => setMeiaProduct(null)}
        />
      )}
    </div>
  )
}
