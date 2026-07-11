-- ============================================================
-- 007 — Grants das tabelas de opções
--
-- Abra o Supabase Dashboard → SQL Editor, cole este arquivo INTEIRO e execute.
--
-- Por quê:
--   A 006 criou as tabelas com RLS, mas o RLS é a camada FINA (quais linhas).
--   Antes dele, o Postgres checa o GRANT da tabela (se o papel pode tocar nela).
--   Como a 003-security-hardening revogou os privilégios padrão do schema, as
--   tabelas novas nasceram sem GRANT nenhum — e o cardápio público quebrou com
--   "permission denied for table product_option_groups".
--
--   Aqui replicamos exatamente os grants que `products` já tem: leitura para
--   todo mundo (o cardápio é público), escrita só para o admin logado — que o
--   RLS já limita à própria loja.
--
-- Seguro rodar mais de uma vez.
-- ============================================================

-- Leitura pública (o cardápio precisa ser visível para quem não fez login)
GRANT SELECT ON TABLE option_groups, option_items, product_option_groups
  TO anon, authenticated;

-- Escrita pelo admin. Quem é dono de qual loja, o RLS resolve.
GRANT INSERT, UPDATE, DELETE ON TABLE option_groups, option_items, product_option_groups
  TO authenticated;

-- ── Conferência ─────────────────────────────────────────────
-- Deve listar SELECT para anon nas três tabelas:
--
--   SELECT table_name, grantee, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_name IN ('option_groups','option_items','product_option_groups')
--      AND grantee IN ('anon','authenticated')
--    ORDER BY table_name, grantee, privilege_type;
