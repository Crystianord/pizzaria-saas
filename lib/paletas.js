export const PALETAS = [
  {
    id: 'vermelho',
    nome: 'Vermelho Clássico',
    primaria: '#dc2626',
    hover:    '#b91c1c',
    fundo:    '#fff7f7',
    acento:   '#f97316',
    texto:    '#1a1a1a',
  },
  {
    id: 'noite',
    nome: 'Noite Italiana',
    primaria: '#1e293b',
    hover:    '#0f172a',
    fundo:    '#f8fafc',
    acento:   '#f59e0b',
    texto:    '#0f172a',
  },
  {
    id: 'verde',
    nome: 'Verde Toscana',
    primaria: '#16a34a',
    hover:    '#15803d',
    fundo:    '#f0fdf4',
    acento:   '#ca8a04',
    texto:    '#14532d',
  },
  {
    id: 'laranja',
    nome: 'Laranja Moderno',
    primaria: '#ea580c',
    hover:    '#c2410c',
    fundo:    '#fff7ed',
    acento:   '#eab308',
    texto:    '#1c1917',
  },
  {
    id: 'roxo',
    nome: 'Roxo Premium',
    primaria: '#7c3aed',
    hover:    '#6d28d9',
    fundo:    '#faf5ff',
    acento:   '#ec4899',
    texto:    '#1e1b4b',
  },
  {
    id: 'azul',
    nome: 'Azul Mediterrâneo',
    primaria: '#0284c7',
    hover:    '#0369a1',
    fundo:    '#f0f9ff',
    acento:   '#f97316',
    texto:    '#0c4a6e',
  },
]

export function getPaleta(id) {
  return PALETAS.find(p => p.id === id) ?? PALETAS[0]
}
