'use client'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Bike, Phone } from 'lucide-react'
import { marcarEntregue } from '@/app/entregador/_actions/orders'

function fmt(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60)   return `${diff}s atrás`
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`
  return `${Math.floor(diff / 3600)}h atrás`
}

export default function EntregadorClient({ entregador, initialOrders, token }) {
  const [orders, setOrders] = useState(initialOrders)
  const [loading, setLoading] = useState({})

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    const channel = supabase
      .channel(`entregador-${entregador.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `entregador_id=eq.${entregador.id}`,
      }, payload => {
        if (payload.new.status === 'entregue' || payload.new.status === 'cancelado') {
          setOrders(prev => prev.filter(o => o.id !== payload.new.id))
        } else {
          setOrders(prev => prev.map(o =>
            o.id === payload.new.id ? { ...o, ...payload.new } : o
          ))
        }
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'orders',
        filter: `entregador_id=eq.${entregador.id}`,
      }, async payload => {
        if (payload.new.status !== 'a_caminho') return
        const { data } = await supabase
          .from('orders').select('*, order_items(*)')
          .eq('id', payload.new.id).single()
        if (data) setOrders(prev => [data, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [entregador.id])

  async function handleMarcarEntregue(orderId) {
    if (!confirm('Confirmar que a entrega foi realizada?')) return
    setLoading(prev => ({ ...prev, [orderId]: true }))
    const result = await marcarEntregue(orderId, token)
    if (result?.error) {
      alert(result.error)
      setLoading(prev => ({ ...prev, [orderId]: false }))
    } else {
      setOrders(prev => prev.filter(o => o.id !== orderId))
      setLoading(prev => ({ ...prev, [orderId]: false }))
    }
  }

  const pendentes = orders.filter(o => o.status === 'a_caminho')

  return (
    <div className="min-h-screen bg-gray-50">

      <header className="bg-orange-500 text-white px-5 py-4 shadow-md">
        <div className="max-w-lg mx-auto">
          <p className="text-xs font-medium text-orange-100 uppercase tracking-wide">Portal do entregador</p>
          <h1 className="text-xl font-bold">{entregador.nome}</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Atualizações em tempo real
        </div>

        {pendentes.length === 0 ? (
          <div className="text-center py-20">
            <Bike className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-base font-semibold text-gray-600">Nenhuma entrega ativa</p>
            <p className="text-sm text-gray-400 mt-1">Aguardando novos pedidos...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-gray-700">
              {pendentes.length} entrega{pendentes.length !== 1 ? 's' : ''} ativa{pendentes.length !== 1 ? 's' : ''}
            </p>

            {pendentes.map(order => (
              <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-gray-900 text-lg">{order.cliente_nome}</p>
                    <p className="text-xs text-gray-400">
                      #{order.id.slice(0, 8).toUpperCase()} · {timeAgo(order.created_at)}
                    </p>
                  </div>
                  <p className="font-bold text-gray-900 text-xl whitespace-nowrap">{fmt(order.total)}</p>
                </div>

                {/* Endereço destacado */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 space-y-1">
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Endereço de entrega</p>
                  <p className="text-base font-semibold text-blue-900">{order.endereco}</p>
                  {order.bairro && <p className="text-sm text-blue-700 font-medium">{order.bairro}</p>}
                </div>

                {/* Contato */}
                <div className="flex gap-2">
                  <a
                    href={`tel:${order.cliente_tel}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  >
                    <Phone className="w-4 h-4" /> Ligar
                  </a>
                  <a
                    href={`https://wa.me/55${order.cliente_tel.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 active:opacity-80 transition-opacity"
                    style={{ backgroundColor: '#25d366' }}
                  >
                    WhatsApp
                  </a>
                </div>

                {/* Itens */}
                <div className="space-y-1">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Itens do pedido</p>
                  {order.order_items?.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-gray-700">
                        {item.quantidade}× {item.nome_produto}
                        {item.nome_variante ? ` (${item.nome_variante})` : ''}
                      </span>
                      <span className="text-gray-500 font-medium">{fmt(item.subtotal)}</span>
                    </div>
                  ))}
                </div>

                {order.observacoes && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    <p className="text-sm text-amber-800">Obs.: {order.observacoes}</p>
                  </div>
                )}

                {/* Botão confirmar entrega */}
                <button
                  onClick={() => handleMarcarEntregue(order.id)}
                  disabled={loading[order.id]}
                  className="w-full py-4 rounded-2xl text-base font-bold text-white bg-green-500 hover:bg-green-600 active:scale-95 transition-all disabled:opacity-60 disabled:scale-100 shadow-sm shadow-green-200"
                >
                  {loading[order.id] ? 'Confirmando...' : '✓ Confirmar entrega'}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
