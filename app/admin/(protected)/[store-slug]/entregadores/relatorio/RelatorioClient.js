'use client'
import { useState, useMemo } from 'react'
import { Bike, BarChart2, Calendar, Moon } from 'lucide-react'

function fmt(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Lógica de turnos ─────────────────────────────────────────────────────────

const TIME_OPTIONS = [
  '00:00','00:30','01:00','01:30','02:00','02:30',
  '06:00','06:30','07:00','07:30','08:00','08:30','09:00','09:30',
  '10:00','10:30','11:00','11:30','12:00','12:30',
  '13:00','13:30','14:00','14:30','15:00','15:30',
  '16:00','16:30','17:00','17:30','18:00','18:30',
  '19:00','19:30','20:00','20:30','21:00','21:30',
  '22:00','22:30','23:00','23:30',
]

function parseHM(t) {
  const [h, m] = t.split(':').map(Number)
  return { h, m }
}

function shiftBounds(dateObj, inicio, fim) {
  const { h: si, m: mi } = parseHM(inicio)
  const { h: sf, m: mf } = parseHM(fim)
  const start = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), si, mi, 0)
  let end     = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), sf, mf, 59, 999)
  if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}

function currentShiftDate(inicio) {
  const now = new Date()
  const { h, m } = parseHM(inicio)
  const todayAtShift = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0)
  if (now < todayAtShift) {
    const d = new Date(now); d.setDate(d.getDate() - 1)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function labelDia(d) {
  const hoje = currentShiftDate('00:00')
  const diff  = Math.round((hoje - d) / 86400000)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

// ─── Card de pagamento do entregador ──────────────────────────────────────────

const MODOS = [
  { value: 'entrega', label: 'Por entrega' },
  { value: 'diaria',  label: 'Diária'      },
  { value: 'ambos',   label: 'Diária + entrega' },
]

function DriverPayCard({ driver, entregador, dataSelecionada, onWhatsapp }) {
  const [modo,   setModo]   = useState('entrega')
  const [diaria, setDiaria] = useState('')
  const [taxa,   setTaxa]   = useState('')

  const diariaVal  = parseFloat(diaria) || 0
  const taxaVal    = parseFloat(taxa)   || 0

  const totalEntregas = modo === 'entrega' || modo === 'ambos' ? driver.entregas * taxaVal : 0
  const totalDiaria   = modo === 'diaria'  || modo === 'ambos' ? diariaVal : 0
  const total         = totalDiaria + totalEntregas

  const dataStr = dataSelecionada.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  function buildWhatsMsg() {
    let msg = `Olá ${driver.nome}! Resumo do turno de ${dataStr}:\n\n`
    msg += `Entregas realizadas: ${driver.entregas}\n`

    if (driver.orderNums.length) {
      const nums = driver.orderNums.map(n => `#${n}`).join(', ')
      msg += `Pedidos: ${nums}\n`
    }

    msg += `\n`

    if (modo === 'diaria' || modo === 'ambos') {
      msg += `Diária: ${fmt(diariaVal)}\n`
    }
    if (modo === 'entrega' || modo === 'ambos') {
      msg += `Entregas (${driver.entregas} × ${fmt(taxaVal)}): ${fmt(totalEntregas)}\n`
    }

    msg += `\nTotal a receber: ${fmt(total)}\n`
    msg += `\nObrigado pelo trabalho!`
    return encodeURIComponent(msg)
  }

  return (
    <div className="p-5 space-y-4 border-b border-gray-100 last:border-0">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center text-base flex-shrink-0">
            {driver.nome.charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="font-bold text-gray-900">{driver.nome}</p>
            {entregador?.telefone && <p className="text-xs text-gray-400">{entregador.telefone}</p>}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-3xl font-bold text-gray-900">{driver.entregas}</p>
          <p className="text-xs text-gray-400">entregas</p>
        </div>
      </div>

      {/* Lista de pedidos */}
      <div className="bg-gray-50 rounded-xl px-3 py-2.5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Pedidos do turno</p>
        <div className="flex flex-wrap gap-1.5">
          {driver.orderNums.slice(0, 20).map(num => (
            <span key={num} className="text-xs font-mono font-semibold bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded-md">
              #{num}
            </span>
          ))}
          {driver.orderNums.length > 20 && (
            <span className="text-xs text-gray-400 self-center">+{driver.orderNums.length - 20} mais</span>
          )}
        </div>
      </div>

      {/* Seletor de modo */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tipo de pagamento</p>
        <div className="grid grid-cols-3 gap-1.5">
          {MODOS.map(m => (
            <button
              key={m.value}
              onClick={() => setModo(m.value)}
              className={`py-2 px-2 rounded-xl text-xs font-semibold border-2 transition-colors text-center ${
                modo === m.value
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Campos de valor */}
      <div className="space-y-2">
        {(modo === 'diaria' || modo === 'ambos') && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <div className="flex-1">
              <p className="text-xs font-semibold text-blue-700">Valor da diária</p>
              <p className="text-xs text-blue-400">fixo por turno</p>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold text-blue-600">R$</span>
              <input
                type="number"
                min="0"
                step="1"
                value={diaria}
                onChange={e => setDiaria(e.target.value)}
                placeholder="0,00"
                className="w-24 text-right text-base font-bold text-blue-700 bg-transparent border-b-2 border-blue-300 focus:border-blue-500 focus:outline-none pb-0.5"
              />
            </div>
          </div>
        )}

        {(modo === 'entrega' || modo === 'ambos') && (
          <div className="flex items-center gap-3 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
            <div className="flex-1">
              <p className="text-xs font-semibold text-orange-700">Valor por entrega</p>
              <p className="text-xs text-orange-400">{driver.entregas} entregas × R$ ___</p>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold text-orange-600">R$</span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={taxa}
                onChange={e => setTaxa(e.target.value)}
                placeholder="0,00"
                className="w-24 text-right text-base font-bold text-orange-700 bg-transparent border-b-2 border-orange-300 focus:border-orange-500 focus:outline-none pb-0.5"
              />
            </div>
          </div>
        )}
      </div>

      {/* Breakdown do total */}
      <div className="bg-gray-900 rounded-2xl px-4 py-4 space-y-2 text-white">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Resumo do pagamento</p>

        {(modo === 'diaria' || modo === 'ambos') && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-300 flex items-center gap-1"><Calendar className="w-3 h-3" /> Diária</span>
            <span className="font-semibold">{fmt(diariaVal)}</span>
          </div>
        )}

        {(modo === 'entrega' || modo === 'ambos') && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-300 flex items-center gap-1">
              <Bike className="w-3 h-3" /> {driver.entregas} entrega{driver.entregas !== 1 ? 's' : ''} × {fmt(taxaVal)}
            </span>
            <span className="font-semibold">{fmt(totalEntregas)}</span>
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-gray-700">
          <span className="text-sm font-semibold text-gray-300">Total a pagar</span>
          <span className={`text-xl font-bold ${total > 0 ? 'text-orange-400' : 'text-gray-500'}`}>
            {fmt(total)}
          </span>
        </div>

        {driver.taxaTotal > 0 && (
          <p className="text-xs text-gray-500 pt-1 border-t border-gray-800">
            Taxa coletada dos clientes: {fmt(driver.taxaTotal)}
          </p>
        )}
      </div>

      {/* Barra visual */}
      <div className="flex gap-1">
        {Array.from({ length: Math.min(driver.entregas, 20) }).map((_, i) => (
          <div key={i} className="h-1.5 flex-1 rounded-full bg-orange-400" />
        ))}
        {driver.entregas > 20 && (
          <span className="text-xs text-gray-400 self-center ml-1">+{driver.entregas - 20}</span>
        )}
      </div>

      {/* WhatsApp */}
      {entregador?.telefone && (
        <a
          href={`https://wa.me/55${entregador.telefone.replace(/\D/g, '')}?text=${buildWhatsMsg()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#25d366' }}
        >
          Enviar resumo no WhatsApp
        </a>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function RelatorioClient({ entregadores, orders }) {
  const [turnoInicio, setTurnoInicio] = useState('18:00')
  const [turnoFim,    setTurnoFim]    = useState('23:30')
  const [periodo, setPeriodo]         = useState('hoje')
  const [customDate, setCustomDate]   = useState('')
  const [view, setView]               = useState('diario')

  const dataSelecionada = useMemo(() => {
    if (periodo === 'ontem') {
      const d = currentShiftDate(turnoInicio); d.setDate(d.getDate() - 1)
      return new Date(d.getFullYear(), d.getMonth(), d.getDate())
    }
    if (periodo === 'custom' && customDate) {
      const [ano, mes, dia] = customDate.split('-').map(Number)
      return new Date(ano, mes - 1, dia)
    }
    return currentShiftDate(turnoInicio)
  }, [periodo, customDate, turnoInicio])

  const { start: shiftStart, end: shiftEnd } = useMemo(
    () => shiftBounds(dataSelecionada, turnoInicio, turnoFim),
    [dataSelecionada, turnoInicio, turnoFim]
  )

  const cruzaMeianoite = shiftEnd.getDate() !== shiftStart.getDate()

  const turnoOrders = useMemo(() =>
    orders.filter(o => { const d = new Date(o.created_at); return d >= shiftStart && d <= shiftEnd }),
  [orders, shiftStart, shiftEnd])

  // Inclui IDs dos pedidos por entregador
  const statsEntregador = useMemo(() => {
    const map = {}
    for (const o of turnoOrders) {
      if (!o.funcionario_id) continue
      if (!map[o.funcionario_id]) {
        map[o.funcionario_id] = {
          id: o.funcionario_id, nome: o.entregador_nome,
          entregas: 0, taxaTotal: 0, orderNums: [],
        }
      }
      map[o.funcionario_id].entregas++
      map[o.funcionario_id].taxaTotal += Number(o.taxa_entrega ?? 0)
      map[o.funcionario_id].orderNums.push(o.id.slice(0, 8).toUpperCase())
    }
    return Object.values(map).sort((a, b) => b.entregas - a.entregas)
  }, [turnoOrders])

  const dadosSemana = useMemo(() => {
    const dias = []
    for (let i = 6; i >= 0; i--) {
      const base = currentShiftDate(turnoInicio); base.setDate(base.getDate() - i)
      const { start, end } = shiftBounds(base, turnoInicio, turnoFim)
      const diaOrders = orders.filter(o => { const d = new Date(o.created_at); return d >= start && d <= end })
      const porEntregador = {}
      for (const o of diaOrders) {
        if (!o.funcionario_id) continue
        porEntregador[o.funcionario_id] = (porEntregador[o.funcionario_id] ?? 0) + 1
      }
      dias.push({ base, label: labelDia(base), total: diaOrders.length, porEntregador })
    }
    return dias
  }, [orders, turnoInicio, turnoFim])

  const entregadoresAtivosNaSemana = useMemo(() =>
    entregadores.filter(e => dadosSemana.some(d => (d.porEntregador[e.id] ?? 0) > 0)),
  [entregadores, dadosSemana])

  const totalEntregasGeral = statsEntregador.reduce((s, d) => s + d.entregas, 0)
  const mapaEntregador = Object.fromEntries(entregadores.map(e => [e.id, e]))

  const shiftLabel = (() => {
    const f = d => d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    return `${f(shiftStart)} → ${f(shiftEnd)}`
  })()

  return (
    <div className="space-y-5">

      {/* ── Controles ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {[['hoje', 'Hoje'], ['ontem', 'Ontem'], ['custom', 'Outra data']].map(([v, l]) => (
            <button key={v} onClick={() => setPeriodo(v)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${
                periodo === v ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >{l}</button>
          ))}
          {periodo === 'custom' && (
            <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)}
              className="border-2 border-orange-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Turno das</label>
            <select value={turnoInicio} onChange={e => setTurnoInicio(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className="text-xs font-semibold text-gray-500">até</label>
            <select value={turnoFim} onChange={e => setTurnoFim(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {cruzaMeianoite && (
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg flex items-center gap-1"><Moon className="w-3 h-3" /> Cruza meia-noite</span>
          )}
        </div>

        <p className="text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-lg">
          ⏱ {shiftLabel} · Pedidos criados nesse intervalo são contados mesmo que a entrega saia depois das {turnoFim}.
        </p>

        <div className="flex gap-2">
          {[['diario', Calendar, 'Diário'], ['semanal', BarChart2, 'Semanal']].map(([v, Icon, l]) => (
            <button key={v} onClick={() => setView(v)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors ${
                view === v ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            ><Icon className="w-3 h-3" />{l}</button>
          ))}
        </div>
      </div>

      {/* ── Visão Diária ── */}
      {view === 'diario' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total de entregas</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{totalEntregasGeral}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Entregadores</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{statsEntregador.length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pedidos no turno</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{turnoOrders.length}</p>
            </div>
          </div>

          {statsEntregador.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Bike className="w-10 h-10 mx-auto mb-4 text-gray-300" />
              <p className="font-medium text-gray-600">Nenhuma entrega neste turno.</p>
              <p className="text-sm mt-1">Ajuste o período ou os horários do turno.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">Pagamento por entregador</h2>
                <p className="text-xs text-gray-400 mt-0.5">Configure o tipo e os valores para cada entregador</p>
              </div>
              <div>
                {statsEntregador.map(driver => (
                  <DriverPayCard
                    key={driver.id}
                    driver={driver}
                    entregador={mapaEntregador[driver.id]}
                    dataSelecionada={dataSelecionada}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Visão Semanal ── */}
      {view === 'semanal' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide">Entregas por turno (últimos 7)</h2>
            <div className="grid grid-cols-7 gap-2">
              {dadosSemana.map(dia => {
                const max = Math.max(...dadosSemana.map(d => d.total), 1)
                const pct = (dia.total / max) * 100
                return (
                  <div key={dia.label} className="flex flex-col items-center gap-1">
                    <div className="w-full bg-gray-100 rounded-lg overflow-hidden" style={{ height: 80, display: 'flex', alignItems: 'flex-end' }}>
                      <div className="w-full rounded-lg transition-all"
                        style={{ height: `${Math.max(pct, dia.total > 0 ? 8 : 0)}%`, backgroundColor: dia.total > 0 ? '#f97316' : '#e5e7eb' }}
                      />
                    </div>
                    <p className="text-sm font-bold text-gray-900">{dia.total}</p>
                    <p className="text-xs text-gray-400 text-center leading-tight whitespace-nowrap">{dia.label}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {entregadoresAtivosNaSemana.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <BarChart2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p>Nenhuma entrega nos últimos 7 turnos.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">Entregas por entregador</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Entregador</th>
                      {dadosSemana.map(dia => (
                        <th key={dia.label} className="text-center px-3 py-3 text-xs font-semibold text-gray-500 min-w-[72px] whitespace-nowrap">{dia.label}</th>
                      ))}
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-900 uppercase tracking-wide whitespace-nowrap">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {entregadoresAtivosNaSemana.map(e => {
                      const semanaTotal = dadosSemana.reduce((s, d) => s + (d.porEntregador[e.id] ?? 0), 0)
                      return (
                        <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 font-bold text-xs flex items-center justify-center flex-shrink-0">
                                {e.nome.charAt(0)}
                              </span>
                              <span className="font-medium text-gray-900 whitespace-nowrap">{e.nome}</span>
                            </div>
                          </td>
                          {dadosSemana.map(dia => {
                            const count = dia.porEntregador[e.id] ?? 0
                            return (
                              <td key={dia.label} className="text-center px-3 py-4">
                                {count > 0 ? (
                                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-700 font-bold text-sm">{count}</span>
                                ) : (
                                  <span className="text-gray-300 text-lg">—</span>
                                )}
                              </td>
                            )
                          })}
                          <td className="text-center px-4 py-4">
                            <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-gray-900 text-white font-bold text-sm">{semanaTotal}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td className="px-5 py-3 text-xs font-bold text-gray-600 uppercase tracking-wide">Total / turno</td>
                      {dadosSemana.map(dia => (
                        <td key={dia.label} className="text-center px-3 py-3 font-bold text-gray-900">{dia.total}</td>
                      ))}
                      <td className="text-center px-4 py-3 font-bold text-orange-600">
                        {dadosSemana.reduce((s, d) => s + d.total, 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
