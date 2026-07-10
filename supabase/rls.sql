-- ============================================================
-- RLS — Pizzaria SaaS
-- Cole no SQL Editor do Supabase Dashboard e execute.
--
-- IMPORTANTE: este arquivo reflete o estado APÓS as correções de segurança.
-- Se você já rodou a versão antiga, rode também o arquivo
--   supabase/migrations/001-security-fixes.sql
-- para aplicar as correções incrementalmente sem perder dados.
-- ============================================================

-- 0. Grants para service_role (bypassa RLS mas ainda precisa de grants PostgreSQL)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 1. Habilitar RLS em todas as tabelas
ALTER TABLE stores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_stores     ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregadores     ENABLE ROW LEVEL SECURITY;
ALTER TABLE funcionarios     ENABLE ROW LEVEL SECURITY;
ALTER TABLE intercorrencias  ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- stores
-- ============================================================
DROP POLICY IF EXISTS "stores_select" ON stores;
DROP POLICY IF EXISTS "stores_update" ON stores;

CREATE POLICY "stores_select"
  ON stores FOR SELECT
  USING (true);

CREATE POLICY "stores_update"
  ON stores FOR UPDATE TO authenticated
  USING (
    id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid())
  );


-- ============================================================
-- admin_stores
-- ============================================================
DROP POLICY IF EXISTS "admin_stores_select" ON admin_stores;

CREATE POLICY "admin_stores_select"
  ON admin_stores FOR SELECT TO authenticated
  USING (user_id = auth.uid());


-- ============================================================
-- orders
-- ----------------------------------------------------------------
-- MUDANÇAS DE SEGURANÇA (vs versão anterior):
--   1. INSERT por anon REMOVIDO. Pedidos do site público entram via
--      Server Action `createOrder` que usa Service Role e valida tudo.
--   2. SELECT por anon LIMITADO a 24h. Antes era USING(true), que deixava
--      qualquer pessoa baixar histórico completo de PII de todas as lojas.
--      O filtro temporal mantém Realtime funcionando para o tracking do
--      cliente sem expor o histórico inteiro.
-- ============================================================
DROP POLICY IF EXISTS "orders_insert"           ON orders;
DROP POLICY IF EXISTS "orders_insert_admin"     ON orders;
DROP POLICY IF EXISTS "orders_select_admin"     ON orders;
DROP POLICY IF EXISTS "orders_select_realtime"  ON orders;
DROP POLICY IF EXISTS "orders_update"           ON orders;

-- Admin pode criar pedidos manuais (pedido por ligação) na própria loja
CREATE POLICY "orders_insert_admin"
  ON orders FOR INSERT TO authenticated
  WITH CHECK (
    store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid())
  );

-- Admin lê todos os pedidos da própria loja
CREATE POLICY "orders_select_admin"
  ON orders FOR SELECT TO authenticated
  USING (
    store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid())
  );

-- Cliente público (anon) lê APENAS pedidos das últimas 24h.
-- Necessário para o Realtime do componente OrderStatus funcionar.
-- O fetch inicial do tracking usa Service Role (passa por verificação
-- de expiração de 7 dias na página). O filtro de 24h aqui só limita a
-- janela do subscribe, não dá acesso histórico arbitrário.
CREATE POLICY "orders_select_anon_recent"
  ON orders FOR SELECT TO anon
  USING (created_at > now() - interval '24 hours');

CREATE POLICY "orders_update"
  ON orders FOR UPDATE TO authenticated
  USING (
    store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid())
  );


-- ============================================================
-- order_items
-- Mesmo padrão de orders.
-- ============================================================
DROP POLICY IF EXISTS "order_items_insert"           ON order_items;
DROP POLICY IF EXISTS "order_items_insert_admin"     ON order_items;
DROP POLICY IF EXISTS "order_items_select"           ON order_items;
DROP POLICY IF EXISTS "order_items_select_admin"     ON order_items;
DROP POLICY IF EXISTS "order_items_select_realtime"  ON order_items;
DROP POLICY IF EXISTS "order_items_select_anon_recent" ON order_items;

CREATE POLICY "order_items_insert_admin"
  ON order_items FOR INSERT TO authenticated
  WITH CHECK (
    store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid())
  );

CREATE POLICY "order_items_select_admin"
  ON order_items FOR SELECT TO authenticated
  USING (
    store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid())
  );

CREATE POLICY "order_items_select_anon_recent"
  ON order_items FOR SELECT TO anon
  USING (
    order_id IN (
      SELECT id FROM orders WHERE created_at > now() - interval '24 hours'
    )
  );


-- ============================================================
-- categories
-- ============================================================
DROP POLICY IF EXISTS "categories_select" ON categories;
DROP POLICY IF EXISTS "categories_write"  ON categories;

CREATE POLICY "categories_select"
  ON categories FOR SELECT
  USING (true);

CREATE POLICY "categories_write"
  ON categories FOR ALL TO authenticated
  USING (
    store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid())
  )
  WITH CHECK (
    store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid())
  );


-- ============================================================
-- products
-- ============================================================
DROP POLICY IF EXISTS "products_select" ON products;
DROP POLICY IF EXISTS "products_write"  ON products;

CREATE POLICY "products_select"
  ON products FOR SELECT
  USING (true);

CREATE POLICY "products_write"
  ON products FOR ALL TO authenticated
  USING (
    store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid())
  )
  WITH CHECK (
    store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid())
  );


-- ============================================================
-- product_variants
-- ============================================================
DROP POLICY IF EXISTS "product_variants_select" ON product_variants;
DROP POLICY IF EXISTS "product_variants_write"  ON product_variants;

CREATE POLICY "product_variants_select"
  ON product_variants FOR SELECT
  USING (true);

CREATE POLICY "product_variants_write"
  ON product_variants FOR ALL TO authenticated
  USING (
    product_id IN (
      SELECT id FROM products
      WHERE store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    product_id IN (
      SELECT id FROM products
      WHERE store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid())
    )
  );


-- ============================================================
-- promotions
-- ============================================================
DROP POLICY IF EXISTS "promotions_select" ON promotions;
DROP POLICY IF EXISTS "promotions_write"  ON promotions;

CREATE POLICY "promotions_select"
  ON promotions FOR SELECT
  USING (true);

CREATE POLICY "promotions_write"
  ON promotions FOR ALL TO authenticated
  USING (
    store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid())
  )
  WITH CHECK (
    store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid())
  );


-- ============================================================
-- entregadores
-- ============================================================
DROP POLICY IF EXISTS "entregadores_all" ON entregadores;

CREATE POLICY "entregadores_all"
  ON entregadores FOR ALL TO authenticated
  USING (
    store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid())
  )
  WITH CHECK (
    store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid())
  );


-- ============================================================
-- funcionarios
-- ============================================================
DROP POLICY IF EXISTS "funcionarios_all" ON funcionarios;

CREATE POLICY "funcionarios_all"
  ON funcionarios FOR ALL TO authenticated
  USING (
    store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid())
  )
  WITH CHECK (
    store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid())
  );


-- ============================================================
-- intercorrencias
-- ============================================================
DROP POLICY IF EXISTS "intercorrencias_all" ON intercorrencias;

CREATE POLICY "intercorrencias_all"
  ON intercorrencias FOR ALL TO authenticated
  USING (
    store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid())
  )
  WITH CHECK (
    store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid())
  );


-- ============================================================
-- CONSTRAINTS DE TAMANHO (defense-in-depth contra payload bomb)
-- Aplicadas via supabase/migrations/001-security-fixes.sql
-- ============================================================
