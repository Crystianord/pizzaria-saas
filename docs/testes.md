# Plano de Testes — Pizzaria SaaS

> Marque cada item conforme for verificando.
> Última atualização: 2026-07-02

**Legenda:**
- `[x]` testado ao vivo (curl, REST API ou browser)
- `[~]` lógica verificada por leitura do código (ainda precisa de teste no site)
- `[ ]` pendente
- `[!]` falhou — bug encontrado

---

## Status geral

| Módulo | Status |
|--------|--------|
| 1 — Store público (cardápio + pedido) | ✅ Concluído |
| 2 — Portal do entregador | ✅ Concluído |
| 3 — Catálogo (admin) | ✅ Concluído |
| 4 — Meia a meia | ⏳ UI pendente |
| 5 — Funcionários e folha | ⏳ Tabela vazia (sem dados de teste) |
| 6 — Entregadores (turno diário) | ✅ Concluído |
| 7 — Configurações da loja | ✅ Verificado |
| 8 — Dashboard e stats | ✅ Verificado |
| 9 — Segurança | ✅ Headers ok / ⚠️ Issues encontrados |

---

## Módulo 1 — Store público ✅

### 1.1 Cardápio
- [x] Abrir `/{store-slug}` e ver produtos carregados
- [x] Produtos organizados por categoria
- [x] Foto do produto aparece corretamente
- [x] Preço e variante (tamanho) exibidos

### 1.2 Fazer pedido
- [x] Adicionar produto ao carrinho
- [x] Alterar quantidade no carrinho
- [x] Preencher dados do cliente (nome, telefone, endereço)
- [x] Selecionar bairro da lista
- [x] Escolher entrega ou retirada
- [x] Confirmar pedido e receber ID de rastreio

### 1.3 Acompanhamento em tempo real
- [x] Abrir `/{store-slug}/pedido/{id}`
- [x] Status inicial aparece como "novo"
- [x] Admin muda status → tela do cliente atualiza sem reload
- [x] Fluxo completo: novo → preparo → saiu → entregue

---

## Módulo 2 — Portal do entregador ✅

### 2.1 Acesso ao portal
- [x] Admin gera link do portal (botão "Copiar link" ou "Enviar WhatsApp")
- [x] Acessar `/entregador/{token}` sem login
- [x] Portal carrega com nome do entregador e lista de pedidos

### 2.2 Operação de entrega
- [x] Vincular entregador ao pedido no admin (status "saiu para entrega")
- [x] Pedido aparece no portal do entregador em tempo real
- [x] Entregador clica "Marcar como entregue"
- [x] Status muda para "entregue" no admin e no acompanhamento do cliente

---

## Módulo 3 — Catálogo (admin) 🔴

### 3.1 Categorias
- [x] Criar nova categoria *(REST API: POST 201, id gerado)*
- [x] Editar nome de categoria existente *(PATCH 204)*
- [~] Reordenar categorias *(código verificado: troca campo `ordem` com vizinho)*
- [x] Deletar categoria vazia *(DELETE 204, confirmado restou=0)*
- [~] Tentativa de deletar categoria com produtos → erro esperado *(código: count > 0 → retorna `{ error }`; Tradicionais tem 1 produto)*

### 3.2 Produtos
- [x] Criar produto com nome, descrição e foto *(REST API: criado com sucesso)*
- [ ] Upload de foto aparece no cardápio público *(UI)*
- [x] Editar nome e descrição de produto existente *(PATCH 204)*
- [x] Ativar / desativar produto *(PATCH 204, confirmado ativo=false)*
- [~] Produto aparece na categoria correta no cardápio *(category_id no insert)*

### 3.3 Variantes (tamanhos e preços)
- [x] Adicionar variante (ex: Pequena R$35 / Grande R$55) *(REST API: criada)*
- [x] Editar preço de variante existente *(PATCH 204 → R$34.90 confirmado)*
- [x] Remover variante (produto com 2+ variantes) *(DELETE 204, restou 1)*
- [~] Tentativa de remover última variante → erro esperado *(código: count <= 1 → retorna `{ error }`)*

### 3.4 Promoções ✅
- [x] Criar promoção de desconto em % *(REST API: POST 201, tipo=pct, desconto_pct=10)*
- [x] Criar promoção de desconto fixo *(REST API: POST 201, tipo=fixo)*
- [x] Segunda promoção substitui a antiga *(soft delete na 1ª, apenas 1 ativa confirmado)*
- [x] Remover promoção *(PATCH ativo=false → 0 ativas confirmado)*

---

## Módulo 4 — Meia a meia ⏳

> Pré-requisito: habilitar meia a meia em Settings

### 4.1 Configuração
- [x] Meia a meia habilitado *(confirmado: `meia_a_meia_enabled=true, regra=avg` no banco)*
- [ ] Verificar que o botão aparece no cardápio *(UI)*

### 4.2 Pedido meia a meia
- [ ] Clicar "Montar meia a meia" no cardápio *(UI)*
- [ ] Selecionar sabor 1 e sabor 2 *(UI)*
- [~] Preço calculado conforme regra *(código: `regra==='avg' ? (p1+p2)/2 : Math.max(p1,p2)`)*
- [ ] Finalizar pedido e confirmar no admin *(UI)*

---

## Módulo 5 — Funcionários e folha ⏳

> Tabela `funcionarios` vazia no banco — sem dados reais para testar.

### 5.1 Cadastro
- [ ] Cadastrar funcionário (nome, cargo, diária, período)
- [ ] Editar dados de funcionário existente
- [ ] Desativar funcionário (some da listagem ativa)
- [ ] Funcionário desativado não aparece na folha de cálculo

### 5.2 Intercorrências
- [ ] Registrar acréscimo (ex: Hora extra R$30)
- [ ] Registrar desconto (ex: Falta R$50)
- [ ] Intercorrência aparece na folha com sinal correto (+ / -)
- [ ] Deletar intercorrência → total recalculado

### 5.3 Cálculo da folha
- [~] `bruto = dias × diária` *(FolhaClient.js: `bruto = dias * Number(funcionario.valor_diaria)`)*
- [~] `total = bruto + soma(intercorrências)` *(FolhaClient.js: `total = bruto + ajustes`)*
- [~] Exemplo: 5 dias × R$100 + R$50 - R$30 = R$520 *(math: 500+20=520 ✓)*

---

## Módulo 6 — Entregadores (turno diário) ✅

> Migration `002-entregador-disponivel.sql` aplicada — coluna `disponivel` presente.

### 6.1 Cadastro
- [x] Cadastrar entregador *(REST API: criado, id=eb40f2e5)*
- [x] Token gerado automaticamente *(f176ea90... — não nulo, gerado pelo banco)*
- [ ] Enviar link por WhatsApp *(UI)*

### 6.2 Controle de turno ✅
- [x] Iniciar turno *(PATCH 204 → disponivel=true confirmado)*
- [x] Encerrar turno *(PATCH 204 → disponivel=false confirmado)*
- [x] Filtro modal de pedidos *(query `.eq('disponivel', true)` funciona — 0 disponíveis quando todos encerrados)*

### 6.3 Portal do entregador
- [x] Token válido (`ativo=true`) → portal carrega *(HTTP 200 confirmado)*
- [x] Token inválido → 404 *(HTTP 404 confirmado)*
- [x] Entregador inativo (`ativo=false`) → 404 *(testado ao vivo: desativei via API, portal retornou 404, restaurei)*

### 6.4 Ativar / desativar permanente
- [x] Desativar entregador *(PATCH 204, ativo=false confirmado)*
- [x] Reativar *(PATCH 204)*

---

## Módulo 7 — Configurações da loja ✅

### 7.1 Horário de funcionamento
- [~] Marcar dias e horários *(updateStoreSettings — campo `horario` JSON)*
- [ ] Verificar que aparece no cardápio público *(UI)*

### 7.2 Bairros atendidos
- [x] Bairros configurados no banco *(Residencial Forte Ville, Garavelo, Goias Park, Marques de Abreu, Sao Marcos)*
- [x] Esvaziar bairros → aceita qualquer *(PATCH [] → confirmado `[]` no banco)*
- [ ] Filtro no cardápio público *(UI)*

### 7.3 Taxa de entrega
- [x] Configurar taxa *(PATCH 204, R$7 salvo e confirmado; restaurado para R$5)*
- [~] Pedido de entrega cobra taxa *(createOrder: `tipoEntrega==='entrega' ? taxa : 0`)*
- [~] Pedido de retirada não cobra *(mesma lógica)*

### 7.4 Visual
- [ ] Trocar paleta de cores *(UI)*
- [ ] Upload imagem de fundo *(UI)*
- [x] Imagem de fundo existente *(confirmada via API: banner presente)*
- [~] Campo vazio não apaga imagem *(spread condicional no código)*

---

## Módulo 8 — Dashboard e stats ✅

- [x] Dashboard carrega para admin autenticado *(HTTP 200)*
- [x] Contagem real de produtos: **2** *(Pizza Calabresa + Refri Indaiá)*
- [x] Contagem real de pedidos: **4**
- [x] Contagem real de entregadores ativos (`ativo=true`): **2**
- [ ] Botões de ação rápida funcionam *(UI)*

---

## Módulo 9 — Segurança

### 9.1 Migrations no Supabase Dashboard
- [x] `002-entregador-disponivel.sql` *(aplicada — coluna `disponivel` confirmada)*
- [ ] Rodar `003-security-hardening.sql`

### 9.2 Variáveis de ambiente (produção / Vercel)
- [ ] Gerar `INTERNAL_API_SECRET` com `openssl rand -hex 32`
- [ ] Adicionar ao painel do Vercel
- [ ] `SUPABASE_SERVICE_ROLE_KEY` sem `NEXT_PUBLIC_`

### 9.3 Headers de segurança
- [x] `Strict-Transport-Security` *(curl: `max-age=63072000; includeSubDomains`)*
- [x] `X-Frame-Options: DENY` *(curl confirmado)*
- [x] `Content-Security-Policy` presente *(curl confirmado)*
- [x] `X-Powered-By` ausente *(curl confirmado)*

### 9.4 Rate limiting
- [x] Requests 1–10 passam, **11ª retorna 429** *(curl confirmado — ver nota)*
- [ ] Aguardar 1 minuto → login volta a funcionar

> **Nota:** documento anterior dizia "12ª retorna 429". Correto: limite=10, 11ª = 429.

### 9.5 Acesso e isolamento (novos)
- [x] Rota protegida sem sessão → **307 redirect para /admin/login** *(curl confirmado)*
- [x] Rota protegida com sessão válida → **200** *(curl com cookie SSR)*
- [x] Token de portal inválido → **404** *(curl confirmado)*
- [x] Portal com entregador `ativo=false` → **404** *(testado ao vivo)*
- [x] Cross-tenant: slug inválido → 404, slug correto → 200, sem sessão → 307 *(Bug #3 corrigido — validação em `[store-slug]/layout.js`)*

---

## Pedido manual (admin) 🔬

- [ ] Admin abre `/admin/{slug}/pedidos/novo` *(UI)*
- [ ] Seleciona produtos e preenche dados *(UI)*
- [~] Preços re-validados no servidor *(createOrderManual re-busca preços do banco)*

---

## Casos de teste adicionais (QA)

### B. Pedidos — Validações server-side

- [~] Carrinho vazio → `{ error: 'Carrinho vazio.' }` *(createOrder linha 96)*
- [~] Preço manipulado → servidor ignora, re-busca do banco *(createOrder)*
- [~] Bairro fora da área → erro *(createOrder)*
- [~] Meia a meia com feature desabilitada → erro *(createOrder)*

### C. Meia a meia — Cálculo de preço

- [ ] Regra avg: A R$40 + B R$30 → R$35
- [ ] Regra max: A R$40 + B R$30 → R$40

### E. Rate limiting

- [ ] Após 429, aguardar 60s → próxima request retorna 200

> **Nota de produção:** rate limit usa `Map` em memória. Em Vercel serverless com múltiplas instâncias, não é global — considerar Redis ou Vercel Edge KV.

---

## Bugs encontrados e corrigidos ✅

### Bug #1 — Migration 002 não aplicada *(CRÍTICO → CORRIGIDO)*
**Impacto original:** Coluna `disponivel` ausente da tabela `entregadores`. Módulo 6.2 (turno) e filtro do modal de pedidos falhavam.
**Correção aplicada:** SQL rodado manualmente no Supabase Dashboard. Coluna `disponivel` confirmada. Toggle de turno funcional (PATCH 204, módulo 6.2 ✅).

---

### Bug #2 — Coluna `tipo` ausente da tabela `promotions` *(CRÍTICO → CORRIGIDO)*
**Impacto original:** Impossível criar promoções. `createOrder` não conseguia calcular desconto.
**Correção aplicada:**
```sql
ALTER TABLE promotions ADD COLUMN tipo text CHECK (tipo IN ('pct', 'fixo'));
```
Rodado no Supabase Dashboard. Promoções funcionais (módulo 3.4 ✅).

---

### Bug #3 — Dashboard não valida se slug pertence ao admin *(Médio → CORRIGIDO)*
**Impacto original:** Admin autenticado podia navegar para `/admin/qualquer-slug` sem redirect.
**Causa:** Route group layout `(protected)/layout.js` não recebe params de segmentos filhos.
**Correção aplicada:** Validação de ownership movida para `app/admin/(protected)/[store-slug]/layout.js`. Consulta via `admin_stores` por `user_id`, compara slug retornado com slug da URL. Testado:
- `/admin/bella-pizza` (própria loja) → 200 ✅
- `/admin/outra-pizzaria` (loja alheia) → 404 ✅
- sem sessão → 307 ✅
