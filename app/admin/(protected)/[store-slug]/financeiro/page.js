import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import FinanceiroClient from './FinanceiroClient'

function periodoRange(periodo) {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  switch (periodo) {
    case 'hoje':
      return [today, today]
    case 'semana': {
      const d = new Date(now)
      const dow = d.getDay() || 7
      d.setDate(d.getDate() - dow + 1)
      return [d.toISOString().split('T')[0], today]
    }
    case '7dias': {
      const d = new Date(now)
      d.setDate(d.getDate() - 6)
      return [d.toISOString().split('T')[0], today]
    }
    case 'mes_passado': {
      const f = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const l = new Date(now.getFullYear(), now.getMonth(), 0)
      return [f.toISOString().split('T')[0], l.toISOString().split('T')[0]]
    }
    case '30dias': {
      const d = new Date(now)
      d.setDate(d.getDate() - 29)
      return [d.toISOString().split('T')[0], today]
    }
    default: { // 'mes'
      const f = new Date(now.getFullYear(), now.getMonth(), 1)
      return [f.toISOString().split('T')[0], today]
    }
  }
}

function prevPeriodoRange(periodo, inicio, fim) {
  if (periodo === 'mes') {
    const now = new Date()
    const f = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const l = new Date(now.getFullYear(), now.getMonth(), 0)
    return [f.toISOString().split('T')[0], l.toISOString().split('T')[0]]
  }
  if (periodo === 'mes_passado') {
    const now = new Date()
    const f = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    const l = new Date(now.getFullYear(), now.getMonth() - 1, 0)
    return [f.toISOString().split('T')[0], l.toISOString().split('T')[0]]
  }
  const s = new Date(inicio + 'T12:00:00')
  const e = new Date(fim    + 'T12:00:00')
  const days = Math.round((e - s) / 86400000) + 1
  const prevFim = new Date(s)
  prevFim.setDate(prevFim.getDate() - 1)
  const prevInicio = new Date(prevFim)
  prevInicio.setDate(prevInicio.getDate() - days + 1)
  return [prevInicio.toISOString().split('T')[0], prevFim.toISOString().split('T')[0]]
}

function daysBetween(inicio, fim) {
  const s = new Date(inicio + 'T12:00:00')
  const e = new Date(fim    + 'T12:00:00')
  return Math.max(1, Math.round((e - s) / 86400000) + 1)
}

export default async function FinanceiroPage({ params, searchParams }) {
  const { 'store-slug': storeSlug } = await params
  const { periodo = 'mes' } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: adminStore } = await supabase
    .from('admin_stores').select('store_id').eq('user_id', user.id).single()
  if (!adminStore) redirect('/admin/login')

  const storeId = adminStore.store_id
  const [inicio, fim] = periodoRange(periodo)
  const [prevInicio, prevFim] = prevPeriodoRange(periodo, inicio, fim)
  const dias = daysBetween(inicio, fim)

  const [
    { data: allOrders },
    { data: ordersAnterior },
    { data: funcionarios },
    { data: intercorrencias },
  ] = await Promise.all([
    supabase.from('orders')
      .select('id, status, subtotal, total, taxa_entrega, tipo_entrega, created_at')
      .eq('store_id', storeId)
      .gte('created_at', inicio + 'T00:00:00')
      .lte('created_at', fim    + 'T23:59:59'),
    supabase.from('orders')
      .select('total')
      .eq('store_id', storeId)
      .gte('created_at', prevInicio + 'T00:00:00')
      .lte('created_at', prevFim    + 'T23:59:59')
      .neq('status', 'cancelado'),
    supabase.from('funcionarios')
      .select('id, valor_diaria')
      .eq('store_id', storeId)
      .eq('ativo', true),
    supabase.from('intercorrencias')
      .select('ajuste')
      .eq('store_id', storeId)
      .gte('data', inicio)
      .lte('data', fim),
  ])

  const orders  = allOrders ?? []
  const validos = orders.filter(o => o.status !== 'cancelado')
  const orderIds = validos.map(o => o.id)

  // Top produtos — query sequencial (depende de orderIds)
  let topProdutos = []
  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from('order_items')
      .select('nome_produto, nome_variante, quantidade, subtotal')
      .in('order_id', orderIds)
      .eq('store_id', storeId)

    const map = {}
    for (const item of items ?? []) {
      const key = item.nome_variante
        ? `${item.nome_produto} (${item.nome_variante})`
        : item.nome_produto
      if (!map[key]) map[key] = { nome: key, quantidade: 0, total: 0 }
      map[key].quantidade += Number(item.quantidade)
      map[key].total      += Number(item.subtotal)
    }
    topProdutos = Object.values(map).sort((a, b) => b.total - a.total).slice(0, 8)
  }

  // Métricas
  const faturamento       = validos.reduce((s, o) => s + Number(o.total), 0)
  const taxaEntregaTotal  = validos.reduce((s, o) => s + Number(o.taxa_entrega || 0), 0)
  const totalPedidos      = validos.length
  const pedidosCancelados = orders.length - totalPedidos
  const ticketMedio       = totalPedidos > 0 ? faturamento / totalPedidos : 0
  const pedidosEntrega    = validos.filter(o => o.tipo_entrega === 'entrega').length
  const pedidosRetirada   = validos.filter(o => o.tipo_entrega === 'retirada').length

  const pedidosPorStatus = {
    novo:       orders.filter(o => o.status === 'novo').length,
    em_preparo: orders.filter(o => o.status === 'em_preparo').length,
    a_caminho:  orders.filter(o => o.status === 'a_caminho').length,
    entregue:   orders.filter(o => o.status === 'entregue').length,
    cancelado:  pedidosCancelados,
  }

  // Gastos equipe
  const salarioBase  = (funcionarios ?? []).reduce((s, f) => s + Number(f.valor_diaria) * dias, 0)
  const ajustesTotal = (intercorrencias ?? []).reduce((s, i) => s + Number(i.ajuste), 0)
  const gastosEquipe = salarioBase + ajustesTotal
  const lucroEstimado = faturamento - gastosEquipe

  // Crescimento vs período anterior
  const fatAnterior = (ordersAnterior ?? []).reduce((s, o) => s + Number(o.total), 0)
  const crescimentoPct = fatAnterior > 0
    ? Math.round(((faturamento - fatAnterior) / fatAnterior) * 100)
    : null

  // Faturamento por dia (inclui dias sem pedido com total = 0)
  const dayMap = {}
  for (const o of validos) {
    const d = o.created_at.split('T')[0]
    dayMap[d] = (dayMap[d] || 0) + Number(o.total)
  }
  const faturamentoPorDia = []
  const cur = new Date(inicio + 'T12:00:00')
  const end = new Date(fim    + 'T12:00:00')
  while (cur <= end) {
    const d = cur.toISOString().split('T')[0]
    faturamentoPorDia.push({ data: d, total: dayMap[d] || 0 })
    cur.setDate(cur.getDate() + 1)
  }

  return (
    <FinanceiroClient
      storeSlug={storeSlug}
      periodo={periodo}
      inicio={inicio}
      fim={fim}
      dias={dias}
      faturamento={faturamento}
      taxaEntregaTotal={taxaEntregaTotal}
      totalPedidos={totalPedidos}
      pedidosCancelados={pedidosCancelados}
      ticketMedio={ticketMedio}
      pedidosEntrega={pedidosEntrega}
      pedidosRetirada={pedidosRetirada}
      pedidosPorStatus={pedidosPorStatus}
      gastosEquipe={gastosEquipe}
      lucroEstimado={lucroEstimado}
      crescimentoPct={crescimentoPct}
      faturamentoPorDia={faturamentoPorDia}
      topProdutos={topProdutos}
    />
  )
}
