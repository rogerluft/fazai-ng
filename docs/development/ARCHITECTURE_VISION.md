# 🏗️ Arquitetura FazAI v4.0 - Terminal + AutoGPT + Genkit

**Visão:** Mega Framework Terminal com IA Autônoma  
**Data:** 15/11/2024  
**Status:** 🚧 Em Planejamento → Implementação

---

## 📊 Estado Atual vs. Visão Futura

### ✅ Estado Atual (v3.1-beta)

**Arquitetura Simples:**
```
User → Terminal CLI → SDK direto (Anthropic/OpenAI/Ollama) → Response
                                    ↓
                              Qdrant (5 collections definidas, NÃO usadas)
```

**Onde GenAI é Usado (ATUALMENTE):**
- ❌ **NENHUM USO DE GENKIT** - Apenas SDKs nativos
- ✅ **Anthropic SDK** (`@anthropic-ai/sdk`) em `src/linux-admin.ts:32` e `src/askAI.ts:17`
- ✅ **OpenAI SDK** (`openai`) em `src/linux-admin.ts:127` e `src/askAI.ts:39`
- ✅ **Ollama** (via OpenAI SDK) em `src/linux-admin.ts:222` e `src/askAI.ts:57`

**Modelos Configurados:**
```typescript
// src/models.ts
models = [
  { name: "gpt-4o-mini", provider: "openai", nickName: "gpt4mini" },
  { name: "gpt-4o", provider: "openai", nickName: "gpt4o" },
  { name: "gpt-4-turbo", provider: "openai", nickName: "gpt4turbo" },
  { name: "claude-3-5-sonnet-latest", provider: "anthropic", nickName: "sonnet35" },
  { name: "claude-3-haiku-20240307", provider: "anthropic", nickName: "haiku" },
  { name: "llama3.2", provider: "ollama", nickName: "llama32" },
  { name: "qwen2.5:7b", provider: "ollama", nickName: "qwen" },
  { name: "mistral", provider: "ollama", nickName: "mistral" },
]
```

**Fluxo Atual:**
1. User input → `src/app.ts` (router)
2. Mode selection: admin/ask/cli
3. **Direct SDK call** (sem abstração):
   - `src/linux-admin.ts` → `Anthropic()` ou `OpenAI()` direto
   - `src/askAI.ts` → `Anthropic()` ou `OpenAI()` direto
4. Streaming response → Terminal
5. Qdrant: **Schema definido, MAS NÃO CONSULTA collections**

---

### 🎯 Visão Futura (v4.0)

**Mega Framework FazAI Terminal + AutoGPT + Genkit:**
```
User/AutoGPT Agent
        ↓
FazAI Terminal (CLI Robusta)
        ↓
Genkit Orchestrator (Plugin-based)
        ├─→ genkitx-openai (GPT-4o/Mini/Turbo)
        ├─→ genkitx-openrouter (200+ models: Claude, Mistral, Gemini, Llama...)
        ├─→ genkitx-ollama (Local models: Llama/Qwen/Mistral)
        └─→ genkitx-groq (Groq LPU - opcional)
        ↓
Genkit RAG (Vector Plugin)
        └─→ genkitx-qdrant (5 collections ativas)
        ↓
GPTCache (Performance Layer)
        ↓
Qdrant Vector Database
        ├─→ fazai_personality (Traits com weights)
        ├─→ fazai_memory (Histórico operacional + vida)
        ├─→ fazai_learning (Erros/Acertos + auto-correção)
        ├─→ fazai_kb (Docs: Guitararena, frameworks)
        └─→ fazai_inference (Regras manuais + Zero Trust)
        ↓
Linux Kernel (Wrappers seguros)
        ├─→ Zero Trust (mínimo privilégio)
        ├─→ Port security
        └─→ Network isolation
```

---

## 🧩 Componentes do Mega Framework

### 1. FazAI Terminal (CLI Interface)
**Função:** Interface Humano-Agente e Autonomia

**Recursos:**
- ✅ CLI interativo com memória persistente (`src/cli-mode.ts`)
- ✅ Comandos especiais (`/exec`, `/history`, `/memory`)
- 🔨 **ADICIONAR:** AutoGPT integration
- 🔨 **ADICIONAR:** Task queue e planning
- 🔨 **ADICIONAR:** Self-correction loop

**Melhorias Necessárias:**
```typescript
// src/fazai-terminal.ts (NOVO)
interface FazaiAgent {
  plan(goal: string): Task[];
  execute(task: Task): Promise<Result>;
  reflect(result: Result): Correction[];
  learn(outcome: Outcome): void;
}
```

---

### 2. Genkit Orchestrator (Plugin System)
**Função:** Flexibilidade e Orquestração Multi-LLM

**Por que Genkit?**
- ✅ **Plugin ecosystem** rico (https://bloomlabsinc.github.io/genkit-plugins/)
- ✅ **Model routing** inteligente (escolhe melhor LLM por tarefa)
- ✅ **RAG built-in** (vector plugins)
- ✅ **Observability** (tracing, logs, metrics)
- ✅ **Cost optimization** (fallback cheaper models)

**Plugins Necessários:**

#### LLM Providers:
```bash
npm install genkitx-openai       # GPT-4o/Mini/Turbo
npm install genkitx-openrouter   # Unified API (200+ models)
npm install genkitx-ollama       # Llama/Qwen/Mistral local
npm install genkitx-groq         # Groq LPU (opcional)
```

#### Vector Stores (RAG):
```bash
npm install genkitx-qdrant       # Primary (já temos Qdrant rodando)
```

#### Observability:
```bash
npm install @genkit-ai/google-cloud  # Logging/tracing
```

**Implementação:**
```typescript
// src/genkit-orchestrator.ts (NOVO)
import { configureGenkit } from '@genkit-ai/core';
import { openai } from 'genkitx-openai';
import { openrouter } from 'genkitx-openrouter';
import { ollama } from 'genkitx-ollama';
import { qdrant } from 'genkitx-qdrant';
import { getConfigValue } from './config';

const ai = configureGenkit({
  plugins: [
    // LLM providers
    openai({ apiKey: getConfigValue("OPENAI_API_KEY") }),
    openrouter({ apiKey: getConfigValue("OPENROUTER_API_KEY") }), // 200+ models
    ollama({ baseUrl: getConfigValue("OLLAMA_BASE_URL") }),
    
    // Vector store
    qdrant({ 
      url: getConfigValue("QDRANT_URL"),
      apiKey: getConfigValue("QDRANT_API_KEY"),
      collections: [
        'fazai_personality',
        'fazai_memory',
        'fazai_learning',
        'fazai_kb',
        'fazai_inference'
      ]
    }),
  ],
  
  // Dynamic model routing from config
  modelRouter: (task) => {
    const defaultModel = getConfigValue("DEFAULT_MODEL") || 'gpt-4o-mini';
    const complexModel = getConfigValue("COMPLEX_MODEL") || 'openrouter/anthropic/claude-3.5-sonnet';
    const fastModel = getConfigValue("FAST_MODEL") || 'openrouter/anthropic/claude-3-haiku';
    const localModel = getConfigValue("LOCAL_MODEL") || 'ollama/llama3.2';
    
    if (task.complexity === 'high') return complexModel;
    if (task.speed === 'critical') return fastModel;
    if (task.cost === 'minimal') return localModel;
    return defaultModel;
  },
});
```

---

### 3. GPTCache + Qdrant (Performance + RAG)
**Função:** Cache inteligente + Conhecimento estendido

**Estratégia:**
- **GPTCache:** Camada de cache em memória (LRU) em TypeScript
- **Qdrant:** Vector DB com 5 collections especializadas

**Collections Qdrant (Schema já definido):**

#### fazai_personality
```typescript
{
  trait_name: string;      // "conservative_operations"
  category: string;        // "decision_making"
  value: string;          // "Prefere dry-run antes de executar"
  intensity: number;      // 0.9 (peso 0.0-1.0)
  context?: string;       // "linux_admin"
  tags?: string[];        // ["safety", "cautious"]
}
```

#### fazai_memory
```typescript
{
  conversation_id: string;
  message_id: number;
  role: "user" | "assistant" | "system" | "autonomous";
  timestamp: string;
  content: string;
  summary?: string;
  emotional_context?: string;
  importance?: number;     // 0.0-1.0
  tags?: string[];
}
```

#### fazai_learning
```typescript
{
  learning_id: string;
  type: "erro" | "acerto" | "padrão" | "otimização";
  title: string;
  description: string;
  context: string;
  action_taken?: string;
  outcome: "sucesso" | "falha" | "parcial";
  confidence: number;      // 0.0-1.0
  category: string;        // "linux", "network", "security"
  timestamp: string;
  applied_count?: number;
  tags?: string[];
}
```

#### fazai_kb
```typescript
{
  doc_id: string;
  source: "guitararena" | "framework" | "manual" | "web";
  title: string;
  content: string;
  category: string;
  tags?: string[];
  url?: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
}
```

#### fazai_inference
```typescript
{
  rule_id: string;
  type: "security" | "policy" | "sla" | "manual_override";
  name: string;
  description: string;
  condition: string;
  action: string;
  priority: number;        // 1-10
  enabled: boolean;
  created_by: string;
  tags?: string[];
}
```

**Implementação RAG com Genkit:**
```typescript
// src/genkit-rag.ts (NOVO)
import { generate } from '@genkit-ai/ai';
import { retrieve } from 'genkitx-qdrant';

async function ragQuery(query: string, collection: string) {
  // 1. Retrieve context from Qdrant
  const context = await retrieve(qdrant, {
    collection,
    query,
    limit: 5,
    threshold: 0.7
  });
  
  // 2. Enhance prompt with context
  const enhancedPrompt = `
    Context from ${collection}:
    ${context.map(c => c.content).join('\n\n')}
    
    User query: ${query}
  `;
  
  // 3. Generate with best model
  const response = await generate({
    model: 'claude-3-5-sonnet',
    prompt: enhancedPrompt,
    config: {
      temperature: 0.3,
      maxTokens: 2048
    }
  });
  
  return response;
}
```

---

### 4. AutoGPT Integration (Autonomia)
**Função:** Agente autônomo com planejamento e auto-correção

**Fluxo AutoGPT:**
```
1. Goal Definition
   ↓
2. Task Planning (decompose goal)
   ↓
3. Task Execution (via Genkit + RAG)
   ↓
4. Result Evaluation
   ↓
5. Self-Correction (se falhou)
   ↓
6. Learning (save to fazai_learning)
   ↓
7. Next Task (loop até goal completo)
```

**Implementação:**
```typescript
// src/autogpt-agent.ts (NOVO)
class AutoGPTAgent {
  async achieveGoal(goal: string): Promise<void> {
    // 1. Plan tasks
    const plan = await this.planTasks(goal);
    
    // 2. Execute each task
    for (const task of plan) {
      const result = await this.executeTask(task);
      
      // 3. Evaluate
      if (!result.success) {
        // 4. Self-correct
        const correction = await this.correctMistake(task, result);
        result = await this.executeTask(correction.newTask);
      }
      
      // 5. Learn
      await this.learn({
        task,
        result,
        outcome: result.success ? 'sucesso' : 'falha'
      });
    }
  }
  
  private async planTasks(goal: string): Promise<Task[]> {
    // RAG query fazai_memory + fazai_learning
    const context = await ragQuery(goal, 'fazai_memory');
    const lessons = await ragQuery(goal, 'fazai_learning');
    
    // Generate plan with Claude Sonnet
    const plan = await generate({
      model: 'claude-3-5-sonnet',
      prompt: `
        Goal: ${goal}
        
        Previous similar tasks:
        ${context}
        
        Lessons learned:
        ${lessons}
        
        Create a step-by-step plan.
      `
    });
    
    return parsePlan(plan);
  }
}
```

---

### 5. Linux + Zero Trust (Segurança)
**Função:** Execução segura no mundo real

**Princípios:**
- ✅ **Mínimo privilégio** (já implementado em `src/linux-executor.ts`)
- ✅ **Pattern matching** de comandos perigosos
- ✅ **Sandbox execution** (containers/namespaces)
- 🔨 **ADICIONAR:** Port wrappers
- 🔨 **ADICIONAR:** Network isolation
- 🔨 **ADICIONAR:** Audit logging

**Melhorias:**
```typescript
// src/zero-trust-executor.ts (NOVO)
class ZeroTrustExecutor {
  async executeCommand(cmd: LinuxCommand): Promise<Result> {
    // 1. Check inference rules
    const allowed = await this.checkInferenceRules(cmd);
    if (!allowed) throw new SecurityViolation();
    
    // 2. Apply port wrapper
    if (cmd.requiresNetwork) {
      cmd = await this.wrapWithFirewall(cmd);
    }
    
    // 3. Execute in namespace
    const result = await this.executeInNamespace(cmd);
    
    // 4. Audit log
    await this.auditLog(cmd, result);
    
    return result;
  }
}
```

---

## 📦 Dependências a Adicionar

### Core Genkit:
```json
{
  "@genkit-ai/core": "^0.5.0",
  "@genkit-ai/ai": "^0.5.0",
  "@genkit-ai/flow": "^0.5.0"
}
```

### Genkit Plugins (LLM):
```json
{
  "genkitx-openai": "^1.0.0",
  "genkitx-openrouter": "^1.0.0",
  "genkitx-ollama": "^1.0.0",
  "genkitx-groq": "^1.0.0"
}
```

### Genkit Plugins (Vector):
```json
{
  "genkitx-qdrant": "^1.0.0"
}
```

### AutoGPT/Autonomia:
```json
{
  "langchain": "^0.1.0",
  "autogpt": "^0.5.0"
}
```

---

## 🗺️ Roadmap de Implementação

### Fase 1: Genkit Migration (2-3 dias)
1. ✅ Instalar dependências Genkit
2. ✅ Criar `src/genkit-orchestrator.ts`
3. ✅ Migrar `src/linux-admin.ts` para usar Genkit
4. ✅ Migrar `src/askAI.ts` para usar Genkit
5. ✅ Adicionar RAG com Qdrant via `genkitx-qdrant`
6. ✅ Testar backward compatibility

### Fase 2: Personality + Learning (2-3 dias)
7. ✅ Implementar `src/personality-loader.ts`
8. ✅ Integrar personality traits nos prompts
9. ✅ Criar `src/learning-manager.ts`
10. ✅ Auto-save outcomes em `fazai_learning`
11. ✅ Feedback loop (acertos/erros)

### Fase 3: AutoGPT Integration (3-4 dias)
12. ✅ Criar `src/autogpt-agent.ts`
13. ✅ Task planning com RAG
14. ✅ Self-correction loop
15. ✅ Autonomous mode (`fazai --autonomous "goal"`)

### Fase 4: Zero Trust + Security (2-3 dias)
16. ✅ Implementar `src/zero-trust-executor.ts`
17. ✅ Port wrappers
18. ✅ Network isolation
19. ✅ Inference rules engine

### Fase 5: GPTCache + Performance (1-2 dias)
20. ✅ Implementar `src/llm-cache.ts`
21. ✅ Integrar cache com Genkit
22. ✅ Metrics e monitoring

**Total: 10-15 dias de desenvolvimento**

---

## 📝 Changelog e Commits

### Estrutura de Commits:
```bash
feat(genkit): Add Genkit orchestrator with multi-LLM support
feat(rag): Integrate Qdrant RAG with genkitx-qdrant
feat(personality): Load personality traits from Qdrant
feat(learning): Auto-save outcomes to fazai_learning collection
feat(autogpt): Add autonomous agent with task planning
feat(security): Implement Zero Trust executor with port wrappers
perf(cache): Add LLM response cache with LRU strategy
docs(architecture): Update architecture vision to v4.0
```

### Changelog Format:
```markdown
## [4.0.0-alpha] - 2024-11-XX

### Added
- Genkit orchestrator with plugin-based architecture
- Multi-LLM support (Anthropic, OpenAI, Ollama, Mistral, Groq)
- RAG with Qdrant using genkitx-qdrant plugin
- Personality traits integration with weight-based behavior
- Learning system with auto-correction
- AutoGPT autonomous agent
- Zero Trust executor with network isolation
- LLM response cache with configurable TTL

### Changed
- Migrated from direct SDK calls to Genkit abstraction
- Enhanced CLI with autonomous mode
- Improved security with inference rules engine

### Breaking Changes
- None (backward compatible via Genkit wrappers)
```

---

## 🚀 Como Contribuir

### Setup Dev Environment:
```bash
git clone https://github.com/rogerluft/fazai-ng
cd fazai-ng
npm install
npm run build
npm link
```

### Desenvolvimento:
```bash
npm run dev           # Watch mode com tsx
npm run build         # Build para produção
npm test              # Run tests
npm run test:watch    # Test watch mode
```

### Commit Guidelines:
- **feat:** Nova feature
- **fix:** Bug fix
- **perf:** Performance improvement
- **docs:** Documentação
- **refactor:** Refatoração
- **test:** Testes
- **chore:** Manutenção

---

**Next Steps:**
1. Revisar esta arquitetura com a equipe
2. Criar issues no GitHub para cada fase
3. Implementar Fase 1 (Genkit Migration)
4. Deploy incremental com feature flags

**Contato:** Roger Luft (VeilWalker)  
**Repositório:** https://github.com/rogerluft/fazai-ng
