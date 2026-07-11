'use client'
import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Link2, Copy, CheckCircle, ChefHat, Bike, PackageCheck, XCircle } from 'lucide-react'

function LinkAcompanhamento({ paleta }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? window.location.href : ''

  function copiar() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const textoWhatsApp = encodeURIComponent(
    `Olá! Acompanhe meu pedido em tempo real:\n${url}`
  )

  return (
    <div className="bg-white rounded-2xl border-2 p-4 shadow-sm space-y-3" style={{ borderColor: paleta.primaria + '40' }}>
      <div className="flex items-center gap-2">
        <Link2 className="w-4 h-4 text-gray-500" />
        <p className="text-sm font-bold text-gray-900">Seu link de acompanhamento</p>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">
        Salve este link para acompanhar seu pedido mesmo se fechar o navegador.
      </p>

      {/* Link visível */}
      <div className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
        <p className="text-xs text-gray-600 break-all font-mono">{url}</p>
      </div>

      {/* Botões */}
      <div className="flex gap-2">
        <button
          onClick={copiar}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all"
          style={copied
            ? { backgroundColor: '#f0fdf4', borderColor: '#22c55e', color: '#16a34a' }
            : { borderColor: paleta.primaria, color: paleta.primaria }
          }
        >
          {copied ? '✓ Copiado!' : (<><Copy className="w-4 h-4" /> Copiar link</>)}
        </button>

        <a
          href={`https://wa.me/?text=${textoWhatsApp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#25d366' }}
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Compartilhar
        </a>
      </div>
    </div>
  )
}

const STEPS = [
  { key: 'novo',       label: 'Pedido recebido',    Icon: CheckCircle,  desc: 'Aguardando confirmação do restaurante' },
  { key: 'em_preparo', label: 'Em preparo',          Icon: ChefHat,      desc: 'O restaurante está preparando seu pedido' },
  { key: 'a_caminho',  label: 'A caminho',           Icon: Bike,         desc: 'Seu pedido está a caminho' },
  { key: 'entregue',   label: 'Entregue',            Icon: PackageCheck, desc: 'Pedido entregue. Bom apetite!' },
]

const STATUS_ORDER = { novo: 0, em_preparo: 1, a_caminho: 2, entregue: 3, cancelado: -1 }

function fmt(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function OrderStatus({ initialOrder, paleta }) {
  const [order, setOrder] = useState(initialOrder)

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    const channel = supabase
      .channel(`order-${order.id}`)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'orders',
        filter: `id=eq.${order.id}`,
      }, payload => {
        setOrder(prev => ({ ...prev, ...payload.new }))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [order.id])

  const isCanceled = order.status === 'cancelado'
  const currentIdx = STATUS_ORDER[order.status] ?? 0

  return (
    <div className="space-y-5">

      <LinkAcompanhamento paleta={paleta} />

      {isCanceled ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <XCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
          <p className="font-bold text-red-700 text-lg">Pedido cancelado</p>
          <p className="text-sm text-red-500 mt-1">Entre em contato com o restaurante para mais informações.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="space-y-4">
            {STEPS.map((step, idx) => {
              const done    = idx < currentIdx
              const current = idx === currentIdx
              return (
                <div key={step.key} className={`flex items-center gap-4 transition-opacity ${!done && !current ? 'opacity-30' : ''}`}>
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-lg flex-shrink-0 border-2 transition-colors"
                    style={current
                      ? { borderColor: paleta.primaria, backgroundColor: paleta.primaria + '15' }
                      : done
                        ? { borderColor: '#22c55e', backgroundColor: '#f0fdf4' }
                        : { borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }
                    }
                  >
                    <step.Icon
                      className="w-5 h-5"
                      style={current
                        ? { color: paleta.primaria }
                        : done
                          ? { color: '#16a34a' }
                          : { color: '#9ca3af' }
                      }
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${current ? '' : done ? 'text-green-700' : 'text-gray-400'}`}
                       style={current ? { color: paleta.primaria } : {}}>
                      {step.label}
                    </p>
                    {current && <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>}
                  </div>
                  {done && <span className="text-green-500 text-lg flex-shrink-0">✓</span>}
                  {current && (
                    <span className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: paleta.primaria }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Resumo do pedido */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="font-bold text-gray-900 mb-3 text-sm uppercase tracking-wide">Resumo</h2>
        <div className="space-y-2">
          {order.order_items?.map(item => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-gray-700">
                {item.quantidade}× {item.nome_produto}
                {item.nome_variante ? ` (${item.nome_variante})` : ''}
              </span>
              <span className="font-medium text-gray-900">{fmt(item.subtotal)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 mt-3 pt-3 space-y-1">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Subtotal</span><span>{fmt(order.subtotal)}</span>
          </div>
          {order.tipo_entrega === 'entrega' && (
            <div className="flex justify-between text-sm text-gray-500">
              <span>Entrega</span>
              <span>{order.taxa_entrega === 0 ? 'Grátis' : fmt(order.taxa_entrega)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 text-base pt-1">
            <span>Total</span><span>{fmt(order.total)}</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 space-y-0.5">
          <p>{order.tipo_entrega === 'entrega' ? `Entrega — ${order.endereco}, ${order.bairro}` : 'Retirada no local'}</p>
          {order.observacoes && <p>Obs.: {order.observacoes}</p>}
        </div>
      </div>

    </div>
  )
}
