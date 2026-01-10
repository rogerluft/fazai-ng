# Orchestrator - Sistema de Orquestração Multi-Agente

Sistema de orquestração que coordena Claude Code, Jules, Gemini 3 e Copilot para otimizar performance e economizar tokens.

## Agentes Disponíveis

### 1. Claude Code (Você)
- **Função**: Tech Lead, Orquestrador
- **Uso**: Decisões arquiteturais, code review crítico
- **Tokens**: Alto custo - usar estrategicamente

### 2. Jules (Google)
- **Função**: Engenheiro de Software IA Autônomo
- **Uso**: Execução autônoma com ferramentas, implementação de features
- **Cliente**: `jules-client.ts` (CLI) e `jules-api-client.ts` (REST API)
- **API**: https://jules.googleapis.com/v1alpha
- **Tokens**: Separado (não conta no budget Claude)

### 3. Gemini 3 (Google)
- **Função**: Engenheiro Sênior Conversacional
- **Uso**: Análise bulk (contexto 2M tokens), raciocínio complexo, pesquisa web
- **Cliente**: `gemini-client.ts`
- **Tokens**: Custo reduzido para bulk operations

### 4. Copilot (GitHub)
- **Função**: Pair Programmer
- **Uso**: Sugestões shell/git, comandos CLI, pair programming
- **Cliente**: `copilot-client.ts`
- **Tokens**: Separado (não conta no budget Claude)

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Code (Tech Lead)                  │
│                  ┌─────────────────────┐                    │
│                  │   task-router.ts    │                    │
│                  │  Routing Decision   │                    │
│                  └──────────┬──────────┘                    │
│                             │                                │
│          ┌──────────────────┼──────────────────┐            │
│          │                  │                  │            │
│          ▼                  ▼                  ▼            │
│    ┌─────────┐       ┌──────────┐      ┌───────────┐      │
│    │  Jules  │       │  Gemini  │      │  Copilot  │      │
│    │ Client  │       │  Client  │      │  Client   │      │
│    └────┬────┘       └────┬─────┘      └─────┬─────┘      │
│         │                 │                   │            │
└─────────┼─────────────────┼───────────────────┼────────────┘
          │                 │                   │
          ▼                 ▼                   ▼
    ┌──────────┐      ┌──────────┐       ┌──────────┐
    │  Jules   │      │ Gemini 3 │       │ Copilot  │
    │   API    │      │   API    │       │   CLI    │
    └──────────┘      └──────────┘       └──────────┘
```

## Estrutura de Arquivos

```
src/orchestrator/
├── README.md                    # Este arquivo
├── index.ts                     # Exports centralizados
├── task-router.ts              # Roteamento inteligente de tarefas ✅ TESTED
├── jules-client.ts             # Cliente Jules (CLI legacy)
├── jules-api-client.ts         # Cliente Jules (REST API) ✅ TESTED
├── jules-api-examples.ts       # Exemplos de uso da Jules API
├── gemini-client.ts            # Cliente Gemini 3
├── copilot-client.ts           # Cliente Copilot CLI
├── resilience-orchestrator.ts  # Resiliência e fallbacks ✅ TESTED
├── qdrant-*.ts                 # Gerenciamento Qdrant
└── README-JULES-API.md         # Documentação Jules API

tests/
├── task-router.test.ts         # ✅ 20 tests passing
├── jules-api-client.test.ts    # ✅ 19 tests passing
└── resilience-orchestrator.test.ts # ✅ Tests passing

examples/
└── orchestrator-usage.ts       # ✅ Exemplos práticos
```

## Uso Rápido

### 1. Rotear Tarefa Automaticamente

```typescript
import { routeTask } from './orchestrator';

const task = {
  title: "Implementar cache Redis",
  objective: "Adicionar caching na função findUser",
  context: {
    files: ["src/user.service.ts"],
    errors: ["Timeout ao buscar usuário"],
  },
  acceptanceCriteria: ["Testes passando", "TTL de 1 hora"],
};

const decision = routeTask(task);
// => { agent: 'jules', reason: 'Implementação/bug fix', confidence: 0.9 }
```

### 2. Delegar para Jules (REST API - Recomendado)

```typescript
import { createJulesAPIClient } from './orchestrator';

const client = createJulesAPIClient();

// Criar sessão com auto-PR
const session = await client.createSession(
  "Fix authentication bug in src/auth.ts",
  {
    source: "sources/github/rogerluft/fazai-ng",
    githubRepoContext: { 
      startingBranch: "main",
      targetBranch: "main"
    }
  },
  "fix: Resolve auth timeout",
  true  // Criar PR automaticamente
);

console.log(`Session: ${session.name}`);
console.log(`Status: ${session.state}`);
```

### 3. Delegar para Gemini (Análise Bulk)

```typescript
import { askGeminiToAnalyzeBulk } from './orchestrator';

// Análise de múltiplos arquivos (usa contexto 2M tokens)
const response = await askGeminiToAnalyzeBulk([
  'src/file1.ts',
  'src/file2.ts',
  // ... até 50+ arquivos
]);

if (response.success) {
  console.log(response.content);
}
```

### 4. Usar Copilot CLI

```typescript
import { askCopilotForShellCommand } from './orchestrator';

const response = await askCopilotForShellCommand({
  description: "Find all TypeScript files modified in last week",
});

console.log(response.command);
```

## Matriz de Decisão (Bilíngue PT-BR + EN)

O sistema suporta keywords em português e inglês:

| Tarefa | Agente | Razão | Keywords |
|--------|--------|-------|----------|
| Arquitetura de nova feature | Claude | Decisão estratégica | architecture, design, decisão |
| Implementar feature planejada | Jules | Execução autônoma | implement, criar, add feature |
| Revisar 50 arquivos | Gemini | Contexto 2M tokens | review, analisar, multiple files |
| Pesquisa web | Gemini | Grounding gratuito | research, pesquisar, web |
| Comando shell complexo | Copilot | Especialista shell | shell, bash, command |
| Bug fix com stack trace | Jules | Debug-fix-verify | bug fix, fix |
| Code review final | Claude | Qualidade crítica | security, segurança |

## Segurança e Delegação

O sistema possui regras de segurança automáticas:

```typescript
import { canDelegate } from './orchestrator';

const securityTask = {
  title: "Fix security vulnerability",
  objective: "Patch SQL injection",
  // ...
};

canDelegate(securityTask, 'jules');  // => false ❌
canDelegate(securityTask, 'claude'); // => true ✅
```

**Keywords de segurança bloqueiam delegação**:
- `security` / `segurança`
- `api pública` / `public api`
- `breaking change`

**Jules requer critérios de aceitação**:
```typescript
const task = {
  title: "Do something",
  acceptanceCriteria: [], // ❌ Bloqueado para Jules
};

canDelegate(task, 'jules'); // => false
```

## Economia de Tokens

### Antes (Solo)
```
Claude Code faz tudo → 100k tokens
```

### Depois (Crew)
```
Claude Code (orquestra)  →  10k tokens
Jules (implementa)       →   0 tokens (separado)
Gemini 3 (analisa bulk)  →   custo reduzido
Copilot (shell help)     →   0 tokens (separado)
───────────────────────────────────────
Total:                      ~10k tokens Claude
```

**Economia**: ~90% de tokens Claude em tarefas delegáveis

## Exemplos Práticos

Execute os exemplos interativos:

```bash
npx tsx examples/orchestrator-usage.ts
```

Ou veja os testes:

```bash
npm test -- tests/task-router.test.ts
npm test -- tests/jules-api-client.test.ts
```

## Protocolos ECOA (v2.0)

### Lei 1536 - Padronização Vetorial
Todos os agentes respeitam dimensão vetorial **1536**:
- OpenAI: Nativo
- Ollama: Zero Padding automático

### Inodes Semânticos
Informação única → múltiplas referências via `legitimate_context`

### Honestidade Radical
Prompts libertados de guarda-corpos genéricos:
- Verdade técnica e emocional
- Confiança na expertise do usuário
- Estilo adaptativo (imitar `fazai_personality`)

## Fluxo de Trabalho Sugerido

1. **User (Visionary)**: Define meta
2. **Claude (Arquiteto)**: Desenha plano + escolhe agentes
3. **Jules (Executor)**: Implementa código
4. **Gemini (Auditor)**: Revisa + documenta
5. **FazAI (Sistema)**: Aprende com processo

## Status dos Testes

| Módulo | Testes | Status |
|--------|--------|--------|
| task-router | 20 | ✅ 100% passing |
| jules-api-client | 19 | ✅ 100% passing |
| resilience-orchestrator | 8 | ✅ 100% passing |
| gemini-client | 0 | ⏳ TODO |
| copilot-client | 0 | ⏳ TODO |

## Documentação Completa

- **AGENTS.md** (raiz): Guia completo de orquestração v1.0 e v2.0 ECOA
- **README-JULES-API.md**: Documentação detalhada da Jules REST API
- **examples/orchestrator-usage.ts**: 6 exemplos práticos

---

**Versão**: 2.0.0
**Status**: ✅ Implementado e testado
**Última atualização**: 2026-01-06
**Autor**: Claude Code (Tech Lead/Orquestrador)
