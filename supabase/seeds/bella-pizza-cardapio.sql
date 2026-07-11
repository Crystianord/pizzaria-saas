-- ============================================================
-- SEED — Cardápio Bella Pizza Delivery
--
-- Abra o Supabase Dashboard → SQL Editor, cole este arquivo INTEIRO e execute.
-- Requer a migration 006-opcoes-adicionais.sql já aplicada.
--
-- Dados extraídos do cardápio real em bellapizzadelivery.gynfood.com.br:
--   3 categorias · 9 produtos · 27 sabores · 25 adicionais
--
-- Idempotente: apaga o catálogo anterior desta loja e recria.
-- NÃO apaga pedidos.
-- ============================================================

DO $$
DECLARE
  v_store   uuid;
  v_cat     uuid;
  v_prod    uuid;
  g_sabores uuid;
  g_portug  uuid;
  g_adic    uuid;
BEGIN

  SELECT id INTO v_store FROM stores WHERE slug = 'bella-pizza';
  IF v_store IS NULL THEN
    RAISE EXCEPTION 'Loja bella-pizza não encontrada';
  END IF;

  -- Limpa o catálogo anterior (pedidos ficam intactos)
  DELETE FROM product_option_groups WHERE store_id = v_store;
  DELETE FROM option_items          WHERE store_id = v_store;
  DELETE FROM option_groups         WHERE store_id = v_store;
  DELETE FROM promotions            WHERE store_id = v_store;
  DELETE FROM product_variants      WHERE store_id = v_store;
  DELETE FROM products              WHERE store_id = v_store;
  DELETE FROM categories            WHERE store_id = v_store;

  -- ── Grupos de opções ──────────────────────────────────────
  INSERT INTO option_groups (store_id, nome, tipo, ordem)
    VALUES (v_store, 'Escolha seu Sabor!', 'escolha', 0) RETURNING id INTO g_sabores;

  INSERT INTO option_groups (store_id, nome, tipo, ordem)
    VALUES (v_store, 'Sabor da Promoção', 'escolha', 1) RETURNING id INTO g_portug;

  INSERT INTO option_groups (store_id, nome, tipo, ordem)
    VALUES (v_store, 'Adicione Mais Sabor!', 'adicional', 2) RETURNING id INTO g_adic;

  -- ── Sabores (27) ──
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Portuguesa', 'Molho, mussarela, presunto, pimentão, azeitona, ovos, cebola e orégano', 0, 0);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Margherita', 'Molho, mussarela, tomate, azeitona e orégano', 0, 1);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Calabresa', 'Molho, mussarela, calabresa, cebola e orégano', 0, 2);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Três Queijos', 'Molho, mussarela, catupiry, cheddar, azeitona e orégano', 0, 3);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Lombo', 'Molho, mussarela, lombo, catupiry e orégano', 0, 4);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Grega', 'Molho, mussarela, lombo, azeitona, cebola e orégano', 0, 5);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Bacon', 'Molho, mussarela, bacon, milho e orégano', 0, 6);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Americana', 'Molho, mussarela, bacon, milho, ervilha, ovos e orégano', 0, 7);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Calabresa Especial', 'Molho, mussarela, calabresa, milho, azeitona, ovos e orégano', 0, 8);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Mussarela', 'Molho, mussarela, 2 camadas, tomate e orégano', 0, 9);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Vegetariana', 'Molho, mussarela, tomate, pimentão, milho, ervilha, azeitona, palmito e orégano', 0, 10);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Presunto', 'Molho, mussarela, presunto, tomate, milho e orégano', 0, 11);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Frango Catupiry', 'Molho, mussarela, frango, catupiry e orégano', 0, 12);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Frango Cheddar', 'Molho, mussarela, frango, cheddar e orégano', 0, 13);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Frango Batata', 'Molho, mussarela, frango, catupiry, batata palha e orégano', 0, 14);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Moda', 'Molho, mussarela, barbebcue, bacon, catupiry e orégano', 0, 15);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Belissima', 'Molho, mussarlea, frango, tomate, bacon e orégano', 0, 16);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Cheddar Bacon', 'Molho, mussarela, cheddar, bacon, palmito, batata palha e orégano', 0, 17);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Frango Especial', 'Molho, mussarela, frango, milho, palmito e orégano', 0, 18);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Calabacon', 'Molho, mussarela, calabresa, bacon, cebola e orégano', 0, 19);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Frango Bacon', 'Molho, frango, mussarela, bacon e orégano', 0, 20);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Chocolate M&M', 'Pizza com leite condensado, recheio de chocolate e confetes M&M.', 0, 21);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Brigadeiro', 'Pizza com leite condensado, recheio de chocolate e confetes de brigadeiro.', 0, 22);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Romeu e Julieta', 'Pizza com leite condensado, mussarela, goiabada e canela.', 0, 23);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Prestígio', 'Pizza com leite condensado, recheio de chocolate e coco ralado.', 0, 24);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Cocadinha', 'Pizza com leite condensado, mussarela e coco ralado.', 0, 25);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_sabores, v_store, 'Banana com Canela', 'Pizza com leite condensado, mussarela, banana e canela.', 0, 26);

  -- Sabor único da promoção de quarta
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_portug, v_store, 'Portuguesa', 'Molho, mussarela, presunto, pimentão, azeitona, ovos, cebola e orégano', 0, 0);

  -- ── Adicionais (25) ──
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Tomate', NULL, 5, 0);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Azeitona', NULL, 5, 1);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Cebola', NULL, 5, 2);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Cheddar', NULL, 5, 3);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Catupiry', NULL, 5, 4);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Milho', NULL, 5, 5);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Ervilha', NULL, 5, 6);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Ovo', NULL, 5, 7);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Pimentão', NULL, 5, 8);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Palmito', NULL, 5, 9);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Batata Palha', NULL, 5, 10);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Barbecue', NULL, 5, 11);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Leite condensado', NULL, 5, 12);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Coco ralado', NULL, 5, 13);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Granulado', NULL, 5, 14);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Banana', NULL, 5, 15);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Canela', NULL, 5, 16);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Confete', NULL, 8, 17);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Mussarela', NULL, 10, 18);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Bacon', NULL, 10, 19);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Presunto', NULL, 10, 20);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Lombo', NULL, 10, 21);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Frango', NULL, 10, 22);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Chocolate', NULL, 10, 23);
  INSERT INTO option_items (group_id, store_id, nome, descricao, preco_extra, ordem) VALUES (g_adic, v_store, 'ADD Calabresa', NULL, 10, 24);

  -- ════ Categoria: Pizzas ════
  INSERT INTO categories (store_id, nome, ordem) VALUES (v_store, 'Pizzas', 0) RETURNING id INTO v_cat;

  INSERT INTO products (store_id, category_id, nome, descricao, preco, ativo)
    VALUES (v_store, v_cat, 'Quarta-feira da Portuguesa', 'QUARTA IMPERDÍVEL! Pizza Grande de PORTUGUESA por apenas R$ 35. Não incluso refrigerante pedindo mais de 1 pizza. Somente na quarta-feira.', 40, true) RETURNING id INTO v_prod;
  INSERT INTO product_option_groups (product_id, group_id, store_id, min_selecao, max_selecao, ordem)
    VALUES (v_prod, g_portug, v_store, 1, 1, 0);
  INSERT INTO product_option_groups (product_id, group_id, store_id, min_selecao, max_selecao, ordem)
    VALUES (v_prod, g_adic, v_store, 0, 10, 1);
  INSERT INTO promotions (store_id, product_id, tipo, desconto_fixo, ativo, label)
    VALUES (v_store, v_prod, 'fixo', 5, true, 'Só na quarta');

  INSERT INTO products (store_id, category_id, nome, descricao, preco, ativo)
    VALUES (v_store, v_cat, 'Pizza Grande — 1 Sabor', 'Escolha 1 sabor entre os 27 disponíveis.', 40, true) RETURNING id INTO v_prod;
  INSERT INTO product_option_groups (product_id, group_id, store_id, min_selecao, max_selecao, ordem)
    VALUES (v_prod, g_sabores, v_store, 1, 1, 0);
  INSERT INTO product_option_groups (product_id, group_id, store_id, min_selecao, max_selecao, ordem)
    VALUES (v_prod, g_adic, v_store, 0, 10, 1);

  INSERT INTO products (store_id, category_id, nome, descricao, preco, ativo)
    VALUES (v_store, v_cat, '2 Pizzas + Refrigerante', '2 Pizzas Grande + 1 Refrigerante Crystal de 2 Litros.', 80, true) RETURNING id INTO v_prod;
  INSERT INTO product_option_groups (product_id, group_id, store_id, min_selecao, max_selecao, ordem)
    VALUES (v_prod, g_sabores, v_store, 2, 2, 0);
  INSERT INTO product_option_groups (product_id, group_id, store_id, min_selecao, max_selecao, ordem)
    VALUES (v_prod, g_adic, v_store, 0, 10, 1);

  INSERT INTO products (store_id, category_id, nome, descricao, preco, ativo)
    VALUES (v_store, v_cat, 'Pizza 2 Sabores — Metade/Metade', 'Escolha 2 sabores para sua pizza grande.', 45, true) RETURNING id INTO v_prod;
  INSERT INTO product_option_groups (product_id, group_id, store_id, min_selecao, max_selecao, ordem)
    VALUES (v_prod, g_sabores, v_store, 2, 2, 0);
  INSERT INTO product_option_groups (product_id, group_id, store_id, min_selecao, max_selecao, ordem)
    VALUES (v_prod, g_adic, v_store, 0, 10, 1);

  -- ════ Categoria: Promoções ════
  INSERT INTO categories (store_id, nome, ordem) VALUES (v_store, 'Promoções', 1) RETURNING id INTO v_cat;

  INSERT INTO products (store_id, category_id, nome, descricao, preco, ativo)
    VALUES (v_store, v_cat, 'Pizza Grande + Coca-Cola 2 Litros', '1 Pizza Grande (até 2 sabores) + Coca-Cola 2 Litros.', 49.99, true) RETURNING id INTO v_prod;
  INSERT INTO product_option_groups (product_id, group_id, store_id, min_selecao, max_selecao, ordem)
    VALUES (v_prod, g_sabores, v_store, 1, 2, 0);

  INSERT INTO products (store_id, category_id, nome, descricao, preco, ativo)
    VALUES (v_store, v_cat, '3 Pizzas Grande + Coca-Cola 2L', '3 Pizzas Grande + Coca-Cola 2 Litros.', 105, true) RETURNING id INTO v_prod;
  INSERT INTO product_option_groups (product_id, group_id, store_id, min_selecao, max_selecao, ordem)
    VALUES (v_prod, g_sabores, v_store, 3, 3, 0);

  INSERT INTO products (store_id, category_id, nome, descricao, preco, ativo)
    VALUES (v_store, v_cat, '5 Pizzas Grande + Coca-Cola 2L', '5 Pizzas Grande + Coca-Cola 2 Litros.', 199.99, true) RETURNING id INTO v_prod;
  INSERT INTO product_option_groups (product_id, group_id, store_id, min_selecao, max_selecao, ordem)
    VALUES (v_prod, g_sabores, v_store, 5, 5, 0);

  -- ════ Categoria: Refrigerantes ════
  INSERT INTO categories (store_id, nome, ordem) VALUES (v_store, 'Refrigerantes', 2) RETURNING id INTO v_cat;

  INSERT INTO products (store_id, category_id, nome, descricao, preco, ativo)
    VALUES (v_store, v_cat, 'Refrigerante Crystal 2 Litros', NULL, 8, true) RETURNING id INTO v_prod;

  INSERT INTO products (store_id, category_id, nome, descricao, preco, ativo)
    VALUES (v_store, v_cat, 'Coca-Cola 2 Litros', NULL, 15, true) RETURNING id INTO v_prod;

  -- Marca o setup do catálogo como concluído
  UPDATE stores SET catalog_setup_done = true WHERE id = v_store;

  RAISE NOTICE 'Cardápio da Bella Pizza criado com sucesso.';
END
$$;

-- ── Conferência ─────────────────────────────────────────────
--   SELECT c.nome AS categoria, p.nome AS produto, p.preco
--     FROM products p JOIN categories c ON c.id = p.category_id
--    WHERE p.store_id = (SELECT id FROM stores WHERE slug = 'bella-pizza')
--    ORDER BY c.ordem, p.nome;
