/**
 * Horário de funcionamento da loja.
 *
 * Por que existe um módulo só para isso:
 *   `new Date()` devolve a hora do servidor. Na Vercel isso é UTC, então uma
 *   loja que abre 18:00 aparecia como aberta às 15:00 de Brasília. O horário
 *   é sempre avaliado no fuso do restaurante, nunca no do servidor.
 *
 * Formato de `stores.horario` (jsonb), com as 7 chaves sempre presentes:
 *   { "seg": { "ativo": true, "abertura": "18:00", "fechamento": "23:00" }, ... }
 */

export const TIMEZONE = 'America/Sao_Paulo'

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

/**
 * Dia da semana e minutos desde a meia-noite, no fuso do restaurante.
 * @returns {{ diaIdx: number, minutos: number }}
 */
function agoraNoFuso(now = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday:  'short',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).formatToParts(now)

  const get = type => partes.find(p => p.type === type)?.value ?? ''

  // 'Mon' → 1, casando com a ordem de DIAS (domingo = 0)
  const semana = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const diaIdx = semana[get('weekday')] ?? 0

  // Em hour12:false o Intl devolve "24" para a meia-noite, não "00".
  const hora = Number(get('hour')) % 24

  return {
    diaIdx,
    minutos: hora * 60 + Number(get('minute')),
  }
}

/**
 * A loja está aberta agora?
 *
 * Um turno que cruza a meia-noite (18:00 → 02:00 na terça) continua valendo na
 * quarta de madrugada. Por isso não basta olhar a config de hoje: às 01:00 de
 * quarta, quem está aberto é o turno de terça. Avaliamos os dois.
 *
 * @param {object} horario — stores.horario
 * @returns {boolean}
 */
export function isOpen(horario, now = new Date()) {
  if (!horario) return false

  const { diaIdx, minutos } = agoraNoFuso(now)

  const hoje  = horario[DIAS[diaIdx]]
  const ontem = horario[DIAS[(diaIdx + 6) % 7]]

  return emTurnoHoje(hoje, minutos) || emRestoDeTurnoDeOntem(ontem, minutos)
}

/** O turno que começa hoje já abriu e ainda não fechou? */
function emTurnoHoje(conf, minutos) {
  const t = turno(conf)
  if (!t) return false

  // Cruza a meia-noite: hoje ele só cobre de `abertura` até 23:59.
  if (t.fechamento < t.abertura) return minutos >= t.abertura

  return minutos >= t.abertura && minutos <= t.fechamento
}

/** Estamos na madrugada, ainda dentro do turno que começou ontem? */
function emRestoDeTurnoDeOntem(conf, minutos) {
  const t = turno(conf)
  if (!t) return false
  if (t.fechamento >= t.abertura) return false  // não cruza a meia-noite

  return minutos <= t.fechamento
}

function turno(conf) {
  if (!conf?.ativo) return null

  const abertura   = paraMinutos(conf.abertura,   0)
  const fechamento = paraMinutos(conf.fechamento, 23 * 60 + 59)
  if (abertura === null || fechamento === null) return null

  return { abertura, fechamento }
}

function paraMinutos(hhmm, fallback) {
  if (!hhmm) return fallback
  const [h, m] = String(hhmm).split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}
