import { createServiceClient } from '@/lib/supabase-service'
import { notFound } from 'next/navigation'
import { getPaleta } from '@/lib/paletas'
import OrderStatus from './OrderStatus'

// Link público de acompanhamento expira 7 dias após a criação do pedido.
// Depois disso, o cliente perde acesso aos dados de PII via URL pública.
// (O admin continua vendo no painel — RLS protege normalmente.)
const TRACKING_TTL_MS = 7 * 24 * 60 * 60 * 1000

export default async function OrderPage({ params }) {
  const { 'store-slug': storeSlug, 'order-id': orderId } = await params
  const supabase = createServiceClient()

  const { data: store } = await supabase
    .from('stores')
    .select('id, nome, slug, paleta_id')
    .eq('slug', storeSlug)
    .single()

  if (!store) notFound()

  const { data: order } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .eq('store_id', store.id)
    .single()

  if (!order) notFound()

  // Expiração do link público de acompanhamento
  const ageMs = Date.now() - new Date(order.created_at).getTime()
  if (ageMs > TRACKING_TTL_MS) notFound()

  const paleta = getPaleta(store.paleta_id)

  return (
    <div className="min-h-screen" style={{ backgroundColor: paleta.fundo }}>
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <p className="text-sm font-medium mb-1" style={{ color: paleta.primaria }}>{store.nome}</p>
          <h1 className="text-2xl font-extrabold text-gray-900">Acompanhe seu pedido</h1>
          <p className="text-xs text-gray-400 mt-1">#{orderId.slice(0, 8).toUpperCase()}</p>
        </div>
        <OrderStatus initialOrder={order} paleta={paleta} />
      </div>
    </div>
  )
}
