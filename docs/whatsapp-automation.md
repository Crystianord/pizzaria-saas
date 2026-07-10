# WhatsApp Automation — n8n + Evolution API + Supabase

## Visão geral da arquitetura

```
CLIENTE
   │ manda mensagem no WhatsApp
   ▼
EVOLUTION API (seu número/chip)
   │ webhook HTTP
   ▼
N8N (orquestrador)
   │ detecta tipo de fluxo
   ├─► Chatbot de atendimento (cliente falou primeiro)
   └─► Notificação de pedido (Supabase avisou)
   │
   ├─► busca dados no SUPABASE (bairros, taxa, horário)
   └─► responde via Evolution API → CLIENTE
```

---

## Infraestrutura necessária

| Componente | O que é | Onde rodar | Custo |
|---|---|---|---|
| **Evolution API** | Conecta chip do WhatsApp ao sistema | Railway ou VPS | ~R$20/mês |
| **n8n** | Cria os fluxos visuais | Railway, Render ou n8n Cloud | Grátis (self-hosted) |
| **Supabase** | Já existe — fonte de dados | Já está no ar | Já pago |

---

## Fluxo 1 — Chatbot de atendimento

### Como funciona passo a passo

```
1. Cliente manda "oi" no WhatsApp da pizzaria
2. Evolution API recebe e dispara webhook para o n8n
3. n8n extrai: número do cliente + texto da mensagem
4. n8n verifica palavras-chave no texto
5. Busca dados atualizados no Supabase (se necessário)
6. Monta a resposta com os dados reais
7. Manda a mensagem de volta via Evolution API
```

### Nós no n8n (em ordem)

```
[Webhook] ← recebe mensagem da Evolution API
    │
[Set] ← extrai: telefone, mensagem, nome do contato
    │
[Switch] ← detecta a intenção pela palavra-chave
    │
    ├── SAUDAÇÃO ──► [Respond] mensagem de boas-vindas com menu
    │
    ├── CARDÁPIO ──► [Respond] link da loja
    │
    ├── ENTREGA ──► [HTTP Request → Supabase] busca bairros + taxa
    │                   └── [Respond] lista de bairros + taxa
    │
    ├── TAXA ────► [HTTP Request → Supabase] busca taxa_entrega
    │                   └── [Respond] valor da taxa
    │
    ├── HORÁRIO ──► [HTTP Request → Supabase] busca horario JSON
    │                   └── [Function] formata os dias
    │                         └── [Respond] horário formatado
    │
    ├── PEDIDO ──► [Respond] instrução para acessar o link de rastreio
    │
    └── NENHUMA ──► [Respond] mensagem de fallback com opções
```

### Palavras-chave por intenção

| Intenção | Palavras que ativam |
|---|---|
| Saudação | oi, olá, bom dia, boa tarde, boa noite, hello, hey, ola |
| Cardápio | cardápio, menu, pizza, produto, opção, quero pedir, ver pizzas |
| Entrega | entrega, entregam, entregar, bairro, zona, região, endereço, entregam |
| Taxa | taxa, frete, cobram, grátis, custo, valor da entrega, quanto custa |
| Horário | horário, hora, funcionam, aberto, fechado, abre, fecha, funciona |
| Pedido | pedido, acompanhar, rastrear, onde está, status, cadê meu pedido |

> No n8n o nó **Switch** usa expressões `{{ $json.body.message.toLowerCase().includes("oi") }}` para cada grupo.

---

## Templates de mensagem — Fluxo 1 (chatbot)

### Saudação
```
Olá! 👋 Bem-vindo à *{nome da pizzaria}*!

Como posso te ajudar?

🍕 *cardápio* — ver nossas pizzas
🛵 *entrega* — bairros que atendemos
💰 *taxa* — valor do frete
🕐 *horário* — quando estamos abertos
📦 *pedido* — acompanhar meu pedido

Ou acesse direto: {link-da-loja}
```

### Cardápio
```
Veja nosso cardápio completo aqui 👇
🍕 {link-da-loja}

Escolha sua pizza favorita e faça seu pedido direto pelo site!
```

### Entrega (dados buscados do Supabase)
```
🛵 *Bairros que atendemos:*
{lista de bairros, um por linha}

💰 Taxa de entrega: R$ {taxa_entrega}
🛵 Retirada no local: grátis!

Fazer pedido: {link-da-loja}
```

### Taxa
```
💰 Nossa taxa de entrega é *R$ {taxa_entrega}*

Para retirada no local é *grátis*! 😊

Fazer pedido: {link-da-loja}
```

### Horário (dados buscados do Supabase)
```
🕐 *Nosso horário de funcionamento:*

Segunda: {seg}
Terça:   {ter}
Quarta:  {qua}
Quinta:  {qui}
Sexta:   {sex}
Sábado:  {sab}
Domingo: {dom}
```

### Rastrear pedido
```
📦 Para acompanhar seu pedido, acesse o link que você recebeu após finalizar a compra.

Não recebeu o link? Faça o pedido pelo site e o link aparece na confirmação 👇
{link-da-loja}
```

### Fallback (nenhuma keyword reconhecida)
```
Não entendi sua mensagem 😅

Digite uma dessas opções:
• *cardápio*
• *entrega*
• *taxa*
• *horário*
• *pedido*
```

---

## Fluxo 2 — Notificações automáticas de pedido

### Como funciona

```
1. Cliente faz pedido / admin muda status
2. Supabase dispara Webhook (Database Webhook no painel)
3. n8n recebe o evento com os dados do pedido
4. Verifica qual status foi atualizado
5. Manda mensagem para o telefone do cliente
```

### Nós no n8n

```
[Webhook] ← recebe evento do Supabase
    │
[Switch] ← qual é o novo status?
    │
    ├── "preparo"   ──► [WhatsApp] pedido confirmado
    ├── "a_caminho" ──► [WhatsApp] saiu para entrega + link rastreio
    └── "entregue"  ──► [WhatsApp] pedido entregue + agradecimento
```

### Templates de notificação

**Pedido confirmado (status: preparo):**
```
✅ *Pedido confirmado!*

Olá, {nome_cliente}! Seu pedido foi aceito e já está sendo preparado. 🍕

Acompanhe aqui: {link-da-loja}/pedido/{id}
```

**Saiu para entrega (status: a_caminho):**
```
🛵 *Seu pedido saiu para entrega!*

Olá, {nome_cliente}! Seu pedido está a caminho.

Acompanhe em tempo real: {link-da-loja}/pedido/{id}
```

**Entregue (status: entregue):**
```
🎉 *Pedido entregue!*

Obrigado pela preferência, {nome_cliente}!
Esperamos que goste muito. Até a próxima! 🍕
```

---

## Configuração do Supabase Webhook

No painel do Supabase → **Database → Webhooks → Create a new hook**:

```
Nome:    pedido-status-change
Tabela:  orders
Evento:  UPDATE
URL:     https://seu-n8n.railway.app/webhook/pedido-status
Headers:
  x-webhook-secret: seu-secret-aqui
```

O n8n valida o header `x-webhook-secret` antes de processar (evita chamadas não autorizadas).

---

## Configuração do Supabase — busca de dados

Para os nós **HTTP Request** que buscam dados da loja no Fluxo 1, o n8n faz uma chamada REST ao Supabase:

```
URL:    https://{projeto}.supabase.co/rest/v1/stores?slug=eq.{slug}&select=taxa_entrega,bairros_atendidos,horario
Method: GET
Headers:
  apikey: {SUPABASE_ANON_KEY}
  Authorization: Bearer {SUPABASE_ANON_KEY}
```

> Os dados de taxa, bairros e horário são públicos (RLS permite leitura anon na tabela stores).

---

## Ordem de implementação

```
[ ] 1. Escolher API WhatsApp:
        → Evolution API (chip físico, custo quase zero, self-hosted)
        → Z-API (plano mensal ~R$60, mais fácil de configurar)

[ ] 2. Subir Evolution API no Railway ou VPS

[ ] 3. Subir n8n
        → n8n Cloud (grátis até 5 workflows, bom pra testar)
        → Railway/Render (self-hosted, gratuito)

[ ] 4. Criar Fluxo 1 (chatbot)
        → Webhook → Set → Switch → branches → Respond
        → Testar cada keyword manualmente

[ ] 5. Configurar Supabase Webhook
        → Database → Webhooks → orders UPDATE → URL do n8n

[ ] 6. Criar Fluxo 2 (notificações)
        → Webhook → Switch (status) → WhatsApp
        → Testar fazendo um pedido real e mudando o status

[ ] 7. Ajustar templates
        → Inserir nome real da pizzaria
        → Inserir link real da loja
        → Testar todos os cenários

[ ] 8. Testar fallback
        → Mandar mensagem aleatória → confirmar que recebe a mensagem de ajuda
```

---

## Custos estimados

| Serviço | Plano | Custo |
|---|---|---|
| Evolution API (self-hosted) | Railway Starter | ~R$20/mês |
| n8n (self-hosted) | Railway Starter | Grátis (no mesmo plano) |
| n8n Cloud | Free tier | Grátis (até 5 workflows) |
| Z-API (alternativa) | Plano básico | ~R$60/mês |
| Chip WhatsApp | Número dedicado | ~R$30 (único) |
| **Total mínimo** | | **~R$50/mês** |

> A Evolution API e o n8n podem rodar no mesmo servidor Railway, dividindo o custo.
