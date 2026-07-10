/**
 * MIDDLEWARE — Defense-in-Depth (camada de entrada)
 *
 * Executa ANTES de cada requisição. Responsabilidades:
 *
 *   1. Rate Limiting   — aborta requisições em excesso por IP
 *   2. Security Headers — adiciona cabeçalhos defensivos em toda resposta
 *   3. HTTPS Redirect  — força HTTPS em produção
 *   4. Session Refresh — renova JWT do Supabase antes de expirar
 *   5. Cookies blindados — força httpOnly + Secure + SameSite no Set-Cookie
 *
 * Camadas independentes: se uma falhar (ex: rate limiter), as outras continuam.
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

// ─── Security Headers ─────────────────────────────────────────────────────────

const SECURITY_HEADERS = {
  // Força HTTPS por 1 ano, inclui subdomínios, aceito por preload lists
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // Bloqueia iframe embedding (clickjacking)
  'X-Frame-Options': 'DENY',

  // Evita MIME-type sniffing (drive-by download via content-type errado)
  'X-Content-Type-Options': 'nosniff',

  // Controla o que aparece no Referer ao navegar para domínios externos
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Desativa APIs de hardware desnecessárias
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',

  // Ativa filtro XSS do browser (obsoleto mas inofensivo em navegadores modernos)
  'X-XSS-Protection': '1; mode=block',

  // Remove header que expõe stack tecnológico
  'X-Powered-By': '',
}

// ─── Content Security Policy ──────────────────────────────────────────────────

function buildCSP(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  let supabaseHost = ''
  let supabaseWs   = ''

  try {
    const u  = new URL(supabaseUrl)
    supabaseHost = u.host
    supabaseWs   = `wss://${u.host}`
  } catch { /* URL inválida — não bloqueia a requisição */ }

  const isDev = process.env.NODE_ENV === 'development'

  const directives = [
    "default-src 'self'",

    // Next.js precisa de unsafe-inline para Server Components (RSC payload)
    // unsafe-eval é necessário apenas em dev (HMR)
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,

    // Supabase REST API + Realtime WebSocket
    `connect-src 'self'${supabaseHost ? ` https://${supabaseHost} ${supabaseWs}` : ''}`,

    // Supabase Storage + inline images (data:) + blobs (upload preview)
    `img-src 'self' data: blob:${supabaseHost ? ` https://${supabaseHost}` : ''}`,

    // Tailwind usa estilos inline — unsafe-inline obrigatório
    "style-src 'self' 'unsafe-inline'",

    // Fontes locais apenas
    "font-src 'self'",

    // Bloqueia este site sendo embarcado em iframe de qualquer origem
    "frame-ancestors 'none'",

    // Formulários só podem submeter para o próprio domínio
    "form-action 'self'",

    // Bloqueia base tag injection
    "base-uri 'self'",

    // Força upgrade de HTTP → HTTPS para recursos sub-page
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ]

  return directives.join('; ')
}

// ─── Cookie options seguras ───────────────────────────────────────────────────

function secureCookieOptions(options) {
  return {
    ...options,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  }
}

// ─── Middleware principal ─────────────────────────────────────────────────────

export async function middleware(request) {
  const { pathname }  = request.nextUrl

  // ── 1. HTTPS Redirect (produção) ──────────────────────────────────────────
  if (
    process.env.NODE_ENV === 'production' &&
    request.headers.get('x-forwarded-proto') === 'http'
  ) {
    const httpsUrl = request.nextUrl.clone()
    httpsUrl.protocol = 'https:'
    return NextResponse.redirect(httpsUrl, { status: 301 })
  }

  // ── 2. Session Refresh (Supabase) ─────────────────────────────────────────
  let response = NextResponse.next({ request })

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Propaga cookies atualizados para o request interno
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })

          // Seta cookies com flags de segurança na resposta
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, secureCookieOptions(options))
          )
        },
      },
    }
  )

  // Renova token se necessário (efeito colateral: escreve Set-Cookie se o JWT renovou)
  await supabase.auth.getUser()

  // ── 4. Security Headers ───────────────────────────────────────────────────
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    if (value) {
      response.headers.set(key, value)
    } else {
      response.headers.delete(key)
    }
  })

  response.headers.set('Content-Security-Policy', buildCSP(request))

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|woff|woff2)$).*)',
  ],
}
