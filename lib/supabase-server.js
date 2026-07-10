/**
 * Cliente Supabase para o servidor (Server Components, Server Actions, Route Handlers).
 *
 * Diferença crítica de segurança vs lib/supabase.js (browser):
 *   - Usa cookies como transporte de sessão (não localStorage)
 *   - Cookies são marcados httpOnly + Secure + SameSite=Lax
 *   - Tokens de acesso NUNCA chegam ao JavaScript do browser
 *
 * httpOnly  → JS do browser não consegue ler o token (mitiga XSS)
 * Secure    → cookie só trafega por HTTPS (mitiga MITM)
 * SameSite  → cookie não é enviado em requisições cross-origin (mitiga CSRF)
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const IS_PROD = process.env.NODE_ENV === 'production'

function secureOptions(options) {
  return {
    ...options,
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/',
  }
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, secureOptions(options))
            )
          } catch {
            // Server Components não podem setar cookies — esperado e OK.
            // Somente middleware e Server Actions gravam cookies.
          }
        },
      },
    }
  )
}
