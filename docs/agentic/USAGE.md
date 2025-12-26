# Guia de Uso do Sistema Agêntico FazAI

Guia prático com exemplos e tutoriais para usar o sistema agêntico.

## Índice

1. [Quick Start](#quick-start)
2. [Casos de Uso](#casos-de-uso)
3. [Configuração](#configuração)
4. [Exemplos Práticos](#exemplos-práticos)
5. [Integração](#integração)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

## Quick Start

### Instalação

```bash
# 1. Clone e instale
cd /home/user/fazai-ng
npm install

# 2. Inicie Qdrant (Docker)
docker run -d -p 6333:6333 -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage:z \
  --name qdrant \
  qdrant/qdrant

# 3. Verifique Qdrant
curl http://localhost:6333/collections

# 4. Build do projeto
npm run build

# 5. Teste o loop agêntico
npx genaiscript run genaisrc/fazai-core.genai.mjs \
  --vars query="O que você pode fazer?"
```

### Primeiro Comando

```bash
# Via CLI FazAI (quando implementado)
fazai --agentic "Como usar embeddings locais?"

# Via GenAIScript direto
npx genaiscript run genaisrc/fazai-core.genai.mjs \
  --vars query="Como usar embeddings locais?"

# Via TypeScript/Node
node -e "import('./dist/agentic/agentic-loop.js').then(m => m.runAgenticQuery('Como usar embeddings locais?'))"
```

## Casos de Uso

### Caso 1: Consulta Técnica

**Cenário:** Preciso saber como configurar Qdrant collections.

**Solução:**

```bash
npx genaiscript run genaisrc/fazai-core.genai.mjs \
  --vars query="Como configurar Qdrant collections para embeddings de 1536 dimensões?"
```

**O que acontece:**

```
ITERAÇÃO 1:
  ├─ Busca em memory, learning, kb, inference
  ├─ Encontra 8 resultados relevantes
  ├─ Reflete: "Contexto suficiente, alta confiança"
  └─ Responde com informação consolidada

Duração: ~2s
```

---

### Caso 2: Salvar Novo Conhecimento

**Cenário:** Descobri uma otimização e quero salvar para consultas futuras.

**Solução TypeScript:**

```typescript
import { qdrantUpsertInsight } from "./genaisrc/tools/qdrant-tools.mjs";
import { embed } from "./genaisrc/tools/transformers-embed.mjs";

const insight = `
OTIMIZAÇÃO QDRANT:
Usar HNSW indexing com m=16 e ef_construct=100 reduz latência em 60%
para collections com 100k+ pontos.
`;

const vector = await embed(insight);

await qdrantUpsertInsight(
  insight,
  vector,
  "optimization",
  "performance_test_2025-12-26"
);

console.log("✓ Insight salvo! Será retornado em buscas futuras.");
```

---

### Caso 3: Busca Multi-Collection

**Cenário:** Preciso buscar em múltiplas bases de conhecimento simultaneamente.

**Solução:**

```javascript
import { qdrantFusionSearch } from "./genaisrc/tools/qdrant-tools.mjs";
import { embed } from "./genaisrc/tools/transformers-embed.mjs";

const query = "Melhores práticas para embeddings";
const vector = await embed(query);

// Pesos customizados (mais peso em learning e kb)
const results = await qdrantFusionSearch(vector, {
  memory: 0.10,      // Menos contexto conversacional
  learning: 0.45,    // Mais aprendizados
  kb: 0.40,          // Mais knowledge base
  inference: 0.05    // Menos regras
});

console.log(`\nTop 5 resultados:\n`);
results.slice(0, 5).forEach((r, i) => {
  console.log(`${i+1}. [${r.source.toUpperCase()}] Fused: ${r.fusedScore.toFixed(4)}`);
  console.log(`   Original: ${r.score.toFixed(4)}`);
  console.log(`   ${r.payload.content.substring(0, 100)}...\n`);
});
```

---

### Caso 4: Loop Completo com Reflexão

**Cenário:** Problema complexo que requer múltiplas iterações.

**Solução:**

```typescript
import { AgenticLoop } from "./dist/agentic/agentic-loop.js";

const loop = new AgenticLoop({
  maxIterations: 5,
  enableReflection: true,
  enableLearning: true,
  verbose: true,
  minContextItems: 5,  // Exige mais contexto
  timeout: 180000      // 3 minutos
});

const state = await loop.run(
  "Qual a melhor arquitetura para sistema de RAG com Qdrant?"
);

console.log(loop.formatOutput(state));

// Análise do resultado
console.log(`\n=== MÉTRICAS ===`);
console.log(`Iterações executadas: ${state.iteration}`);
console.log(`Contexto acumulado: ${state.context.length} itens`);
console.log(`Insights gerados: ${state.insights.length}`);
console.log(`Reflexões: ${state.reflections.length}`);

if (state.reflections.length > 0) {
  const lastReflection = state.reflections[state.reflections.length - 1];
  console.log(`Confiança final: ${lastReflection.confidence.toFixed(2)}`);
}
```

---

## Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```bash
# Qdrant
QDRANT_URL=http://localhost:6333

# Modelo padrão (opcional)
GENAISCRIPT_DEFAULT_MODEL=ollama:phi3
# GENAISCRIPT_DEFAULT_MODEL=anthropic:claude-3-5-sonnet-latest
# GENAISCRIPT_DEFAULT_MODEL=openai:gpt-4-turbo

# Google AI (se usar Gemini)
GOOGLE_API_KEY=your_key_here

# OpenAI (se usar)
OPENAI_API_KEY=your_key_here

# Anthropic (se usar)
ANTHROPIC_API_KEY=your_key_here

# Projeto (auto-detectado, mas pode ser fixado)
FAZAI_PROJECT_ROOT=/home/user/fazai-ng

# Log level
LOG_LEVEL=info
```

### Configuração Qdrant

```bash
# Docker Compose (recomendado)
cat > docker-compose.yml <<EOF
version: '3.8'
services:
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - ./qdrant_storage:/qdrant/storage:z
    environment:
      - QDRANT__SERVICE__GRPC_PORT=6334
    restart: unless-stopped
EOF

docker-compose up -d
```

### Configuração de Modelos

#### Ollama (Local)

```bash
# Instalar Ollama
curl https://ollama.ai/install.sh | sh

# Baixar modelo
ollama pull phi3

# Testar
ollama run phi3 "Hello"

# Configurar no FazAI
export GENAISCRIPT_DEFAULT_MODEL=ollama:phi3
```

#### Anthropic (Cloud)

```bash
# Obter API key em https://console.anthropic.com/
export ANTHROPIC_API_KEY=sk-ant-...

# Configurar modelo
export GENAISCRIPT_DEFAULT_MODEL=anthropic:claude-3-5-sonnet-latest
```

#### Google Gemini (Cloud)

```bash
# Obter API key em https://makersuite.google.com/app/apikey
export GOOGLE_API_KEY=AIza...

# Configurar modelo
export GENAISCRIPT_DEFAULT_MODEL=google:gemini-1.5-pro
```

---

## Exemplos Práticos

### Exemplo 1: Script de Backup de Knowledge

```javascript
#!/usr/bin/env node
/**
 * backup-knowledge.mjs
 * Exporta todo conhecimento das collections para JSON
 */

import { qdrantScroll, COLLECTIONS } from "./genaisrc/tools/qdrant-tools.mjs";
import { writeFile } from "fs/promises";

async function backupKnowledge() {
  const backup = {};

  for (const [name, fullName] of Object.entries(COLLECTIONS)) {
    console.log(`Exportando ${name}...`);

    const points = await qdrantScroll(fullName, 1000);

    backup[name] = {
      collection: fullName,
      count: points.length,
      exported_at: new Date().toISOString(),
      points: points.map(p => ({
        id: p.id,
        payload: p.payload
      }))
    };

    console.log(`  ✓ ${points.length} pontos`);
  }

  const filename = `fazai-backup-${Date.now()}.json`;
  await writeFile(filename, JSON.stringify(backup, null, 2));

  console.log(`\n✓ Backup salvo em: ${filename}`);
}

backupKnowledge();
```

**Uso:**

```bash
node backup-knowledge.mjs
```

---

### Exemplo 2: Indexação em Batch

```javascript
#!/usr/bin/env node
/**
 * index-docs.mjs
 * Indexa arquivos markdown em fazai_kb
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { qdrantUpsert } from "./genaisrc/tools/qdrant-tools.mjs";
import { embedBatch } from "./genaisrc/tools/transformers-embed.mjs";

async function indexDocs(docsDir) {
  console.log(`Indexando docs em: ${docsDir}\n`);

  // 1. Lista arquivos .md
  const files = (await readdir(docsDir))
    .filter(f => f.endsWith(".md"));

  console.log(`Encontrados ${files.length} arquivos\n`);

  // 2. Lê conteúdo
  const docs = [];
  for (const file of files) {
    const content = await readFile(join(docsDir, file), "utf-8");
    docs.push({
      filename: file,
      content: content.substring(0, 5000)  // Limita tamanho
    });
  }

  // 3. Gera embeddings em batch
  console.log("Gerando embeddings...");
  const texts = docs.map(d => d.content);
  const vectors = await embedBatch(texts);
  console.log("✓ Embeddings gerados\n");

  // 4. Prepara pontos
  const points = docs.map((doc, i) => ({
    id: Date.now() + i,
    vector: vectors[i],
    payload: {
      content: doc.content,
      filename: doc.filename,
      type: "documentation",
      category: "docs",
      source: "batch_indexing",
      timestamp: new Date().toISOString()
    }
  }));

  // 5. Upsert
  console.log("Salvando no Qdrant...");
  const result = await qdrantUpsert("fazai_kb", points);

  if (result.success) {
    console.log(`✓ ${result.count} documentos indexados!`);
  } else {
    console.error(`✗ Erro: ${result.error}`);
  }
}

// Uso
const docsDir = process.argv[2] || "./docs";
indexDocs(docsDir);
```

**Uso:**

```bash
node index-docs.mjs ./docs/guides
```

---

### Exemplo 3: Monitor de Performance

```javascript
#!/usr/bin/env node
/**
 * monitor-performance.mjs
 * Monitora performance do loop agêntico
 */

import { AgenticLoop } from "./dist/agentic/agentic-loop.js";

async function benchmark(queries) {
  const results = [];

  for (const query of queries) {
    console.log(`\nTesting: "${query}"`);

    const loop = new AgenticLoop({
      maxIterations: 5,
      enableReflection: true,
      enableLearning: false,  // Sem learning para benchmark limpo
      verbose: false
    });

    const startTime = Date.now();
    const state = await loop.run(query);
    const duration = Date.now() - startTime;

    const avgConfidence = state.reflections.length > 0
      ? state.reflections.reduce((sum, r) => sum + r.confidence, 0) / state.reflections.length
      : 0;

    const result = {
      query,
      duration,
      iterations: state.iteration,
      contextItems: state.context.length,
      avgConfidence: avgConfidence.toFixed(3),
      actionsCount: state.actions.length
    };

    results.push(result);

    console.log(`  Duration: ${duration}ms`);
    console.log(`  Iterations: ${state.iteration}`);
    console.log(`  Context: ${state.context.length} items`);
    console.log(`  Confidence: ${result.avgConfidence}`);
  }

  // Sumário
  console.log("\n=== BENCHMARK SUMMARY ===\n");

  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const avgIterations = results.reduce((sum, r) => sum + r.iterations, 0) / results.length;
  const avgContext = results.reduce((sum, r) => sum + r.contextItems, 0) / results.length;

  console.log(`Average duration: ${avgDuration.toFixed(0)}ms`);
  console.log(`Average iterations: ${avgIterations.toFixed(1)}`);
  console.log(`Average context items: ${avgContext.toFixed(1)}`);

  return results;
}

// Queries de teste
const testQueries = [
  "Como usar Qdrant?",
  "Otimizar embeddings locais",
  "Melhores práticas RAG",
  "Configurar fusion scoring"
];

benchmark(testQueries);
```

**Uso:**

```bash
node monitor-performance.mjs
```

---

### Exemplo 4: CLI Helper

```javascript
#!/usr/bin/env node
/**
 * fazai-agentic-cli.mjs
 * CLI wrapper para loop agêntico
 */

import { runAgenticQuery } from "./dist/agentic/agentic-loop.js";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
FazAI Agentic CLI

Usage:
  fazai-agentic <query> [options]

Options:
  --max-iterations <n>   Max iterations (default: 5)
  --verbose              Enable verbose logging
  --no-learning          Disable learning
  --no-reflection        Disable reflection

Examples:
  fazai-agentic "Como usar Qdrant?"
  fazai-agentic "Otimizar embeddings" --verbose
  fazai-agentic "Best practices RAG" --max-iterations 3
  `);
  process.exit(0);
}

// Parse args
let query = args[0];
const options = {
  maxIterations: 5,
  verbose: false,
  enableLearning: true,
  enableReflection: true
};

for (let i = 1; i < args.length; i++) {
  switch (args[i]) {
    case "--max-iterations":
      options.maxIterations = parseInt(args[++i]);
      break;
    case "--verbose":
      options.verbose = true;
      break;
    case "--no-learning":
      options.enableLearning = false;
      break;
    case "--no-reflection":
      options.enableReflection = false;
      break;
  }
}

// Execute
console.log(`\nQuery: "${query}"\n`);

try {
  const output = await runAgenticQuery(query, options);
  console.log(output);
} catch (error) {
  console.error(`\n✗ Error: ${error.message}`);
  process.exit(1);
}
```

**Uso:**

```bash
chmod +x fazai-agentic-cli.mjs

./fazai-agentic-cli.mjs "Como configurar Qdrant?" --verbose
```

---

## Integração

### Integração com Express.js

```javascript
import express from "express";
import { runAgenticQuery } from "./dist/agentic/agentic-loop.js";

const app = express();
app.use(express.json());

app.post("/api/agentic/query", async (req, res) => {
  const { query, options = {} } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Query required" });
  }

  try {
    const result = await runAgenticQuery(query, options);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(3000, () => {
  console.log("FazAI Agentic API listening on :3000");
});
```

---

### Integração com Discord Bot

```javascript
import { Client, GatewayIntentBits } from "discord.js";
import { runAgenticQuery } from "./dist/agentic/agentic-loop.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Comando: !fazai <query>
  if (message.content.startsWith("!fazai ")) {
    const query = message.content.slice(7);

    await message.channel.send("🤔 Pensando...");

    try {
      const result = await runAgenticQuery(query, {
        maxIterations: 3,
        verbose: false
      });

      // Extrai sumário (primeiros 2000 chars)
      const summary = result.substring(0, 2000);

      await message.reply(summary);
    } catch (error) {
      await message.reply(`❌ Erro: ${error.message}`);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
```

---

## Troubleshooting

### Problema: Qdrant não conecta

**Sintomas:**

```
Error: connect ECONNREFUSED 127.0.0.1:6333
```

**Solução:**

```bash
# Verificar se Qdrant está rodando
docker ps | grep qdrant

# Se não estiver, iniciar
docker start qdrant

# Ou reiniciar
docker restart qdrant

# Verificar logs
docker logs qdrant

# Testar conectividade
curl http://localhost:6333/collections
```

---

### Problema: Embeddings muito lentos

**Sintomas:**

```
[Transformers.js] Download: 20%
[Transformers.js] Download: 40%
...
```

**Solução:**

```bash
# Primeira execução baixa modelo (~80MB)
# Cache em ~/.cache/huggingface/

# Pré-baixar modelo
node -e "import('@xenova/transformers').then(t => t.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2'))"

# Verificar cache
ls -lh ~/.cache/huggingface/hub/
```

---

### Problema: GenAIScript timeout

**Sintomas:**

```
Error: Timeout após 120000ms
```

**Solução:**

```typescript
// Aumentar timeout
const result = await runAgenticLoop(query, {
  timeout: 300000,  // 5 minutos
  maxRetries: 3
});
```

---

### Problema: Collection não existe

**Sintomas:**

```
Error: Collection fazai_learning not found
```

**Solução:**

```javascript
import { ensureCollection } from "./genaisrc/tools/qdrant-tools.mjs";

// Cria se não existir
await ensureCollection("fazai_learning", 1536);
```

---

## Best Practices

### 1. Limite de Iterações

```typescript
// ✓ BOM: Limite razoável
const loop = new AgenticLoop({ maxIterations: 5 });

// ✗ RUIM: Muito alto (pode demorar muito)
const loop = new AgenticLoop({ maxIterations: 20 });
```

---

### 2. Timeout Apropriado

```typescript
// ✓ BOM: Timeout generoso para loop completo
runAgenticLoop(query, { timeout: 180000 });  // 3 min

// ✗ RUIM: Timeout muito curto
runAgenticLoop(query, { timeout: 10000 });   // 10s
```

---

### 3. Contexto Mínimo

```typescript
// ✓ BOM: Exige contexto suficiente
const loop = new AgenticLoop({ minContextItems: 3 });

// ✗ RUIM: Aceita qualquer contexto
const loop = new AgenticLoop({ minContextItems: 0 });
```

---

### 4. Pesos de Fusion

```javascript
// ✓ BOM: Pesos somam ~1.0, priorizando learning
qdrantFusionSearch(vector, {
  memory: 0.20,
  learning: 0.40,
  kb: 0.30,
  inference: 0.10
});

// ✗ RUIM: Pesos desequilibrados
qdrantFusionSearch(vector, {
  memory: 0.90,
  learning: 0.05,
  kb: 0.05,
  inference: 0.00
});
```

---

### 5. Error Handling

```typescript
// ✓ BOM: Try/catch com fallback
try {
  const result = await runAgenticQuery(query);
  console.log(result);
} catch (error) {
  console.error("Erro:", error.message);
  // Fallback para busca simples
  const fallback = await simpleSearch(query);
  console.log(fallback);
}

// ✗ RUIM: Sem error handling
const result = await runAgenticQuery(query);
console.log(result);  // Pode crashar!
```

---

### 6. Cache de Embeddings

```javascript
// ✓ BOM: Reutiliza embeddings
const embeddingCache = new Map();

async function getCachedEmbedding(text) {
  if (embeddingCache.has(text)) {
    return embeddingCache.get(text);
  }

  const vector = await embed(text);
  embeddingCache.set(text, vector);
  return vector;
}

// ✗ RUIM: Gera embedding toda vez
const vector = await embed(text);
```

---

**Versão:** 1.0.0
**Atualizado:** 2025-12-26
**Autor:** FazAI Development Team
