/**
 * Normalização de telefone brasileiro para E.164.
 *
 * Por que isso existe:
 *   O telefone do cliente é digitado à mão e é a chave que liga uma conversa
 *   de WhatsApp a um pedido. Sem um formato canônico, "(62) 98189-5453",
 *   "62981895453" e "+5562981895453" são três clientes diferentes para o banco.
 *
 * Formato canônico (E.164 sem o "+"): 55 + DDD (2) + número (8 ou 9)
 *   Ex: 5562981895453
 *
 * É este formato que a Evolution API espera no JID, então guarde sempre assim
 * e formate só na hora de exibir.
 */

// Celular tem 9 dígitos e sempre começa com 9. Fixo tem 8 e começa com 2–5.
const CELULAR_LEN = 9
const FIXO_LEN    = 8

/**
 * Converte um telefone brasileiro em qualquer formato para E.164 sem "+".
 * @param {string} raw
 * @returns {string|null} ex: "5562981895453", ou null se inválido
 */
export function toE164(raw) {
  if (!raw || typeof raw !== 'string') return null

  let digits = raw.replace(/\D/g, '')
  if (!digits) return null

  // Prefixo internacional discado ("0055...")
  if (digits.startsWith('00')) digits = digits.slice(2)

  // Remove o código do país se já veio junto. O check de comprimento evita
  // decapitar um DDD 55 (Pelotas/RS) de um número local: "55 9xxxx-xxxx" tem
  // 11 dígitos, enquanto um número com código do país tem 12 ou 13.
  const national = (digits.length >= 12 && digits.startsWith('55'))
    ? digits.slice(2)
    : digits

  const ddd    = national.slice(0, 2)
  const numero = national.slice(2)

  if (Number(ddd) < 11 || Number(ddd) > 99) return null

  if (numero.length === CELULAR_LEN) {
    if (numero[0] !== '9') return null
  } else if (numero.length === FIXO_LEN) {
    if (!'2345'.includes(numero[0])) return null
  } else {
    return null
  }

  return `55${national}`
}

/** @returns {boolean} */
export function isValidPhone(raw) {
  return toE164(raw) !== null
}

/**
 * Formata para exibição: "5562981895453" → "(62) 98189-5453".
 * Devolve a entrada intacta se não der para normalizar — melhor mostrar algo
 * imperfeito do que uma tela vazia.
 */
export function formatBR(raw) {
  const e164 = toE164(raw)
  if (!e164) return raw ?? ''

  const ddd    = e164.slice(2, 4)
  const numero = e164.slice(4)
  const meio   = numero.length === CELULAR_LEN ? 5 : 4

  return `(${ddd}) ${numero.slice(0, meio)}-${numero.slice(meio)}`
}
