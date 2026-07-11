'use client'
import { useState, useTransition, useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Plus, Trash2, Pencil, Check, X, ListChecks, CirclePlus } from 'lucide-react'
import Modal from '@/app/admin/_components/Modal'
import {
  createGroup, updateGroup, toggleGroup, deleteGroup,
  addOption, updateOption, removeOption,
} from '@/app/admin/_actions/opcoes'

const fmt = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function SubmitBtn({ children }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors"
    >
      {pending ? 'Salvando...' : children}
    </button>
  )
}

/** Uma opção da lista (sabor ou adicional), com edição inline. */
function OpcaoRow({ opcao, tipo, onChanged }) {
  const [editando, setEditando] = useState(false)
  const [nome, setNome]         = useState(opcao.nome)
  const [descricao, setDesc]    = useState(opcao.descricao ?? '')
  const [preco, setPreco]       = useState(String(opcao.preco_extra ?? 0))
  const [isPending, startTransition] = useTransition()

  function salvar() {
    startTransition(async () => {
      await updateOption(opcao.id, nome, descricao, preco)
      setEditando(false)
      onChanged()
    })
  }

  function excluir() {
    startTransition(async () => {
      await removeOption(opcao.id)
      onChanged()
    })
  }

  if (editando) {
    return (
      <div className="border border-orange-200 bg-orange-50/50 rounded-xl p-3 space-y-2">
        <input
          value={nome}
          onChange={e => setNome(e.target.value)}
          placeholder="Nome"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <input
          value={descricao}
          onChange={e => setDesc(e.target.value)}
          placeholder="Ingredientes (opcional)"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        {tipo === 'adicional' && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">+ R$</span>
            <input
              type="number" step="0.01" min="0"
              value={preco}
              onChange={e => setPreco(e.target.value)}
              className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={salvar}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-1 bg-orange-500 text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-50"
          >
            <Check className="w-4 h-4" /> Salvar
          </button>
          <button
            onClick={() => setEditando(false)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-gray-50 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{opcao.nome}</p>
        {opcao.descricao && <p className="text-xs text-gray-400 leading-snug">{opcao.descricao}</p>}
      </div>

      {opcao.preco_extra > 0 && (
        <span className="text-xs font-semibold text-orange-600 whitespace-nowrap">
          + {fmt(opcao.preco_extra)}
        </span>
      )}

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEditando(true)} className="p-1.5 text-gray-400 hover:text-gray-700">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={excluir} disabled={isPending} className="p-1.5 text-gray-400 hover:text-red-600">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

/** Formulário de nova opção, embutido no card do grupo. */
function NovaOpcao({ grupo, onChanged }) {
  const [aberto, setAberto] = useState(false)
  const [nome, setNome]     = useState('')
  const [descricao, setDesc] = useState('')
  const [preco, setPreco]   = useState('')
  const [erro, setErro]     = useState(null)
  const [isPending, startTransition] = useTransition()

  function adicionar() {
    setErro(null)
    startTransition(async () => {
      const r = await addOption(grupo.id, nome, descricao, preco)
      if (r?.error) { setErro(r.error); return }
      setNome(''); setDesc(''); setPreco('')
      setAberto(false)
      onChanged()
    })
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="w-full flex items-center justify-center gap-1.5 text-sm text-orange-600 font-medium py-2 border border-dashed border-orange-300 rounded-xl hover:bg-orange-50 transition-colors"
      >
        <CirclePlus className="w-4 h-4" /> Adicionar opção
      </button>
    )
  }

  return (
    <div className="border border-orange-200 bg-orange-50/50 rounded-xl p-3 space-y-2">
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <input
        autoFocus
        value={nome}
        onChange={e => setNome(e.target.value)}
        placeholder={grupo.tipo === 'adicional' ? 'Ex: ADD Bacon' : 'Ex: Calabresa'}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
      />
      <input
        value={descricao}
        onChange={e => setDesc(e.target.value)}
        placeholder="Ingredientes (opcional)"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
      />
      {grupo.tipo === 'adicional' && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">+ R$</span>
          <input
            type="number" step="0.01" min="0"
            value={preco}
            onChange={e => setPreco(e.target.value)}
            placeholder="0,00"
            className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={adicionar}
          disabled={isPending || !nome.trim()}
          className="flex-1 bg-orange-500 text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-50"
        >
          {isPending ? 'Adicionando...' : 'Adicionar'}
        </button>
        <button
          onClick={() => { setAberto(false); setErro(null) }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

function GrupoCard({ grupo, uso, onChanged }) {
  const [editandoNome, setEditandoNome] = useState(false)
  const [nome, setNome] = useState(grupo.nome)
  const [erro, setErro] = useState(null)
  const [isPending, startTransition] = useTransition()

  const opcoes = (grupo.option_items ?? [])
    .filter(o => o.ativo)
    .sort((a, b) => a.ordem - b.ordem)

  function excluir() {
    setErro(null)
    startTransition(async () => {
      const r = await deleteGroup(grupo.id)
      if (r?.error) { setErro(r.error); return }
      onChanged()
    })
  }

  function salvarNome() {
    startTransition(async () => {
      await updateGroup(grupo.id, nome, grupo.tipo)
      setEditandoNome(false)
      onChanged()
    })
  }

  return (
    <div className={`bg-white rounded-2xl border p-5 ${grupo.ativo ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0 flex-1">
          {editandoNome ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={nome}
                onChange={e => setNome(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && salvarNome()}
                className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button onClick={salvarNome} className="text-orange-600"><Check className="w-4 h-4" /></button>
              <button onClick={() => { setNome(grupo.nome); setEditandoNome(false) }} className="text-gray-400"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              {grupo.nome}
              <button onClick={() => setEditandoNome(true)} className="text-gray-300 hover:text-gray-600">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </h2>
          )}

          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              grupo.tipo === 'adicional'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {grupo.tipo === 'adicional' ? 'Adicionais pagos' : 'Escolha'}
            </span>
            <span className="text-xs text-gray-400">
              {opcoes.length} {opcoes.length === 1 ? 'opção' : 'opções'}
              {uso > 0 && ` · usado em ${uso} produto${uso > 1 ? 's' : ''}`}
            </span>
          </div>
        </div>

        <button
          onClick={excluir}
          disabled={isPending}
          className="p-2 text-gray-300 hover:text-red-600 transition-colors flex-shrink-0"
          title="Excluir grupo"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {erro && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 my-2">{erro}</p>
      )}

      <div className="mt-3 space-y-1 max-h-80 overflow-y-auto">
        {opcoes.map(o => (
          <OpcaoRow key={o.id} opcao={o} tipo={grupo.tipo} onChanged={onChanged} />
        ))}
      </div>

      <div className="mt-3">
        <NovaOpcao grupo={grupo} onChanged={onChanged} />
      </div>
    </div>
  )
}

export default function OpcoesClient({ storeSlug, grupos, usoPorGrupo }) {
  const router = useRouter()
  const [novoAberto, setNovoAberto] = useState(false)
  const [state, formAction] = useActionState(createGroup, null)

  const onChanged = () => router.refresh()

  // Fecha o modal quando o grupo é criado
  if (state?.success && novoAberto) setTimeout(() => setNovoAberto(false), 0)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      <Link
        href={`/admin/${storeSlug}/catalog`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Voltar ao catálogo
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ListChecks className="w-6 h-6 text-orange-500" />
            Grupos de opções
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Um grupo é uma lista de escolhas — os sabores da pizza, ou os adicionais pagos.
            O mesmo grupo pode ser usado em vários produtos: você define quantos itens
            escolher <strong>em cada produto</strong>, na tela do produto.
          </p>
        </div>

        <button
          onClick={() => setNovoAberto(true)}
          className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> Novo grupo
        </button>
      </div>

      {grupos.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center">
          <ListChecks className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-700">Nenhum grupo ainda</p>
          <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
            Crie um grupo &ldquo;Escolha seu Sabor&rdquo; com os sabores da pizza, e outro
            &ldquo;Adicionais&rdquo; com os extras pagos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {grupos.map(g => (
            <GrupoCard
              key={g.id}
              grupo={g}
              uso={usoPorGrupo[g.id] ?? 0}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}

      <Modal open={novoAberto} onClose={() => setNovoAberto(false)} title="Novo grupo">
        <form action={formAction} className="p-5 space-y-4">
          {state?.error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {state.error}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do grupo</label>
            <input
              name="nome"
              required
              autoFocus
              placeholder="Ex: Escolha seu Sabor!"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 border border-gray-200 rounded-xl px-3 py-2.5 cursor-pointer has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50">
                <input type="radio" name="tipo" value="escolha" defaultChecked className="mt-1 accent-orange-500" />
                <span>
                  <span className="block text-sm font-medium text-gray-800">Escolha</span>
                  <span className="block text-xs text-gray-500">Sabores e opções sem custo extra.</span>
                </span>
              </label>

              <label className="flex items-start gap-3 border border-gray-200 rounded-xl px-3 py-2.5 cursor-pointer has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50">
                <input type="radio" name="tipo" value="adicional" className="mt-1 accent-orange-500" />
                <span>
                  <span className="block text-sm font-medium text-gray-800">Adicionais pagos</span>
                  <span className="block text-xs text-gray-500">Cada opção soma um valor ao preço.</span>
                </span>
              </label>
            </div>
          </div>

          <SubmitBtn>Criar grupo</SubmitBtn>
        </form>
      </Modal>
    </div>
  )
}
