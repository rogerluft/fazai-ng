# Delegação Jules - Análise Completa FazAI v3.10.0

## Contexto do Projeto

**Nome:** FazAI - Administrador Linux Inteligente com IA
**Versão:** 3.10.0
**Descrição:** CLI para administração Linux com IA, suporte multi-provider (Anthropic, OpenAI, Google, Ollama, OpenRouter), sistema RAG com Qdrant, orquestração agêntica via GenAIScript.

## Estrutura Principal

```
src/                    # Código fonte TypeScript (principal)
├── app.ts              # CLI principal
├── models.ts           # Definição de modelos AI
├── linux-admin.ts      # Geração de comandos Linux
├── services/           # Serviços (cache, embeddings, qdrant)
├── commands/           # Comandos CLI (agent, dashboard, qdrant, etc)
├── agentic/            # Sistema agêntico (DAG, loops, decomposer)
├── dashboard/          # REST API Express.js
└── mcp/                # Model Context Protocol

genaisrc/               # Scripts GenAIScript (Microsoft)
├── fazai-core.genai.mjs    # Loop agêntico principal
├── tools/                   # Ferramentas (qdrant, embeddings)
└── agents/                  # Agentes especializados

scripts/                # Scripts de build
tests/                  # Testes (vitest)
```

## Arquivos Críticos para Análise

### Core
- `src/app.ts` - Entry point CLI
- `src/models.ts` - Configuração de modelos
- `src/linux-admin.ts` - Geração de comandos

### Serviços
- `src/services/embeddingService.ts` - Embeddings
- `src/services/qdrant-client.ts` - Cliente Qdrant
- `src/services/semantic-cache.ts` - Cache semântico
- `src/services/circuit-breaker.ts` - Resiliência

### Agêntico
- `src/agentic/agentic-loop.ts` - Loop principal
- `src/agentic/dag-executor.ts` - Executor DAG
- `src/agentic/task-decomposer.ts` - Decompositor de tarefas
- `genaisrc/fazai-core.genai.mjs` - GenAIScript core

### Dashboard
- `src/dashboard/server.ts` - Express server
- `src/dashboard/routes/` - Rotas REST API

---

## TAREFAS DE ANÁLISE

### 1. BUGS E CONTROLES PROATIVOS (Prioridade Máxima)

Analise arquivo por arquivo identificando:

- **Race conditions** em operações async
- **Memory leaks** em loops e listeners
- **Error handling** incompleto ou inconsistente
- **Type safety** - uso de `any`, casts perigosos
- **Null/undefined** não tratados
- **Promise rejections** não capturadas
- **Resource cleanup** (conexões, streams, timers)

Para cada bug encontrado, sugira código de controle proativo.

### 2. FUNCIONALIDADE E PONTOS DE FALHA (Prioridade Alta)

Simule execuções mentais dos fluxos:

- **CLI startup** → app.ts → models.ts → providers
- **Comando ask** → prompt → AI → response
- **Comando agent** → agentic-loop → GenAIScript → tools
- **Dashboard API** → routes → services → Qdrant
- **Embedding flow** → text → model → vector → storage

Identifique:
- Pontos onde exceções podem propagar sem tratamento
- Timeouts não configurados
- Fallbacks ausentes
- Dependências externas sem circuit breaker
- Estados inconsistentes possíveis

### 3. USABILIDADE E FEATURES (Prioridade Média)

Avalie:
- Mensagens de erro são claras?
- Help é completo?
- Feedback de progresso existe?
- Erros são recuperáveis?
- Configuração é intuitiva?

Sugira features que melhorariam a experiência.

### 4. PLANO ORQUESTRADO

Organize as correções em tasks interrelacionadas:

```
Phase 1: Critical Fixes (bugs que podem causar crash)
Phase 2: Stability (circuit breakers, retries, fallbacks)
Phase 3: Resilience (graceful degradation, recovery)
Phase 4: UX (mensagens, feedback, help)
Phase 5: Features (novas funcionalidades)
```

Cada task deve indicar:
- Arquivo(s) afetado(s)
- Dependências de outras tasks
- Estimativa de complexidade (low/medium/high)
- Código sugerido ou pseudo-código

### 5. CONSIDERAÇÕES LIVRES

Espaço para:
- Opiniões sobre arquitetura
- Sugestões de refatoração
- Padrões que poderiam ser melhor aplicados
- Tecnologias que poderiam substituir/complementar
- Preocupações de segurança
- Performance observations

---

## Formato de Saída Esperado

```markdown
# Relatório de Análise FazAI v3.10.0

## Executive Summary
[Resumo em 3-5 parágrafos]

## 1. Bugs Críticos Encontrados
### Bug 1.1: [Título]
- **Arquivo:** path/to/file.ts:linha
- **Severidade:** Critical/High/Medium/Low
- **Descrição:** ...
- **Código Atual:** ...
- **Correção Sugerida:** ...

## 2. Pontos de Falha Identificados
### Falha 2.1: [Título]
- **Fluxo:** ...
- **Cenário:** ...
- **Impacto:** ...
- **Mitigação:** ...

## 3. Melhorias de Usabilidade
...

## 4. Plano de Execução Orquestrado
### Phase 1: Critical Fixes
- Task 1.1: ... (depende de: nenhuma)
- Task 1.2: ... (depende de: 1.1)
...

## 5. Considerações do Analista
...
```

---

## Instruções Adicionais

1. Seja exaustivo - leia TODOS os arquivos
2. Priorize bugs que causam crash ou perda de dados
3. Considere o contexto: CLI Linux, multi-provider AI, Qdrant
4. Código sugerido deve ser TypeScript idiomático
5. Mantenha compatibilidade com Node.js 18+
