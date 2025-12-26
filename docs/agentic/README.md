# Sistema Agêntico FazAI

Sistema de loops agênticos com reflexão, memória persistente e auto-evolução para o assistente Linux inteligente FazAI.

## Visão Geral

O sistema agêntico FazAI implementa um loop de raciocínio autônomo que:
- **Busca contexto** em múltiplas bases de conhecimento (Qdrant)
- **Reflete** sobre ações e resultados
- **Aprende** salvando insights para consultas futuras
- **Evolui** identificando gaps de conhecimento

```
┌─────────────────────────────────────────────────────────┐
│              LOOP AGÊNTICO FAZAI                        │
│                                                          │
│  Query → Buscar → Refletir → Aprender → Responder      │
│            ↑                      ↓                      │
│            └──────── Loop ────────┘                      │
│                (max 5 iterações)                         │
└─────────────────────────────────────────────────────────┘
```

## Arquitetura

### Camadas do Sistema

1. **GenAIScript Layer** (`genaisrc/`)
   - Loop agêntico principal (`fazai-core.genai.mjs`)
   - Ferramentas Qdrant (`tools/qdrant-tools.mjs`)
   - Embeddings locais (`tools/transformers-embed.mjs`)

2. **TypeScript Native Layer** (`src/agentic/`)
   - Loop nativo TypeScript (`agentic-loop.ts`)
   - Executor GenAIScript (`genai-runner.ts`)
   - Integração com serviços FazAI

3. **Storage Layer** (Qdrant)
   - 6 collections especializadas
   - Fusion scoring multi-collection
   - Embeddings 1536-dim (compatível OpenAI/ECOA)

### Fluxo de Execução

```
┌─────────────┐
│   Usuário   │
│    Query    │
└──────┬──────┘
       │
       v
┌─────────────────────────────────────────────────────────┐
│ ITERAÇÃO (1-5x)                                         │
│                                                          │
│  1. BUSCAR CONTEXTO                                     │
│     ├─ Gera embedding da query                          │
│     ├─ Busca em 4 collections:                          │
│     │   • memory (peso 0.20)                            │
│     │   • learning (peso 0.40)                          │
│     │   • kb (peso 0.30)                                │
│     │   • inference (peso 0.10)                         │
│     └─ Fusion scoring (combina resultados)              │
│                                                          │
│  2. REFLETIR                                            │
│     ├─ Analisa resultados encontrados                   │
│     ├─ Gera meta-cognição (LLM reflete sobre LLM)       │
│     ├─ Calcula confiança                                │
│     └─ Decide se continua                               │
│                                                          │
│  3. APRENDER (se produtivo)                             │
│     ├─ Identifica insights úteis                        │
│     ├─ Gera embedding do insight                        │
│     └─ Salva em collection learning                     │
│                                                          │
│  4. VERIFICAR                                           │
│     ├─ Contexto suficiente? (≥3 itens)                  │
│     ├─ Limite de iterações? (<5)                        │
│     └─ Decisão: continuar ou responder                  │
│                                                          │
└─────────────────────────────────────────────────────────┘
       │
       v
┌─────────────┐
│  Resposta   │
│  ao Usuário │
└─────────────┘
```

## Componentes Principais

### 1. Loop Agêntico Principal

**Arquivo:** `genaisrc/fazai-core.genai.mjs`

Loop agêntico completo com 4 ferramentas (tools):

| Ferramenta | Descrição |
|------------|-----------|
| `qdrant_multi_search` | Busca multi-collection com fusion scoring |
| `qdrant_upsert_insight` | Salva insights com embedding automático |
| `reflect` | Meta-cognição (LLM reflete sobre ações) |
| `check_loop_status` | Verifica estado e decide continuação |
| `skill_seeker_scrape` | *[PLACEHOLDER]* Auto-geração de skills |

### 2. Ferramentas Qdrant

**Arquivo:** `genaisrc/tools/qdrant-tools.mjs`

Biblioteca completa de operações Qdrant:

```javascript
// Busca simples
qdrantSearch(collection, vector, limit)

// Busca multi-collection
qdrantMultiSearch(vector, collections, limitPerCollection)

// Fusion scoring (Neural Flow style)
qdrantFusionSearch(vector, weights)

// Upsert de insights
qdrantUpsertInsight(content, vector, category, source)

// Estatísticas
qdrantStats()
```

### 3. Embeddings Locais

**Arquivo:** `genaisrc/tools/transformers-embed.mjs`

Gera embeddings 100% local (CPU) usando Transformers.js:

- **Modelo:** Xenova/all-MiniLM-L6-v2
- **Dimensão nativa:** 384
- **Dimensão com padding:** 1536 (compatível Qdrant)
- **Tamanho:** ~80MB
- **Custo:** Zero (local)

```javascript
// Embedding único
const vector = await embed("texto aqui");

// Batch
const vectors = await embedBatch(["texto1", "texto2"]);
```

### 4. Loop TypeScript Nativo

**Arquivo:** `src/agentic/agentic-loop.ts`

Implementação nativa em TypeScript (alternativa ao GenAIScript):

```typescript
import { AgenticLoop } from "./agentic/agentic-loop.js";

const loop = new AgenticLoop({
  maxIterations: 5,
  enableReflection: true,
  enableLearning: true,
  verbose: true,
});

const state = await loop.run("Como configurar Qdrant?");
console.log(loop.formatOutput(state));
```

### 5. Executor GenAIScript

**Arquivo:** `src/agentic/genai-runner.ts`

Executa scripts GenAIScript com retry e timeout:

```typescript
import { runAgenticLoop } from "./agentic/genai-runner.js";

const result = await runAgenticLoop("query aqui", {
  timeout: 180000, // 3 minutos
  verbose: true,
  maxRetries: 2,
});
```

## Collections Qdrant

O sistema usa 6 collections especializadas:

| Collection | Propósito | Peso Fusion |
|------------|-----------|-------------|
| `fazai_personality` | Traços de personalidade | - |
| `fazai_memory` | Memórias de conversas | 0.20 |
| `fazai_learning` | Aprendizados técnicos | 0.40 |
| `fazai_kb` | Knowledge base | 0.30 |
| `fazai_inference` | Regras de inferência | 0.10 |
| `fazai_semantic_cache` | Cache semântico | - |

**URL Padrão:** `http://localhost:6333`

## Configuração

### Requisitos

```bash
# Qdrant (Docker recomendado)
docker run -p 6333:6333 -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage:z \
  qdrant/qdrant

# Node.js 18+
node --version

# Dependências
npm install
```

### Variáveis de Ambiente

```bash
# Qdrant
QDRANT_URL=http://localhost:6333

# Modelos (opcional - usa Ollama local por padrão)
GENAISCRIPT_DEFAULT_MODEL=ollama:phi3

# Projeto (auto-detectado)
FAZAI_PROJECT_ROOT=/home/user/fazai-ng
```

## Uso

### Via CLI (recomendado)

```bash
# Loop agêntico completo
fazai --agentic "Como usar Qdrant collections?"

# Com verbose
fazai --agentic "query" --verbose

# Com modelo específico
fazai --agentic "query" --model "anthropic:claude-3-5-sonnet"
```

### Via TypeScript

```typescript
// Loop nativo TypeScript
import { runAgenticQuery } from "./agentic/agentic-loop.js";

const output = await runAgenticQuery("Como configurar embeddings?", {
  maxIterations: 3,
  verbose: true,
});

console.log(output);
```

### Via GenAIScript Direto

```bash
# Executa script diretamente
npx genaiscript run genaisrc/fazai-core.genai.mjs \
  --vars query="Como usar Qdrant?"

# Com modelo específico
npx genaiscript run genaisrc/fazai-core.genai.mjs \
  --vars query="query" \
  --model "ollama:phi3"
```

## Exemplos

### Exemplo 1: Busca Multi-Collection

```typescript
import { qdrantFusionSearch } from "./genaisrc/tools/qdrant-tools.mjs";
import { embed } from "./genaisrc/tools/transformers-embed.mjs";

const query = "Como configurar Qdrant?";
const vector = await embed(query);

const results = await qdrantFusionSearch(vector, {
  memory: 0.20,
  learning: 0.40,
  kb: 0.30,
  inference: 0.10,
});

console.log(`Encontrados ${results.length} resultados`);
results.forEach(r => {
  console.log(`[${r.source}] (${r.fusedScore.toFixed(3)}) ${r.payload.content}`);
});
```

### Exemplo 2: Salvar Insight

```typescript
import { qdrantUpsertInsight } from "./genaisrc/tools/qdrant-tools.mjs";
import { embed } from "./genaisrc/tools/transformers-embed.mjs";

const insight = "Usar fusion scoring melhora precisão em 40%";
const vector = await embed(insight);

const result = await qdrantUpsertInsight(
  insight,
  vector,
  "optimization",
  "benchmark_test"
);

console.log(`Insight salvo:`, result);
```

### Exemplo 3: Loop Completo com Reflexão

```typescript
import { AgenticLoop } from "./agentic/agentic-loop.js";

const loop = new AgenticLoop({
  maxIterations: 5,
  enableReflection: true,
  enableLearning: true,
  verbose: true,
  minContextItems: 3,
});

const state = await loop.run("Qual a melhor configuração de Qdrant?");

console.log("\n=== RESULTADO ===");
console.log(`Iterações: ${state.iteration}`);
console.log(`Contexto: ${state.context.length} itens`);
console.log(`Insights: ${state.insights.length}`);
console.log(`Reflexões: ${state.reflections.length}`);

if (state.context.length > 0) {
  console.log("\nTop 3 resultados:");
  state.context.slice(0, 3).forEach((ctx, i) => {
    console.log(`${i+1}. [${ctx.source}] (${ctx.fusedScore.toFixed(3)})`);
    console.log(`   ${ctx.content.substring(0, 100)}...`);
  });
}
```

## Performance

### Benchmarks (DL380 G8, Xeon E5-2670)

| Operação | Tempo Médio | Observações |
|----------|-------------|-------------|
| Embedding (local) | ~50ms | Transformers.js, CPU |
| Busca single collection | ~10ms | Qdrant local |
| Busca multi-collection (4x) | ~40ms | Paralelo |
| Fusion scoring | ~5ms | In-memory |
| **Loop completo (5 iter)** | **~2-3s** | Com reflexões |

### Otimizações

1. **Cache de embedder** - Modelo carregado uma vez
2. **Busca paralela** - 4 collections simultâneas
3. **Retry com backoff** - Tolerância a falhas temporárias
4. **Timeout configurável** - Evita travamentos

## Troubleshooting

### Qdrant não conecta

```bash
# Verificar se está rodando
curl http://localhost:6333/collections

# Reiniciar Docker
docker restart qdrant
```

### Modelo não carrega (Transformers.js)

```bash
# Cache pode estar corrompido
rm -rf ~/.cache/huggingface/

# Forçar download
node -e "import('@xenova/transformers').then(t => t.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2'))"
```

### GenAIScript timeout

```typescript
// Aumentar timeout
const result = await runAgenticLoop(query, {
  timeout: 300000, // 5 minutos
  maxRetries: 3,
});
```

### Collection não existe

```typescript
import { ensureCollection } from "./genaisrc/tools/qdrant-tools.mjs";

// Cria automaticamente se não existir
await ensureCollection("fazai_learning", 1536);
```

## Próximos Passos

- [ ] Implementar Skill Seekers (auto-geração de skills)
- [ ] Integração com MCP servers
- [ ] Dashboard de métricas
- [ ] Exportação de conhecimento
- [ ] Multi-modal (imagens, PDFs)

## Links Relacionados

- [Arquitetura Técnica](./ARCHITECTURE.md)
- [Documentação das Ferramentas](./TOOLS.md)
- [Guia de Uso](./USAGE.md)
- [Qdrant Architecture](../QDRANT_ARCHITECTURE.md)
- [CORACAO_AGENTICO.md](../CORACAO_AGENTICO.md)

---

**Versão:** 1.0.0
**Atualizado:** 2025-12-26
**Autor:** FazAI Development Team
