# Arquitetura de Servidores FazAI-NG

Visão completa da infraestrutura de servidores do FazAI-NG: daemon, dashboard e web UI.

**Versão:** v3.20+
**Atualizado:** 2026-03-18

---

## Visão Geral

O FazAI-NG opera com **3 servidores** independentes, cada um atendendo um público e propósito distinto:

```
                           ┌─────────────────────────────────────────┐
                           │          /etc/fazai/fazai.conf          │
                           │        (configuração centralizada)       │
                           └──────────────┬──────────────────────────┘
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              │                           │                           │
              ▼                           ▼                           ▼
   ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
   │     DAEMON       │      │    DASHBOARD      │      │     WEB UI       │
   │   (Gateway)      │      │    (REST API)     │      │   (Interface)    │
   │                  │      │                   │      │                  │
   │  Express + WS    │      │  Express + Routes │      │  Next.js 15      │
   │  Porta: 18789    │      │  Porta: 3000      │      │  Porta: 3300     │
   │                  │      │                   │      │                  │
   │  fazai daemon    │      │  fazai dashboard  │      │  npm start       │
   │  fazai serve     │      │  start            │      │  (em web/)       │
   └────────┬─────────┘      └────────┬──────────┘      └────────┬─────────┘
            │                         │                          │
            │  HTTP/WS                │  REST                    │  consome
            │                         │                          │  Dashboard
            ▼                         ▼                          ▼
   ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
   │  Clientes        │      │  Serviços Backend │      │  Browser         │
   │  Externos        │      │                   │      │  do Usuário      │
   │                  │      │  ┌─────────┐      │      │                  │
   │  - Telegram      │      │  │ Qdrant  │      │      │  Dashboard       │
   │  - OpenClaw      │      │  │ :6333   │      │      │  visual com      │
   │  - Automação     │      │  └─────────┘      │      │  páginas para    │
   │  - Bots          │      │  ┌─────────┐      │      │  cada collection │
   │                  │      │  │ Ollama  │      │      │                  │
   └──────────────────┘      │  │ :11434  │      │      └──────────────────┘
                             │  └─────────┘      │
                             │  ┌──────────┐     │
                             │  │GenAIScript│    │
                             │  └──────────┘     │
                             └───────────────────┘
```

---

## Tabela Comparativa

| Aspecto | Daemon | Dashboard | Web UI |
|---------|--------|-----------|--------|
| **Propósito** | Gateway para integração externa | API REST para gerenciamento | Interface visual para humanos |
| **Framework** | Express + WebSocket | Express + Router stack | Next.js 15 (App Router) |
| **Porta padrão** | 18789 | 3000 | 3300 |
| **Comando** | `fazai daemon` / `fazai serve` | `fazai dashboard start` | `npm start` (em `web/`) |
| **Systemd** | `fazai-daemon.service` | N/A (roda via CLI) | `fazai-web@user.service` |
| **Config var** | `FAZAI_DAEMON_PORT` | `DASHBOARD_PORT`, `DASHBOARD_HOST` | `WEB_PORT`, `WEB_HOST` |
| **Autenticação** | Nenhuma | Nenhuma (local only) | `WEB_UI_USERNAME` / `WEB_UI_PASSWORD` |
| **Arquivo principal** | `src/commands/daemon.ts` | `src/dashboard/server.ts` | `web/` |
| **Linhas de código** | ~78 | ~226 + routes + middleware | Full Next.js app |
| **Protocolo** | HTTP + WebSocket | HTTP REST | HTTP (SSR/CSR) |
| **Rate limiting** | Não | Sim (100 req/min/IP) | N/A |
| **CORS** | Não | Sim (configurável) | N/A |

---

## Quando Usar Cada Servidor

### Daemon — Integração com Sistemas Externos
- Conectar bots (Telegram, Discord) ao FazAI
- Integrar com OpenClaw Gateway via WebSocket
- Automação externa que precisa enviar mensagens ao FazAI
- Manter o FazAI disponível 24/7 como serviço de background

### Dashboard — Gerenciamento Programático
- Gerenciar collections do Qdrant (CRUD)
- Executar buscas semânticas via API
- Rodar agentes GenAIScript remotamente
- Monitorar status do sistema (Qdrant, Ollama, GenAIScript)
- Gerenciar skills e knowledge gaps
- Administrar compartilhamentos Samba

### Web UI — Administração Visual
- Visualizar e editar personality, memory, knowledge, learning
- Dashboard visual com métricas do agente
- Gerenciar integrações (Cloudflare, OPNsense, SpamExperts)
- Administrar Samba shares via interface gráfica
- Explorar source code indexado

---

## Configuração Centralizada

Todas as variáveis são lidas de `/etc/fazai/fazai.conf` via `getConfigValue()`.

### Variáveis do Daemon

```bash
FAZAI_DAEMON_PORT=18789          # Porta do daemon HTTP/WS
```

### Variáveis do Dashboard

```bash
DASHBOARD_PORT=3000              # Porta do servidor
DASHBOARD_HOST=localhost         # Bind address
DASHBOARD_ENABLE_CORS=true       # Habilitar CORS
DASHBOARD_ENABLE_RATE_LIMIT=true # Habilitar rate limiting
DASHBOARD_LOG_REQUESTS=true      # Logar requisições
DASHBOARD_ALLOWED_ORIGINS=*      # Origens CORS permitidas
```

### Variáveis da Web UI

```bash
WEB_HOST=0.0.0.0                 # Bind address
WEB_PORT=3300                    # Porta da Web UI
WEB_UI_USERNAME=admin            # Usuário de login
WEB_UI_PASSWORD=secret           # Senha de login
```

### Variáveis Compartilhadas (Backend Services)

```bash
# Qdrant (usado por Dashboard e Web UI)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# Ollama (usado por Dashboard para status/agents)
OLLAMA_BASE_URL=http://localhost:11434

# Providers (usados pelo core FazAI)
PROVIDER_FALLBACK_ORDER=google,ollama,openrouter,anthropic
MODELS_OLLAMA=qwen2.5:7b
MODELS_GOOGLE=gemini-2.5-flash,gemini-2.5-pro
MODELS_ANTHROPIC=claude-sonnet-4-5
```

---

## Fluxo de Dados

```
┌─────────┐    HTTP POST /api/message     ┌──────────┐
│ Telegram │ ──────────────────────────── │  Daemon   │
│ Bot      │                              │  :18789   │
└─────────┘                               └─────┬────┘
                                                 │
                                                 │ (futuro: AgentOrchestrator)
                                                 ▼
┌─────────┐    REST /api/*                ┌──────────┐
│ Scripts  │ ──────────────────────────── │ Dashboard │
│ curl     │                              │  :3000    │
└─────────┘                               └─────┬────┘
                                                 │
                          ┌──────────────────────┼──────────────────────┐
                          │                      │                      │
                          ▼                      ▼                      ▼
                   ┌──────────┐          ┌──────────┐          ┌──────────────┐
                   │  Qdrant  │          │  Ollama  │          │  GenAIScript  │
                   │  :6333   │          │  :11434  │          │  (CLI)        │
                   └──────────┘          └──────────┘          └──────────────┘
                          ▲
                          │
┌─────────┐    API Routes (proxy)         ┌──────────┐
│ Browser  │ ──────────────────────────── │  Web UI   │
│          │                              │  :3300    │
└─────────┘                               └──────────┘
```

### Relação entre Web UI e Dashboard

A Web UI (`web/lib/api.ts`) faz requests para o Dashboard como backend:
```typescript
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
});
```

Porém, a Web UI também possui **API Routes próprias** (Next.js App Router) que acessam serviços diretamente:
- `/api/integrations/cloudflare/*` — API Cloudflare
- `/api/integrations/opnsense/*` — API OPNsense
- `/api/integrations/spamexperts/*` — API SpamExperts
- `/api/samba/*` — Samba management
- `/api/health` — Health check próprio

---

## Systemd Services

| Service | Arquivo | Tipo | Instalação |
|---------|---------|------|------------|
| `fazai-daemon.service` | Gerado por `fazai install-daemon` | `simple` | `sudo fazai install-daemon` |
| `fazai-web@.service` | `etc/fazai/fazai-web@.service` | `simple` (template) | `sudo cp ... /etc/systemd/system/` |
| `qdrant.service` | `etc/fazai/qdrant.service` | Via install.sh | Automático |
| `fazai.service` | `etc/fazai/fazai.service` | CLI interativo | Manual |

> **Nota**: O Dashboard **não** tem service systemd. Roda via `fazai dashboard start` no terminal ou dentro de scripts.

---

## Dependências entre Serviços

```
qdrant.service
    ▲
    │ Wants + After
    │
fazai-web@.service ──── precisa de Qdrant para collections
    │
    │ consome
    ▼
Dashboard (CLI) ──── precisa de Qdrant + Ollama + GenAIScript
    │
    │ independente
    ▼
fazai-daemon.service ──── standalone, futuro: conecta ao orchestrator
```

---

## Documentação Detalhada

| Servidor | Documentação |
|----------|-------------|
| Daemon | [docs/guides/DAEMON.md](../guides/DAEMON.md) |
| Dashboard | [docs/guides/DASHBOARD.md](../guides/DASHBOARD.md) |
| Web UI | [docs/guides/WEB_UI.md](../guides/WEB_UI.md) |
| Systemd | [docs/guides/SERVICES.md](../guides/SERVICES.md) |

---

## Referências

- **Config Schema**: `src/config/schema.ts` — validação Zod de todas as variáveis
- **Config centralizada**: `/etc/fazai/fazai.conf`
- **CHANGELOG**: versões e features por servidor
