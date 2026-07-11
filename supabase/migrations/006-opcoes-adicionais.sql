-- ============================================================
-- 006 — Grupos de opções e adicionais pagos
--
-- Abra o Supabase Dashboard → SQL Editor, cole este arquivo INTEIRO e execute.
--
-- Por quê:
--   O modelo atual assume "produto = sabor, variante = tamanho". Isso não
--   consegue representar um combo ("2 Pizzas + Refrigerante — escolha 2
--   sabores") nem um adicional pago ("+R$10 de bacon").
--
--   Aqui o produto passa a poder ter GRUPOS DE OPÇÕES. Cada grupo tem um
--   mínimo e um máximo de escolhas, definidos POR PRODUTO — é isso que permite
--   o mesmo grupo "Sabores" (27 opções) servir tanto "Promoção 1" (escolha 1)
--   quanto "5 Pizzas + Coca" (escolha 5) sem duplicar as opções.
--
-- Seguro rodar mais de uma vez.
-- ============================================================

-- ── 1. Grupo (nível loja, reutilizável entre produtos) ──────
CREATE TABLE IF NOT EXISTS option_groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  nome       text NOT NULL,
  -- 'escolha'   → sabores/opções sem custo (o preço vem do produto)
  -- 'adicional' → extras pagos, somados ao preço
  tipo       text NOT NULL DEFAULT 'escolha',
  ordem      int  NOT NULL DEFAULT 0,
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE option_groups DROP CONSTRAINT IF EXISTS option_groups_nome_length;
ALTER TABLE option_groups DROP CONSTRAINT IF EXISTS option_groups_tipo_valid;
ALTER TABLE option_groups ADD CONSTRAINT option_groups_nome_length CHECK (char_length(nome) <= 80);
ALTER TABLE option_groups ADD CONSTRAINT option_groups_tipo_valid  CHECK (tipo IN ('escolha', 'adicional'));

-- ── 2. Opções dentro do grupo ───────────────────────────────
-- store_id é denormalizado de propósito: é o que permite o servidor buscar
-- todas as opções de um pedido numa query só, já filtrando por loja.
CREATE TABLE IF NOT EXISTS option_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
  store_id    uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  descricao   text,
  preco_extra numeric NOT NULL DEFAULT 0,
  ordem       int  NOT NULL DEFAULT 0,
  ativo       boolean NOT NULL DEFAULT true
);

ALTER TABLE option_items DROP CONSTRAINT IF EXISTS option_items_nome_length;
ALTER TABLE option_items DROP CONSTRAINT IF EXISTS option_items_descricao_length;
ALTER TABLE option_items DROP CONSTRAINT IF EXISTS option_items_preco_nonneg;
ALTER TABLE option_items ADD CONSTRAINT option_items_nome_length      CHECK (char_length(nome) <= 80);
ALTER TABLE option_items ADD CONSTRAINT option_items_descricao_length CHECK (descricao IS NULL OR char_length(descricao) <= 200);
ALTER TABLE option_items ADD CONSTRAINT option_items_preco_nonneg     CHECK (preco_extra >= 0);

CREATE INDEX IF NOT EXISTS option_items_group_idx ON option_items (group_id);
CREATE INDEX IF NOT EXISTS option_items_store_idx ON option_items (store_id);

-- ── 3. Junção produto ↔ grupo, com min/max POR PRODUTO ──────
CREATE TABLE IF NOT EXISTS product_option_groups (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid NOT NULL REFERENCES products(id)      ON DELETE CASCADE,
  group_id     uuid NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
  store_id     uuid NOT NULL REFERENCES stores(id)        ON DELETE CASCADE,
  min_selecao  int  NOT NULL DEFAULT 0,
  max_selecao  int  NOT NULL DEFAULT 1,
  ordem        int  NOT NULL DEFAULT 0,
  UNIQUE (product_id, group_id)
);

ALTER TABLE product_option_groups DROP CONSTRAINT IF EXISTS pog_min_nonneg;
ALTER TABLE product_option_groups DROP CONSTRAINT IF EXISTS pog_max_positive;
ALTER TABLE product_option_groups DROP CONSTRAINT IF EXISTS pog_max_gte_min;
ALTER TABLE product_option_groups ADD CONSTRAINT pog_min_nonneg   CHECK (min_selecao >= 0);
ALTER TABLE product_option_groups ADD CONSTRAINT pog_max_positive CHECK (max_selecao >= 1);
ALTER TABLE product_option_groups ADD CONSTRAINT pog_max_gte_min  CHECK (max_selecao >= min_selecao);

CREATE INDEX IF NOT EXISTS pog_product_idx ON product_option_groups (product_id);
CREATE INDEX IF NOT EXISTS pog_store_idx   ON product_option_groups (store_id);

-- ── 4. Descrição do produto ─────────────────────────────────
-- Não existia. O cardápio precisa dela ("Escolha 2 Sabores!", "2 Pizzas
-- Grande + 1 Refri. Crystal de 2 Litros") — hoje só as opções têm descrição.
ALTER TABLE products ADD COLUMN IF NOT EXISTS descricao text;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_descricao_length;
ALTER TABLE products ADD CONSTRAINT products_descricao_length
  CHECK (descricao IS NULL OR char_length(descricao) <= 300);

-- ── 5. Snapshot do que o cliente escolheu, no pedido ────────
-- jsonb (e não tabela filha) para que o rollback manual do createOrder
-- continue com 2 passos, e para que os 4 leitores existentes recebam o dado
-- de graça — todos já fazem `select('*, order_items(*)')`.
--
-- Formato (fixo — writer e readers precisam concordar):
--   [{ "grupo": "Escolha seu Sabor!",
--      "itens": [{ "nome": "Calabresa", "preco_extra": 0 }] }]
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS opcoes_info jsonb;

-- ============================================================
-- RLS — mesmo padrão de `products` (catálogo é público para leitura,
-- escrita só do admin dono da loja)
-- ============================================================
ALTER TABLE option_groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE option_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_option_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "option_groups_select" ON option_groups;
DROP POLICY IF EXISTS "option_groups_write"  ON option_groups;

CREATE POLICY "option_groups_select"
  ON option_groups FOR SELECT
  USING (true);

CREATE POLICY "option_groups_write"
  ON option_groups FOR ALL TO authenticated
  USING      (store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "option_items_select" ON option_items;
DROP POLICY IF EXISTS "option_items_write"  ON option_items;

CREATE POLICY "option_items_select"
  ON option_items FOR SELECT
  USING (true);

CREATE POLICY "option_items_write"
  ON option_items FOR ALL TO authenticated
  USING      (store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "pog_select" ON product_option_groups;
DROP POLICY IF EXISTS "pog_write"  ON product_option_groups;

CREATE POLICY "pog_select"
  ON product_option_groups FOR SELECT
  USING (true);

CREATE POLICY "pog_write"
  ON product_option_groups FOR ALL TO authenticated
  USING      (store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid()));

-- ============================================================
-- Grants (mesma lista da 003-security-hardening.sql)
-- ============================================================
GRANT ALL ON TABLE option_groups, option_items, product_option_groups TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_api') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      option_groups, option_items, product_option_groups
    TO app_api;
  END IF;
END
$$;
