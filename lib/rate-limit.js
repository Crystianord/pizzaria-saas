/**
 * Rate limiter — sliding window, in-memory.
 *
 * Funciona para instâncias únicas (dev local, containers com estado).
 * Em serverless (Vercel, AWS Lambda), o Map não persiste entre cold starts
 * — cada instância tem sua janela própria.
 *
 * Para produção em serverless: substitua por Upstash Redis:
 *   npm install @upstash/ratelimit @upstash/redis
 *   https://github.com/upstash/ratelimit-js
 */

const store = new Map()

/**
 * @param {string} key       — identificador único (IP + rota, ex: "1.2.3.4:/admin/login")
 * @param {object} opts
 * @param {number} opts.limit     — máximo de requisições na janela (padrão: 60)
 * @param {number} opts.windowMs  — tamanho da janela em ms (padrão: 60_000)
 * @returns {{ ok: boolean, remaining: number, retryAfter?: number }}
 */
export function rateLimit(key, { limit = 60, windowMs = 60_000 } = {}) {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1 }
  }

  if (entry.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    }
  }

  entry.count++
  return { ok: true, remaining: limit - entry.count }
}

// Limpa entradas expiradas a cada 5 minutos (evita leak de memória)
// Só roda em ambientes com setInterval (não Edge Runtime puro)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [k, v] of store.entries()) {
      if (now > v.resetAt) store.delete(k)
    }
  }, 300_000)
}
