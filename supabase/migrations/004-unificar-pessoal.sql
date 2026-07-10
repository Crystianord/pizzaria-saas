-- Migration 004: Unificar entregadores em funcionarios
--
-- Contexto: a separação entregadores/funcionarios era artificial.
-- A distinção correta é "como a pessoa é paga" e "se faz entregas",
-- não "tipo de pessoa". Esta migration:
--   1. Extende funcionarios com campos de entregador
--   2. Migra dados de entregadores → funcionarios
--   3. Adiciona funcionario_id em orders
--   4. Migra orders.entregador_id → orders.funcionario_id via token como chave

-- ─── 1. Adicionar colunas em funcionarios ────────────────────────────────────

ALTER TABLE funcionarios
  ADD COLUMN IF NOT EXISTS faz_entrega      boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS token            text,
  ADD COLUMN IF NOT EXISTS valor_por_entrega numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS modo_pagamento   text        NOT NULL DEFAULT 'semanal',
  ADD COLUMN IF NOT EXISTS disponivel       boolean     NOT NULL DEFAULT false;

-- Índice único no token (apenas rows com token definido)
CREATE UNIQUE INDEX IF NOT EXISTS funcionarios_token_key
  ON funcionarios(token) WHERE token IS NOT NULL;

-- ─── 2. Migrar entregadores → funcionarios ───────────────────────────────────
-- Usa token como chave de idempotência: se o token já existir em funcionarios
-- (ex: migration rodada duas vezes), o ON CONFLICT ignora.

INSERT INTO funcionarios
  (store_id, nome, telefone, cargo, periodo_pagamento, valor_diaria,
   faz_entrega, token, valor_por_entrega, modo_pagamento, ativo, disponivel)
SELECT
  store_id,
  nome,
  telefone,
  'Entregador'   AS cargo,
  'semanal'      AS periodo_pagamento,
  0              AS valor_diaria,
  true           AS faz_entrega,
  token,
  0              AS valor_por_entrega,
  'por_entrega'  AS modo_pagamento,
  ativo,
  disponivel
FROM entregadores
ON CONFLICT (token) WHERE token IS NOT NULL DO NOTHING;

-- ─── 3. Adicionar funcionario_id em orders ───────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS funcionario_id uuid REFERENCES funcionarios(id);

-- ─── 4. Migrar orders.entregador_id → orders.funcionario_id ─────────────────
-- Join: orders.entregador_id → entregadores.id → entregadores.token
--       → funcionarios.token → funcionarios.id
-- Só atualiza rows que ainda não têm funcionario_id (idempotente).

UPDATE orders o
SET funcionario_id = f.id
FROM entregadores e
JOIN funcionarios f
  ON  f.token    = e.token
  AND f.store_id = e.store_id
  AND f.faz_entrega = true
WHERE o.entregador_id = e.id
  AND o.funcionario_id IS NULL;
