'use client'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { motion } from 'framer-motion'
import { updateOrderStatus } from '@/app/admin/_actions/orders'
import Modal from '@/app/admin/_components/Modal'
import { Bike, Store, Phone, MessageSquare, ClipboardList, Printer } from 'lucide-react'
import { formatBR } from '@/lib/phone'
import { descreveItem, linhasDeOpcoes } from '@/lib/order-display'

const TABS = [
  { key: 'novo',       label: 'Em espera',  dot: 'bg-yellow-500' },
  { key: 'em_preparo', label: 'Em preparo', dot: 'bg-orange-500' },
  { key: 'a_caminho',  label: 'A caminho',  dot: 'bg-blue-500'   },
  { key: 'entregue',   label: 'Entregue',   dot: 'bg-green-500'  },
  { key: 'cancelado',  label: 'Cancelados', dot: 'bg-red-500'    },
]

const NEXT_STATUS = {
  novo:       { label: 'Iniciar preparo',   next: 'em_preparo' },
  em_preparo: { label: 'Saiu para entrega', next: 'a_caminho'  },
}

function fmt(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtSimple(v) {
  return Number(v).toFixed(2).replace('.', ',')
}

function handlePrint(orderId) {
  const styleId = 'comanda-print-style'
  let el = document.getElementById(styleId)
  if (!el) {
    el = document.createElement('style')
    el.id = styleId
    document.head.appendChild(el)
  }
  el.textContent = `@media print { #comanda-print-${orderId} { display: block !important; } }`
  window.print()
  window.addEventListener('afterprint', () => { el.textContent = '' }, { once: true })
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60)   return `${diff}s atrás`
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`
  return `${Math.floor(diff / 3600)}h atrás`
}

// ─── Comanda de impressão ─────────────────────────────────────────────────────

function ComandaPrint({ order, storeName }) {
  const date = new Date(order.created_at)
  const dateStr = date.toLocaleDateString('pt-BR')
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const isEntrega = order.tipo_entrega === 'entrega'

  return (
    <div id={`comanda-print-${order.id}`} style={{ display: 'none' }}>
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: '11px', width: '72mm', padding: '4mm', color: '#000', background: '#fff' }}>
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px dashed #000', paddingBottom: '4px', marginBottom: '4px' }}>
          {storeName}
        </div>
        <div style={{ borderBottom: '1px dashed #000', paddingBottom: '4px', marginBottom: '4px' }}>
          <div>Pedido #{order.id.slice(0, 8).toUpperCase()}</div>
          <div>{dateStr} {timeStr}</div>
          <div style={{ fontWeight: 'bold' }}>{isEntrega ? 'ENTREGA' : 'RETIRADA'} — {order.cliente_nome}</div>
        </div>
        <div style={{ borderBottom: '1px dashed #000', paddingBottom: '4px', marginBottom: '4px' }}>
          {order.order_items?.map(item => (
            <div key={item.id} className="comanda-print-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
                <span style={{ flex: 1 }}>
                  {`${item.quantidade}x ${descreveItem(item)}`}
                </span>
                <span style={{ flexShrink: 0 }}>{fmtSimple(item.subtotal)}</span>
              </div>

              {/* Sabores e adicionais escolhidos — a cozinha precisa ver isto */}
              {item.opcoes_info?.map(g => (
                <div key={g.grupo} style={{ paddingLeft: '8px', fontSize: '10px' }}>
                  {g.itens.map(o => o.nome).join(', ')}
                </div>
              ))}

              {item.observacoes && (
                <div style={{ paddingLeft: '8px', fontSize: '10px' }}>   {item.observacoes}</div>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Subtotal</span><span>{fmtSimple(order.subtotal)}</span>
        </div>
        {isEntrega && order.taxa_entrega > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Entrega</span><span>{fmtSimple(order.taxa_entrega)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', borderTop: '1px dashed #000', marginTop: '4px', paddingTop: '4px' }}>
          <span>TOTAL</span><span>R$ {fmtSimple(order.total)}</span>
        </div>
        {isEntrega && (
          <div style={{ borderTop: '1px dashed #000', marginTop: '4px', paddingTop: '4px', fontSize: '10px' }}>
            {order.endereco}{order.bairro ? ` - ${order.bairro}` : ''}
          </div>
        )}
        <div style={{ fontSize: '10px', marginTop: '2px' }}>Tel: {formatBR(order.cliente_tel)}</div>
        {order.observacoes && (
          <div style={{ fontSize: '10px', marginTop: '4px', borderTop: '1px dashed #000', paddingTop: '4px' }}>
            Obs: {order.observacoes}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Modal seleção de entregador ─────────────────────────────────────────────

function ModalEntregador({ open, entregadores, onConfirm, onClose }) {
  const [selected, setSelected] = useState(null)

  return (
    <Modal open={open} onClose={onClose} title="Selecionar entregador" size="sm">
      <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
        {entregadores.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">
            Nenhum entregador disponível hoje.<br />
            <a href="../entregadores" className="text-orange-500 underline font-semibold">Gerenciar entregadores</a>
          </p>
        ) : (
          entregadores.map(e => (
            <motion.button
              key={e.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelected(e)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
                selected?.id === e.id
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-100 hover:border-gray-200 bg-gray-50'
              }`}
            >
              <span className="w-9 h-9 rounded-full bg-orange-100 text-orange-600 font-bold text-sm flex items-center justify-center flex-shrink-0">
                {e.nome.charAt(0).toUpperCase()}
              </span>
              <div>
                <p className="font-semibold text-sm text-gray-900">{e.nome}</p>
                <p className="text-xs text-gray-400">{formatBR(e.telefone)}</p>
              </div>
              {selected?.id === e.id && (
                <span className="ml-auto w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              )}
            </motion.button>
          ))
        )}
      </div>

      <div className="px-4 pb-4 flex gap-2">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
        <motion.button
          whileHover={{ scale: selected ? 1.02 : 1 }}
          whileTap={{ scale: selected ? 0.97 : 1 }}
          onClick={() => selected && onConfirm(selected)}
          disabled={!selected}
          className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-orange-200 text-white text-sm font-bold transition-colors"
        >
          Confirmar saída
        </motion.button>
      </div>
    </Modal>
  )
}

// ─── Card do pedido ───────────────────────────────────────────────────────────

function OrderCard({ order, storeSlug, storeName, entregadores, onStatusChange, baseUrl }) {
  const [loading, setLoading]       = useState(false)
  const [showModal, setShowModal]   = useState(false)
  const tab      = TABS.find(t => t.key === order.status) ?? TABS[0]
  const nextInfo = NEXT_STATUS[order.status]

  async function handleNext() {
    if (nextInfo.next === 'a_caminho') {
      setShowModal(true)
      return
    }
    setLoading(true)
    await updateOrderStatus(order.id, nextInfo.next, storeSlug)
    onStatusChange(order.id, nextInfo.next)
    setLoading(false)
  }

  async function handleConfirmEntregador(entregador) {
    setShowModal(false)
    setLoading(true)
    await updateOrderStatus(order.id, 'a_caminho', storeSlug, entregador.id, entregador.nome)
    onStatusChange(order.id, 'a_caminho', { entregador_id: entregador.id, entregador_nome: entregador.nome })
    setLoading(false)
  }

  async function handleCancel() {
    if (!confirm('Cancelar este pedido?')) return
    setLoading(true)
    await updateOrderStatus(order.id, 'cancelado', storeSlug)
    onStatusChange(order.id, 'cancelado')
    setLoading(false)
  }

  return (
    <>
      <ModalEntregador
        open={showModal}
        entregadores={entregadores}
        onConfirm={handleConfirmEntregador}
        onClose={() => setShowModal(false)}
      />

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-gray-900">{order.cliente_nome}</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                { novo: 'bg-yellow-100 text-yellow-800', em_preparo: 'bg-orange-100 text-orange-800', a_caminho: 'bg-blue-100 text-blue-800', entregue: 'bg-green-100 text-green-800', cancelado: 'bg-red-100 text-red-800' }[order.status]
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${tab.dot}`} />
                {tab.label}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">#{order.id.slice(0, 8).toUpperCase()} · {timeAgo(order.created_at)}</p>
            {order.entregador_nome && (
              <p className="text-xs text-blue-600 font-semibold mt-0.5 flex items-center gap-1"><Bike className="w-3 h-3" /> {order.entregador_nome}</p>
            )}
          </div>
          <p className="font-bold text-gray-900 text-lg flex-shrink-0">{fmt(order.total)}</p>
        </div>

        <div className="space-y-1">
          {order.order_items?.map(item => (
            <div key={item.id} className="flex justify-between text-sm gap-2">
              <span className="text-gray-700 min-w-0">
                {item.quantidade}× {descreveItem(item)}
                {item.eh_meia_meia ? ' ½' : ''}
                {linhasDeOpcoes(item).map((linha, i) => (
                  <span key={i} className="block text-xs text-gray-400 leading-snug">{linha}</span>
                ))}
              </span>
              <span className="text-gray-500 flex-shrink-0">{fmt(item.subtotal)}</span>
            </div>
          ))}
        </div>

        <div className="text-xs text-gray-500 space-y-0.5 bg-gray-50 rounded-xl px-3 py-2">
          <p className="font-semibold text-gray-700 flex items-center gap-1">
            {order.tipo_entrega === 'entrega' ? <><Bike className="w-3 h-3" /> Entrega</> : <><Store className="w-3 h-3" /> Retirada</>}
            {order.tipo_entrega === 'entrega' && order.taxa_entrega > 0 && ` · ${fmt(order.taxa_entrega)}`}
          </p>
          {order.tipo_entrega === 'entrega' && (
            <p>{order.endereco}{order.bairro ? `, ${order.bairro}` : ''}</p>
          )}
          <p className="flex items-center gap-1"><Phone className="w-3 h-3" /> {formatBR(order.cliente_tel)}</p>
          {order.observacoes && <p className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {order.observacoes}</p>}
        </div>

        <div className="flex gap-2 pt-1 flex-wrap">
          {order.status !== 'entregue' && order.status !== 'cancelado' && nextInfo && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleNext}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-60"
            >
              {loading ? '...' : nextInfo.label}
            </motion.button>
          )}
          {order.status !== 'entregue' && order.status !== 'cancelado' && (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleCancel}
              disabled={loading}
              className="px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-60"
            >
              Cancelar
            </motion.button>
          )}
          <button
            onClick={() => handlePrint(order.id)}
            className="px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-1"
            title="Imprimir comanda"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>

        <ComandaPrint order={order} storeName={storeName} />
      </motion.div>
    </>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PedidosClient({ initialOrders, storeId, storeSlug, storeName, entregadores, baseUrl }) {
  const [orders, setOrders]       = useState(initialOrders)
  const [activeTab, setActiveTab] = useState('novo')

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    const channel = supabase
      .channel(`store-orders-${storeId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'orders',
        filter: `store_id=eq.${storeId}`,
      }, async payload => {
        const { data } = await supabase
          .from('orders').select('*, order_items(*)')
          .eq('id', payload.new.id).single()
        if (data) { setOrders(prev => [data, ...prev]); setActiveTab('novo') }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `store_id=eq.${storeId}`,
      }, payload => {
        setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [storeId])

  function handleStatusChange(orderId, newStatus, extra = {}) {
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, status: newStatus, ...extra } : o
    ))
  }

  const filtered = orders.filter(o => o.status === activeTab)

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide">
        {TABS.map(tab => {
          const count = orders.filter(o => o.status === tab.key).length
          return (
            <motion.button
              key={tab.key}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors flex-shrink-0 border-2 ${
                activeTab === tab.key
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${tab.dot}`} />
              {tab.label}
              {count > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>
                  {count}
                </span>
              )}
            </motion.button>
          )
        })}
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        Atualização em tempo real
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Nenhum pedido aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              storeSlug={storeSlug}
              storeName={storeName}
              entregadores={entregadores}
              baseUrl={baseUrl}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}
