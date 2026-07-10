'use client'
import { useRouter } from 'next/navigation'

function fmt(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtShortDate(s) {
  if (!s) return ''
  const [, mes, dia] = s.split('-')
  return `${dia}/${mes}`
}

function fmtFullDate(s) {
  if (!s) return ''
  const [ano, mes, dia] = s.split('-')
  return `${dia}/${mes}/${ano}`
}

const PERIODOS = [
  { value: 'hoje',        label: 'Hoje' },
  { value: '7dias',       label: '7 dias' },
  { value: 'semana',      label: 'Esta semana' },
  { value: 'mes',         label: 'Este mês' },
  { value: 'mes_passado', label: 'Mês passado' },
  { value: '30dias',      label: '30 dias' },
]

function KpiCard({ label, value, sub, accent = false }) {
  return (
    <div className={`rounded-2xl p-5 ${accent ? 'bg-orange-500' : 'bg-white border border-gray-100 shadow-sm'}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${accent ? 'text-orange-100' : 'text-gray-500'}`}>
        {label}
      </p>
      <p className={`text-2xl font-bold mt-2 leading-tight ${accent ? 'text-white' : 'text-gray-900'}`}>{value}</p>
      {sub && (
        <p className={`text-xs mt-1.5 ${accent ? 'text-orange-200' : 'text-gray-400'}`}>{sub}</p>
      )}
    </div>
  )
}

function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.total), 1)
  const hasData = data.some(d => d.total > 0)
  const showLabels = data.length <= 14

  if (!hasData) {
    return (
      <div className="h-32 flex items-center justify-center text-gray-300 text-sm">
        Sem pedidos no período
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-0.5 h-32" style={{ minWidth: data.length * 16 }}>
        {data.map(d => {
          const barH = d.total > 0 ? Math.max(4, Math.round((d.total / max) * 124)) : 2
          const dow = new Date(d.data + 'T12:00:00').getDay()
          const isWeekend = dow === 0 || dow === 6
          return (
            <div
              key={d.data}
              title={`${fmtShortDate(d.data)}: ${d.total > 0 ? fmt(d.total) : 'Sem pedidos'}`}
              style={{ height: barH }}
              className={`flex-1 rounded-t cursor-default transition-opacity hover:opacity-70 ${
                d.total > 0
                  ? isWeekend ? 'bg-orange-300' : 'bg-orange-400'
                  : 'bg-gray-100'
              }`}
            />
          )
        })}
      </div>
      <div className="flex mt-1.5 gap-0.5" style={{ minWidth: data.length * 16 }}>
        {data.map((d, i) => {
          const show = showLabels
            ? true
            : i === 0 || i === data.length - 1 || i % 7 === 0
          return (
            <div key={d.data} className="flex-1 text-center" style={{ minWidth: 16 }}>
              {show && (
                <span className="text-[9px] text-gray-400">{fmtShortDate(d.data)}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function FinanceiroClient({
  storeSlug,
  periodo,
  inicio,
  fim,
  dias,
  faturamento,
  taxaEntregaTotal,
  totalPedidos,
  pedidosCancelados,
  ticketMedio,
  pedidosEntrega,
  pedidosRetirada,
  pedidosPorStatus,
  gastosEquipe,
  lucroEstimado,
  crescimentoPct,
  faturamentoPorDia,
  topProdutos,
}) {
  const router = useRouter()
  const lucroPositivo = lucroEstimado >= 0

  function crescimentoLabel() {
    if (crescimentoPct === null) return 'Primeiro período'
    const sinal = crescimentoPct >= 0 ? '▲' : '▼'
    return `${sinal} ${Math.abs(crescimentoPct)}% vs período anterior`
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Painel Financeiro</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {fmtFullDate(inicio)}{inicio !== fim ? ` → ${fmtFullDate(fim)}` : ''} · {dias} dia{dias !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PERIODOS.map(p => (
            <button
              key={p.value}
              onClick={() => router.push(`/admin/${storeSlug}/financeiro?periodo=${p.value}`)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                periodo === p.value
                  ? 'bg-gray-900 border-gray-900 text-white'
                  : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Faturamento"
          value={fmt(faturamento)}
          sub={crescimentoLabel()}
          accent
        />
        <KpiCard
          label="Pedidos"
          value={totalPedidos}
          sub={pedidosCancelados > 0 ? `${pedidosCancelados} cancelado${pedidosCancelados !== 1 ? 's' : ''}` : 'Nenhum cancelado'}
        />
        <KpiCard
          label="Ticket Médio"
          value={fmt(ticketMedio)}
          sub={`${pedidosEntrega} entrega${pedidosEntrega !== 1 ? 's' : ''} · ${pedidosRetirada} retirada${pedidosRetirada !== 1 ? 's' : ''}`}
        />
        <KpiCard
          label="Taxa de Entrega"
          value={fmt(taxaEntregaTotal)}
          sub={pedidosEntrega > 0 ? `${pedidosEntrega} pedido${pedidosEntrega !== 1 ? 's' : ''} com entrega` : 'Nenhuma entrega'}
        />
      </div>

      {/* Lucro + Gastos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`rounded-2xl p-5 ${lucroPositivo ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Lucro Estimado *</p>
          <p className={`text-3xl font-bold mt-2 ${lucroPositivo ? 'text-emerald-600' : 'text-red-600'}`}>
            {fmt(lucroEstimado)}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Faturamento {fmt(faturamento)} − Gastos equipe {fmt(gastosEquipe)}
          </p>
          <p className="text-[10px] text-gray-400 mt-1.5">
            * Estimativa sem custo de mercadoria — considera apenas pessoal.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Gastos com Equipe</p>
          <p className="text-3xl font-bold mt-2 text-gray-900">{fmt(gastosEquipe)}</p>
          <p className="text-xs text-gray-400 mt-2">
            Diárias × {dias} dia{dias !== 1 ? 's' : ''} + intercorrências do período
          </p>
        </div>
      </div>

      {/* Gráfico de barras */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-sm font-bold text-gray-700 mb-4">Faturamento por dia</p>
        <BarChart data={faturamentoPorDia} />
      </div>

      {/* Top produtos + Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top produtos */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-bold text-gray-700 mb-4">Produtos mais vendidos</p>
          {topProdutos.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhum produto vendido no período</p>
          ) : (
            <div className="space-y-3">
              {topProdutos.map((p, i) => {
                const barW = Math.round((p.total / topProdutos[0].total) * 100)
                return (
                  <div key={p.nome}>
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-gray-400 shrink-0 w-4">{i + 1}</span>
                        <span className="text-sm text-gray-800 truncate">{p.nome}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400">{p.quantidade}×</span>
                        <span className="text-sm font-bold text-gray-900">{fmt(p.total)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div style={{ width: `${barW}%` }} className="h-full bg-orange-400 rounded-full" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Breakdown */}
        <div className="space-y-4">

          {/* Tipo de pedido */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm font-bold text-gray-700 mb-3">Tipo de pedido</p>
            {[
              { label: 'Entrega',  value: pedidosEntrega,  color: 'bg-blue-400' },
              { label: 'Retirada', value: pedidosRetirada, color: 'bg-purple-400' },
            ].map(item => {
              const tot = pedidosEntrega + pedidosRetirada
              const p = tot > 0 ? Math.round((item.value / tot) * 100) : 0
              return (
                <div key={item.label} className="mb-2.5">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-semibold text-gray-900">
                      {item.value} <span className="text-gray-400 font-normal text-xs">({p}%)</span>
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div style={{ width: `${p}%` }} className={`h-full ${item.color} rounded-full`} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Status dos pedidos */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm font-bold text-gray-700 mb-3">Status dos pedidos</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'entregue',   label: 'Entregues',  cls: 'text-emerald-700 bg-emerald-50' },
                { key: 'cancelado',  label: 'Cancelados', cls: 'text-red-700 bg-red-50' },
                { key: 'a_caminho',  label: 'A caminho',  cls: 'text-blue-700 bg-blue-50' },
                { key: 'em_preparo', label: 'Em preparo', cls: 'text-yellow-700 bg-yellow-50' },
                { key: 'novo',       label: 'Novos',      cls: 'text-gray-700 bg-gray-50' },
              ].map(s => (
                <div key={s.key} className={`rounded-xl px-3 py-2.5 ${s.cls}`}>
                  <p className="text-xl font-bold leading-tight">{pedidosPorStatus[s.key]}</p>
                  <p className="text-xs font-semibold mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
