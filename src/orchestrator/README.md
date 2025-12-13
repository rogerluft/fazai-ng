# Orchestrator - Sistema de Orquestração Multi-Agente

Sistema de orquestração que coordena Claude Code, Jules, Gemini 3 e Copilot para otimizar performance e economizar tokens.

## Agentes Disponíveis

### 1. Claude Code (Você)
- **Função**: Tech Lead, Orquestrador
- **Uso**: Decisões arquiteturais, code review crítico

### 2. Jules (Google)
- **Função**: Engenheiro de Software IA
- **Uso**: Execução autônoma com ferramentas
- **Cliente**: `jules-client.ts`

### 3. Gemini 3 (Google)
- **Função**: Engenheiro Sênior Conversacional
- **Uso**: Análise bulk, raciocínio complexo, pesquisa web
- **Cliente**: `gemini-client.ts`

### 4. Copilot (GitHub)
- **Função**: Pair Programmer
- **Uso**: Sugestões shell/git, pair programming
- **Cliente**: `copilot-client.ts`

## Estrutura de Arquivos

```
src/orchestrator/
├── README.md              # Este arquivo
├── index.ts               # Exports centralizados
├── task-router.ts         # Roteamento inteligente de tarefas
├── jules-client.ts        # Cliente para Jules (execução autônoma)
├── gemini-client.ts       # Cliente para Gemini 3 (raciocínio/bulk)
└── copilot-client.ts      # Cliente para Copilot CLI (shell/git)
```

## Uso Rápido

### Rotear Tarefa Automaticamente

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
// => { agent: 'jules', reason: 'Implementação/bug fix - Engenheiro autônomo', confidence: 0.9 }
```

### Delegar para Jules

```typescript
import { delegateToJules, approveJulesPlan } from './orchestrator';

const julesTask = {
  ...task,
  technicalContext: "Usando biblioteca redis, conexão já configurada",
};

const result = await delegateToJules(julesTask);

if (result.plan) {
  console.log("Plano de Jules:", result.plan);
  // Revisar e aprovar
  await approveJulesPlan();
}
```

### Delegar para Gemini

```typescript
import { delegateToGemini, askGeminiForApproaches } from './orchestrator';

// Análise bulk de múltiplos arquivos
const response = await askGeminiToAnalyzeBulk([
  'src/file1.ts',
  'src/file2.ts',
  // ... 50 arquivos
]);

// Comparar múltiplas abordagens
const approaches = await askGeminiForApproaches(
  "Implementar rate limiting",
  "API REST com Express.js"
);
```

### Usar Copilot CLI

```typescript
import { askCopilotForShellCommand, getCopilotGitWorkflow } from './orchestrator';

// Comando shell complexo
const shellCmd = await askCopilotForShellCommand({
  description: "Find all TypeScript files modified in last week",
});

// Workflow git
const gitWorkflow = await getCopilotGitWorkflow(
  "Rebase current branch on main and resolve conflicts"
);
```

## Matriz de Decisão

| Tarefa | Agente | Razão |
|--------|--------|-------|
| Arquitetura de nova feature | Claude Code | Decisão estratégica |
| Implementar feature planejada | Jules | Execução autônoma |
| Revisar 50 arquivos | Gemini 3 | Contexto 2M tokens |
| Pesquisa web | Gemini 3 | Grounding gratuito |
| Comando shell complexo | Copilot CLI | Especialista shell |
| Bug fix com stack trace | Jules | Ciclo debug-fix-verify |

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

**Economia**: ~90% de tokens Claude

## Protocolos

### Respeito entre Agentes
- Tratar Jules como colega engenheiro sênior
- Não microgerenciar
- Confiar no processo

### Comunicação Clara
- Objetivos finais, não passos
- Critérios mensuráveis
- Contexto técnico completo

### Verificação
- Claude Code faz code review final
- Jules executa testes automatizados
- Sempre verificar antes de merge

## Documentação Completa

Veja `AGENTS.md` na raiz do projeto para guia completo de cada agente.
