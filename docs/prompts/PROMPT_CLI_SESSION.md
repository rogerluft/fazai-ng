# 🎯 PROMPT PARA SESSÃO CLI (Backend + Genkit)

## Contexto Geral
Você está trabalhando no **FazAI v4.0**, um terminal inteligente Linux com IA autônoma. Sua responsabilidade é **migrar o backend** de SDKs diretos (Anthropic/OpenAI) para **Genkit orchestrator** com plugins, implementar RAG com Qdrant, e adicionar AutoGPT.

## Arquitetura Atual vs. Desejada

### ❌ Atual (v3.1-beta):
```
User → Terminal → SDK direto (Anthropic/OpenAI/Ollama) → Response
```

### ✅ Desejado (v4.0):
```
User → Terminal, cli e web → engenharia de orchestracao (talves longchains, pequenas ais locais autodidatas, etc...) → Multi-LLM Plugins, compativel com antrhopic, grok, openrouter, perplexity, zai, gllms, etc..  → RAG (Qdrant) → Response, personalidade trasnparente injetada, etc..
                              ↓ ou algo parecido + agentes talvez 
                         AutoGPT Agent (autonomia)
```
######   REAJUSTAR AS TAREFAS CONFORME NECESSARIO DECIDIDO UTILIZAR ALGO MAIS VERSATIL DO QUE GENKIT, TALVES GENAISCRIPTS PARA ESCREVER PROMPT INTELIGENTES ALGO ASSIM USAR O AGENTE DE ENGENHARIA DE FLUXO E AI E BANCO DE DADOS JUNTOS PARA PLANEJAR TUDO A PARTIR DAQUI ####


## 📋 Suas Tarefas (Fase 1 + 2)

### FASE 1: Genkit Migration (2-3 dias)

#### 1.1 Instalar Dependências Genkit
```bash
cd /opt/fazai

# Core Genkit
npm install @genkit-ai/core @genkit-ai/ai @genkit-ai/flow

# LLM Plugins
npm install genkitx-openai genkitx-openrouter genkitx-ollama

# Vector Store Plugin (apenas Qdrant)
npm install genkitx-qdrant

# Save
npm install --save
```

#### 1.2 Criar Genkit Orchestrator
**Arquivo:** `src/genkit-orchestrator.ts`

**Objetivos:**
- Configurar Genkit com todos os plugins (anthropic, openai, ollama, qdrant)
- Criar função `selectModel(task)` que escolhe melhor LLM baseado em complexidade
- Exportar `generateWithGenkit(prompt, options)` que substitui SDKs diretos

**Estrutura:**
```typescript
import { configureGenkit } from '@genkit-ai/core';
import { generate } from '@genkit-ai/ai';
import { anthropic } from 'genkitx-anthropic';
import { openai } from 'genkitx-openai';
import { ollama } from 'genkitx-ollama';
import { qdrant } from 'genkitx-qdrant';
import { getConfigValue } from './config';

// Initialize Genkit with all plugins
export const ai = configureGenkit({
  plugins: [
    anthropic({ apiKey: getConfigValue("ANTHROPIC_API_KEY") }),
    openai({ apiKey: getConfigValue("OPENAI_API_KEY") }),
    ollama({ baseUrl: getConfigValue("OLLAMA_BASE_URL") || "http://localhost:11434" }),
    qdrant({ 
      url: getConfigValue("QDRANT_URL") || "http://localhost:6333",
      apiKey: getConfigValue("QDRANT_API_KEY")
    }),
  ],
  flowStateStore: 'local',
  traceStore: 'local',
  enableTracingAndMetrics: true,
});

// Model selection strategy
export function selectModel(complexity: 'low' | 'medium' | 'high', speed: 'fast' | 'balanced' | 'quality'): string {
  if (complexity === 'high') return 'claude-3-5-sonnet-latest';
  if (speed === 'fast') return 'claude-3-haiku-20240307';
  return 'gpt-4o-mini'; // default
}

// Main generation function
export async function generateWithGenkit(
  prompt: string,
  options?: {
    model?: string;
    complexity?: 'low' | 'medium' | 'high';
    speed?: 'fast' | 'balanced' | 'quality';
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  }
): Promise<string | AsyncIterable<string>> {
  const model = options?.model || selectModel(
    options?.complexity || 'medium',
    options?.speed || 'balanced'
  );

  const config = {
    model,
    temperature: options?.temperature ?? 0.3,
    maxOutputTokens: options?.maxTokens ?? 4096,
  };

  if (options?.stream) {
    return generateStream(prompt, options.systemPrompt, config);
  }

  const response = await generate({
    prompt: [
      ...(options?.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
      { role: 'user', content: prompt }
    ],
    config,
  });

  return response.text();
}

// Streaming version
async function* generateStream(prompt: string, systemPrompt?: string, config?: any) {
  // TODO: Implement streaming with Genkit
  yield "Streaming implementation coming soon...";
}
```

#### 1.3 Migrar `linux-admin.ts`
**Modificar:** `src/linux-admin.ts`

**Objetivo:** Substituir chamadas diretas `Anthropic()` e `OpenAI()` por `generateWithGenkit()`

**Antes:**
```typescript
const anthropic = new Anthropic();
const stream = await anthropic.messages.create({...});
```

**Depois:**
```typescript
import { generateWithGenkit } from './genkit-orchestrator';

const response = await generateWithGenkit(
  linuxAdminPrompt(task),
  {
    systemPrompt: `INFORMAÇÕES DO SISTEMA:\n${systemInfo}\n\nVocê é um administrador Linux...`,
    complexity: 'high',
    model: model, // passa model do usuário
    stream: true,
    temperature: 0
  }
);
```

#### 1.4 Migrar `askAI.ts`
**Modificar:** `src/askAI.ts`

**Mesmo processo:** Substituir SDKs diretos por `generateWithGenkit()`

#### 1.5 Testar Backward Compatibility
```bash
# Testar todos os modelos
fazai sonnet35
fazai haiku
fazai gpt4o
fazai gpt4mini
fazai llama32

# Testar modos
fazai --dry-run
fazai ask "Como configurar nginx?"
fazai --cli
```

---

### FASE 2: RAG + Personality + Learning (2-3 dias)

#### 2.1 Implementar `personality-loader.ts`
**Arquivo:** `src/personality-loader.ts`

**Código completo está em:** `INTEGRATION_STATUS.md` linhas 287-356

**Objetivo:**
- Carregar traits da collection `fazai_personality` no Qdrant
- Cache de 5 minutos
- Retornar array ordenado por `intensity`

#### 2.2 Integrar Personality nos Prompts
**Modificar:** `src/linux-prompt.ts`

**Código está em:** `INTEGRATION_STATUS.md` linhas 358-392

**Objetivo:**
- Carregar traits com `loadPersonalityTraits()`
- Injetar top 5 traits no system prompt
- Aplicar `intensity` como modificador ("FORTEMENTE", "moderadamente", "levemente")

#### 2.3 Criar `learning-manager.ts`
**Arquivo:** `src/learning-manager.ts`

**Objetivo:**
- Salvar outcomes (sucesso/falha) em `fazai_learning`
- Função `saveOutcome(task, result, outcome)`
- Função `queryLessons(task)` que faz RAG search

**Estrutura:**
```typescript
import { QdrantClient } from "@qdrant/js-client-rest";
import { getConfigValue } from "./config";
import { logger } from "./logger";

export interface LearningOutcome {
  task: string;
  action_taken: string;
  outcome: "sucesso" | "falha" | "parcial";
  error_message?: string;
  confidence: number;
  category: string;
}

export class LearningManager {
  private client: QdrantClient;
  
  constructor() {
    const url = getConfigValue("QDRANT_URL") || "http://localhost:6333";
    const apiKey = getConfigValue("QDRANT_API_KEY");
    
    this.client = new QdrantClient({
      url,
      apiKey: apiKey || undefined
    });
  }
  
  async saveOutcome(outcome: LearningOutcome): Promise<void> {
    try {
      await this.client.upsert("fazai_learning", {
        points: [{
          id: Date.now(),
          vector: Array(1536).fill(0), // TODO: Generate real embedding
          payload: {
            learning_id: `learning_${Date.now()}`,
            type: outcome.outcome === "sucesso" ? "acerto" : "erro",
            title: `Task: ${outcome.task}`,
            description: outcome.action_taken,
            context: JSON.stringify({ category: outcome.category }),
            outcome: outcome.outcome,
            confidence: outcome.confidence,
            category: outcome.category,
            timestamp: new Date().toISOString(),
            applied_count: 0,
            tags: [outcome.category, outcome.outcome]
          }
        }]
      });
      
      logger.info(`💾 Learning saved: ${outcome.outcome} - ${outcome.task}`);
    } catch (error) {
      logger.warn(`Failed to save learning: ${error}`);
    }
  }
  
  async queryLessons(task: string, limit: number = 5): Promise<any[]> {
    try {
      // TODO: Implement semantic search with embeddings
      const result = await this.client.scroll("fazai_learning", {
        limit,
        with_payload: true,
        with_vector: false
      });
      
      return result.points.map(p => p.payload);
    } catch (error) {
      logger.warn(`Failed to query lessons: ${error}`);
      return [];
    }
  }
}

export const learningManager = new LearningManager();
```

#### 2.4 Integrar Learning Loop
**Modificar:** `src/linux-executor.ts`

**Adicionar após executar comando:**
```typescript
import { learningManager } from './learning-manager';

// Após executar comando
const outcome = {
  task: command.explain,
  action_taken: command.command,
  outcome: success ? "sucesso" : "falha",
  error_message: error?.message,
  confidence: success ? 0.9 : 0.5,
  category: "linux"
};

await learningManager.saveOutcome(outcome);
```

#### 2.5 RAG Query com Genkit
**Criar:** `src/genkit-rag.ts`

**Objetivo:** Usar `genkitx-qdrant` para fazer retrieve + generate

```typescript
import { retrieve } from 'genkitx-qdrant';
import { generateWithGenkit } from './genkit-orchestrator';

export async function ragQuery(
  query: string, 
  collection: 'fazai_personality' | 'fazai_memory' | 'fazai_learning' | 'fazai_kb' | 'fazai_inference',
  options?: { limit?: number; threshold?: number }
): Promise<string> {
  // 1. Retrieve context
  const context = await retrieve(ai.qdrant, {
    collection,
    query,
    limit: options?.limit || 5,
    threshold: options?.threshold || 0.7
  });
  
  // 2. Enhance prompt
  const enhancedPrompt = `
    Context from ${collection}:
    ${context.map(c => JSON.stringify(c.payload)).join('\n\n')}
    
    User query: ${query}
    
    Use the context above to inform your response.
  `;
  
  // 3. Generate
  const response = await generateWithGenkit(enhancedPrompt, {
    complexity: 'high',
    temperature: 0.3
  });
  
  return response as string;
}
```

---

## 📝 Checklist de Tarefas

### Fase 1: Genkit Migration
- [ ] Instalar dependências Genkit + plugins
- [ ] Criar `src/genkit-orchestrator.ts`
- [ ] Migrar `src/linux-admin.ts` para Genkit
- [ ] Migrar `src/askAI.ts` para Genkit
- [ ] Testar backward compatibility (todos modelos funcionam)
- [ ] Commitar: `feat(genkit): Migrate to Genkit orchestrator with multi-LLM support`

### Fase 2: RAG + Personality + Learning
- [ ] Implementar `src/personality-loader.ts`
- [ ] Integrar personality em `src/linux-prompt.ts`
- [ ] Criar `src/learning-manager.ts`
- [ ] Integrar learning loop em `src/linux-executor.ts`
- [ ] Criar `src/genkit-rag.ts`
- [ ] Testar RAG queries funcionam
- [ ] Commitar: `feat(rag): Add RAG with Qdrant + personality + learning system`

---

## 🧪 Como Testar

### Teste 1: Genkit Funciona
```bash
fazai sonnet35  # Deve usar genkitx-anthropic
fazai gpt4o     # Deve usar genkitx-openai
fazai llama32   # Deve usar genkitx-ollama
```

### Teste 2: Personality Aplicada
```bash
# Adicionar trait ao Qdrant manualmente (via Qdrant UI ou script)
fazai ask "Como instalar nginx?"  # Response deve refletir personality
```

### Teste 3: Learning Salva
```bash
fazai --dry-run  # Executar tarefa
# Verificar no Qdrant: collection fazai_learning tem novo entry
```

### Teste 4: RAG Query
```bash
# Criar script de teste
node -e "
const { ragQuery } = require('./dist/genkit-rag.cjs');
ragQuery('nginx configuration', 'fazai_kb').then(console.log);
"
```

---

## 📚 Recursos

- **Genkit Docs:** https://firebase.google.com/docs/genkit
- **Genkit Plugins:** https://bloomlabsinc.github.io/genkit-plugins/
- **genkitx-qdrant:** https://www.npmjs.com/package/genkitx-qdrant
- **genkitx-openai:** https://www.npmjs.com/package/genkitx-openai
- **genkitx-openrouter:** https://www.npmjs.com/package/genkitx-openrouter
- **genkitx-ollama:** https://www.npmjs.com/package/genkitx-ollama
- **OpenRouter Models:** https://openrouter.ai/models (200+ disponíveis)

---

## ⚠️ Notas Importantes

1. **Backward Compatibility:** Usuários devem conseguir usar `fazai sonnet35` exatamente como antes
2. **Performance:** Genkit adiciona pequeno overhead, mas traz flexibilidade
3. **Logs:** Use `logger.info/warn/error` para rastrear migração
4. **Erros:** Trate falhas gracefully com fallback
5. **Testing:** Teste cada model provider (Anthropic, OpenAI, Ollama)

---

## 🚀 Git Workflow

```bash
# Criar branch
git checkout -b feat/genkit-migration

# Desenvolvimento
npm run dev  # Watch mode

# Build e teste
npm run build
npm link
fazai --help

# Commit (mensagens semânticas)
git add .
git commit -m "feat(genkit): Add Genkit orchestrator core"
git commit -m "feat(genkit): Migrate linux-admin to use Genkit"
git commit -m "feat(rag): Implement personality-loader with Qdrant"

# Push
git push origin feat/genkit-migration
```

---

**Prioridade Máxima:** Fase 1 (Genkit Migration)  
**Tempo Estimado:** 2-3 dias  
**Após Completar:** Notifique para revisão e merge

**BOA SORTE! 🚀**
