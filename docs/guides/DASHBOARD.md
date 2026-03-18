# FazAI Dashboard

API REST para gerenciamento de conhecimento, agentes e monitoramento do FazAI.

**Versão:** v3.20+
**Atualizado:** 2026-03-18
**Fonte:** `src/dashboard/`

---

## Visão Geral

O Dashboard é um servidor Express.js que expõe endpoints REST para:
- Gerenciar collections do Qdrant (listar, consultar, deletar)
- Busca semântica multi-collection com fusion scoring
- Executar agentes GenAIScript via HTTP
- Detectar knowledge gaps (skill seeker)
- Administrar compartilhamentos Samba
- Monitorar status do sistema

---

## Quick Start

```bash
# Iniciar com defaults (localhost:3000)
fazai dashboard start

# Custom port
fazai dashboard start --port 8080

# Bind em todas interfaces
fazai dashboard start --host 0.0.0.0

# Desabilitar CORS
fazai dashboard start --no-cors

# Desabilitar rate limiting
fazai dashboard start --no-rate-limit

# Parar
fazai dashboard stop

# Status
fazai dashboard status
```

### Verificar

```bash
curl http://localhost:3000/health
```

---

## Arquitetura

```
src/dashboard/
├── server.ts                    # DashboardServer class (Express setup)
├── routes/
│   ├── api.ts                   # Router principal (monta sub-routers)
│   ├── status.ts                # GET /api/status
│   ├── collections.ts           # CRUD /api/collections
│   ├── search.ts                # POST /api/search
│   ├── agent.ts                 # POST /api/agent/*
│   ├── skills.ts                # /api/skills/*
│   └── samba.ts                 # /api/samba/* (shares, users, groups)
└── middleware/
    ├── cors.ts                  # CORS configurável
    ├── rate-limiter.ts          # 100 req/min/IP
    ├── request-logger.ts        # Log de requisições
    ├── error-handler.ts         # Error handler padronizado
    └── async-handler.ts         # Wrapper async/await
```

### Middleware Stack (ordem de execução)

```
Request
  │
  ├── 1. express.json() + urlencoded (body parsing, limit 10mb)
  ├── 2. CORS middleware (se DASHBOARD_ENABLE_CORS=true)
  ├── 3. Request Logger (se DASHBOARD_LOG_REQUESTS=true)
  ├── 4. Rate Limiter (se DASHBOARD_ENABLE_RATE_LIMIT=true)
  ├── 5. Route handlers
  └── 6. Error Handler (catch-all)
  │
Response
```

---

## Referência de Endpoints

### Health & Status

#### GET /health

Health check simples.

```bash
curl http://localhost:3000/health
```

```json
{
  "status": "ok",
  "timestamp": "2026-03-18T10:00:00.000Z",
  "uptime": 3600
}
```

#### GET /api/status

Status completo do sistema (Qdrant, Ollama, GenAIScript).

```bash
curl http://localhost:3000/api/status | jq
```

```json
{
  "timestamp": "2026-03-18T10:00:00.000Z",
  "qdrant": {
    "available": true,
    "url": "http://localhost:6333",
    "collections": ["fazai_kb", "fazai_memory", "fazai_learning"],
    "metrics": {}
  },
  "ollama": {
    "available": true,
    "url": "http://localhost:11434",
    "models": ["qwen2.5:7b", "nomic-embed-text"]
  },
  "genaiscript": {
    "installed": true,
    "scriptsCount": 4
  },
  "system": {
    "uptime": 3600,
    "memory": {}
  }
}
```

#### GET /api

Info da API com todos os endpoints disponíveis.

```bash
curl http://localhost:3000/api | jq
```

---

### Collections (Qdrant)

#### GET /api/collections

Lista todas as collections FazAI (prefixo `fazai_*`).

```bash
curl http://localhost:3000/api/collections | jq '.collections[].name'
```

```json
{
  "total": 4,
  "collections": [
    {
      "name": "fazai_kb",
      "vectorsCount": 1500,
      "pointsCount": 1500,
      "status": "green"
    }
  ]
}
```

#### GET /api/collections/:name

Detalhes de uma collection específica.

```bash
curl http://localhost:3000/api/collections/fazai_kb | jq
```

#### GET /api/collections/:name/points

Lista pontos de uma collection (paginado).

```bash
curl "http://localhost:3000/api/collections/fazai_kb/points?limit=10&offset=0" | jq
```

**Query params:**
- `limit` — máximo de resultados (padrão: 10, max: 100)
- `offset` — offset para paginação (padrão: 0)

#### DELETE /api/collections/:name

Deleta uma collection (requer confirmação).

```bash
curl -X DELETE "http://localhost:3000/api/collections/fazai_test?confirm=true"
```

> **Segurança**: Apenas collections com prefixo `fazai_*` são acessíveis via API.

---

### Search (Busca Semântica)

#### POST /api/search

Busca semântica multi-collection com fusion scoring.

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "nginx configuration",
    "collections": ["fazai_kb", "fazai_learning"],
    "limit": 5,
    "threshold": 0.7
  }' | jq
```

**Body:**
```json
{
  "query": "texto da busca",
  "collections": ["fazai_kb", "fazai_learning"],
  "limit": 5,
  "threshold": 0.7
}
```

**Fusion Scoring Weights:**
| Collection | Peso |
|------------|------|
| `fazai_learning` | 0.4 (aprendizados técnicos) |
| `fazai_kb` | 0.3 (knowledge base) |
| `fazai_memory` | 0.2 (memórias de conversas) |
| `fazai_inference` | 0.1 (regras de inferência) |

**Resposta:**
```json
{
  "query": "nginx configuration",
  "results": [
    {
      "id": "uuid",
      "score": 0.92,
      "fusionScore": 0.276,
      "rawScore": 0.92,
      "collection": "fazai_kb",
      "payload": { "title": "Nginx Setup", "content": "..." }
    }
  ],
  "total": 5,
  "collections": ["fazai_kb", "fazai_learning"]
}
```

#### POST /api/search/:collection

Busca dentro de uma collection específica, com suporte a filtros Qdrant.

```bash
curl -X POST http://localhost:3000/api/search/fazai_kb \
  -H "Content-Type: application/json" \
  -d '{
    "query": "systemctl commands",
    "limit": 10,
    "threshold": 0.8,
    "filter": {
      "must": [
        { "key": "category", "match": { "value": "linux-admin" } }
      ]
    }
  }' | jq
```

---

### Agent Operations (GenAIScript)

#### POST /api/agent/run

Executa um script GenAIScript.

```bash
curl -X POST http://localhost:3000/api/agent/run \
  -H "Content-Type: application/json" \
  -d '{
    "query": "configure nginx as reverse proxy",
    "script": "fazai-core.genai.mjs",
    "model": "ollama:phi3",
    "timeout": 120000,
    "vars": { "custom_key": "value" }
  }' | jq
```

**Resposta:**
```json
{
  "success": true,
  "output": "Agent output...",
  "error": null,
  "duration": 5432,
  "exitCode": 0,
  "retries": 0
}
```

#### POST /api/agent/loop

Executa o agentic loop.

```bash
curl -X POST http://localhost:3000/api/agent/loop \
  -H "Content-Type: application/json" \
  -d '{"query": "optimize embeddings", "model": "ollama:phi3", "timeout": 180000}' | jq
```

#### POST /api/agent/reflect

Trigger de reflexão autônoma.

```bash
curl -X POST http://localhost:3000/api/agent/reflect \
  -H "Content-Type: application/json" \
  -d '{"model": "ollama:phi3", "timeout": 60000}' | jq
```

#### GET /api/agent/scripts

Lista scripts GenAIScript disponíveis.

```bash
curl http://localhost:3000/api/agent/scripts | jq
```

```json
{
  "scripts": ["fazai-core.genai.mjs", "reflect.genai.mjs", "skill-seeker.genai.mjs"],
  "total": 3,
  "scriptsDir": "genaisrc/"
}
```

---

### Skills

#### POST /api/skills/seek

Detecta knowledge gaps.

```bash
curl -X POST http://localhost:3000/api/skills/seek \
  -H "Content-Type: application/json" \
  -d '{"query": "docker swarm", "mode": "detect", "model": "ollama:phi3"}' | jq
```

**Modos:**
- `detect` — detectar gaps de conhecimento
- `scrape` — scrape de documentação (futuro)
- `generate` — gerar skills (futuro)

#### GET /api/skills

Lista skills geradas.

```bash
curl "http://localhost:3000/api/skills?limit=20&category=linux-admin" | jq
```

#### GET /api/skills/categories

Lista categorias de skills disponíveis.

#### GET /api/skills/:id

Busca skill específica por ID.

---

### Samba

#### GET /api/samba/shares

Lista shares do `/etc/samba/smb.conf`.

```bash
curl http://localhost:3000/api/samba/shares | jq
```

#### POST /api/samba/shares

Adiciona share para um diretório existente (via `fzsamba add`).

```bash
curl -X POST http://localhost:3000/api/samba/shares \
  -H "Content-Type: application/json" \
  -d '{"path": "/srv/compartilhado"}' | jq
```

#### DELETE /api/samba/shares/:name

Remove share (via `fzsamba del`).

```bash
curl -X DELETE http://localhost:3000/api/samba/shares/MeuShare | jq
```

#### GET /api/samba/status

Status dos serviços smb e nmb.

```bash
curl http://localhost:3000/api/samba/status | jq
```

#### POST /api/samba/users

Informações para criar usuário Samba (interativo via CLI).

```bash
curl -X POST http://localhost:3000/api/samba/users \
  -H "Content-Type: application/json" \
  -d '{"username": "novousuario"}' | jq
```

> **Nota**: Criação de usuários e grupos Samba é interativa. A API retorna o comando CLI a executar.

#### POST /api/samba/groups

Informações para criar grupo Samba (interativo via CLI).

#### POST /api/samba/restart

Reinicia serviços smb e nmb.

```bash
curl -X POST http://localhost:3000/api/samba/restart | jq
```

---

## Configuração

Variáveis em `/etc/fazai/fazai.conf`:

```bash
# Servidor
DASHBOARD_PORT=3000                # Porta (padrão: 3000)
DASHBOARD_HOST=localhost           # Bind address (padrão: localhost)

# Features
DASHBOARD_ENABLE_CORS=true         # CORS habilitado (padrão: true)
DASHBOARD_ENABLE_RATE_LIMIT=true   # Rate limiting (padrão: true)
DASHBOARD_LOG_REQUESTS=true        # Logging (padrão: true)
DASHBOARD_ALLOWED_ORIGINS=*        # Origens CORS (* = todas)

# Dependências
QDRANT_URL=http://localhost:6333   # URL do Qdrant
QDRANT_API_KEY=                    # API key Qdrant (opcional)
OLLAMA_BASE_URL=http://localhost:11434  # URL do Ollama
```

---

## Segurança

### Rate Limiting

Padrão: **100 requests por minuto por IP**.

Headers de resposta:
- `X-RateLimit-Limit` — máximo de requests permitidos
- `X-RateLimit-Remaining` — requests restantes
- `X-RateLimit-Reset` — timestamp do reset

### CORS

Configurar origens permitidas:
```bash
# Desenvolvimento (aceita tudo)
DASHBOARD_ALLOWED_ORIGINS=*

# Produção (específico)
DASHBOARD_ALLOWED_ORIGINS=http://localhost:3300,https://fazai.example.com
```

### Collection Access

Apenas collections com prefixo `fazai_*` são acessíveis via API. Tentativas de acessar outras collections retornam `403 Forbidden`.

### Autenticação

Atualmente não há autenticação (uso local only). Para produção, considerar:
- API key via header
- JWT tokens
- Reverse proxy com nginx/caddy + HTTPS

---

## Error Handling

Todas os erros retornam JSON padronizado:

```json
{
  "error": "ErrorType",
  "message": "Mensagem legível",
  "statusCode": 400,
  "timestamp": "2026-03-18T10:00:00.000Z",
  "path": "/api/search"
}
```

**Códigos HTTP:**
| Código | Significado |
|--------|-------------|
| `200` | Sucesso |
| `400` | Bad Request (validação) |
| `403` | Forbidden (collection não-fazai) |
| `404` | Not Found |
| `429` | Too Many Requests (rate limit) |
| `500` | Internal Server Error |

---

## Integrações

### Qdrant (Vector Database)

O Dashboard conecta ao Qdrant com circuit breaker para resiliência:
- Auto-detect de status (disponível/indisponível)
- Listagem de collections com métricas
- Busca semântica com embeddings via Ollama

### GenAIScript (Agent Runtime)

Execução de scripts `.genai.mjs` via CLI do GenAIScript:
- Suporte a múltiplos models (ollama, openai, etc.)
- Timeout configurável
- Variáveis customizáveis

### Ollama (Embeddings & LLM)

- Geração de embeddings para busca semântica (nomic-embed-text, 768d)
- Status check dos modelos carregados

---

## Troubleshooting

### Porta em uso

```bash
# Usar porta diferente
fazai dashboard start --port 8080

# Ou matar processo existente
sudo lsof -ti:3000 | xargs kill -9
```

### Qdrant indisponível

```bash
# Verificar Qdrant
fazai qdrant status
curl http://127.0.0.1:6333/collections

# Verificar container
docker ps | grep qdrant

# IMPORTANTE: Qdrant só aceita IPv4
# Use 127.0.0.1, NÃO use ::1 (IPv6)
```

### GenAIScript não encontrado

```bash
npm install -g genaiscript
npx genaiscript --version
```

---

## Nota sobre Systemd

O Dashboard **não possui** service systemd próprio. Ele é projetado para rodar via CLI:

```bash
# Foreground
fazai dashboard start

# Background (nohup)
nohup fazai dashboard start &

# Ou dentro de um screen/tmux
screen -S dashboard
fazai dashboard start
```

Se precisar de um servidor HTTP persistente com systemd, use o [Daemon](DAEMON.md) ou a [Web UI](WEB_UI.md).

---

## Documentação Relacionada

- [Arquitetura de Servidores](../architecture/SERVERS_ARCHITECTURE.md)
- [Daemon](DAEMON.md)
- [Web UI](WEB_UI.md)
- [Serviços Systemd](SERVICES.md)
