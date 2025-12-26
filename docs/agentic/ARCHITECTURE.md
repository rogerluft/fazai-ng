# Arquitetura do Sistema Agêntico FazAI

Documentação técnica detalhada da arquitetura do loop agêntico com reflexão e auto-evolução.

## Índice

1. [Visão Geral](#visão-geral)
2. [Camadas da Arquitetura](#camadas-da-arquitetura)
3. [Fluxo de Dados](#fluxo-de-dados)
4. [Componentes Detalhados](#componentes-detalhados)
5. [Padrões de Design](#padrões-de-design)
6. [Segurança e Confiabilidade](#segurança-e-confiabilidade)

## Visão Geral

O sistema agêntico FazAI usa uma arquitetura em camadas com dois caminhos de execução:

```
┌───────────────────────────────────────────────────────────────┐
│                    USUÁRIO / CLI                              │
└───────────────────────┬───────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        v                               v
┌───────────────────┐         ┌────────────────────┐
│  GENAI RUNTIME    │         │  TYPESCRIPT NATIVE │
│  (defTool, LLM)   │         │  (AgenticLoop)     │
└────────┬──────────┘         └─────────┬──────────┘
         │                              │
         └──────────┬───────────────────┘
                    │
                    v
         ┌──────────────────────┐
         │   SHARED SERVICES    │
         │  - Embeddings        │
         │  - Qdrant Client     │
         │  - Cache             │
         └──────────┬───────────┘
                    │
                    v
         ┌──────────────────────┐
         │   STORAGE LAYER      │
         │  - Qdrant (6 colls)  │
         │  - Vector Search     │
         │  - Fusion Scoring    │
         └──────────────────────┘
```

## Camadas da Arquitetura

### Layer 1: Interface de Usuário

**Componentes:**
- CLI FazAI (`src/app.ts`)
- Comandos de terminal

**Responsabilidades:**
- Receber queries do usuário
- Validar entrada
- Rotear para camada de execução
- Formatar saída

### Layer 2: Execução Agêntica

#### 2A: GenAIScript Runtime

**Arquivo:** `genaisrc/fazai-core.genai.mjs`

**Características:**
- Usa LLM para decisões (tool calling)
- Loop gerenciado pelo GenAIScript runtime
- Tools definidos via `defTool()`
- Meta-cognição (LLM reflete sobre LLM)

**Vantagens:**
- Mais "inteligente" (LLM decide próxima ação)
- Suporta modelos diversos (Ollama, Anthropic, OpenAI)
- Código declarativo

**Desvantagens:**
- Mais lento (cada decisão = chamada LLM)
- Depende de runtime externo
- Debug mais complexo

#### 2B: TypeScript Native

**Arquivo:** `src/agentic/agentic-loop.ts`

**Características:**
- Loop imperativo em TypeScript
- Decisões programáticas (sem LLM)
- Controle total do fluxo
- Reflection algorítmica

**Vantagens:**
- Mais rápido (sem chamadas LLM para controle)
- Debug simples
- Previsível

**Desvantagens:**
- Menos "inteligente" (sem reasoning do LLM)
- Lógica de decisão fixa

### Layer 3: Serviços Compartilhados

#### Embedding Service

**Arquivo:** `src/services/embeddings.ts`

**Arquitetura:**
```typescript
interface EmbeddingService {
  generate(text: string): Promise<number[]>;
  generateBatch(texts: string[]): Promise<number[][]>;
  getInfo(): EmbeddingInfo;
}

// Factory pattern
async function createEmbeddingService(): Promise<EmbeddingService> {
  // Lazy loading + singleton
  if (cached) return cached;

  // Usa Transformers.js local
  const embedder = await getLocalEmbedder();

  return {
    generate: async (text) => await embed(text),
    // ...
  };
}
```

**Providers suportados:**
1. **Transformers.js** (default) - Local, CPU, gratuito
2. **OpenAI** - Cloud, pago
3. **Ollama** - Local, GPU opcional

#### Qdrant Client Pool

**Arquivo:** `genaisrc/tools/qdrant-tools.mjs`

**Pattern:** Singleton client reutilizado

```javascript
import { QdrantClient } from "@qdrant/js-client-rest";

const client = new QdrantClient({
  url: process.env.QDRANT_URL || "http://localhost:6333"
});

// Todas as funções reutilizam o mesmo client
export async function qdrantSearch(collection, vector, limit) {
  return await client.search(collection, { vector, limit });
}
```

### Layer 4: Storage

#### Qdrant Vector Database

**URL:** `http://localhost:6333`

**Collections:**

```
fazai_personality  (traços de personalidade)
fazai_memory       (memórias de conversas)
fazai_learning     (aprendizados técnicos)
fazai_kb           (knowledge base)
fazai_inference    (regras de inferência)
fazai_semantic_cache (cache semântico)
```

**Schema (todas as collections):**

```json
{
  "vectors": {
    "size": 1536,
    "distance": "Cosine"
  },
  "payload_schema": {
    "content": "text",
    "type": "keyword",
    "category": "keyword",
    "source": "keyword",
    "timestamp": "datetime",
    "indexed_at": "datetime"
  }
}
```

## Fluxo de Dados

### Ciclo Completo de uma Query

```
1. ENTRADA
   │
   ├─ Usuário: "Como configurar Qdrant collections?"
   │
   v
2. EMBEDDING
   │
   ├─ createEmbeddingService()
   ├─ getLocalEmbedder() → Transformers.js
   ├─ embed(query) → [1536 floats]
   │
   v
3. MULTI-SEARCH (paralelo)
   │
   ├─ qdrantSearch("fazai_memory", vector, 5)     → [r1, r2, r3]
   ├─ qdrantSearch("fazai_learning", vector, 5)   → [r4, r5, r6]
   ├─ qdrantSearch("fazai_kb", vector, 5)         → [r7, r8, r9]
   ├─ qdrantSearch("fazai_inference", vector, 5)  → [r10]
   │
   v
4. FUSION SCORING
   │
   ├─ r1.fusedScore = r1.score * 0.20  (memory weight)
   ├─ r4.fusedScore = r4.score * 0.40  (learning weight)
   ├─ r7.fusedScore = r7.score * 0.30  (kb weight)
   ├─ r10.fusedScore = r10.score * 0.10 (inference weight)
   │
   ├─ sort by fusedScore DESC
   ├─ take top 10
   │
   v
5. REFLEXÃO
   │
   ├─ generateReflection(state)
   ├─ avgScore = sum(fusedScores) / count
   ├─ confidence = avgScore + successRate * 0.3
   ├─ shouldContinue = iteration < max && context < min
   │
   v
6. DECISÃO
   │
   ├─ if (shouldContinue) → goto step 2 (nova iteração)
   ├─ else → goto step 7
   │
   v
7. APRENDIZADO (opcional)
   │
   ├─ if (hasInsights)
   │   ├─ embed(insight) → vector
   │   └─ qdrantUpsertInsight(content, vector, category)
   │
   v
8. RESPOSTA
   │
   ├─ formatOutput(state)
   ├─ return to user
   │
   v
9. FIM
```

## Componentes Detalhados

### AgenticLoop Class (TypeScript Native)

**Arquivo:** `src/agentic/agentic-loop.ts`

**Interface Pública:**

```typescript
class AgenticLoop {
  constructor(config?: AgenticConfig)
  async init(): Promise<void>
  async multiSearch(query: string): Promise<ContextItem[]>
  async saveInsight(content: string, category: string, source?: string): Promise<boolean>
  generateReflection(state: AgenticState): Reflection
  async runIteration(state: AgenticState): Promise<AgenticState>
  async run(query: string): Promise<AgenticState>
  formatOutput(state: AgenticState): string
  generateSummary(state: AgenticState): string
}
```

**Estado Interno:**

```typescript
interface AgenticState {
  query: string;
  context: ContextItem[];        // Resultados acumulados
  actions: AgenticAction[];      // Log de ações
  reflections: Reflection[];     // Histórico de reflexões
  insights: Insight[];           // Insights gerados
  iteration: number;             // Iteração atual
  maxIterations: number;         // Limite de iterações
  startTime: number;             // Timestamp de início
}
```

**Algoritmo de Reflexão:**

```typescript
generateReflection(state: AgenticState): Reflection {
  // Calcula taxa de sucesso
  const successRate = successfulActions / totalActions;

  // Verifica contexto suficiente
  const hasEnoughContext = state.context.length >= minContextItems;

  // Calcula score médio
  const avgScore = sum(fusedScores) / count;

  // Combina métricas em confidence
  const confidence = min(1, avgScore + successRate * 0.3);

  // Decisão de continuar
  const shouldContinue = iteration < max && !hasEnoughContext;

  return {
    iteration,
    wasProductive: context.length > 0 || insights.length > 0,
    keyInsight: `Top match: ${topContext.source} (${score})`,
    shouldContinue,
    confidence
  };
}
```

### GenAI Tools (LLM-based)

**Arquivo:** `genaisrc/fazai-core.genai.mjs`

**Tool: qdrant_multi_search**

```javascript
defTool(
  "qdrant_multi_search",
  "Busca em múltiplas collections com fusion scoring",
  {
    type: "object",
    properties: {
      query: { type: "string" },
      collections: { type: "array", default: ["memory", "learning", "kb"] },
      limit: { type: "number", default: 3 }
    }
  },
  async ({ query, collections, limit }) => {
    // 1. Gera embedding
    const embeddingService = await createEmbeddingService();
    const embedding = await embeddingService.generate(query);

    // 2. Busca com fusion
    const results = await qdrantFusionSearch(embedding, WEIGHTS);

    // 3. Atualiza contexto global
    loopState.contextGathered.push(...results.slice(0, 5));

    return JSON.stringify({ results });
  }
);
```

**Tool: reflect**

```javascript
defTool(
  "reflect",
  "Meta-cognição: LLM reflete sobre LLM",
  { /* schema */ },
  async ({ context, outcome }) => {
    // Usa o próprio LLM para reflexão profunda
    const reflection = await runPrompt(`
      Você é o sistema de reflexão do FazAI.

      ITERAÇÃO: ${iteration}/${max}
      CONTEXTO: ${context}
      RESULTADO: ${outcome}

      Responda em JSON:
      {
        "was_productive": boolean,
        "key_insight": string,
        "should_continue": boolean,
        "confidence": 0.0-1.0
      }
    `, {
      model: "small",
      responseType: "json"
    });

    return reflection;
  }
);
```

### Fusion Scoring Algorithm

**Arquivo:** `genaisrc/tools/qdrant-tools.mjs`

**Implementação:**

```javascript
export async function qdrantFusionSearch(vector, weights = {
  memory: 0.20,
  learning: 0.40,
  kb: 0.30,
  inference: 0.10
}) {
  // 1. Busca em paralelo
  const collections = Object.keys(weights);
  const multiResults = await qdrantMultiSearch(vector, collections, 5);

  // 2. Aplica pesos
  const fusedResults = [];
  for (const [collName, results] of Object.entries(multiResults)) {
    const weight = weights[collName] || 0.25;
    for (const result of results) {
      fusedResults.push({
        ...result,
        source: collName,
        fusedScore: result.score * weight  // FUSION!
      });
    }
  }

  // 3. Ordena por fusedScore
  fusedResults.sort((a, b) => b.fusedScore - a.fusedScore);

  return fusedResults.slice(0, 10);
}
```

**Justificativa dos Pesos:**

- `learning: 0.40` - Maior peso para aprendizados (conhecimento técnico validado)
- `kb: 0.30` - Knowledge base geral
- `memory: 0.20` - Contexto conversacional
- `inference: 0.10` - Regras de inferência (metadados)

**Inspiração:** Neural Flow (multi-head attention com weighted fusion)

## Padrões de Design

### 1. Factory Pattern (Embeddings)

```typescript
// Esconde complexidade de criação
export async function createEmbeddingService(): Promise<EmbeddingService> {
  // Singleton + lazy loading
  if (cachedService) return cachedService;

  const service = await initializeService();
  cachedService = service;

  return service;
}
```

### 2. Singleton Pattern (Qdrant Client)

```javascript
// Um único client reutilizado
const client = new QdrantClient({ url: QDRANT_URL });

// Todas as funções usam o mesmo
export async function qdrantSearch(...) {
  return await client.search(...);
}
```

### 3. Strategy Pattern (Execution Path)

```typescript
// Estratégia 1: GenAI (LLM-based)
const resultGenAI = await runAgenticLoop(query);

// Estratégia 2: Native (algorithmic)
const loop = new AgenticLoop();
const resultNative = await loop.run(query);

// Escolha em runtime
const result = preferGenAI ? resultGenAI : resultNative;
```

### 4. Observer Pattern (State Changes)

```typescript
interface AgenticState {
  // Estado observável
  context: ContextItem[];
  actions: AgenticAction[];
  reflections: Reflection[];

  // Cada mudança gera log
  iteration: number;
}

// Ações são logadas
state.actions.push({
  type: "search",
  input: query,
  output: results,
  timestamp: new Date(),
  success: true,
  duration: elapsed
});
```

### 5. Builder Pattern (State Construction)

```typescript
async run(query: string): Promise<AgenticState> {
  // Construção incremental do estado
  let state: AgenticState = {
    query,
    context: [],
    actions: [],
    reflections: [],
    insights: [],
    iteration: 0,
    maxIterations: 5,
    startTime: Date.now()
  };

  // Build step by step
  while (state.iteration < state.maxIterations) {
    state = await this.runIteration(state);
    // ...
  }

  return state;
}
```

## Segurança e Confiabilidade

### Error Handling

**Retry com Backoff:**

```typescript
async runGenAIScript(options: GenAIRunOptions): Promise<GenAIRunResult> {
  let retries = 0;
  const maxRetries = options.maxRetries || 2;

  while (retries <= maxRetries) {
    try {
      const result = await executeScript(options);
      if (result.success) return result;

      // Exponential backoff
      await sleep(Math.pow(2, retries) * 1000);
      retries++;
    } catch (error) {
      if (retries >= maxRetries) throw error;
      retries++;
    }
  }
}
```

**Timeouts:**

```typescript
const timeoutId = setTimeout(() => {
  proc.kill("SIGTERM");
  setTimeout(() => proc.kill("SIGKILL"), 5000);
}, timeout);

proc.on("close", (code) => {
  clearTimeout(timeoutId);
  // ...
});
```

### Validação de Dados

**Schema Validation:**

```javascript
defTool("qdrant_multi_search", "...", {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "..."
    },
    limit: {
      type: "number",
      minimum: 1,
      maximum: 20,  // Evita overload
      default: 3
    }
  },
  required: ["query"]
}, handler);
```

**Input Sanitization:**

```typescript
async multiSearch(query: string): Promise<ContextItem[]> {
  // Valida input
  if (!this.embeddingService) {
    throw new Error("Service not initialized");
  }

  if (!query || query.trim().length === 0) {
    return [];
  }

  // Limita tamanho
  const sanitized = query.substring(0, 5000);

  // ...
}
```

### Rate Limiting

```typescript
// Limite de iterações
const MAX_ITERATIONS = 5;

// Timeout total
const TIMEOUT = 120000; // 2 minutos

while (state.iteration < MAX_ITERATIONS) {
  if (Date.now() > startTime + TIMEOUT) {
    break; // Timeout protection
  }
  // ...
}
```

### Logging e Observabilidade

```typescript
interface AgenticAction {
  type: "search" | "reflect" | "upsert" | "respond";
  input: string;
  output: string;
  timestamp: Date;
  success: boolean;
  duration: number;  // Para métricas
}

// Todas as ações são logadas
state.actions.push({
  type: "search",
  input: query,
  output: `Found ${results.length} results`,
  timestamp: new Date(),
  success: results.length > 0,
  duration: Date.now() - actionStart
});
```

## Performance Considerations

### Otimizações Implementadas

1. **Lazy Loading de Modelos**
   - Embedder carregado apenas na primeira chamada
   - Singleton cached para reutilização

2. **Busca Paralela**
   - 4 collections buscadas simultaneamente
   - `Promise.all()` para paralelismo

3. **Deduplicação de Resultados**
   - Hash por conteúdo (primeiros 100 chars)
   - Evita redundância no contexto

4. **Early Exit**
   - Loop para quando tem contexto suficiente
   - Não espera max iterations se desnecessário

### Bottlenecks Conhecidos

1. **Embedding Generation** (~50ms/query)
   - Solução: Cache de embeddings comuns

2. **LLM Reflection** (~2s/reflexão)
   - Solução: Usar modelo "small" para reflexão
   - Alternativa: Reflexão algorítmica (TypeScript native)

3. **Qdrant Latency** (~10ms/collection)
   - Solução: Busca paralela
   - Otimização: Indexação otimizada (HNSW)

---

**Versão:** 1.0.0
**Atualizado:** 2025-12-26
**Autor:** FazAI Development Team
