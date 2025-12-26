# Jules API Reference

**Base URL:** `https://jules.googleapis.com/v1alpha`
**Auth Header:** `X-Goog-Api-Key: YOUR_API_KEY`
**Status:** Alpha (experimental, may change)

---

## Endpoints

### 1. List Sources

Lista repositórios conectados à conta Jules.

```bash
curl -H "x-goog-api-key: $JULES_API_KEY" \
  https://jules.googleapis.com/v1alpha/sources
```

**Response:**
```json
{
  "sources": [
    {
      "name": "sources/github/owner/repo",
      "githubRepo": {
        "owner": "owner",
        "repo": "repo",
        "defaultBranch": { "displayName": "main" },
        "branches": [...]
      },
      "id": "github/owner/repo"
    }
  ],
  "nextPageToken": "..."
}
```

---

### 2. Create Session

Cria uma nova sessão de trabalho.

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: $JULES_API_KEY" \
  https://jules.googleapis.com/v1alpha/sessions \
  -d '{
    "prompt": "Fix the login bug",
    "sourceContext": {
      "source": "sources/github/owner/repo",
      "githubRepoContext": {
        "startingBranch": "main"
      }
    },
    "automationMode": "AUTO_CREATE_PR",
    "title": "Fix Login Bug"
  }'
```

**⚠️ IMPORTANTE: automationMode**

| Valor | Comportamento |
|-------|---------------|
| `AUTO_CREATE_PR` | PR criado automaticamente ao completar |
| (omitido) | Requer clique manual em "Publish PR" na UI |

**Response:**
```json
{
  "name": "sessions/SESSION_ID",
  "title": "Fix Login Bug",
  "state": "IN_PROGRESS",
  "url": "https://jules.google.com/session/SESSION_ID",
  "id": "SESSION_ID"
}
```

---

### 3. List Sessions

Lista sessões existentes.

```bash
curl -H "x-goog-api-key: $JULES_API_KEY" \
  "https://jules.googleapis.com/v1alpha/sessions?pageSize=10"
```

**Response:**
```json
{
  "sessions": [
    {
      "name": "sessions/SESSION_ID",
      "title": "...",
      "state": "COMPLETED",
      "outputs": [
        {
          "pullRequest": {
            "url": "https://github.com/owner/repo/pull/123",
            "title": "PR Title",
            "description": "PR Description"
          }
        }
      ]
    }
  ],
  "nextPageToken": "..."
}
```

**Session States:**
- `PLANNING` - Jules está planejando
- `IN_PROGRESS` - Jules está trabalhando
- `COMPLETED` - Trabalho finalizado
- `FAILED` - Erro na execução

---

### 4. Get Session

Obtém detalhes de uma sessão específica.

```bash
curl -H "x-goog-api-key: $JULES_API_KEY" \
  https://jules.googleapis.com/v1alpha/sessions/SESSION_ID
```

---

### 5. Approve Plan

Aprova o plano gerado pelo Jules para iniciar execução.

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: $JULES_API_KEY" \
  https://jules.googleapis.com/v1alpha/sessions/SESSION_ID:approvePlan
```

**Response:** `{}`

---

### 6. Send Message

Envia mensagem para o agente durante a sessão.

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: $JULES_API_KEY" \
  https://jules.googleapis.com/v1alpha/sessions/SESSION_ID:sendMessage \
  -d '{
    "prompt": "Also add unit tests"
  }'
```

---

### 7. List Activities

Lista atividades de uma sessão.

```bash
curl -H "x-goog-api-key: $JULES_API_KEY" \
  "https://jules.googleapis.com/v1alpha/sessions/SESSION_ID/activities?pageSize=20"
```

---

## Workflow Recomendado

### Para PR Automático (Recomendado)

```bash
# 1. Criar sessão com AUTO_CREATE_PR
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: $JULES_API_KEY" \
  https://jules.googleapis.com/v1alpha/sessions \
  -d '{
    "prompt": "Descrição da tarefa",
    "sourceContext": {
      "source": "sources/github/owner/repo",
      "githubRepoContext": { "startingBranch": "main" }
    },
    "automationMode": "AUTO_CREATE_PR",
    "title": "Título da Tarefa"
  }'

# 2. Aprovar plano quando state = PLANNING
curl -X POST \
  -H "x-goog-api-key: $JULES_API_KEY" \
  https://jules.googleapis.com/v1alpha/sessions/SESSION_ID:approvePlan

# 3. Aguardar state = COMPLETED

# 4. PR estará em outputs[].pullRequest.url
```

### Para PR Manual

Se não usar `automationMode: "AUTO_CREATE_PR"`:
1. Criar sessão
2. Aprovar plano
3. Aguardar COMPLETED
4. Acessar UI: https://jules.google.com/session/SESSION_ID
5. Clicar em "Publish PR"

---

## Configuração Local

### API Key

Armazenar em `/etc/fazai/fazai.conf`:
```bash
JULES_API_KEY=your_api_key_here
```

### CLI Jules

```bash
# Login
jules login

# Criar sessão
jules new "descrição da tarefa"

# Listar sessões
jules remote list --session

# Pull resultado
jules remote pull --session SESSION_ID --apply
```

---

## Limitações (Alpha)

1. **Sem endpoint de Publish PR** - Apenas via UI ou `automationMode`
2. **Sem endpoint de Merge** - Fazer via GitHub API/CLI
3. **Sem endpoint de Cancel** - Apenas via UI
4. **Rate limits** - Não documentados

---

## Referências

- Docs: https://jules.google/docs/api/reference/
- UI: https://jules.google.com
- CLI: `npm install -g @anthropic/jules` (verificar nome correto)
