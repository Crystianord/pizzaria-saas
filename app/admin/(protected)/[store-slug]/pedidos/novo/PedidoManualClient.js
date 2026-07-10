'use client'
import { useState, useRef, useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { createOrderManual } from '@/app/admin/_actions/orders'
import { Search, Bike, Store } from 'lucide-react'

function fmt(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Botão de submit ──────────────────────────────────────────────────────────
function SubmitBtn({ disabled }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="w-full py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:bg-orange-200 text-white font-bold text-base transition-colors"
    >
      {pending ? 'Salvando pedido...' : 'Criar pedido'}
    </button>
  )
}

// ─── Badge de quantidade no carrinho ─────────────────────────────────────────
function CartBadge({ count }) {
  if (!count) return null
  return (
    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
      {count > 9 ? '9+' : count}
    </span>
  )
}

// ─── Controle de quantidade ───────────────────────────────────────────────────
function QtyControl({ value, onChange, onRemove, small }) {
  const cls = small ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={value === 1 ? onRemove : () => onChange(value - 1)}
        className={`${cls} rounded-full border-2 ${value === 1 ? 'border-red-300 text-red-500 hover:bg-red-50' : 'border-gray-300 text-gray-600 hover:bg-gray-100'} font-bold flex items-center justify-center transition-colors`}
      >
        {value === 1 ? '×' : '−'}
      </button>
      <span className={`${small ? 'w-5 text-xs' : 'w-7 text-sm'} text-center font-semibold text-gray-900`}>{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className={`${cls} rounded-full border-2 border-orange-400 text-orange-500 hover:bg-orange-50 font-bold flex items-center justify-center transition-colors`}
      >
        +
      </button>
    </div>
  )
}

// ─── Browser de produtos ──────────────────────────────────────────────────────
function ProductBrowser({ categories, products, onAdd }) {
  const [search, setSearch]     = useState('')
  const [activeCat, setActiveCat] = useState(categories[0]?.id ?? null)

  const query = search.trim().toLowerCase()

  const filtered = query
    ? products.filter(p => p.nome.toLowerCase().includes(query))
    : products.filter(p => p.category_id === activeCat)

  function addVariant(product, variant) {
    onAdd({
      productId:   product.id,
      variantId:   variant.id,
      nomeProduto: product.nome,
      nomeVariante: variant.nome,
      preco:       variant.preco,
    })
  }

  function addDirect(product) {
    onAdd({
      productId:   product.id,
      variantId:   null,
      nomeProduto: product.nome,
      nomeVariante: null,
      preco:       product.preco,
    })
  }

  return (
    <div className="flex flex-col h-full">

      {/* Busca */}
      <div className="px-4 pt-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Tabs de categoria (quando não está buscando) */}
      {!query && (
        <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-hide flex-shrink-0">
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCat(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
                activeCat === cat.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-orange-300'
              }`}
            >
              {cat.nome}
            </button>
          ))}
        </div>
      )}

      {/* Lista de produtos */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Nenhum produto encontrado.</p>
        ) : (
          filtered.map(product => (
            <div key={product.id} className="bg-white rounded-xl border border-gray-100 p-3 space-y-2.5">
              <p className="font-semibold text-sm text-gray-900">{product.nome}</p>

              {product.product_variants.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {product.product_variants.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => addVariant(product, v)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-2 border-orange-200 bg-orange-50 hover:bg-orange-100 hover:border-orange-400 transition-colors group text-left"
                    >
                      <span className="text-xs font-semibold text-gray-700 group-hover:text-gray-900">{v.nome}</span>
                      <span className="text-xs font-bold text-orange-600">{fmt(v.preco)}</span>
                      <span className="text-orange-400 text-xs font-bold">+</span>
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => addDirect(product)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 border-orange-200 bg-orange-50 hover:bg-orange-100 hover:border-orange-400 transition-colors"
                >
                  <span className="text-xs font-bold text-orange-600">{fmt(product.preco)}</span>
                  <span className="text-orange-400 text-xs font-bold">+ Adicionar</span>
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Painel do carrinho (direita) ─────────────────────────────────────────────
function CartPanel({ cart, onQty, onRemove, storeId, taxaEntrega, bairros, state }) {

  const [tipoEntrega, setTipoEntrega] = useState('entrega')
  const [rua, setRua]                 = useState('')
  const [quadra, setQuadra]           = useState('')
  const [lote, setLote]               = useState('')
  const [numero, setNumero]           = useState('')
  const [complemento, setComplemento] = useState('')
  const [bairro, setBairro]           = useState(bairros[0] ?? '')
  const [bairroCustom, setBairroCustom] = useState('')

  const subtotal    = cart.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const taxa        = tipoEntrega === 'entrega' ? taxaEntrega : 0
  const total       = subtotal + taxa
  const cartEmpty   = cart.length === 0

  const enderecoParts = [rua, quadra && `Quadra ${quadra}`, lote && `Lote ${lote}`, numero && `Nº ${numero}`, complemento].filter(Boolean)
  const enderecoFull  = enderecoParts.join(', ')
  const bairroFinal   = bairros.length > 0 ? bairro : bairroCustom

  const itemsJson = JSON.stringify(cart.map(i => ({
    productId:   i.productId,
    variantId:   i.variantId,
    nomeProduto: i.nomeProduto,
    nomeVariante: i.nomeVariante,
    preco:       i.preco,
    quantidade:  i.quantidade,
  })))

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      <div className="p-4 space-y-5">

        {/* ── Cliente ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Cliente</h2>
          <div className="space-y-2">
            <input
              name="cliente_nome"
              required
              placeholder="Nome do cliente *"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <input
              name="cliente_tel"
              required
              placeholder="Telefone / WhatsApp *"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </div>

        {/* ── Entrega / Retirada ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Tipo</h2>
          <div className="grid grid-cols-2 gap-2">
            {[['entrega', Bike, 'Entrega'], ['retirada', Store, 'Retirada']].map(([v, Icon, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setTipoEntrega(v)}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-colors ${
                  tipoEntrega === v
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>

          {tipoEntrega === 'entrega' && (
            <div className="space-y-2 pt-1">
              <input
                value={rua} onChange={e => setRua(e.target.value)}
                required placeholder="Rua *"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <div className="grid grid-cols-3 gap-2">
                <input value={quadra} onChange={e => setQuadra(e.target.value)} placeholder="Quadra" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                <input value={lote}   onChange={e => setLote(e.target.value)}   placeholder="Lote"   className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="Nº"     className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <input
                value={complemento} onChange={e => setComplemento(e.target.value)}
                placeholder="Complemento (opcional)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              {bairros.length > 0 ? (
                <select
                  value={bairro}
                  onChange={e => setBairro(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                >
                  {bairros.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              ) : (
                <input
                  value={bairroCustom} onChange={e => setBairroCustom(e.target.value)}
                  required placeholder="Bairro *"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              )}
            </div>
          )}
        </div>

        {/* ── Itens do carrinho ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
            Itens {cart.length > 0 && <span className="text-orange-500">({cart.length})</span>}
          </h2>

          {cartEmpty ? (
            <p className="text-sm text-gray-400 text-center py-4">
              Adicione produtos pelo catálogo ao lado.
            </p>
          ) : (
            <div className="space-y-2">
              {cart.map(item => (
                <div key={item.uid} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.nomeProduto}</p>
                    {item.nomeVariante && (
                      <p className="text-xs text-gray-500">{item.nomeVariante}</p>
                    )}
                    <p className="text-xs font-bold text-orange-600">{fmt(item.preco)}</p>
                  </div>
                  <QtyControl
                    small
                    value={item.quantidade}
                    onChange={qty => onQty(item.uid, qty)}
                    onRemove={() => onRemove(item.uid)}
                  />
                  <p className="text-xs font-bold text-gray-700 w-14 text-right">
                    {fmt(item.preco * item.quantidade)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Observações ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">Observações</h2>
          <textarea
            name="observacoes"
            rows={2}
            placeholder="Ex: sem cebola, ponto da carne, troco para..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
          />
        </div>

        {/* ── Resumo ── */}
        <div className="bg-gray-900 rounded-2xl p-4 space-y-2 text-white">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Subtotal</span>
            <span className="font-medium">{fmt(subtotal)}</span>
          </div>
          {tipoEntrega === 'entrega' && taxa > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Taxa de entrega</span>
              <span className="font-medium">{fmt(taxa)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold pt-1 border-t border-gray-700">
            <span>Total</span>
            <span className="text-orange-400 text-lg">{fmt(total)}</span>
          </div>
        </div>

        {/* ── Campos hidden ── */}
        <input type="hidden" name="store_id"     value={storeId} />
        <input type="hidden" name="tipo_entrega"  value={tipoEntrega} />
        <input type="hidden" name="taxa_entrega"  value={taxa} />
        <input type="hidden" name="endereco"      value={enderecoFull} />
        <input type="hidden" name="bairro"        value={bairroFinal} />
        <input type="hidden" name="items_json"    value={itemsJson} />

        {state?.error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{state.error}</p>
        )}

        <SubmitBtn disabled={cartEmpty} />
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PedidoManualClient({
  storeId, storeSlug, taxaEntrega, bairros, categories, products,
}) {
  const [cart, setCart]       = useState([])
  const [mobileTab, setMobileTab] = useState('produtos') // 'produtos' | 'carrinho'
  const [state, formAction]   = useActionState(createOrderManual, null)

  const totalItems = cart.reduce((s, i) => s + i.quantidade, 0)

  function addToCart({ productId, variantId, nomeProduto, nomeVariante, preco }) {
    setCart(prev => {
      const key = `${productId}-${variantId ?? 'sem'}`
      const existing = prev.find(i => i.key === key)
      if (existing) {
        return prev.map(i => i.key === key ? { ...i, quantidade: i.quantidade + 1 } : i)
      }
      return [...prev, {
        uid: `${key}-${Date.now()}`,
        key, productId, variantId, nomeProduto, nomeVariante, preco, quantidade: 1,
      }]
    })
  }

  function updateQty(uid, qty) {
    setCart(prev => prev.map(i => i.uid === uid ? { ...i, quantidade: qty } : i))
  }

  function removeItem(uid) {
    setCart(prev => prev.filter(i => i.uid !== uid))
  }

  return (
    <form action={formAction}>
      {/* ── Desktop: dois painéis ── */}
      <div className="hidden lg:grid lg:grid-cols-[1fr_420px] h-[calc(100vh-73px)]">

        {/* Coluna esquerda: catálogo */}
        <div className="border-r border-gray-200 bg-gray-50 overflow-hidden flex flex-col">
          <div className="px-5 pt-4 pb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Catálogo</p>
          </div>
          <div className="flex-1 overflow-hidden">
            <ProductBrowser
              categories={categories}
              products={products}
              onAdd={addToCart}
            />
          </div>
        </div>

        {/* Coluna direita: carrinho + formulário */}
        <div className="bg-white overflow-hidden flex flex-col">
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pedido</p>
          </div>
          <div className="flex-1 overflow-hidden">
            <CartPanel
              cart={cart}
              onQty={updateQty}
              onRemove={removeItem}
              storeId={storeId}
              taxaEntrega={taxaEntrega}
              bairros={bairros}
              state={state}
            />
          </div>
        </div>
      </div>

      {/* ── Mobile: tabs ── */}
      <div className="lg:hidden">

        {/* Tab bar */}
        <div className="sticky top-[65px] z-20 bg-white border-b border-gray-200 flex">
          {[['produtos', 'Catálogo'], ['carrinho', 'Pedido']].map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMobileTab(tab)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-colors ${
                mobileTab === tab
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500'
              }`}
            >
              {label}
              {tab === 'carrinho' && (
                <span className="relative">
                  <CartBadge count={totalItems} />
                </span>
              )}
              {tab === 'carrinho' && totalItems > 0 && (
                <span className="text-xs bg-orange-500 text-white font-bold px-1.5 py-0.5 rounded-full">
                  {totalItems}
                </span>
              )}
            </button>
          ))}
        </div>

        {mobileTab === 'produtos' ? (
          <div className="min-h-[60vh]">
            <ProductBrowser
              categories={categories}
              products={products}
              onAdd={(item) => { addToCart(item); }}
            />
          </div>
        ) : (
          <CartPanel
            cart={cart}
            onQty={updateQty}
            onRemove={removeItem}
            storeId={storeId}
            taxaEntrega={taxaEntrega}
            bairros={bairros}
            state={state}
          />
        )}
      </div>
    </form>
  )
}
