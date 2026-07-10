'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategory,
} from '@/app/admin/_actions/catalog'

function CategoryRow({ cat, isFirst, isLast }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [renaming, setRenaming]      = useState(false)
  const [name, setName]              = useState(cat.nome)
  const [error, setError]            = useState(null)

  function reorder(dir) {
    startTransition(async () => {
      await reorderCategory(cat.id, dir)
      router.refresh()
    })
  }

  function saveRename() {
    if (!name.trim() || name.trim() === cat.nome) { setRenaming(false); return }
    startTransition(async () => {
      const res = await updateCategory(cat.id, name.trim())
      if (res?.error) { setError(res.error); return }
      setRenaming(false)
      router.refresh()
    })
  }

  function remove() {
    if (!confirm(`Excluir "${cat.nome}"?`)) return
    startTransition(async () => {
      const res = await deleteCategory(cat.id)
      if (res?.error) { setError(res.error); return }
      router.refresh()
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <div className="flex items-center gap-3">
        {/* Reorder buttons */}
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => reorder('up')}
            disabled={isFirst || isPending}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs leading-none px-1"
          >▲</button>
          <button
            onClick={() => reorder('down')}
            disabled={isLast || isPending}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs leading-none px-1"
          >▼</button>
        </div>

        {/* Nome */}
        <div className="flex-1">
          {renaming ? (
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={saveRename}
              onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') { setName(cat.nome); setRenaming(false) } }}
              autoFocus
              className="border border-orange-400 rounded px-2 py-1 text-sm w-48 focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
          ) : (
            <span className="font-medium text-gray-800">{cat.nome}</span>
          )}
          {error && <p className="text-red-500 text-xs mt-0.5">{error}</p>}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setRenaming(true); setError(null) }}
            disabled={isPending}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2.5 py-1 hover:border-gray-300 transition-colors"
          >
            renomear
          </button>
          <button
            onClick={remove}
            disabled={isPending}
            className="text-sm text-red-400 hover:text-red-600 border border-red-100 rounded px-2.5 py-1 hover:border-red-200 transition-colors"
          >
            excluir
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CategoriesClient({ categories, storeSlug }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [newName, setNewName]        = useState('')
  const [error, setError]            = useState(null)

  function addCategory() {
    if (!newName.trim()) return
    const fd = new FormData()
    fd.append('nome', newName.trim())
    setError(null)
    startTransition(async () => {
      const res = await createCategory(null, fd)
      if (res?.error) { setError(res.error); return }
      setNewName('')
      router.refresh()
    })
  }

  return (
    <div>
      <div className="space-y-2 mb-6">
        {categories.length === 0 && (
          <p className="text-center py-8 text-gray-400 italic text-sm">
            Nenhuma categoria. Adicione a primeira abaixo.
          </p>
        )}
        {categories.map((cat, idx) => (
          <CategoryRow
            key={cat.id}
            cat={cat}
            isFirst={idx === 0}
            isLast={idx === categories.length - 1}
          />
        ))}
      </div>

      {/* Adicionar */}
      <div className="bg-white border border-dashed border-gray-300 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Nova categoria</h3>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCategory()}
            placeholder="Nome da categoria"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={addCategory}
            disabled={isPending || !newName.trim()}
            className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-200 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Adicionar
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>
    </div>
  )
}
