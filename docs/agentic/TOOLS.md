# Ferramentas do Sistema Agêntico FazAI

Documentação completa das ferramentas (tools) disponíveis no sistema agêntico.

## Índice

1. [Visão Geral](#visão-geral)
2. [Ferramentas GenAI](#ferramentas-genai)
3. [Ferramentas Qdrant](#ferramentas-qdrant)
4. [Ferramentas de Embedding](#ferramentas-de-embedding)
5. [Utilitários](#utilitários)
6. [Exemplos de Uso](#exemplos-de-uso)

## Visão Geral

O sistema agêntico FazAI possui dois tipos de ferramentas:

1. **GenAI Tools** - Chamadas via LLM (tool calling)
2. **JavaScript/TypeScript Functions** - Funções diretas

```
┌──────────────────────────────────────────────────────┐
│                  TOOLS LAYER                         │
│                                                       │
│  ┌────────────────┐    ┌─────────────────────┐      │
│  │  GenAI Tools   │    │  JS/TS Functions    │      │
│  │  (LLM-based)   │    │  (Direct calls)     │      │
│  ├────────────────┤    ├─────────────────────┤      │
│  │ • multi_search │    │ • qdrantSearch      │      │
│  │ • upsert       │    │ • qdrantMultiSearch │      │
│  │ • reflect      │    │ • qdrantFusion      │      │
│  │ • check_status │    │ • embed             │      │
│  │ • skill_seeker │    │ • embedBatch        │      │
│  └────────────────┘    └─────────────────────┘      │
└──────────────────────────────────────────────────────┘
```

## Ferramentas GenAI

### qdrant_multi_search

Busca em múltiplas collections do Qdrant com fusion scoring.

**Schema:**

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Termo ou conceito para buscar"
    },
    "collections": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Collections para buscar",
      "default": ["memory", "learning", "kb"]
    },
    "limit": {
      "type": "number",
      "description": "Limite de resultados por collection",
      "default": 3,
      "minimum": 1,
      "maximum": 10
    }
  },
  "required": ["query"]
}
```

**Exemplo de Chamada (GenAI):**

```javascript
// No script GenAI, o LLM chama automaticamente
const result = await $tool("qdrant_multi_search", {
  query: "Como configurar Qdrant?",
  collections: ["memory", "learning", "kb"],
  limit: 5
});
```

**Retorno:**

```json
{
  "success": true,
  "results_count": 10,
  "top_results": [
    {
      "source": "learning",
      "score": 0.8532,
      "content": "Configuração de Qdrant: usar collections com 1536 dims..."
    },
    {
      "source": "kb",
      "score": 0.7421,
      "content": "Qdrant aceita vetores de até 65536 dimensões..."
    }
  ]
}
```

**Implementação Interna:**

```javascript
async ({ query, collections, limit }) => {
  // 1. Gera embedding
  const embeddingService = await createEmbeddingService();
  const embedding = await embeddingService.generate(query);

  // 2. Pesos por collection
  const weights = {
    memory: 0.20,
    learning: 0.40,
    kb: 0.30,
    inference: 0.10
  };

  // 3. Busca com fusion scoring
  const results = await qdrantFusionSearch(embedding, weights);

  // 4. Atualiza contexto global
  loopState.contextGathered.push(...results.slice(0, 5));

  return JSON.stringify({ success: true, results });
}
```

---

### qdrant_upsert_insight

Salva um novo insight na collection learning com embedding automático.

**Schema:**

```json
{
  "type": "object",
  "properties": {
    "content": {
      "type": "string",
      "description": "Conteúdo do insight"
    },
    "category": {
      "type": "string",
      "enum": ["error_fix", "pattern", "optimization", "insight", "reflection"],
      "description": "Categoria do insight"
    },
    "source": {
      "type": "string",
      "description": "Origem do insight",
      "default": "agentic_loop"
    }
  },
  "required": ["content", "category"]
}
```

**Exemplo de Chamada:**

```javascript
const result = await $tool("qdrant_upsert_insight", {
  content: "Usar fusion scoring melhora precisão em 40%",
  category: "optimization",
  source: "benchmark_test"
});
```

**Retorno:**

```json
{
  "success": true,
  "category": "optimization",
  "content_preview": "Usar fusion scoring melhora precisão em 40%",
  "iteration": 3
}
```

**Implementação:**

```javascript
async ({ content, category, source = "agentic_loop" }) => {
  // 1. Gera embedding
  const embeddingService = await createEmbeddingService();
  const embedding = await embeddingService.generate(content);

  // 2. Salva no Qdrant
  const result = await qdrantUpsertInsight(content, embedding, category, source);

  // 3. Atualiza estado global
  loopState.insights.push({ content, category });

  return JSON.stringify({ success: true, category });
}
```

---

### reflect

Reflete sobre ações e contexto para gerar insights. Usa o próprio LLM para meta-cognição.

**Schema:**

```json
{
  "type": "object",
  "properties": {
    "context": {
      "type": "string",
      "description": "Contexto da reflexão (o que foi feito/encontrado)"
    },
    "outcome": {
      "type": "string",
      "description": "Resultado obtido",
      "default": "análise em andamento"
    }
  },
  "required": ["context"]
}
```

**Exemplo de Chamada:**

```javascript
const result = await $tool("reflect", {
  context: "Buscou em 4 collections e encontrou 10 resultados relevantes",
  outcome: "Contexto suficiente obtido"
});
```

**Retorno:**

```json
{
  "iteration": 3,
  "was_productive": true,
  "key_insight": "Encontrados matches de alta qualidade em learning",
  "should_continue": false,
  "confidence": 0.87,
  "next_action": "responder ao usuário"
}
```

**Implementação:**

```javascript
async ({ context, outcome }) => {
  loopState.iteration++;

  // Meta-cognição: usa LLM para reflexão profunda
  const reflection = await runPrompt(`
    Você é o sistema de reflexão agêntico do FazAI.

    ITERAÇÃO: ${loopState.iteration}/${loopState.maxIterations}
    CONTEXTO: ${context}
    RESULTADO: ${outcome}
    CONTEXTO ACUMULADO: ${loopState.contextGathered.length} itens
    INSIGHTS GERADOS: ${loopState.insights.length}

    Responda em JSON:
    {
      "was_productive": boolean,
      "key_insight": "insight principal desta iteração",
      "should_continue": boolean,
      "next_action": "próxima ação recomendada",
      "confidence": 0.0-1.0
    }
  `, {
    model: "small",
    responseType: "json"
  });

  const parsed = JSON.parse(reflection.text);
  loopState.reflections.push(parsed);

  return JSON.stringify({ iteration: loopState.iteration, ...parsed });
}
```

---

### check_loop_status

Verifica o status do loop agêntico e se deve continuar.

**Schema:**

```json
{
  "type": "object",
  "properties": {}
}
```

**Exemplo de Chamada:**

```javascript
const status = await $tool("check_loop_status");
```

**Retorno:**

```json
{
  "iteration": 3,
  "max_iterations": 5,
  "should_continue": false,
  "context_count": 8,
  "insights_count": 2,
  "reflections_count": 3,
  "recommendation": "Contexto suficiente - pode responder"
}
```

**Implementação:**

```javascript
async () => {
  const shouldContinue = loopState.iteration < loopState.maxIterations;
  const hasEnoughContext = loopState.contextGathered.length >= 3;

  return JSON.stringify({
    iteration: loopState.iteration,
    max_iterations: loopState.maxIterations,
    should_continue: shouldContinue && !hasEnoughContext,
    context_count: loopState.contextGathered.length,
    insights_count: loopState.insights.length,
    reflections_count: loopState.reflections.length,
    recommendation: hasEnoughContext
      ? "Contexto suficiente - pode responder"
      : "Continue buscando mais contexto"
  });
}
```

---

### skill_seeker_scrape

**STATUS:** PLACEHOLDER - A ser implementado

Auto-geração de skills de fontes externas quando gap de conhecimento é detectado.

**Schema:**

```json
{
  "type": "object",
  "properties": {
    "gap_description": {
      "type": "string",
      "description": "Descrição do gap de conhecimento detectado"
    },
    "source_type": {
      "type": "string",
      "enum": ["url", "github_repo", "pdf", "local_docs"],
      "description": "Tipo de fonte para scrape"
    },
    "source_path": {
      "type": "string",
      "description": "Caminho ou URL da fonte"
    }
  },
  "required": ["gap_description"]
}
```

**Planejamento Futuro:**

1. Detectar gap de conhecimento
2. Scrape doc/repo/PDF
3. Extrair conhecimento
4. Gerar skill definition
5. Embed + upsert to fazai_kb

---

## Ferramentas Qdrant

### qdrantSearch

Busca semântica em uma collection.

**Assinatura:**

```typescript
async function qdrantSearch(
  collection: string,
  vector: number[],
  limit: number = 5,
  filter: object | null = null
): Promise<SearchResult[]>
```

**Parâmetros:**

- `collection` - Nome da collection (ex: "fazai_learning")
- `vector` - Vetor de embedding (1536 dims)
- `limit` - Número máximo de resultados
- `filter` - Filtro opcional (Qdrant filter syntax)

**Exemplo:**

```javascript
import { qdrantSearch } from "./genaisrc/tools/qdrant-tools.mjs";
import { embed } from "./genaisrc/tools/transformers-embed.mjs";

const query = "Como usar Qdrant?";
const vector = await embed(query);

const results = await qdrantSearch("fazai_learning", vector, 5);

results.forEach(r => {
  console.log(`Score: ${r.score.toFixed(4)}`);
  console.log(`Content: ${r.payload.content}`);
});
```

**Retorno:**

```javascript
[
  {
    id: 1234567890,
    score: 0.8532,
    payload: {
      content: "Qdrant é um vector database...",
      type: "insight",
      category: "documentation",
      timestamp: "2025-12-26T10:30:00Z"
    }
  },
  // ...
]
```

---

### qdrantMultiSearch

Busca em múltiplas collections simultaneamente.

**Assinatura:**

```typescript
async function qdrantMultiSearch(
  vector: number[],
  collections: string[] = ["memory", "kb", "learning"],
  limitPerCollection: number = 3
): Promise<Record<string, SearchResult[]>>
```

**Exemplo:**

```javascript
import { qdrantMultiSearch } from "./genaisrc/tools/qdrant-tools.mjs";
import { embed } from "./genaisrc/tools/transformers-embed.mjs";

const vector = await embed("Como configurar collections?");

const results = await qdrantMultiSearch(vector, ["memory", "learning", "kb"], 5);

console.log("Results from memory:", results.memory.length);
console.log("Results from learning:", results.learning.length);
console.log("Results from kb:", results.kb.length);
```

**Retorno:**

```javascript
{
  "memory": [
    { id: 123, score: 0.75, payload: {...} },
    // ...
  ],
  "learning": [
    { id: 456, score: 0.85, payload: {...} },
    // ...
  ],
  "kb": [
    { id: 789, score: 0.70, payload: {...} },
    // ...
  ]
}
```

---

### qdrantFusionSearch

Busca com fusion scoring (Neural Flow style).

**Assinatura:**

```typescript
async function qdrantFusionSearch(
  vector: number[],
  weights: Record<string, number> = {
    memory: 0.20,
    learning: 0.40,
    kb: 0.30,
    inference: 0.10
  }
): Promise<FusedResult[]>
```

**Algoritmo:**

```
For each collection:
  1. Busca top 5 resultados
  2. Multiplica score pelo peso da collection
  3. Adiciona ao pool de resultados

Ordena pool por fusedScore DESC
Retorna top 10
```

**Exemplo:**

```javascript
import { qdrantFusionSearch } from "./genaisrc/tools/qdrant-tools.mjs";
import { embed } from "./genaisrc/tools/transformers-embed.mjs";

const vector = await embed("Otimizar performance Qdrant");

// Pesos customizados (mais peso em learning)
const results = await qdrantFusionSearch(vector, {
  memory: 0.10,
  learning: 0.50,
  kb: 0.30,
  inference: 0.10
});

results.forEach(r => {
  console.log(`[${r.source}] Score: ${r.score.toFixed(4)} | Fused: ${r.fusedScore.toFixed(4)}`);
  console.log(`  ${r.payload.content.substring(0, 80)}...`);
});
```

**Retorno:**

```javascript
[
  {
    id: 123,
    score: 0.9120,        // Score original da collection
    fusedScore: 0.4560,   // score * weight (0.9120 * 0.50)
    source: "learning",
    payload: {
      content: "Para otimizar Qdrant: usar HNSW indexing...",
      category: "optimization"
    }
  },
  // ...
]
```

---

### qdrantUpsert

Insere ou atualiza pontos em uma collection.

**Assinatura:**

```typescript
async function qdrantUpsert(
  collection: string,
  points: Array<{ id?: number; vector: number[]; payload: object }>
): Promise<{ success: boolean; count: number }>
```

**Exemplo:**

```javascript
import { qdrantUpsert } from "./genaisrc/tools/qdrant-tools.mjs";
import { embed } from "./genaisrc/tools/transformers-embed.mjs";

const content = "Fusion scoring melhora precisão em 40%";
const vector = await embed(content);

const result = await qdrantUpsert("fazai_learning", [
  {
    id: Date.now(),
    vector,
    payload: {
      content,
      type: "insight",
      category: "optimization",
      source: "benchmark",
      timestamp: new Date().toISOString()
    }
  }
]);

console.log(`Upserted ${result.count} points`);
```

---

### qdrantUpsertInsight

Helper para salvar insights (wrapper de qdrantUpsert).

**Assinatura:**

```typescript
async function qdrantUpsertInsight(
  content: string,
  vector: number[],
  category: "error_fix" | "pattern" | "optimization" | "insight" | "reflection" = "insight",
  source: string = "agentic_loop"
): Promise<{ success: boolean; count: number }>
```

**Exemplo:**

```javascript
import { qdrantUpsertInsight } from "./genaisrc/tools/qdrant-tools.mjs";
import { embed } from "./genaisrc/tools/transformers-embed.mjs";

const insight = "HNSW indexing reduz latência em 60%";
const vector = await embed(insight);

await qdrantUpsertInsight(insight, vector, "optimization", "benchmark_test");
```

---

### qdrantStats

Obtém estatísticas de todas as collections FazAI.

**Assinatura:**

```typescript
async function qdrantStats(): Promise<Record<string, CollectionInfo>>
```

**Exemplo:**

```javascript
import { qdrantStats } from "./genaisrc/tools/qdrant-tools.mjs";

const stats = await qdrantStats();

for (const [name, info] of Object.entries(stats)) {
  console.log(`${name}:`);
  console.log(`  Points: ${info.points_count}`);
  console.log(`  Status: ${info.status}`);
}
```

**Retorno:**

```javascript
{
  "personality": { points_count: 15, vectors_count: 15, status: "green" },
  "memory": { points_count: 243, vectors_count: 243, status: "green" },
  "learning": { points_count: 89, vectors_count: 89, status: "green" },
  "kb": { points_count: 1205, vectors_count: 1205, status: "green" },
  "inference": { points_count: 42, vectors_count: 42, status: "green" },
  "semantic_cache": { points_count: 0, vectors_count: 0, status: "green" }
}
```

---

## Ferramentas de Embedding

### embed

Gera embedding para um texto (100% local, CPU).

**Assinatura:**

```typescript
async function embed(text: string): Promise<number[]>
```

**Parâmetros:**

- `text` - Texto para gerar embedding (max ~5000 chars)

**Retorno:**

- Array de 1536 floats (384 nativos + 1152 padding)

**Exemplo:**

```javascript
import { embed } from "./genaisrc/tools/transformers-embed.mjs";

const vector = await embed("Como configurar Qdrant?");

console.log(`Dimensão: ${vector.length}`);
console.log(`Primeiros 5 valores: ${vector.slice(0, 5)}`);
```

**Output:**

```
Dimensão: 1536
Primeiros 5 valores: [0.0234, -0.1456, 0.0892, -0.0123, 0.1678]
```

**Características:**

- **Modelo:** Xenova/all-MiniLM-L6-v2
- **Tamanho:** ~80MB (download único)
- **Latência:** ~50ms/query (CPU)
- **Cache:** Modelo carregado uma vez (singleton)
- **Normalizado:** Unit vector (magnitude = 1)

---

### embedBatch

Gera embeddings em batch (múltiplos textos).

**Assinatura:**

```typescript
async function embedBatch(texts: string[]): Promise<number[][]>
```

**Exemplo:**

```javascript
import { embedBatch } from "./genaisrc/tools/transformers-embed.mjs";

const texts = [
  "Configurar Qdrant",
  "Usar embeddings locais",
  "Otimizar performance"
];

const vectors = await embedBatch(texts);

console.log(`Gerados ${vectors.length} embeddings`);
vectors.forEach((v, i) => {
  console.log(`${i+1}. Dimensão: ${v.length}`);
});
```

**Performance:**

- ~50ms/embedding
- Para 100 textos: ~5s total
- Progress log a cada 10 itens

---

### getModelInfo

Obtém informações sobre o modelo de embedding.

**Assinatura:**

```typescript
function getModelInfo(): EmbeddingInfo
```

**Exemplo:**

```javascript
import { getModelInfo } from "./genaisrc/tools/transformers-embed.mjs";

const info = getModelInfo();
console.log(JSON.stringify(info, null, 2));
```

**Retorno:**

```json
{
  "provider": "transformers.js",
  "model": "Xenova/all-MiniLM-L6-v2",
  "nativeDimension": 384,
  "targetDimension": 1536,
  "isLocal": true,
  "isCached": true,
  "quantized": true
}
```

---

## Utilitários

### ensureCollection

Verifica se collection existe e cria se necessário.

**Assinatura:**

```typescript
async function ensureCollection(
  collectionName: string,
  dimension: number = 1536
): Promise<{ exists: boolean; created?: boolean }>
```

**Exemplo:**

```javascript
import { ensureCollection } from "./genaisrc/tools/qdrant-tools.mjs";

const result = await ensureCollection("fazai_custom", 1536);

if (result.created) {
  console.log("Collection criada com sucesso!");
} else {
  console.log("Collection já existia");
}
```

---

### qdrantListCollections

Lista todas as collections disponíveis.

**Exemplo:**

```javascript
import { qdrantListCollections } from "./genaisrc/tools/qdrant-tools.mjs";

const collections = await qdrantListCollections();

collections.forEach(c => {
  console.log(`${c.name} - FazAI: ${c.isFazAI}`);
});
```

---

## Exemplos de Uso

### Exemplo 1: Busca Completa com Fusion

```javascript
import { qdrantFusionSearch } from "./genaisrc/tools/qdrant-tools.mjs";
import { embed } from "./genaisrc/tools/transformers-embed.mjs";

async function searchWithContext(query) {
  console.log(`\nBuscando: "${query}"\n`);

  // 1. Gera embedding
  const vector = await embed(query);

  // 2. Busca com fusion scoring
  const results = await qdrantFusionSearch(vector, {
    memory: 0.20,
    learning: 0.40,
    kb: 0.30,
    inference: 0.10
  });

  // 3. Exibe resultados
  console.log(`Encontrados ${results.length} resultados:\n`);

  results.slice(0, 5).forEach((r, i) => {
    console.log(`${i+1}. [${r.source.toUpperCase()}] Score: ${r.fusedScore.toFixed(4)}`);
    console.log(`   ${r.payload.content.substring(0, 80)}...\n`);
  });

  return results;
}

// Uso
await searchWithContext("Como otimizar Qdrant collections?");
```

### Exemplo 2: Salvar Aprendizado

```javascript
import { qdrantUpsertInsight } from "./genaisrc/tools/qdrant-tools.mjs";
import { embed } from "./genaisrc/tools/transformers-embed.mjs";

async function saveLesson(lesson, category = "insight") {
  console.log(`\nSalvando aprendizado: "${lesson}"\n`);

  // 1. Gera embedding
  const vector = await embed(lesson);

  // 2. Salva no Qdrant
  const result = await qdrantUpsertInsight(
    lesson,
    vector,
    category,
    "manual_entry"
  );

  if (result.success) {
    console.log(`✓ Aprendizado salvo com sucesso!`);
  } else {
    console.error(`✗ Erro ao salvar: ${result.error}`);
  }

  return result;
}

// Uso
await saveLesson("Fusion scoring combina múltiplas collections para melhor precisão", "pattern");
```

### Exemplo 3: Loop Completo com Ferramentas

```javascript
import { runGenAIScript } from "./src/agentic/genai-runner.js";

async function agenticQuery(query) {
  console.log(`\nExecutando loop agêntico para: "${query}"\n`);

  const result = await runGenAIScript({
    script: "fazai-core.genai.mjs",
    vars: { query },
    timeout: 180000,
    verbose: true,
    maxRetries: 2
  });

  if (result.success) {
    console.log("\n=== RESULTADO ===");
    console.log(result.output);
    console.log(`\nDuração: ${result.duration}ms`);
  } else {
    console.error(`\n✗ Erro: ${result.error}`);
  }

  return result;
}

// Uso
await agenticQuery("Qual a melhor configuração para embeddings locais?");
```

---

**Versão:** 1.0.0
**Atualizado:** 2025-12-26
**Autor:** FazAI Development Team
