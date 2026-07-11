'use client'
import { useState, useTransition, useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { createFuncionario, updateFuncionario, toggleFuncionario } from '@/app/admin/_actions/funcionarios'
import { Users, Phone } from 'lucide-react'
import { formatBR } from '@/lib/phone'

const CARGOS = ['Cozinheiro(a)', 'Auxiliar de cozinha', 'Atendente', 'Caixa', 'Garçom/Garçonete', 'Gerente', 'Pizzaiolo']
const PERIODOS = [
  { value: 'diario',    label: 'Diário'     },
  { value: 'semanal',   label: 'Semanal'    },
  { value: 'quinzenal', label: 'Quinzenal'  },
  { value: 'mensal',    label: 'Mensal'     },
]

function fmt(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function PeriodoBadge({ p }) {
  const colors = { diario: 'bg-blue-100 text-blue-700', semanal: 'bg-orange-100 text-orange-700', quinzenal: 'bg-purple-100 text-purple-700', mensal: 'bg-green-100 text-green-700' }
  const label  = PERIODOS.find(x => x.value === p)?.label ?? p
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[p] ?? 'bg-gray-100 text-gray-600'}`}>{label}</span>
}

function SubmitBtn() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}
      className="bg-gray-900 hover:bg-gray-700 disabled:bg-gray-400 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
      {pending ? 'Salvando...' : 'Cadastrar'}
    </button>
  )
}

function FuncionarioCard({ f, storeSlug }) {
  const [editing, setEditing]     = useState(false)
  const [isPending, startTrans]   = useTransition()
  const [nome, setNome]           = useState(f.nome)
  const [cargo, setCargo]         = useState(f.cargo ?? '')
  const [tel, setTel]             = useState(f.telefone ?? '')
  const [periodo, setPeriodo]     = useState(f.periodo_pagamento ?? 'semanal')
  const [diaria, setDiaria]       = useState(f.valor_diaria ?? 0)

  function salvar() {
    if (!nome.trim()) return
    startTrans(async () => {
      await updateFuncionario(f.id, { nome, cargo, telefone: tel, periodo_pagamento: periodo, valor_diaria: diaria }, storeSlug)
      setEditing(false)
    })
  }

  function toggle() {
    startTrans(() => toggleFuncionario(f.id, f.ativo, storeSlug))
  }

  return (
    <div className={`bg-white rounded-2xl border p-5 space-y-4 transition-opacity ${!f.ativo ? 'opacity-50 border-gray-100' : 'border-gray-200'}`}>
      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome *"
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            <input value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Cargo" list="cargos-list"
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            <datalist id="cargos-list">{CARGOS.map(c => <option key={c} value={c} />)}</datalist>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={tel} onChange={e => setTel(e.target.value)} placeholder="Telefone / WhatsApp"
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            <input type="number" min="0" step="0.01" value={diaria} onChange={e => setDiaria(e.target.value)} placeholder="Diária R$"
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
          </div>
          <select value={periodo} onChange={e => setPeriodo(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 w-full">
            {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={salvar} disabled={isPending}
              className="bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors">
              {isPending ? '...' : 'Salvar'}
            </button>
            <button onClick={() => setEditing(false)}
              className="text-xs text-gray-500 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 font-bold flex items-center justify-center text-base flex-shrink-0">
                {f.nome.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-gray-900">{f.nome}</p>
                  {!f.ativo && <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Inativo</span>}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {f.cargo && <p className="text-xs text-gray-500">{f.cargo}</p>}
                  <PeriodoBadge p={f.periodo_pagamento} />
                  <span className="text-xs font-semibold text-gray-700">{fmt(f.valor_diaria)}/dia</span>
                </div>
                {f.telefone && <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><Phone className="w-3 h-3" /> {formatBR(f.telefone)}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setEditing(true)}
                className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5">
                Editar
              </button>
              <button onClick={toggle} disabled={isPending}
                className={`text-xs font-semibold border rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50 ${f.ativo ? 'border-red-200 text-red-500 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                {f.ativo ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function FuncionariosClient({ funcionarios, storeSlug }) {
  const [state, formAction] = useActionState(createFuncionario, null)
  const ativos   = funcionarios.filter(f => f.ativo)
  const inativos = funcionarios.filter(f => !f.ativo)

  return (
    <div className="space-y-6">

      {/* Cadastrar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-bold text-gray-900 mb-4">Cadastrar funcionário</h2>
        <form action={formAction} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Nome *</label>
              <input name="nome" required placeholder="Ex: Ana Silva"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Cargo</label>
              <input name="cargo" placeholder="Ex: Cozinheiro" list="cargos-new"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
              <datalist id="cargos-new">{CARGOS.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Telefone / WhatsApp</label>
              <input name="telefone" placeholder="(61) 99999-9999"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Valor da diária (R$) *</label>
              <input name="valor_diaria" type="number" min="0" step="0.01" required placeholder="50,00"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Período de pagamento</label>
            <select name="periodo_pagamento"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
              {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          <SubmitBtn />
        </form>
      </div>

      {/* Ativos */}
      {ativos.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Ativos ({ativos.length})</h2>
          <div className="space-y-3">
            {ativos.map(f => <FuncionarioCard key={f.id} f={f} storeSlug={storeSlug} />)}
          </div>
        </div>
      )}

      {/* Inativos */}
      {inativos.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Inativos ({inativos.length})</h2>
          <div className="space-y-3">
            {inativos.map(f => <FuncionarioCard key={f.id} f={f} storeSlug={storeSlug} />)}
          </div>
        </div>
      )}

      {funcionarios.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-4 text-gray-300" />
          <p className="font-medium text-gray-600">Nenhum funcionário cadastrado.</p>
        </div>
      )}
    </div>
  )
}
