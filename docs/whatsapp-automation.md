# WhatsApp Automation — Arquitetura (n8n + Evolution API self-hosted)

> **Status:** documento de arquitetura. Nada disso está implementado ainda.
> **Substitui** o rascunho anterior deste arquivo (que assumia Railway / n8n Cloud).
> Agora tudo roda **self-hosted numa VPS própria**, 24/7, sem mensalidade de n8n.

---

## 0. Decisões de arquitetura (o "porquê" antes do "como")

| Decisão | Escolha | Motivo |
|---|---|---|
| Onde roda | **VPS única, Docker Compose** | Sem n8n Cloud (mensalidade), sem Railway. Um único `docker compose up -d` sobe tudo. |
| Como o app avisa o n8n | **Supabase Database Webhooks** (não Realtime, não Server Action) | Server Actions rodam serverless na Vercel — um `fetch()` fire-and-forget pode ser morto antes de completar. O DB webhook é disparado pelo Postgres, é confiável e **não exige nenhuma mudança no código do app**. |
| Como o n8n lê dados | REST do Supabase com **service_role** | O bot precisa ler `orders`/`order_items`, e a policy `orders_select_anon_recent` só libera 24h para anon. Service role bypassa RLS. A key fica só na VPS. |
| Um número por loja | **Uma instância Evolution por store** | Multi-tenant: cada restaurante tem o próprio chip/número. Exige tabela nova de config (§4). |
| Auth n8n ↔ Next.js | **`lib/internal-token.js`** (HMAC, já existe e está sem uso) | Já pronto no repo, com anti-replay de 30s. Só precisa de um Route Handler que o consuma. |

---

## 1. Visão geral

```
                        ┌──────────────────────────────────────────┐
                        │              VPS (Ubuntu)                 │
                        │                                           │
  CLIENTE               │   ┌─────────┐                             │
  (WhatsApp) ◄──────────┼──►│Evolution│◄───┐                        │
                        │   │  API    │    │ envia msg              │
                        │   └────┬────┘    │                        │
                        │        │ webhook │                        │
                        │        │ (msg    │                        │
                        │        │ recebida)│                       │
                        │        ▼         │                        │
                        │   ┌──────────────┴──┐                     │
   SUPABASE ────────────┼──►│      n8n        │────────┐            │
   (DB Webhook:         │   │  (orquestrador) │        │            │
    orders INSERT/      │   └────────┬────────┘        │            │
    UPDATE)             │            │                 │            │
                        │            │ lê dados        │            │
                        │   ┌────────▼────────┐        │            │
                        │   │ Postgres│ Redis │        │            │
                        │   └─────────────────┘        │            │
                        │   ┌─────────────────┐        │            │
                        │   │ Caddy (TLS)     │        │            │
                        │   └─────────────────┘        │            │
                        └──────────────────────────────┼────────────┘
                                                       │ REST (service_role)
                                                       ▼
                                                  SUPABASE
```

Dois sentidos de tráfego, independentes:

- **Outbound (app → cliente):** Supabase detecta mudança em `orders` → webhook → n8n → Evolution → WhatsApp do cliente.
- **Inbound (cliente → app):** Cliente manda msg → Evolution → webhook → n8n → consulta Supabase → responde via Evolution.

---

## 2. Infraestrutura na VPS

### 2.1 Requisitos mínimos

| Recurso | Mínimo | Recomendado | Nota |
|---|---|---|---|
| RAM | 2 GB | **4 GB** | Evolution (Baileys) segura a sessão do WhatsApp em memória; n8n + Postgres + Redis somam. Com 2 GB você vive no limite e o OOM killer derruba a sessão do WhatsApp — o que exige reescanear o QR. Não economize aqui. |
| vCPU | 2 | 2 | |
| Disco | 40 GB SSD | 60 GB | Evolution guarda mídia; n8n guarda histórico de execuções. |
| SO | Ubuntu 22.04/24.04 LTS | | |
| Domínio | 1 (com 2 subdomínios) | | `n8n.seudominio.com` e `evo.seudominio.com` |

Provedores no Brasil (latência menor pro WhatsApp/Supabase): Hostinger, Contabo, Magalu Cloud, Hetzner (EUA/DE mas barato).

### 2.2 Stack — `docker-compose.yml`

> ⚠️ **Verificar as versões e os nomes de env vars contra a doc oficial na hora de implantar** — a Evolution API muda env vars entre minors. Este compose é o desenho, não o gospel.

```yaml
# /opt/cardapp-automation/docker-compose.yml
services:

  # ── Reverse proxy + TLS automático (Let's Encrypt) ──────────────
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks: [cardapp]

  # ── Banco compartilhado (n8n + evolution, schemas separados) ────
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${PG_USER}
      POSTGRES_PASSWORD: ${PG_PASSWORD}
      POSTGRES_DB: postgres
      TZ: America/Sao_Paulo
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./init-dbs.sh:/docker-entrypoint-initdb.d/init-dbs.sh:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${PG_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks: [cardapp]

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      retries: 5
    networks: [cardapp]

  # ── Evolution API (WhatsApp) ────────────────────────────────────
  evolution:
    image: atendai/evolution-api:v2.1.1   # pin a versão; não use :latest
    restart: unless-stopped
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_healthy }
    environment:
      SERVER_URL: https://evo.${DOMAIN}
      AUTHENTICATION_API_KEY: ${EVOLUTION_API_KEY}   # chave mestra global
      TZ: America/Sao_Paulo

      DATABASE_ENABLED: "true"
      DATABASE_PROVIDER: postgresql
      DATABASE_CONNECTION_URI: postgresql://${PG_USER}:${PG_PASSWORD}@postgres:5432/evolution
      DATABASE_SAVE_DATA_INSTANCE: "true"
      DATABASE_SAVE_DATA_NEW_MESSAGE: "true"
      DATABASE_SAVE_MESSAGE_UPDATE: "true"

      CACHE_REDIS_ENABLED: "true"
      CACHE_REDIS_URI: redis://redis:6379/6
      CACHE_REDIS_SAVE_INSTANCES: "true"

      # Webhook global — todas as instâncias mandam evento pro mesmo n8n,
      # que separa por `instance` no payload.
      WEBHOOK_GLOBAL_ENABLED: "true"
      WEBHOOK_GLOBAL_URL: https://n8n.${DOMAIN}/webhook/wa-inbound
      WEBHOOK_EVENTS_MESSAGES_UPSERT: "true"
      WEBHOOK_EVENTS_CONNECTION_UPDATE: "true"
      # desligue o resto — menos ruído, menos execução gasta no n8n
    volumes:
      - evolution_instances:/evolution/instances
    networks: [cardapp]

  # ── n8n (orquestrador) ──────────────────────────────────────────
  n8n:
    image: n8nio/n8n:latest
    restart: unless-stopped
    depends_on:
      postgres: { condition: service_healthy }
    environment:
      DB_TYPE: postgresdb
      DB_POSTGRESDB_HOST: postgres
      DB_POSTGRESDB_DATABASE: n8n
      DB_POSTGRESDB_USER: ${PG_USER}
      DB_POSTGRESDB_PASSWORD: ${PG_PASSWORD}

      N8N_HOST: n8n.${DOMAIN}
      N8N_PROTOCOL: https
      WEBHOOK_URL: https://n8n.${DOMAIN}/
      N8N_EDITOR_BASE_URL: https://n8n.${DOMAIN}/

      # Sem isso, credenciais salvas viram lixo se o container recriar.
      # Gere UMA vez e NUNCA mude: openssl rand -hex 32
      N8N_ENCRYPTION_KEY: ${N8N_ENCRYPTION_KEY}

      N8N_BASIC_AUTH_ACTIVE: "true"
      N8N_BASIC_AUTH_USER: ${N8N_USER}
      N8N_BASIC_AUTH_PASSWORD: ${N8N_PASSWORD}

      # A API pública é o que nos deixa criar os workflows por código depois.
      N8N_PUBLIC_API_DISABLED: "false"

      GENERIC_TIMEZONE: America/Sao_Paulo
      TZ: America/Sao_Paulo

      # Poda o histórico — sem isso o Postgres incha até encher o disco.
      EXECUTIONS_DATA_PRUNE: "true"
      EXECUTIONS_DATA_MAX_AGE: "336"        # 14 dias
    volumes:
      - n8n_data:/home/node/.n8n
    networks: [cardapp]

  # ── Monitoramento (opcional mas recomendado) ────────────────────
  uptime-kuma:
    image: louislam/uptime-kuma:1
    restart: unless-stopped
    volumes:
      - kuma_data:/app/data
    networks: [cardapp]

volumes:
  pg_data: {}
  redis_data: {}
  evolution_instances: {}
  n8n_data: {}
  caddy_data: {}
  caddy_config: {}
  kuma_data: {}

networks:
  cardapp: {}
```

**Ponto crítico:** nenhum serviço expõe porta pro host além do Caddy. Postgres, Redis, n8n e Evolution só existem dentro da rede `cardapp`. Isso é o que impede alguém de varrer a internet e achar sua Evolution API aberta.

### 2.3 `Caddyfile` (TLS automático)

```
n8n.{$DOMAIN} {
    reverse_proxy n8n:5678
}

evo.{$DOMAIN} {
    reverse_proxy evolution:8080
}
```

Só isso. O Caddy pega certificado Let's Encrypt e renova sozinho.

### 2.4 `init-dbs.sh` (cria os 2 bancos)

```bash
#!/bin/bash
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE n8n;
    CREATE DATABASE evolution;
EOSQL
```

### 2.5 `.env` da VPS (nunca versionar)

```bash
DOMAIN=seudominio.com.br

PG_USER=cardapp
PG_PASSWORD=              # openssl rand -hex 24

EVOLUTION_API_KEY=        # openssl rand -hex 32  — chave mestra da Evolution
N8N_ENCRYPTION_KEY=       # openssl rand -hex 32  — NUNCA mude depois de criado
N8N_USER=admin
N8N_PASSWORD=             # senha forte

# Segredos compartilhados com o app/Supabase
SUPABASE_URL=https://nrehmmrncratidtglvjb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_WEBHOOK_SECRET=  # openssl rand -hex 32 — valida webhooks do Supabase
INTERNAL_API_SECRET=      # mesmo valor do .env da Vercel
```

### 2.6 Rodar 24/7 de verdade

`restart: unless-stopped` cobre crash de container. Falta cobrir reboot da VPS e falha silenciosa:

```bash
# 1. Docker sobe no boot
sudo systemctl enable docker

# 2. Compose sobe no boot (systemd unit)
sudo tee /etc/systemd/system/cardapp.service <<'EOF'
[Unit]
Description=Cardapp Automation Stack
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/cardapp-automation
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable cardapp.service
```

**Firewall** — só 22/80/443 abertos:
```bash
sudo ufw default deny incoming
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable
```

**Backup** (cron diário — sem isso, perder o volume = reescanear todos os QR codes e perder todos os workflows):
```bash
# /etc/cron.d/cardapp-backup
0 4 * * * root cd /opt/cardapp-automation && \
  docker compose exec -T postgres pg_dumpall -U cardapp | gzip > /opt/backups/pg-$(date +\%F).sql.gz && \
  find /opt/backups -name 'pg-*.sql.gz' -mtime +14 -delete
```
> Mande o backup pra fora da VPS também (rclone → S3/Backblaze). Backup que só existe na máquina que pode morrer não é backup.

**Monitoramento:** Uptime Kuma monitorando `https://evo.SEUDOMINIO/instance/connectionState/{instancia}` — se o WhatsApp desconectar (celular sem internet, chip banido, sessão expirada), você é avisado. **Isso é o modo de falha mais comum e mais silencioso da stack.** Sem alerta, você só descobre quando um cliente reclama que não recebeu confirmação.

---

## 3. ⚠️ Bloqueadores — corrigir ANTES de automatizar

Levantados na leitura do código. Não são opcionais.

### 3.1 BUG: `marcarEntregue` está quebrado (migration 004 incompleta)

`app/entregador/_actions/orders.js` ainda usa as colunas legadas:
```js
.from('entregadores')            // :10  — tabela morta pós-004
.eq('entregador_id', entregador.id)   // :22  — coluna morta; agora é funcionario_id
```
Mas `app/entregador/[token]/page.js` já lê de `funcionarios` / `funcionario_id`. Resultado: **o botão "Confirmar entrega" do portal do entregador não atualiza nada** — o UPDATE casa com 0 linhas e a função retorna `{success:true}` mesmo assim (não checa `count`).

**Impacto na automação:** a notificação de "pedido entregue" nunca dispararia por esse caminho. Corrigir antes.

### 3.2 Não existe normalizador de telefone

Hoje cada lugar faz `'55' + tel.replace(/\D/g,'')`. Se o usuário digitar `+55 62 …` vira `5555…` — número inválido. E `cliente_tel` **não é validado como telefone** (aceita qualquer string de até 20 chars).

**Precisa de:** `lib/phone.js` com `toE164(raw)` — remove não-dígitos, remove `55`/`0055` duplicado, valida DDD (11–99), trata celular 8 vs 9 dígitos, retorna `null` se inválido. Usado no app (validação no `createOrder`) e replicado no n8n.

### 3.3 Timezone

`isOpen()` em `app/[store-slug]/page.js:6-23` roda em `new Date()` = hora local do servidor. Na Vercel isso é **UTC**. Um restaurante que abre 18h–23h aparece como fechado/aberto na hora errada. Todo container da VPS já leva `TZ=America/Sao_Paulo` no compose, mas **o app na Vercel também precisa ser corrigido** — senão o bot e o site discordam sobre a loja estar aberta.

---

## 4. Modelo de dados — migration nova

`supabase/migrations/005-whatsapp.sql`:

```sql
-- ============================================================
-- 005 — WhatsApp Automation
-- ============================================================

-- ── Config da instância Evolution por loja ──────────────────
-- NÃO vai em `stores` porque stores tem policy pública de SELECT
-- (rls.sql:35 → USING (true)). A api_key vazaria pro mundo.
CREATE TABLE store_whatsapp_config (
  store_id          uuid PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  instance_name     text NOT NULL UNIQUE,      -- ex: 'bella-pizza'
  phone_e164        text,                      -- 5562999999999 (preenchido ao conectar)
  connection_status text NOT NULL DEFAULT 'disconnected',
                    -- disconnected | connecting | connected
  enabled           boolean NOT NULL DEFAULT false,
  notify_on_create   boolean NOT NULL DEFAULT true,
  notify_on_preparo  boolean NOT NULL DEFAULT true,
  notify_on_caminho  boolean NOT NULL DEFAULT true,
  notify_on_entregue boolean NOT NULL DEFAULT true,
  notify_on_cancel   boolean NOT NULL DEFAULT true,
  chatbot_enabled    boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE store_whatsapp_config ENABLE ROW LEVEL SECURITY;

-- Admin só vê/edita a config da própria loja. anon NÃO tem policy = zero acesso.
CREATE POLICY "wa_config_admin" ON store_whatsapp_config
  FOR ALL TO authenticated
  USING     (store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid()))
  WITH CHECK(store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid()));

-- ── Log + idempotência de mensagens ─────────────────────────
-- A razão de existir: o webhook do Supabase pode reentregar o mesmo evento.
-- Sem a UNIQUE abaixo, o cliente recebe "seu pedido saiu pra entrega" 3x.
CREATE TABLE whatsapp_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_id     uuid REFERENCES orders(id) ON DELETE SET NULL,
  direction    text NOT NULL,              -- inbound | outbound
  event_type   text,                       -- order_created | status_preparo | ...
  to_phone     text,
  body         text,
  status       text NOT NULL DEFAULT 'pending', -- pending|sent|failed
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Chave de idempotência: 1 mensagem por (pedido, evento). Segunda tentativa
-- de inserir estoura conflito e o n8n aborta o envio.
CREATE UNIQUE INDEX whatsapp_messages_idem
  ON whatsapp_messages (order_id, event_type)
  WHERE direction = 'outbound' AND order_id IS NOT NULL;

CREATE INDEX whatsapp_messages_store_created
  ON whatsapp_messages (store_id, created_at DESC);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_messages_admin_read" ON whatsapp_messages
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT store_id FROM admin_stores WHERE user_id = auth.uid()));
-- writes: só service_role (n8n). Sem policy pra anon/authenticated = negado.
```

**Como a idempotência funciona no fluxo:** antes de mandar, o n8n faz `INSERT INTO whatsapp_messages (order_id, event_type, ...) VALUES (...)`. Se o índice único estourar (409), **é reentrega — aborta e não manda**. Se inserir, manda e faz `UPDATE ... SET status='sent'`. Simples e à prova de retry.

---

## 5. O gatilho: Supabase Database Webhook

No painel do Supabase → **Database → Webhooks**:

| Campo | Valor |
|---|---|
| Nome | `orders-to-n8n` |
| Tabela | `orders` |
| Eventos | `INSERT`, `UPDATE` |
| Tipo | HTTP Request → POST |
| URL | `https://n8n.SEUDOMINIO/webhook/order-event` |
| Header | `x-webhook-secret: {SUPABASE_WEBHOOK_SECRET}` |

Payload que o Postgres manda:
```json
{
  "type": "UPDATE",
  "table": "orders",
  "schema": "public",
  "record":     { "id": "...", "status": "a_caminho", "store_id": "...", "cliente_tel": "...", "cliente_nome": "...", "total": 89.9, "entregador_nome": "João", ... },
  "old_record": { "id": "...", "status": "em_preparo", ... }
}
```

**Duas coisas que o n8n obrigatoriamente faz com isso:**

1. **Valida o header** `x-webhook-secret`. Sem isso, qualquer um na internet dispara mensagens em nome da sua loja.
2. **Compara `record.status` vs `old_record.status`.** O webhook dispara em **toda** UPDATE — inclusive as que não mexem no status. Se você não comparar, o cliente leva spam a cada edição de pedido.

> O `record` **não traz os itens do pedido nem o nome da loja**. O n8n busca `order_items` + `stores` via REST com service_role quando a mensagem precisa deles.

---

## 6. Os fluxos (workflows do n8n)

### F1 — Notificações de pedido (outbound) ⭐ maior valor

Hoje o cliente **nunca** é avisado de nada. Ele só descobre o status se abrir o link de rastreio. Este fluxo é o que muda o jogo.

```
[Webhook /order-event]
   │
[IF] header x-webhook-secret confere?  ──não──► [Stop]
   │ sim
[IF] type=INSERT  OU  record.status ≠ old_record.status ?  ──não──► [Stop]
   │ sim
[Switch] evento:
   ├─ INSERT              ──► event_type = order_created
   ├─ status = em_preparo ──► event_type = status_preparo
   ├─ status = a_caminho  ──► event_type = status_caminho
   ├─ status = entregue   ──► event_type = status_entregue
   └─ status = cancelado  ──► event_type = status_cancelado
   │
[HTTP] Supabase: GET store_whatsapp_config?store_id=eq.{store_id}
   │
[IF] enabled = true E notify_on_{evento} = true E connection_status='connected'? ──não──► [Stop]
   │ sim
[HTTP] Supabase: GET stores?id=eq.{store_id}&select=nome,slug
[HTTP] Supabase: GET order_items?order_id=eq.{id}     ← só se o template usar itens
   │
[Function] normaliza telefone → E164   ──inválido──► [Log + Stop]
   │
[HTTP] Supabase: POST whatsapp_messages  (idempotência)  ──409 conflito──► [Stop: já enviado]
   │ 201
[Function] monta o texto pelo template
   │
[HTTP] Evolution: POST /message/sendText/{instance_name}
   │
[HTTP] Supabase: PATCH whatsapp_messages status='sent'   (ou 'failed' + erro)
```

**Templates** (sem emoji, alinhado com a UI):

`order_created` →
```
*Pedido confirmado — {loja}*

Olá, {cliente}! Recebemos seu pedido.

Pedido: #{id_curto}
Total: R$ {total}

Acompanhe em tempo real:
{app_url}/{slug}/pedido/{id}
```

`status_preparo` →
```
Seu pedido já está sendo preparado, {cliente}.

Acompanhe: {app_url}/{slug}/pedido/{id}
```

`status_caminho` (entrega) →
```
*Seu pedido saiu para entrega!*

{cliente}, o {entregador_nome} está a caminho com seu pedido.

Acompanhe: {app_url}/{slug}/pedido/{id}
```

`status_caminho` (retirada) →
```
{cliente}, seu pedido está pronto para retirada!

Pode vir buscar. Até já.
```
> Note o `if tipo_entrega`: mandar "saiu para entrega" pra quem escolheu retirada é o tipo de erro que destrói a confiança no bot.

`status_entregue` →
```
Pedido entregue, {cliente}!

Obrigado pela preferência. Até a próxima.
```

`status_cancelado` →
```
{cliente}, seu pedido #{id_curto} foi cancelado.

Qualquer dúvida, é só chamar aqui.
```

### F2 — Chatbot de atendimento (inbound)

```
[Webhook /wa-inbound]  ← Evolution manda todo MESSAGES_UPSERT
   │
[IF] fromMe = true ? ──sim──► [Stop]      (senão o bot responde a si mesmo — loop infinito)
[IF] é grupo (@g.us)? ──sim──► [Stop]
   │
[Function] extrai: instance, telefone (remoteJid), texto
   │
[HTTP] Supabase: store_whatsapp_config?instance_name=eq.{instance}
   │  (é assim que se descobre DE QUAL LOJA é a mensagem — multi-tenant)
[IF] chatbot_enabled? ──não──► [Stop]
   │
[HTTP] Supabase: stores?id=eq.{store_id}  (nome, slug, taxa, bairros, horario)
   │
[Switch] intenção por palavra-chave:
   ├─ saudação  ──► menu de opções
   ├─ cardápio  ──► link da loja
   ├─ entrega   ──► lista bairros_atendidos + taxa
   ├─ taxa      ──► taxa_entrega
   ├─ horário   ──► formata horario JSON + diz se está aberto AGORA
   ├─ pedido    ──► busca último pedido por cliente_tel (24h) → manda link/status
   ├─ humano    ──► marca conversa como "atendimento humano" e silencia o bot 30min
   └─ fallback  ──► menu de opções
   │
[HTTP] Evolution: POST /message/sendText/{instance}
```

**Palavras-chave por intenção**

| Intenção | Gatilhos |
|---|---|
| Saudação | oi, ola, olá, bom dia, boa tarde, boa noite, eai, opa |
| Cardápio | cardapio, cardápio, menu, produto, ver, quero pedir, pedir |
| Entrega | entrega, entregam, bairro, regiao, região, endereco, endereço |
| Taxa | taxa, frete, quanto custa, valor da entrega, gratis, grátis |
| Horário | horario, horário, hora, funciona, aberto, fechado, abre, fecha |
| Pedido | pedido, acompanhar, rastrear, cade, cadê, onde esta, status |
| Humano | atendente, humano, pessoa, falar com alguem, ajuda |

**O `[Switch]` deve ser ordenado por especificidade** — "quanto custa a *entrega*" casa com `entrega` E `taxa`. Ordene taxa antes de entrega, ou use regex mais estrita.

**"Pedido" precisa de cuidado:** buscar por `cliente_tel` exige que o telefone do WhatsApp bata com o digitado no site. Como hoje `cliente_tel` é texto livre sem normalização (§3.2), **essa busca vai falhar na maioria das vezes até o normalizador existir**. É a dependência mais concreta entre o §3 e o bot.

**Anti-loop e anti-flood** (não são opcionais):
- Ignore `fromMe`. Sem isso o bot conversa com ele mesmo pra sempre.
- Ignore grupos.
- Rate-limit por número: máx ~1 resposta a cada 3s (Redis).
- Se o cliente pedir "humano", **cale o bot** por 30min pra ele não atropelar o dono respondendo.

### F3 — Notificação de entregador (novo)

Quando `status → a_caminho` com `funcionario_id` setado, mandar pro entregador (o `funcionarios.telefone` já existe):

```
*Nova entrega atribuída*

Pedido #{id_curto}
Cliente: {cliente_nome}
Endereço: {endereco}, {bairro}
Total: R$ {total}

Suas entregas: {app_url}/entregador/{token}
```
Sai do mesmo webhook do F1 (branch paralela no `status_caminho`).

### F4 — Substituir os `wa.me` manuais (mais tarde)

Hoje existem 3 links manuais que o dono clica: resumo de turno do entregador (`RelatorioClient.js`), folha de pagamento (`FolhaClient.js`) e link do portal (`EntregadoresClient.js`). Os textos já estão prontos no código — dá pra migrar pra envio real via API.

**Mas isso é prioridade baixa e eu recomendo deixar como está por enquanto.** Clicar em `wa.me` funciona, é zero-risco e o dono está no controle. Automatizar só troca um clique por um risco de ban. Faça depois que o F1/F2 estiverem estáveis.

---

## 7. Mudanças necessárias no código Next.js

O F1 e o F2 **não exigem nenhuma mudança de código** (o gatilho é DB webhook, o bot lê direto do Supabase). O que precisa de código é a **UI de configuração** — sem ela o dono não consegue conectar o próprio WhatsApp.

| # | O quê | Onde |
|---|---|---|
| 1 | `lib/phone.js` — `toE164()` (§3.2) | novo |
| 2 | Validar `cliente_tel` com ele no `createOrder` e `createOrderManual` | `app/store/_actions/orders.js`, `app/admin/_actions/orders.js` |
| 3 | Corrigir `marcarEntregue` (§3.1) | `app/entregador/_actions/orders.js` |
| 4 | Fixar timezone do `isOpen()` (§3.3) | `app/[store-slug]/page.js` |
| 5 | **Aba "WhatsApp" nas configurações** — mostrar QR code, status da conexão, toggles de notificação | `app/admin/(protected)/[store-slug]/settings/` |
| 6 | Server Actions: `createInstance` / `getQrCode` / `getStatus` / `disconnect` | `app/admin/_actions/whatsapp.js` (novo) |
| 7 | Route Handler pro n8n consultar o app (se precisar) — usar `requireInternalAuth` | `app/api/internal/*/route.js` (novo) |

**Item 5/6 é o coração da experiência multi-tenant:** o dono entra em Configurações → WhatsApp → clica "Conectar" → o app chama a Evolution (`POST /instance/create`), recebe o QR code em base64, mostra na tela → o dono escaneia com o celular do restaurante → pronto. A `EVOLUTION_API_KEY` fica **só no servidor** (Server Action), nunca no browser.

---

## 8. Riscos (leia antes de escanear o primeiro QR)

| Risco | Gravidade | Mitigação |
|---|---|---|
| **Ban do número pelo WhatsApp** | **Alta** | Evolution usa Baileys = WhatsApp Web não-oficial. A Meta pode banir. **Nunca use seu número pessoal.** Use um chip dedicado, "esquente" ele (uso normal por alguns dias antes de automatizar), não mande em massa, só responda a quem falou primeiro ou a quem fez pedido (mensagem transacional). |
| Sessão cai sozinha | Alta (frequente) | Uptime Kuma no `connectionState` + alerta. Precisa reescanear o QR. É o custo de não usar a API oficial. |
| Webhook reentregue → mensagem duplicada | Média | Índice único em `whatsapp_messages` (§4). |
| Spam por UPDATE que não mudou status | Média | Comparar `record.status` vs `old_record.status` (§5). |
| `service_role` vazando | **Crítica** | Só na `.env` da VPS. **Nunca** no browser, nunca no repo, nunca com prefixo `NEXT_PUBLIC_`. |
| LGPD | Média | Mensagem **transacional** (o cliente deu o telefone pra receber o pedido) é legítimo interesse. **Marketing/promo em massa exige opt-in explícito** — e é exatamente o que mais causa ban. Não faça broadcast. |
| Loop infinito bot↔bot | Alta | Ignorar `fromMe` (§F2). |

> **Se o número for banido, o restaurante fica sem WhatsApp.** Para um negócio que vende por WhatsApp, isso é uma falha de negócio, não de TI. Se o cliente crescer, o caminho é migrar pra **WhatsApp Business API oficial (Cloud API da Meta)** — paga por conversa, mas não bane. A arquitetura aqui (n8n no meio) permite trocar só a camada Evolution depois, sem refazer os fluxos.

---

## 9. Ordem de implementação

```
FASE 0 — Corrigir bloqueadores (no app, sem VPS ainda)
  [ ] lib/phone.js + validação nos 2 caminhos de criação de pedido
  [ ] Corrigir marcarEntregue (bug da migration 004)
  [ ] Fixar timezone do isOpen()
  [ ] Rodar migration 005 (tabelas de WhatsApp)

FASE 1 — Infra
  [ ] Contratar VPS (4GB) + apontar DNS (n8n. e evo.)
  [ ] docker compose up -d  → Caddy pega TLS
  [ ] systemd + ufw + cron de backup
  [ ] Criar API key do n8n (Settings → API) ← precisamos dela pro passo seguinte

FASE 2 — Conectar 1 loja (bella-pizza) na mão, pra validar
  [ ] POST /instance/create na Evolution
  [ ] Escanear QR com o chip dedicado
  [ ] Mandar uma mensagem de teste via API

FASE 3 — Fluxos (aqui eu crio os workflows via API do n8n)
  [ ] F1 notificações  → testar fazendo um pedido real e mudando status
  [ ] F2 chatbot       → testar cada keyword
  [ ] F3 entregador
  [ ] Configurar o Database Webhook no Supabase

FASE 4 — Produto (multi-tenant de verdade)
  [ ] Aba WhatsApp nas Configurações (QR + status + toggles)
  [ ] Server actions de instância
  [ ] Testar com uma 2ª loja
```

**Sobre a Fase 3:** o n8n tem **API REST pública** (`X-N8N-API-KEY`, `POST /api/v1/workflows`) — dá pra criar os workflows por código, versionar o JSON no repo e importar. É assim que faremos: eu escrevo o JSON dos workflows, mando pra API, e eles aparecem prontos no seu n8n. Nada de arrastar nó na tela.

---

## 10. Custos

| Item | Custo/mês |
|---|---|
| VPS 4GB (Hostinger/Contabo) | R$ 30–50 |
| Domínio (anual diluído) | ~R$ 4 |
| n8n self-hosted | **R$ 0** |
| Evolution API self-hosted | **R$ 0** |
| Chip dedicado (pré-pago) | ~R$ 15 |
| Supabase | já pago (free tier hoje) |
| **Total** | **~R$ 50–70/mês** — e não escala com o nº de lojas |

Comparação: n8n Cloud começa em ~€24/mês e Z-API ~R$60/mês **por número**. Self-hosted, 10 lojas custam o mesmo que 1.

---

## Fontes

- [Evolution API — Docker install](https://doc.evolution-api.com/v2/en/install/docker)
- [n8n — Docker Compose hosting](https://docs.n8n.io/hosting/installation/server-setups/docker-compose/)
- [n8n — Public REST API](https://docs.n8n.io/api/) · [Autenticação](https://docs.n8n.io/api/authentication/)
