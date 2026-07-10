'use client'
import { useState, useTransition, useMemo } from 'react'
import { createIntercorrencia, deleteIntercorrencia } from '@/app/admin/_actions/funcionarios'
import { AlertTriangle, Users } from 'lucide-react'

function fmt(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(s) {
  if (!s) return ''
  const [ano, mes, dia] = s.split('-')
  return `${dia}/${mes}/${ano}`
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toISO(d) { return d.toISOString().split('T')[0] }

function todayStr()  { return toISO(new Date()) }

function weekBounds(offsetWeeks = 0) {
  const d = new Date()
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1 + offsetWeeks * 7) // Monday
  const start = toISO(d)
  d.setDate(d.getDate() + 6)
  return [start, toISO(d)]
}

function monthBounds(offsetMonths = 0) {
  const d = new Date()
  const first = new Date(d.getFullYear(), d.getMonth() + offsetMonths, 1)
  const last  = new Date(d.getFullYear(), d.getMonth() + offsetMonths + 1, 0)
  return [toISO(first), toISO(last)]
}

function quinzenaBounds(which = 'current') {
  const d = new Date()
  if (which === 'first')   return [toISO(new Date(d.getFullYear(), d.getMonth(), 1)),  toISO(new Date(d.getFullYear(), d.getMonth(), 15))]
  if (which === 'second')  return [toISO(new Date(d.getFullYear(), d.getMonth(), 16)), toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0))]
  return d.getDate() <= 15
    ? quinzenaBounds('first')
    : quinzenaBounds('second')
}

function daysBetween(start, end) {
  const s = new Date(start + 'T12:00:00')
  const e = new Date(end   + 'T12:00:00')
  return Math.max(1, Math.round((e - s) / 86400000) + 1)
}

const PRESETS = [
  { label: 'Hoje',           getDates: () => [todayStr(), todayStr()] },
  { label: 'Esta semana',    getDates: () => weekBounds(0) },
  { label: 'Semana passada', getDates: () => weekBounds(-1) },
  { label: '1ª quinzena',    getDates: () => quinzenaBounds('first') },
  { label: '2ª quinzena',    getDates: () => quinzenaBounds('second') },
  { label: 'Este mês',       getDates: () => monthBounds(0) },
  { label: 'Mês passado',    getDates: () => monthBounds(-1) },
]

const PERIODOS = [
  { value: 'todos',     label: 'Todos' },
  { value: 'diario',    label: 'Diários' },
  { value: 'semanal',   label: 'Semanais' },
  { value: 'quinzenal', label: 'Quinzenais' },
  { value: 'mensal',    label: 'Mensais' },
]

// ─── Card de pagamento por funcionário ───────────────────────────────────────

function FuncionarioPayCard({ funcionario, intercorrencias, inicio, fim }) {
  const [showForm, setShowForm]   = useState(false)
  const [tipo,     setTipo]       = useState('desconto')
  const [valor,    setValor]      = useState('')
  const [desc,     setDesc]       = useState('')
  const [data,     setData]       = useState(todayStr())
  const [localList, setLocalList] = useState(intercorrencias) // own copy for instant updates
  const [pending, startTransition] = useTransition()

  const dias    = daysBetween(inicio, fim)
  const bruto   = dias * Number(funcionario.valor_diaria)
  const ajustes = localList.reduce((s, i) => s + Number(i.ajuste), 0)
  const total   = bruto + ajustes

  function handleAdd() {
    if (!desc.trim() || !valor) return
    const v      = parseFloat(valor) || 0
    const ajuste = tipo === 'desconto' ? -v : v
    const fd = new FormData()
    fd.set('funcionario_id', funcionario.id)
    fd.set('data', data)
    fd.set('descricao', desc)
    fd.set('tipo', tipo)
    fd.set('valor', v.toString())

    startTransition(async () => {
      const result = await createIntercorrencia(null, fd)
      if (result?.intercorrencia) {
        const novaData = result.intercorrencia.data
        setLocalList(prev => {
          const lista = novaData >= inicio && novaData <= fim
            ? [result.intercorrencia, ...prev]
            : prev
          return lista.sort((a, b) => a.data < b.data ? 1 : -1)
        })
        setShowForm(false)
        setValor('')
        setDesc('')
        setData(todayStr())
      }
    })
  }

  function handleDelete(id) {
    startTransition(async () => {
      const result = await deleteIntercorrencia(id)
      if (result?.success) setLocalList(prev => prev.filter(i => i.id !== id))
    })
  }

  function buildWhatsMsg() {
    let msg = `Olá ${funcionario.nome}! Resumo do pagamento de ${fmtDate(inicio)} a ${fmtDate(fim)}:\n\n`
    msg += `📅 ${dias} dia${dias !== 1 ? 's' : ''} × ${fmt(funcionario.valor_diaria)}/dia = ${fmt(bruto)}\n`
    if (localList.length > 0) {
      msg += `\n⚠ Intercorrências:\n`
      for (const i of localList) {
        const sinal = Number(i.ajuste) >= 0 ? '+' : ''
        msg += `• ${fmtDate(i.data)} — ${i.descricao} (${sinal}${fmt(i.ajuste)})\n`
      }
    }
    msg += `\n💰 Total a receber: ${fmt(total)}\n\nObrigado pelo trabalho! 🍕`
    return encodeURIComponent(msg)
  }

  const periodoLabel = { diario: 'Diário', semanal: 'Semanal', quinzenal: 'Quinzenal', mensal: 'Mensal' }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 font-bold flex items-center justify-center text-base flex-shrink-0">
            {funcionario.nome.charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="font-bold text-gray-900">{funcionario.nome}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {funcionario.cargo && <span className="text-xs text-gray-500">{funcionario.cargo}</span>}
              <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {periodoLabel[funcionario.periodo_pagamento] ?? funcionario.periodo_pagamento}
              </span>
              <span className="text-xs font-semibold text-gray-700">{fmt(funcionario.valor_diaria)}/dia</span>
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-bold text-gray-900">{fmt(total)}</p>
          <p className="text-xs text-gray-400">total do período</p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">

        {/* Cálculo base */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {dias} dia{dias !== 1 ? 's' : ''} × {fmt(funcionario.valor_diaria)}/dia
          </p>
          <p className="text-sm font-bold text-gray-900">{fmt(bruto)}</p>
        </div>

        {/* Intercorrências */}
        {localList.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Intercorrências ({localList.length})
            </p>
            <div className="space-y-2">
              {localList.map(inter => {
                const aj = Number(inter.ajuste)
                const isNeg = aj < 0
                return (
                  <div key={inter.id}
                    className={`flex items-start justify-between gap-3 rounded-xl px-3 py-2.5 ${isNeg ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-gray-500">{fmtDate(inter.data)}</span>
                        <p className="text-sm text-gray-800 truncate">{inter.descricao}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-sm font-bold ${isNeg ? 'text-red-600' : 'text-green-600'}`}>
                        {aj >= 0 ? '+' : ''}{fmt(aj)}
                      </span>
                      <button onClick={() => handleDelete(inter.id)} disabled={pending}
                        className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-30 text-lg leading-none">
                        ×
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Subtotal ajustes */}
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-gray-500">Soma dos ajustes</p>
              <p className={`text-sm font-bold ${ajustes < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {ajustes >= 0 ? '+' : ''}{fmt(ajustes)}
              </p>
            </div>
          </div>
        )}

        {/* Formulário de intercorrência */}
        {showForm ? (
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-bold text-gray-700">Registrar intercorrência</p>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Data</label>
                <input type="date" value={data} min={inicio} max={fim}
                  onChange={e => setData(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Tipo</label>
                <div className="grid grid-cols-2 gap-1 h-[42px]">
                  {[['desconto', 'Desconto', 'border-red-400 bg-red-50 text-red-700', 'border-gray-200 text-gray-600'],
                    ['acrescimo', 'Acréscimo', 'border-green-400 bg-green-50 text-green-700', 'border-gray-200 text-gray-600']].map(([v, l, activeClass, inactiveClass]) => (
                    <button key={v} type="button" onClick={() => setTipo(v)}
                      className={`rounded-lg border-2 text-xs font-semibold transition-colors ${tipo === v ? activeClass : inactiveClass}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">O que aconteceu? *</label>
              <input value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="Ex: Faltou, chegou 2h atrasado, saiu mais cedo..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">
                Valor {tipo === 'desconto' ? 'do desconto' : 'do acréscimo'} (R$) *
              </label>
              <input type="number" min="0" step="0.01" value={valor} onChange={e => setValor(e.target.value)}
                placeholder="0,00"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
              {funcionario.valor_diaria > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Diária padrão: {fmt(funcionario.valor_diaria)} · Meia diária: {fmt(funcionario.valor_diaria / 2)}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={handleAdd} disabled={pending || !desc.trim() || !valor}
                className="flex-1 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-700 disabled:bg-gray-300 text-white text-sm font-bold transition-colors">
                {pending ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => { setShowForm(false); setValor(''); setDesc('') }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowForm(true)}
            className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm font-semibold text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
            + Registrar intercorrência
          </button>
        )}

        {/* Total final */}
        <div className="bg-gray-900 rounded-2xl px-4 py-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Bruto ({dias} dias)</span>
            <span className="text-white font-medium">{fmt(bruto)}</span>
          </div>
          {ajustes !== 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Ajustes</span>
              <span className={`font-medium ${ajustes < 0 ? 'text-red-400' : 'text-green-400'}`}>
                {ajustes >= 0 ? '+' : ''}{fmt(ajustes)}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-gray-700">
            <span className="text-sm font-semibold text-gray-300">Total a pagar</span>
            <span className="text-2xl font-bold text-orange-400">{fmt(total)}</span>
          </div>
        </div>

        {/* WhatsApp */}
        {funcionario.telefone && (
          <a
            href={`https://wa.me/55${funcionario.telefone.replace(/\D/g, '')}?text=${buildWhatsMsg()}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#25d366' }}
          >
            Enviar resumo no WhatsApp
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function FolhaClient({ funcionarios, intercorrencias, storeSlug }) {
  const [inicio, setInicio] = useState(() => weekBounds(0)[0])
  const [fim,    setFim]    = useState(() => todayStr())
  const [filtro, setFiltro] = useState('todos')

  function applyPreset([s, e]) { setInicio(s); setFim(e) }

  const diasTotal   = daysBetween(inicio, fim)
  const funcionariosFiltrados = filtro === 'todos'
    ? funcionarios
    : funcionarios.filter(f => f.periodo_pagamento === filtro)

  // Intercorrências por funcionário dentro do período
  const intercorrenciasPorFunc = useMemo(() => {
    const map = {}
    for (const f of funcionarios) {
      map[f.id] = intercorrencias.filter(
        i => i.funcionario_id === f.id && i.data >= inicio && i.data <= fim
      )
    }
    return map
  }, [intercorrencias, funcionarios, inicio, fim])

  const totalGeral = funcionariosFiltrados.reduce((s, f) => {
    const bruto   = diasTotal * Number(f.valor_diaria)
    const ajustes = (intercorrenciasPorFunc[f.id] ?? []).reduce((a, i) => a + Number(i.ajuste), 0)
    return s + bruto + ajustes
  }, 0)

  return (
    <div className="space-y-5">

      {/* Controles */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">

        {/* Presets */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Período rápido</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p.getDates())}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-orange-400 hover:text-orange-600 transition-colors">
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Datas manuais */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">De</label>
            <input type="date" value={inicio} onChange={e => setInicio(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500">até</label>
            <input type="date" value={fim} min={inicio} onChange={e => setFim(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <p className="text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-lg">
            {diasTotal} dia{diasTotal !== 1 ? 's' : ''} · {fmtDate(inicio)} → {fmtDate(fim)}
          </p>
        </div>

        {/* Filtro por período */}
        <div className="flex flex-wrap gap-1.5">
          {PERIODOS.map(p => (
            <button key={p.value} onClick={() => setFiltro(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors ${
                filtro === p.value ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:border-gray-400'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Card de total geral */}
      {funcionariosFiltrados.length > 0 && (
        <div className="bg-orange-500 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-orange-100 uppercase tracking-wide">Total a pagar no período</p>
            <p className="text-xs text-orange-200 mt-0.5">{funcionariosFiltrados.length} funcionário{funcionariosFiltrados.length !== 1 ? 's' : ''}</p>
          </div>
          <p className="text-3xl font-bold text-white">{fmt(totalGeral)}</p>
        </div>
      )}

      {/* Cards por funcionário */}
      {funcionariosFiltrados.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-4 text-gray-300" />
          <p className="font-medium text-gray-600">Nenhum funcionário encontrado.</p>
          <a href={`/admin/${storeSlug}/funcionarios`} className="text-sm text-orange-500 underline mt-2 inline-block">
            Cadastrar funcionários
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {funcionariosFiltrados.map(f => (
            <FuncionarioPayCard
              key={f.id}
              funcionario={f}
              intercorrencias={intercorrenciasPorFunc[f.id] ?? []}
              inicio={inicio}
              fim={fim}
            />
          ))}
        </div>
      )}
    </div>
  )
}
