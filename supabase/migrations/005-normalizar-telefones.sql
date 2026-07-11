-- ============================================================
-- 005 — Normalizar telefones para E.164
--
-- Abra o Supabase Dashboard → SQL Editor, cole este arquivo INTEIRO e execute.
--
-- Por quê:
--   O telefone é a chave que liga um pedido a uma conversa de WhatsApp. Hoje o
--   banco tem "62981895453" (sem código do país), enquanto a Evolution API
--   espera "5562981895453". Com formatos misturados, o bot não consegue achar
--   o pedido de quem está falando com ele.
--
--   A partir de agora o app grava sempre em E.164 (lib/phone.js). Esta migration
--   arruma o que já estava no banco.
--
-- Seguro de rodar mais de uma vez: linhas já normalizadas não são tocadas.
-- ============================================================

-- Converte um telefone brasileiro em qualquer formato para E.164 sem "+".
-- Devolve NULL se não for um número reconhecível — o CASE abaixo preserva o
-- valor original nesse caso, para não destruir dado que a gente não entendeu.
CREATE OR REPLACE FUNCTION br_to_e164(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d        text;
  national text;
  ddd      int;
  numero   text;
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN NULL;
  END IF;

  d := regexp_replace(raw, '\D', '', 'g');

  IF left(d, 2) = '00' THEN
    d := substr(d, 3);
  END IF;

  -- Só decapita o "55" quando o comprimento indica código do país (12–13).
  -- Senão um número de Pelotas (DDD 55) perderia o DDD.
  IF length(d) >= 12 AND left(d, 2) = '55' THEN
    national := substr(d, 3);
  ELSE
    national := d;
  END IF;

  IF length(national) NOT IN (10, 11) THEN
    RETURN NULL;
  END IF;

  ddd    := substr(national, 1, 2)::int;
  numero := substr(national, 3);

  IF ddd < 11 OR ddd > 99 THEN
    RETURN NULL;
  END IF;

  -- Celular: 9 dígitos começando com 9. Fixo: 8 dígitos começando com 2–5.
  IF length(numero) = 9 AND left(numero, 1) <> '9' THEN
    RETURN NULL;
  END IF;
  IF length(numero) = 8 AND left(numero, 1) !~ '[2-5]' THEN
    RETURN NULL;
  END IF;

  RETURN '55' || national;
END;
$$;

-- ── Backfill ────────────────────────────────────────────────
UPDATE orders
SET cliente_tel = COALESCE(br_to_e164(cliente_tel), cliente_tel)
WHERE cliente_tel IS NOT NULL
  AND cliente_tel IS DISTINCT FROM COALESCE(br_to_e164(cliente_tel), cliente_tel);

UPDATE funcionarios
SET telefone = COALESCE(br_to_e164(telefone), telefone)
WHERE telefone IS NOT NULL
  AND telefone IS DISTINCT FROM COALESCE(br_to_e164(telefone), telefone);

-- ── Conferência ─────────────────────────────────────────────
-- Rode isto depois para ver se sobrou algo fora do padrão.
-- Um resultado vazio significa que está tudo normalizado.
--
--   SELECT 'orders' AS tabela, cliente_tel AS telefone FROM orders
--     WHERE cliente_tel IS NOT NULL AND cliente_tel !~ '^55\d{10,11}$'
--   UNION ALL
--   SELECT 'funcionarios', telefone FROM funcionarios
--     WHERE telefone IS NOT NULL AND telefone !~ '^55\d{10,11}$';
