/**
 * next.config.mjs — Hardened Security Configuration
 *
 * Camadas configuradas aqui:
 *   1. allowedOrigins   — CSRF: Server Actions só aceitam origem confiável
 *   2. Security Headers — fallback para rotas estáticas não cobertas pelo middleware
 *   3. poweredByHeader  — remove header que expõe stack tecnológico
 *   4. Images           — domínios explicitamente permitidos (evita image proxy abuse)
 */

const IS_PROD = process.env.NODE_ENV === 'production'

// Domínio principal da aplicação (sem trailing slash)
const APP_URL     = process.env.NEXT_PUBLIC_APP_URL   ?? 'http://localhost:3000'
const APP_HOST    = APP_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')

// Supabase Storage para imagens de produtos
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
let   SUPABASE_HOST = ''
try { SUPABASE_HOST = new URL(SUPABASE_URL).host } catch { /* ok */ }

// ─── Security Headers (fallback — middleware cobre rotas dinâmicas) ───────────

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
]

// ─── Config ───────────────────────────────────────────────────────────────────

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove "X-Powered-By: Next.js" das respostas
  poweredByHeader: false,

  // CSRF para Server Actions:
  // Next.js valida o header Origin por padrão — allowedOrigins adiciona origens extras.
  // Apenas seu domínio e localhost são confiáveis.
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        APP_HOST,
      ].filter(Boolean),
    },
  },

  // Domínios permitidos para next/image (evita que atacantes usem seu domínio
  // como proxy para imagens externas arbitrárias)
  images: {
    remotePatterns: [
      ...(SUPABASE_HOST
        ? [{
            protocol: 'https',
            hostname: SUPABASE_HOST,
            pathname: '/storage/v1/object/public/**',
          }]
        : []),
    ],
  },

  // Security headers como fallback para assets estáticos
  // O middleware já cobre rotas dinâmicas — isto cobre o que o middleware não alcança
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
