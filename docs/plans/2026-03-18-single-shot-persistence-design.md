# Design: Persistência Single-Shot + Tools (WebSearch, ReadFile, SaveFile)

## Data: 2026-03-18
## Status: IMPLEMENTADO (2026-03-18)

---

## Contexto

O FazAI-NG tem dois modos de operação:
- `fazai --cli` (chat interativo): persistência COMPLETA (memory.json + Qdrant)
- `fazai ask "pergunta"` / `fazai "tarefa"` (single-shot): SEM persistência

### Problema 1: Single-shot não persiste conversas
O `handleAskCommand()` em `src/commands/ask.ts` chama `askAI()` e sai. Não salva nada.
Já o CLI mode salva em memory.json E Qdrant via `appendConversationEntry()` + `storeMemoryInQdrant()`.

### Problema 2: WebSearch não injeta resultados no contexto
O CLI detecta intenções de busca web ("pesquise sobre X") e usa `ResilienceOrchestrator`,
mas o resultado NÃO é injetado no contexto do LLM — é exibido diretamente ao usuário.
O ECOA tool `[[WEB: query]]` faz a busca via Perplexity e re-chama o LLM com o resultado,
mas depende do LLM decidir emitir a tag — não é determinístico.

### Problema 3: Sem tools de filesystem
O `[[SAVE:]]` existe e grava no Qdrant, mas não há `[[readfile:]]` ou `[[savefile:]]`
para ler/modificar arquivos do filesystem com resultado injetado no contexto.

---

## Arquitetura Atual (Referência)

### Arquivos-Chave

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/app.ts` | Router principal, detecta `--cli`, `ask`, default |
| `src/commands/ask.ts` | Single-shot: `handleAskCommand()` |
| `src/cli-mode.ts` | Chat interativo: `runCliMode()`, `handleChat()` |
| `src/askAI.ts` | Interface LLM + RAG + ECOA tools + fallback chain |
| `src/askPrompt.ts` | Templates de prompt (askPrompt, generalAskPrompt) |
| `src/memory.ts` | CRUD memory.json (max 500 entries, auto-rotate) |
| `src/services/memory-loader.ts` | CRUD Qdrant fazai_memory (embeddings 768d) |
| `src/services/personality-loader.ts` | Personalidade do Qdrant |
| `src/rag/neural-flow.ts` | Busca multi-collection com fusion scoring |
| `src/research.ts` | ResearchCoordinator (DuckDuckGo + Perplexity) |
| `src/orchestrator/resilience-orchestrator.ts` | Busca web multi-nível |

### Fluxo CLI Mode (COMPLETO)
```
User Input → handleChat()
  ├─→ appendConversationEntry(user) → memory.json
  ├─→ storeMemoryInQdrant(user) → fazai_memory (async)
  ├─→ loadRelevantMemories() → busca semântica (7 dias, score > 0.6)
  ├─→ loadPersonalityFromQdrant() → traços
  ├─→ enrichWithRAG() → 5 collections paralelas
  ├─→ buildChatPrompt() → últimas 10 mensagens
  ↓
  askAI(personalityContext, prompt, model, provider, isGeneral=true, semantic=true)
  ↓
  AI Response
  ├─→ appendConversationEntry(assistant) → memory.json
  └─→ storeMemoryInQdrant(assistant) → fazai_memory (async)
```

### Fluxo Single-Shot (INCOMPLETO)
```
User Input → handleAskCommand()
  ↓
  askAI("", question, model, provider, isGeneral=true)
    ├─→ loadPersonalityFromQdrant() ✅
    ├─→ loadRelevantMemories() ✅
    ├─→ enrichWithRAG() ✅
  ↓
  AI Response → stdout
  ↓
  EXIT — Nada salvo!
```

### ECOA Tools Existentes (em askAI.ts)
- `[[WEB: query]]` → Perplexity → follow-up call com resultado
- `[[SAVE: texto]]` → storeMemoryInQdrant(importance=0.9, tags=["ecoa-save"])
- `[[READ: termo]]` → loadRelevantMemories(query, limit=5, minScore=0.5)

### RAG Weights (enrichWithRAG em askAI.ts)
```typescript
weights: { kb: 0.5, learning: 0.3, memory: 0.2, personality: 0, inference: 0 }
```

### System Message (askAI.ts SYSTEM_MESSAGES.general)
- Instrui em PT-BR, processa em EN
- Lista tools: [[WEB:]], [[SAVE:]], [[READ:]]
- Regras: não usar WEB para fatos básicos, só dados atuais
- RAG context injetado no final do system message
- Double injection: RAG também no user prompt via generalAskPrompt()

---

## Plano de Implementação

### Feature 1: Persistência no Single-Shot ✅ DONE

**Arquivo:** `src/commands/ask.ts`

**Implementado:**
- `appendConversationEntry()` + `storeMemoryInQdrant()` para user e assistant
- `sessionId: ask-{timestamp}` agrupa pergunta+resposta
- `.catch(() => {})` nas promises do Qdrant (graceful degradation)
- Guard `fullResponse.length >= 10` para não salvar respostas vazias

### Feature 2: WebSearch com Injeção no Contexto ✅ DONE

**Arquivo:** `src/cli-mode.ts`

**Implementado:**
- CLI mode: após `ResilienceOrchestrator` buscar, resultado é passado para `handleChat()` com prompt de análise
- O LLM agora **infere** sobre os resultados da busca web, em vez de apenas exibi-los
- Ask mode: já funciona via ECOA `[[WEB:]]` follow-up call

### Feature 3: Pseudo-Tools de Filesystem ✅ DONE

**Arquivo:** `src/askAI.ts`

**Implementado:**
- `[[READFILE: /path]]` → `fs.readFileSync()` → conteúdo injetado no follow-up
- `[[SAVEFILE: /path content]]` → `fs.writeFileSync()` → confirmação no follow-up
- `mkdir -p` automático para diretórios inexistentes
- Regex SAVEFILE especial: match greedy para conteúdo com `]`
- System message atualizado com instruções para as 5 tools

### Feature 4: [SAVE] Seletivo de Embedding ✅ DONE

**Arquivo:** `src/askAI.ts`

**Implementado:**
- System message agora instrui: "use [[SAVE: trecho relevante]] para gravar APENAS o trecho"
- Já existia no `executeEcoaTool()` — apenas melhorado no prompt

---

## Decisões Tomadas

1. **Porta Web UI:** 3456 (alinhada com systemd)
2. **Porta Daemon:** 17789 (evita conflito com OpenClaw na 18789)
3. **Versão:** 3.20.0 (alinhada com CHANGELOG)
4. **apiClient baseURL:** `""` (path relativo, funciona de papaimach)
5. **Middleware auth:** Protege TODAS as rotas (exceto /api/health)
6. **Config-loader:** Aceita CLOUDFLARE_API_TOKEN, SPAMEXPERTS_API_URL, OPNSENSE_API_URL

---

## Trabalho Já Realizado Nesta Sessão

### 1. Conflito de Rotas Next.js (CORRIGIDO)
- Removido `[domain]/route.ts` e `[messageId]/route.ts` conflitantes
- Criado `[id]/route.ts` unificado (GET+DELETE) e `[id]/release/route.ts` (POST)
- Slug único `[id]` diferencia por método HTTP

### 2. Versionamento (CORRIGIDO)
- `package.json` (raiz): 3.19.0 → 3.20.0
- `web/package.json`: 3.14.1 → 3.20.0
- Alinhado com CHANGELOG

### 3. Porta do Daemon (CORRIGIDO)
- `/etc/fazai/fazai.conf`: `FAZAI_DAEMON_PORT=17789`
- Daemon instalado via `fazai install-daemon` → systemd service `fazai-daemon`
- Porta 18789 é do OpenClaw, não do FazAI

### 4. Web UI API Mocks (CORRIGIDO)
- `web/lib/api.ts`: removidos todos `Promise.resolve([])` mocks
- `apiClient.baseURL`: `"http://localhost:3000"` → `""` (path relativo)
- Todas funções agora fazem requests reais para API Routes do Next.js
- API Routes consultam Qdrant diretamente (não precisa do Dashboard API)
- `web/app/api/memory/by-role/[role]/route.ts`: removido mock, consulta Qdrant

### 5. Config-Loader Integrations (CORRIGIDO)
- `CLOUDFLARE_API_TOKEN` mapeado (antes só procurava `CLOUDFLARE_API_KEY`)
- `SPAMEXPERTS_API_URL` mapeado (antes: `SPAMEXPERTS_HOST`)
- `SPAMEXPERTS_USERNAME/PASSWORD` adicionados
- `OPNSENSE_API_URL` mapeado (antes: `OPNSENSE_HOST`)
- Managers atualizados para aceitar nomes corretos
- SpamExperts manager suporta Basic Auth (username/password) além de API key

### 6. Autenticação Web UI (CORRIGIDO)
- Middleware expandido: protege TODAS as rotas (não só `/api/integrations/*`)
- Matcher: `/((?!_next/static|_next/image|favicon.ico).*)`
- `/api/health` liberado sem auth
- Browser exibe popup nativo de Basic Auth na primeira visita

### 7. Portas Testadas e Operacionais
| Serviço | Porta | systemd | Status |
|---------|-------|---------|--------|
| Web UI (Next.js) | 3456 | fazai-web@root | 200 OK |
| Dashboard API | 3000 | fazai-worker | 200 OK |
| Daemon HTTP/WS | 17789 | fazai-daemon | 200 OK |

### 8. Integrations (Parcial)
- Código corrigido (config-loader, managers)
- Cloudflare: token expirado (precisa gerar novo no dashboard CF)
- OPNsense/SpamExperts: variáveis comentadas no fazai.conf (não configurados)
