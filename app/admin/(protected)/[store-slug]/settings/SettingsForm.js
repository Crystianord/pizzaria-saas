'use client'
import { useState, useActionState } from 'react'
import { updateStoreSettings } from '@/app/admin/_actions/settings'
import { useFormStatus } from 'react-dom'
import { PALETAS } from '@/lib/paletas'
import { ImageIcon } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

const DIAS = [
  { key: 'seg', label: 'Segunda' },
  { key: 'ter', label: 'Terça'   },
  { key: 'qua', label: 'Quarta'  },
  { key: 'qui', label: 'Quinta'  },
  { key: 'sex', label: 'Sexta'   },
  { key: 'sab', label: 'Sábado'  },
  { key: 'dom', label: 'Domingo' },
]

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
    >
      {pending ? 'Salvando...' : 'Salvar configurações'}
    </button>
  )
}

function DiaRow({ dia, inicial }) {
  const [ativo, setAtivo]         = useState(inicial?.ativo ?? true)
  const [abertura, setAbertura]   = useState(inicial?.abertura ?? '18:00')
  const [fechamento, setFechamento] = useState(inicial?.fechamento ?? '23:00')

  return (
    <div className={`flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0 ${!ativo ? 'opacity-50' : ''}`}>
      {/* Toggle do dia */}
      <label className="flex items-center gap-2 w-28 cursor-pointer flex-shrink-0">
        <input
          type="checkbox"
          name={`horario_${dia.key}_ativo`}
          checked={ativo}
          onChange={e => setAtivo(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
        />
        <span className="text-sm font-medium text-gray-700">{dia.label}</span>
      </label>

      {ativo ? (
        <div className="flex items-center gap-2">
          <input
            type="time"
            name={`horario_${dia.key}_abertura`}
            value={abertura}
            onChange={e => setAbertura(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <span className="text-gray-400 text-sm">até</span>
          <input
            type="time"
            name={`horario_${dia.key}_fechamento`}
            value={fechamento}
            onChange={e => setFechamento(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      ) : (
        <span className="text-sm text-gray-400 italic">Fechado</span>
      )}
    </div>
  )
}

export default function SettingsForm({ store, storeSlug }) {
  const [meiaEnabled, setMeiaEnabled]   = useState(store.meia_a_meia_enabled ?? false)
  const [paleta, setPaleta]             = useState(store.paleta_id ?? 'vermelho')
  const [bgUrl, setBgUrl]               = useState(store.imagem_fundo_url ?? '')
  const [bgUploading, setBgUploading]   = useState(false)
  const [bgError, setBgError]           = useState(null)
  const [state, formAction]             = useActionState(updateStoreSettings, null)

  const horario = store.horario ?? {}
  const bairros = (store.bairros_atendidos ?? []).join(', ')

  async function handleBgUpload(file) {
    if (!file) return
    setBgError(null)
    setBgUploading(true)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
      const path = `stores/${store.id}/banner-${Date.now()}.webp`
      const { error } = await supabase.storage.from('product-images').upload(path, file, { contentType: file.type })
      if (error) throw error
      const url = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
      setBgUrl(url)
    } catch (err) {
      setBgError(err?.message ?? 'Erro no upload')
    } finally {
      setBgUploading(false)
    }
  }

  return (
    <form action={formAction} className="space-y-6">

      {state?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
          Configurações salvas com sucesso.
        </div>
      )}

      {/* Meia a meia */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Meia a meia</h2>

        <div className="flex items-center gap-3 mb-4">
          <input
            type="checkbox"
            id="meia_a_meia_enabled"
            name="meia_a_meia_enabled"
            defaultChecked={store.meia_a_meia_enabled}
            onChange={e => setMeiaEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
          />
          <label htmlFor="meia_a_meia_enabled" className="text-sm font-medium text-gray-700">
            Aceitar pedidos meia a meia
          </label>
        </div>

        {meiaEnabled && (
          <div className="ml-7 space-y-2">
            <p className="text-sm text-gray-600 font-medium">Regra de preço:</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="meia_a_meia_rule"
                value="max"
                defaultChecked={(store.meia_a_meia_rule ?? 'max') === 'max'}
                className="text-orange-500"
              />
              <span className="text-sm text-gray-700">Preço do sabor mais caro</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="meia_a_meia_rule"
                value="avg"
                defaultChecked={store.meia_a_meia_rule === 'avg'}
                className="text-orange-500"
              />
              <span className="text-sm text-gray-700">Média dos dois sabores</span>
            </label>
          </div>
        )}

        {!meiaEnabled && (
          <input type="hidden" name="meia_a_meia_rule" value="max" />
        )}
      </div>

      {/* Horário de funcionamento */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Horário de funcionamento</h2>
        <p className="text-xs text-gray-400 mb-4">Marque os dias em que a pizzaria está aberta e defina o horário.</p>

        <div>
          {DIAS.map(dia => (
            <DiaRow
              key={dia.key}
              dia={dia}
              inicial={horario[dia.key]}
            />
          ))}
        </div>
      </div>

      {/* Entrega */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Entrega</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Taxa de entrega (R$)
          </label>
          <input
            type="number"
            name="taxa_entrega"
            step="0.01"
            min="0"
            defaultValue={store.taxa_entrega ?? 0}
            className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <p className="text-xs text-gray-400 mt-1">Use 0 para entrega grátis.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bairros atendidos
          </label>
          <textarea
            name="bairros_atendidos"
            defaultValue={bairros}
            placeholder="Centro, Jardim América, Vila Nova..."
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">Separe os bairros por vírgula.</p>
        </div>
      </div>

      {/* Paleta de cores */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Paleta de cores</h2>
        <p className="text-xs text-gray-400 mb-4">Define as cores do site público da sua pizzaria.</p>
        <input type="hidden" name="paleta_id" value={paleta} />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PALETAS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPaleta(p.id)}
              className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left ${paleta === p.id ? 'shadow-md' : 'border-gray-200 hover:border-gray-300'}`}
              style={paleta === p.id ? { borderColor: p.primaria } : {}}
            >
              <span className="w-7 h-7 rounded-full flex-shrink-0 border border-white shadow-sm" style={{ backgroundColor: p.primaria }} />
              <span className="text-xs font-medium text-gray-700 leading-tight">{p.nome}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Imagem de fundo */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Imagem de fundo</h2>
        <p className="text-xs text-gray-400 mb-4">Aparece no topo do site público da pizzaria. Recomendado: 1400×600px.</p>
        <input type="hidden" name="imagem_fundo_url" value={bgUrl} />
        <div className="flex items-start gap-4">
          {bgUrl && (
            <div className="relative flex-shrink-0">
              <img src={bgUrl} alt="Fundo" className="w-40 h-24 object-cover rounded-lg border border-gray-200" />
              <button type="button" onClick={() => setBgUrl('')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600">×</button>
            </div>
          )}
          <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-colors ${bgUploading ? 'opacity-50' : 'hover:border-orange-400 hover:bg-orange-50'} ${bgUrl ? 'w-32 h-24' : 'w-48 h-24'} border-gray-300`}>
            <ImageIcon className="w-5 h-5 mb-1 text-gray-400" />
            <span className="text-xs text-gray-500 text-center px-2">{bgUploading ? 'Enviando...' : bgUrl ? 'Trocar' : 'Adicionar imagem'}</span>
            <input type="file" accept="image/*" className="hidden" disabled={bgUploading} onChange={e => e.target.files?.[0] && handleBgUpload(e.target.files[0])} />
          </label>
        </div>
        {bgError && <p className="text-xs text-red-600 mt-2">{bgError}</p>}
      </div>

      <SaveButton />
    </form>
  )
}
