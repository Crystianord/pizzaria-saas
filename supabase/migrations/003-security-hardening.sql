-- ============================================================
-- Migration 003: Defense-in-Depth — Hardening do banco
-- Execute no Supabase Dashboard → SQL Editor
--
-- O que faz (por camada):
--   1. Timeouts: mata queries longas antes que virem DoS
--   2. Revoga DDL: roles de app não podem alterar schema, nunca
--   3. Column-level security: tabelas internas bloqueadas para anon
--      (RLS já bloqueia linhas; isto bloqueia o acesso à estrutura)
--   4. Sequências: anon não consegue inferir volume de pedidos
--   5. Auditoria: queries de verificação para rodar periodicamente
-- ============================================================


-- ============================================================
-- 1. TIMEOUTS — impede queries lentas / ataques de recursos
-- ============================================================

-- anon: máximo 3s (cardápio público, pedidos)
ALTER ROLE anon SET statement_timeout = '3000';
ALTER ROLE anon SET idle_in_transaction_session_timeout = '10000';
ALTER ROLE anon SET lock_timeout = '2000';

-- authenticated: máximo 10s (painel admin, relatórios)
ALTER ROLE authenticated SET statement_timeout = '10000';
ALTER ROLE authenticated SET idle_in_transaction_session_timeout = '30000';
ALTER ROLE authenticated SET lock_timeout = '5000';


-- ============================================================
-- 2. REVOGAR DDL — roles de aplicação não criam nem alteram schema
-- PostgREST já bloqueia DDL via HTTP, mas defense-in-depth
-- ============================================================
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM anon;
REVOKE CREATE ON SCHEMA public FROM authenticated;


-- ============================================================
-- 3. TABLE-LEVEL GRANTS — tabelas internas invisíveis para anon
--
-- Nota: RLS já bloqueia rows. Este grant bloqueia acesso PRÉ-RLS.
-- Dois guardas independentes: se um falhar, o outro segura.
-- ============================================================

-- admin_stores: mapeamento user→loja, anon não deve saber que existe
REVOKE ALL ON TABLE admin_stores FROM anon;

-- funcionarios e intercorrencias: dados internos de RH
REVOKE ALL ON TABLE funcionarios    FROM anon;
REVOKE ALL ON TABLE intercorrencias FROM anon;

-- entregadores: acesso via token (Server Action com service_role),
-- nunca via REST direto com anon key
REVOKE ALL ON TABLE entregadores FROM anon;


-- ============================================================
-- 4. SEQUÊNCIAS — anon não pode usar NEXTVAL nem inferir IDs
-- ============================================================
REVOKE USAGE ON ALL SEQUENCES IN SCHEMA public FROM anon;


-- ============================================================
-- 5. PRINCÍPIO DO MENOR PRIVILÉGIO — role dedicada para a API
--
-- Contexto Supabase: o client usa JWT com role=anon|authenticated.
-- Para operações que precisam de service_role (bypass RLS), criamos
-- uma role específica com apenas DML, sem DDL nem funções destrutivas.
--
-- Use esta role em conexões diretas ao banco (ex: scripts de migração,
-- workers externos). NÃO substitui o service_role JWT do Supabase SSR.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_api') THEN
    CREATE ROLE app_api NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$$;

-- Acesso ao schema
GRANT USAGE ON SCHEMA public TO app_api;

-- Apenas DML — sem DROP, CREATE, ALTER, TRUNCATE
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  stores,
  admin_stores,
  orders,
  order_items,
  categories,
  products,
  product_variants,
  promotions,
  entregadores,
  funcionarios,
  intercorrencias
TO app_api;

-- Sequências para INSERT com RETURNING id
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_api;

-- Bloquear explicitamente qualquer DDL
REVOKE CREATE ON SCHEMA public FROM app_api;


-- ============================================================
-- 6. TLS — verificação de status
--
-- O Supabase managed já EXIGE TLS em todas as conexões REST.
-- Para conexões diretas (PostgreSQL wire protocol), verifique:
--
--   SELECT ssl, cipher FROM pg_stat_ssl WHERE pid = pg_backend_pid();
--   -- ssl deve ser TRUE
--
-- Para forçar via Supabase Dashboard:
--   Settings → Database → SSL Enforcement → ON
--
-- String de conexão segura para workers externos:
--   postgresql://app_api:[senha]@db.[ref].supabase.co:5432/postgres
--     ?sslmode=require
--     &sslrootcert=/path/to/supabase-ca-2021.crt
--
-- Certificado CA: Dashboard → Settings → Database → Download SSL Certificate
-- ============================================================


-- ============================================================
-- 7. QUERIES DE AUDITORIA — rode periodicamente para verificar
-- ============================================================

-- 7a. Verificar que nenhuma tabela tem INSERT/UPDATE/DELETE para PUBLIC
-- Resultado esperado: 0 linhas
/*
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'PUBLIC'
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
ORDER BY table_name;
*/

-- 7b. Confirmar timeouts aplicados
/*
SELECT rolname, rolconfig
FROM pg_roles
WHERE rolname IN ('anon', 'authenticated', 'app_api')
ORDER BY rolname;
*/

-- 7c. Verificar que anon não acessa tabelas internas
-- Execute com anon key via REST:
-- GET /rest/v1/admin_stores → deve retornar 403 Forbidden
-- GET /rest/v1/entregadores → deve retornar 403 Forbidden
-- GET /rest/v1/funcionarios → deve retornar 403 Forbidden
