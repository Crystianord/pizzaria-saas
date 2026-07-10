-- ============================================================
-- MIGRATION 001 — Correções de Segurança Críticas
-- Data: 2026-06-13
--
-- COMO RODAR:
--   1. Abra o Supabase Dashboard → SQL Editor
--   2. Cole este arquivo INTEIRO
--   3. Clique em "Run"
--   4. Verifique que não houve erros
--
-- O QUE FAZ:
--   C1 — Restringe SELECT anon em orders/order_items para últimas 24h
--        (antes: USING(true) → vazamento histórico de PII de todas lojas)
--   C6 — Remove INSERT anon em orders/order_items
--        (pedidos agora entram via Server Action com Service Role)
--   M1 — Adiciona constraints de tamanho em campos de texto
--        (defesa contra payload bomb em cliente_nome, observacoes, etc.)
--
-- REVERSÍVEL: sim, basta dropar as policies novas e recriar as antigas.
-- ============================================================

BEGIN;

-- ── C1 + C6: Reescrever policies de orders ─────────────────────
DROP POLICY IF EXISTS "orders_insert"            ON orders;
DROP POLICY IF EXISTS "orders_select_realtime"   ON orders;
DROP POLICY IF EXISTS "orders_select_anon_recent" ON orders;
DROP POLICY IF EXISTS "orders_insert_admin"      ON orders;

CREATE POLICY "orders_insert_admin"
  ON orders FOR INSERT TO authenticated
  WITH CHECK (
    store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid())
  );

CREATE POLICY "orders_select_anon_recent"
  ON orders FOR SELECT TO anon
  USING (created_at > now() - interval '24 hours');


-- ── C1 + C6: Reescrever policies de order_items ────────────────
DROP POLICY IF EXISTS "order_items_insert"            ON order_items;
DROP POLICY IF EXISTS "order_items_select_realtime"   ON order_items;
DROP POLICY IF EXISTS "order_items_select_anon_recent" ON order_items;
DROP POLICY IF EXISTS "order_items_insert_admin"      ON order_items;

CREATE POLICY "order_items_insert_admin"
  ON order_items FOR INSERT TO authenticated
  WITH CHECK (
    store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid())
  );

CREATE POLICY "order_items_select_anon_recent"
  ON order_items FOR SELECT TO anon
  USING (
    order_id IN (
      SELECT id FROM orders WHERE created_at > now() - interval '24 hours'
    )
  );


-- ── M1: Constraints de tamanho (defesa contra payload bomb) ────
-- Limites generosos mas finitos. Drop IF EXISTS para idempotência.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_cliente_nome_length;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_cliente_tel_length;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_endereco_length;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_bairro_length;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_observacoes_length;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_subtotal_positive;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_total_positive;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_taxa_entrega_nonneg;

ALTER TABLE orders ADD CONSTRAINT orders_cliente_nome_length CHECK (char_length(cliente_nome)  <= 100);
ALTER TABLE orders ADD CONSTRAINT orders_cliente_tel_length  CHECK (char_length(cliente_tel)   <= 20);
ALTER TABLE orders ADD CONSTRAINT orders_endereco_length     CHECK (endereco    IS NULL OR char_length(endereco)    <= 200);
ALTER TABLE orders ADD CONSTRAINT orders_bairro_length       CHECK (bairro      IS NULL OR char_length(bairro)      <= 60);
ALTER TABLE orders ADD CONSTRAINT orders_observacoes_length  CHECK (observacoes IS NULL OR char_length(observacoes) <= 500);
ALTER TABLE orders ADD CONSTRAINT orders_subtotal_positive   CHECK (subtotal     >= 0);
ALTER TABLE orders ADD CONSTRAINT orders_total_positive      CHECK (total        >  0);
ALTER TABLE orders ADD CONSTRAINT orders_taxa_entrega_nonneg CHECK (taxa_entrega >= 0);

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_nome_produto_length;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_nome_variante_length;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_quantidade_positive;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_quantidade_max;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_preco_nonneg;

ALTER TABLE order_items ADD CONSTRAINT order_items_nome_produto_length  CHECK (char_length(nome_produto) <= 200);
ALTER TABLE order_items ADD CONSTRAINT order_items_nome_variante_length CHECK (nome_variante IS NULL OR char_length(nome_variante) <= 80);
ALTER TABLE order_items ADD CONSTRAINT order_items_quantidade_positive  CHECK (quantidade > 0);
ALTER TABLE order_items ADD CONSTRAINT order_items_quantidade_max       CHECK (quantidade <= 99);
ALTER TABLE order_items ADD CONSTRAINT order_items_preco_nonneg         CHECK (preco_unitario >= 0);


COMMIT;

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION
-- Rode estas queries para confirmar que tudo está OK:
-- ============================================================

-- Lista as policies ativas em orders
SELECT polname, polroles::regrole[], pg_get_expr(polqual, polrelid) AS using_expr
FROM pg_policy
WHERE polrelid = 'orders'::regclass
ORDER BY polname;

-- Lista as policies ativas em order_items
SELECT polname, polroles::regrole[], pg_get_expr(polqual, polrelid) AS using_expr
FROM pg_policy
WHERE polrelid = 'order_items'::regclass
ORDER BY polname;

-- Lista os constraints aplicados
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN ('orders'::regclass, 'order_items'::regclass)
  AND contype = 'c'
ORDER BY conrelid, conname;


-- ============================================================
-- IMPORTANTE — Storage Policies (rodar separadamente!)
-- O Supabase Storage tem RLS PRÓPRIO em `storage.objects`.
-- Cole isto no SQL Editor TAMBÉM, para isolar uploads por loja:
-- ============================================================
/*
DROP POLICY IF EXISTS "product_images_upload_own_store" ON storage.objects;
DROP POLICY IF EXISTS "product_images_read_public"      ON storage.objects;
DROP POLICY IF EXISTS "product_images_delete_own_store" ON storage.objects;

CREATE POLICY "product_images_read_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "product_images_upload_own_store"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] IN (
      SELECT store_id::text FROM public.admin_stores WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "product_images_delete_own_store"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] IN (
      SELECT store_id::text FROM public.admin_stores WHERE user_id = auth.uid()
    )
  );
*/
