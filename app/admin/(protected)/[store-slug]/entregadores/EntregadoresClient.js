'use client'
import { useState, useTransition, useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { motion } from 'framer-motion'
import { createEntregador, toggleEntregador, updateEntregador, toggleDisponivel } from '@/app/admin/_actions/entregadores'
import Modal from '@/app/admin/_components/Modal'
import { Bike, Phone, ClipboardList, Check, CircleCheck, Circle, Plus, Pencil } from 'lucide-react'
import { toE164, formatBR } from '@/lib/phone'

function SubmitBtn() {
  const { pending } = useFormStatus()
  return (
    <motion.button
      type="submit"
      disabled={pending}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-bold py-3 rounded-xl text-sm transition-colors"
    >
      {pending ? 'Cadastrando...' : 'Cadastrar entregador'}
    </motion.button>
  )
}

function EntregadorCard({ e, storeSlug, baseUrl }) {
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing]        = useState(false)
  const [nome, setNome]              = useState(e.nome)
  const [tel, setTel]                = useState(e.telefone)
  const [copied, setCopied]          = useState(false)

  const portalUrl = `${baseUrl}/entregador/${e.token}`

  function copiar() {
    navigator.clipboard.writeText(portalUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  function salvar() {
    if (!nome.trim() || !tel.trim()) return
    startTransition(async () => {
      await updateEntregador(e.id, nome, tel, storeSlug)
      setEditing(false)
    })
  }

  function toggle() {
    startTransition(() => toggleEntregador(e.id, e.ativo, storeSlug))
  }

  function toggleDisp() {
    startTransition(() => toggleDisponivel(e.id, e.disponivel, storeSlug))
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-2xl border p-5 space-y-3 transition-opacity ${!e.ativo ? 'opacity-50 border-gray-100' : 'border-gray-200'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Nome"
              />
              <input
                value={tel}
                onChange={e => setTel(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Telefone"
              />
              <div className="flex gap-2">
                <button onClick={salvar} disabled={isPending} className="bg-orange-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-orange-600 disabled:opacity-50">
                  {isPending ? '...' : 'Salvar'}
                </button>
                <button onClick={() => setEditing(false)} className="text-gray-500 text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold text-gray-900">{e.nome}</span>
                {!e.ativo && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inativo</span>}
                {e.ativo && e.disponivel && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CircleCheck className="w-3 h-3" />Trabalhando hoje
                  </span>
                )}
                {e.ativo && !e.disponivel && (
                  <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Circle className="w-3 h-3" />Fora de turno
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> {formatBR(e.telefone)}</p>
            </>
          )}
        </div>

        {!editing && (
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            {e.ativo && (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={toggleDisp}
                disabled={isPending}
                className={`text-xs font-semibold border rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50 ${e.disponivel ? 'border-orange-200 text-orange-600 hover:bg-orange-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}
              >
                {e.disponivel ? 'Encerrar turno' : 'Iniciar turno'}
              </motion.button>
            )}
            <button onClick={() => setEditing(true)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={toggle}
              disabled={isPending}
              className={`text-xs font-semibold border rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50 ${e.ativo ? 'border-red-200 text-red-500 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}
            >
              {e.ativo ? 'Desativar' : 'Ativar'}
            </motion.button>
          </div>
        )}
      </div>

      {/* Link do portal */}
      <div className="bg-gray-50 rounded-xl p-3 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Link do portal</p>
        <p className="text-xs text-gray-600 font-mono break-all">{portalUrl}</p>
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={copiar}
            className="flex-1 text-xs font-semibold py-2 rounded-lg border-2 transition-all"
            style={copied ? { borderColor: '#22c55e', color: '#16a34a', backgroundColor: '#f0fdf4' } : { borderColor: '#f97316', color: '#f97316' }}
          >
            {copied ? <><Check className="w-3 h-3 inline mr-1" />Copiado!</> : <><ClipboardList className="w-3 h-3 inline mr-1" />Copiar link</>}
          </motion.button>
          <a
            href={`https://wa.me/${toE164(e.telefone)}?text=${encodeURIComponent(`Olá ${e.nome}! Aqui está seu link de acesso para ver suas entregas:\n${portalUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-xs font-semibold py-2 rounded-lg text-white text-center transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#25d366' }}
          >
            Enviar no WhatsApp
          </a>
        </div>
      </div>
    </motion.div>
  )
}

function CadastrarModal({ open, onClose, storeSlug }) {
  const [state, formAction] = useActionState(
    async (prev, formData) => {
      const result = await createEntregador(prev, formData)
      if (result?.success) onClose()
      return result
    },
    null
  )

  return (
    <Modal open={open} onClose={onClose} title="Novo entregador" size="sm">
      <form action={formAction} className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Nome *</label>
          <input
            name="nome"
            required
            placeholder="Ex: João Silva"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Telefone / WhatsApp *</label>
          <input
            name="telefone"
            required
            placeholder="(61) 99999-9999"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        {state?.error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
        )}
        <SubmitBtn />
      </form>
    </Modal>
  )
}

export default function EntregadoresClient({ entregadores, storeSlug, baseUrl }) {
  const [modalOpen, setModalOpen] = useState(false)

  const disponiveis = entregadores.filter(e => e.ativo && e.disponivel)
  const foraDeTurno = entregadores.filter(e => e.ativo && !e.disponivel)
  const inativos    = entregadores.filter(e => !e.ativo)

  return (
    <div className="space-y-6">
      {/* Header com botão */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Entregadores</h1>
          <p className="text-sm text-gray-500 mt-0.5">{entregadores.filter(e => e.ativo).length} ativos · {disponiveis.length} hoje</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm shadow-orange-500/25"
        >
          <Plus className="w-4 h-4" />
          Novo entregador
        </motion.button>
      </div>

      <CadastrarModal open={modalOpen} onClose={() => setModalOpen(false)} storeSlug={storeSlug} />

      {/* Disponíveis hoje */}
      {disponiveis.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-green-600 uppercase tracking-widest mb-3">Disponíveis hoje ({disponiveis.length})</h2>
          <div className="space-y-3">
            {disponiveis.map(e => (
              <EntregadorCard key={e.id} e={e} storeSlug={storeSlug} baseUrl={baseUrl} />
            ))}
          </div>
        </div>
      )}

      {/* Fora de turno */}
      {foraDeTurno.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Fora de turno ({foraDeTurno.length})</h2>
          <div className="space-y-3">
            {foraDeTurno.map(e => (
              <EntregadorCard key={e.id} e={e} storeSlug={storeSlug} baseUrl={baseUrl} />
            ))}
          </div>
        </div>
      )}

      {/* Inativos */}
      {inativos.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-gray-300 uppercase tracking-widest mb-3">Inativos ({inativos.length})</h2>
          <div className="space-y-3">
            {inativos.map(e => (
              <EntregadorCard key={e.id} e={e} storeSlug={storeSlug} baseUrl={baseUrl} />
            ))}
          </div>
        </div>
      )}

      {entregadores.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <Bike className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="font-semibold text-gray-500">Nenhum entregador ainda.</p>
          <p className="text-sm mt-1">Clique em "Novo entregador" para começar.</p>
        </div>
      )}
    </div>
  )
}
