/**
 * Cliente Supabase com service_role — bypassa RLS.
 *
 * REGRAS DE USO:
 *   ✅ Usar APENAS em Server Actions e Route Handlers (servidor)
 *   ✅ SUPABASE_SERVICE_ROLE_KEY não tem prefixo NEXT_PUBLIC_ — nunca vai ao browser
 *   ❌ NUNCA importar em arquivos 'use client'
 *   ❌ NUNCA usar para operações que poderiam ser feitas com a anon key + RLS
 *
 * Quando usar service_role:
 *   - createOrder (pedido público — anon não pode inserir por RLS)
 *   - Portal do entregador (acesso por token, sem sessão autenticada)
 *   - Jobs de background / webhooks
 *
 * Auditoria: toda chamada ao service client é logada com a operação.
 * Em produção, redirecione esses logs para o seu sistema de observabilidade.
 */

import { createClient as _createClient } from '@supabase/supabase-js'

let _instance = null

function getClient() {
  if (!_instance) {
    _instance = _createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          // service_role não deve persistir sessão — é stateless
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )
  }
  return _instance
}

/**
 * Retorna o cliente service_role com audit log da operação.
 *
 * @param {string} operation — identificador da operação (ex: "createOrder", "finishDelivery")
 *   Usado em logs para rastrear quem chamou o service client e para quê.
 */
export function createServiceClient(operation = 'unknown') {
  if (process.env.NODE_ENV === 'production') {
    // Em produção: substituir por logger estruturado (Datadog, Axiom, etc.)
    console.log(`[service_role] op=${operation} ts=${new Date().toISOString()}`)
  }

  return getClient()
}
