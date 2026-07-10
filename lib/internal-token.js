/**
 * Autenticação server-to-server com HMAC-SHA256.
 *
 * Usar quando dois serviços internos precisam se comunicar de forma autenticada
 * (ex: worker de jobs → API interna, webhook handler → action handler).
 *
 * Não use para autenticação de usuário — isso é responsabilidade do Supabase Auth.
 *
 * Protocolo:
 *   1. Chamador gera headers com signRequest(payload)
 *   2. Receptor verifica com verifyRequest(req, payload)
 *   3. Assinatura inclui timestamp → replay attack inviável após 30s
 *
 * Configurar em .env.local:
 *   INTERNAL_API_SECRET=$(openssl rand -hex 32)
 */

import { createHmac, timingSafeEqual } from 'crypto'

const SECRET = process.env.INTERNAL_API_SECRET

const REPLAY_WINDOW_MS = 30_000 // 30 segundos

/**
 * Gera headers para autenticar uma requisição server-to-server.
 * @param {string} payload — identificador da operação (ex: "create-order", "notify-driver")
 * @returns {Record<string, string>}
 */
export function signRequest(payload = '') {
  if (!SECRET) throw new Error('INTERNAL_API_SECRET não configurado em .env.local')

  const ts  = Date.now().toString()
  const sig = createHmac('sha256', SECRET)
    .update(`${ts}:${payload}`)
    .digest('hex')

  return {
    'x-internal-ts':      ts,
    'x-internal-sig':     sig,
    'x-internal-payload': payload,
  }
}

/**
 * Verifica se uma requisição interna é autêntica.
 * @param {Request} req — objeto Request do Next.js Route Handler
 * @param {string} expectedPayload — mesmo payload usado no signRequest
 * @returns {boolean}
 */
export function verifyRequest(req, expectedPayload = '') {
  if (!SECRET) return false

  const ts      = req.headers.get('x-internal-ts')
  const sig     = req.headers.get('x-internal-sig')
  const payload = req.headers.get('x-internal-payload')

  if (!ts || !sig || !payload) return false
  if (payload !== expectedPayload) return false

  // Rejeita requisições com mais de 30s (anti-replay)
  const age = Math.abs(Date.now() - Number(ts))
  if (isNaN(age) || age > REPLAY_WINDOW_MS) return false

  const expected = createHmac('sha256', SECRET)
    .update(`${ts}:${payload}`)
    .digest('hex')

  try {
    return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

/**
 * Middleware helper para Route Handlers internos.
 * Retorna Response 401 se a requisição não for autenticada.
 *
 * Uso em Route Handler:
 *   const denied = requireInternalAuth(req, 'minha-operacao')
 *   if (denied) return denied
 */
export function requireInternalAuth(req, expectedPayload = '') {
  if (!verifyRequest(req, expectedPayload)) {
    return new Response('Unauthorized', { status: 401 })
  }
  return null
}
