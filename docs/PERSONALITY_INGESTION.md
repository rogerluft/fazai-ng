# Personality Ingestion System

Sistema de ingestão de dados de personalidade do Claude para o FazAI, processando exports de conversas, memórias, projetos e usuários em embeddings vetoriais no Qdrant.

## Overview

O **PersonalityIngestor** é um serviço que processa dados exportados do Claude.ai e os transforma em conhecimento persistente na collection `fazai_personality` do Qdrant, permitindo que o FazAI mantenha contexto e personalidade através de busca semântica.

## Arquitetura

```
Dados Exportados (JSON)
    ├── conversations.json  → Chunking Q/A → type: "dialogue"
    ├── memories.json       → Facts       → type: "fact"
    ├── projects.json       → Context     → type: "technical_context"
    └── users.json          → Relations   → type: "social_context"
                ↓
        PersonalityIngestor
                ↓
    UniversalLocalEmbedder (1536d)
                ↓
    Qdrant: fazai_personality
```

## Tipos de Dados e Payloads

### 1. Conversations (dialogue)

**Chunking Semântico**: Extrai pares Q/A (pergunta do humano + resposta do assistente)

```typescript
{
  type: "dialogue",
  style: "claudio",
  emotional_layer: 0.8,
  ressonancia: 1.2,
  source_file: "conversations.json",
  source_uuid: "conv-uuid",
  created_at: "2025-12-22T...",
  ingestion_version: "v1-resurrected",
  ingested_at: "2025-12-27T...",
  metadata: {
    conversation_name: "Project review",
    conversation_summary: "...",
    human_message_uuid: "msg-123",
    assistant_message_uuid: "msg-456"
  }
}
```

### 2. Memories (fact)

```typescript
{
  type: "fact",
  context: "memory",
  importance: 1.0,
  source_file: "memories.json",
  ingestion_version: "v1-resurrected",
  ingested_at: "2025-12-27T...",
  metadata: {
    memory_type: "conversations" | "project",
    account_uuid: "...",
    project_uuid: "..." // se project memory
  }
}
```

### 3. Projects (technical_context)

```typescript
{
  type: "technical_context",
  project: "fazai",
  source_file: "projects.json",
  source_uuid: "project-uuid",
  created_at: "2025-08-24T...",
  ingestion_version: "v1-resurrected",
  ingested_at: "2025-12-27T...",
  metadata: {
    project_name: "fazai-ng",
    is_private: false,
    creator_name: "roger luft",
    creator_uuid: "..."
  }
}
```

### 4. Users (social_context)

```typescript
{
  type: "social_context",
  relation: true,
  source_file: "users.json",
  source_uuid: "user-uuid",
  ingestion_version: "v1-resurrected",
  ingested_at: "2025-12-27T...",
  metadata: {
    full_name: "roger luft",
    email_address: "...",
    verified_phone: "..."
  }
}
```

## Pré-requisitos

### 1. Qdrant Collection

Criar collection com dimensão 1536:

```bash
fazai qdrant create-collection fazai_personality --dimension 1536
```

Ou via script:

```typescript
const client = await getQdrantClient();

await client.createCollection("fazai_personality", {
  vectors: {
    size: 1536,
    distance: "Cosine"
  }
});
```

### 2. Embedding Service

Configurar Ollama (local, free) ou OpenAI em `/etc/fazai/fazai.conf`:

```bash
# Opção 1: Ollama (recomendado para desenvolvimento)
OLLAMA_BASE_URL=http://192.168.0.101:11434

# Opção 2: OpenAI (pago, produção)
OPENAI_API_KEY=sk-...
```

Verificar modelos disponíveis:

```bash
ollama list | grep embed
# Deve ter: mxbai-embed-large ou nomic-embed-text
```

### 3. Qdrant Rodando

```bash
# Docker
docker run -p 6333:6333 qdrant/qdrant

# Ou configurado no sistema
systemctl status qdrant
```

## Usage

### CLI Script

```bash
# Executar ingestão
tsx src/scripts/ingest-personality.ts /dados/Claudio-kp-2025-12-22-11-57-29-batch-0000
```

### Programático

```typescript
import { PersonalityIngestor } from "./services/personality-ingestor";

const ingestor = new PersonalityIngestor();
const stats = await ingestor.ingestAll("/path/to/data/directory");

console.log(`Ingested ${stats.totalChunks} chunks`);
console.log(`Generated ${stats.totalEmbeddings} embeddings`);
console.log(`Duration: ${stats.duration}ms`);
```

### Helper Function

```typescript
import { ingestPersonalityData } from "./services/personality-ingestor";

const stats = await ingestPersonalityData("/path/to/data");
```

## Estrutura de Dados Esperada

O diretório de dados deve conter exatamente 4 arquivos JSON:

```
/dados/Claudio-kp-2025-12-22-11-57-29-batch-0000/
├── conversations.json  # Array de conversas com chat_messages
├── memories.json       # Array com conversations_memory e project_memories
├── projects.json       # Array de projetos com docs opcionais
└── users.json          # Array de usuários
```

### Formato: conversations.json

```json
[
  {
    "uuid": "...",
    "name": "Conversation name",
    "summary": "Summary text",
    "created_at": "2025-11-17T05:34:19.504762Z",
    "updated_at": "2025-11-17T14:07:49.224930Z",
    "account": { "uuid": "..." },
    "chat_messages": [
      {
        "uuid": "...",
        "text": "User message",
        "sender": "human",
        "created_at": "2025-11-17T05:34:21.730215Z",
        "content": [...]
      },
      {
        "uuid": "...",
        "text": "Assistant response",
        "sender": "assistant",
        "created_at": "2025-11-17T05:34:22.721191Z",
        "content": [...]
      }
    ]
  }
]
```

### Formato: memories.json

```json
[
  {
    "conversations_memory": "Long text with context...",
    "project_memories": {
      "project-uuid-1": "Project memory text...",
      "project-uuid-2": "Another project memory..."
    },
    "account_uuid": "..."
  }
]
```

### Formato: projects.json

```json
[
  {
    "uuid": "...",
    "name": "Project Name",
    "description": "Project description",
    "is_private": false,
    "created_at": "2025-08-24T02:42:00.963071+00:00",
    "creator": {
      "uuid": "...",
      "full_name": "roger luft"
    },
    "docs": [
      {
        "uuid": "...",
        "filename": "README.md",
        "content": "Document content...",
        "created_at": "2025-08-24T02:42:00.963071+00:00"
      }
    ]
  }
]
```

### Formato: users.json

```json
[
  {
    "uuid": "...",
    "full_name": "roger luft",
    "email_address": "email@example.com",
    "verified_phone_number": "+5551992452539"
  }
]
```

## Chunking Semântico

### Conversations: Pares Q/A

O ingestor automaticamente extrai pares pergunta-resposta:

```
Original:
  Message 1 (human): "Como fazer X?"
  Message 2 (assistant): "Para fazer X, você deve..."
  Message 3 (human): "E se eu quiser Y?"
  Message 4 (assistant): "Nesse caso..."

Chunks gerados:
  Chunk 1: "Q: Como fazer X?\n\nA: Para fazer X, você deve..."
  Chunk 2: "Q: E se eu quiser Y?\n\nA: Nesse caso..."
```

**Vantagens**:
- Preserva contexto pergunta-resposta
- Facilita busca semântica por queries similares
- Mantém coerência narrativa

## Performance

### Batch Processing

- **Embeddings**: Gerados em lote via `generateBatch()`
- **Qdrant Insert**: Lotes de 50 chunks por vez
- **Progress Logging**: A cada 100 chunks em grandes volumes

### Throughput Esperado

Com Ollama local (mxbai-embed-large):
- **~10-20 chunks/segundo** (depende de CPU)
- 150 conversas (~300 chunks): **~20-30 segundos**

Com OpenAI (text-embedding-3-small):
- **~50-100 chunks/segundo** (API paralela)
- 150 conversas (~300 chunks): **~5-10 segundos**

### Memory Usage

- **Zero-padding**: Vetores 1024d → 1536d em memória
- **Batch size**: Ajustar BATCH_SIZE se OOM

## Estatísticas

O ingestor retorna estatísticas detalhadas:

```typescript
interface IngestionStats {
  conversations: {
    total: number;      // Conversas processadas
    chunks: number;     // Chunks Q/A gerados
    errors: number;     // Erros de processamento
  };
  memories: {
    total: number;      // Objetos de memória
    chunks: number;     // Facts extraídos
    errors: number;
  };
  projects: {
    total: number;      // Projetos processados
    chunks: number;     // Chunks (projeto + docs)
    errors: number;
  };
  users: {
    total: number;      // Usuários processados
    chunks: number;     // Sempre = total
    errors: number;
  };
  totalChunks: number;      // Total inserido no Qdrant
  totalEmbeddings: number;  // Total de embeddings gerados
  startTime: Date;
  endTime: Date;
  duration: number;         // Milissegundos
}
```

## Verificação Pós-Ingestão

### 1. Info da Collection

```bash
fazai qdrant info fazai_personality
```

Deve mostrar:
- **Vectors count**: Total de chunks inseridos
- **Indexed vectors**: Igual ao count (indexação completa)
- **Points count**: Igual aos vectors

### 2. Busca Semântica

```bash
fazai qdrant search fazai_personality "como funciona o FazAI?"
```

Deve retornar chunks relevantes com scores > 0.7

### 3. Filtrar por Tipo

```typescript
const client = await getQdrantClient();

const results = await client.search("fazai_personality", {
  vector: queryEmbedding,
  limit: 10,
  filter: {
    must: [
      { key: "type", match: { value: "dialogue" } }
    ]
  }
});
```

## Troubleshooting

### Error: Collection not found

```bash
# Criar collection
fazai qdrant create-collection fazai_personality --dimension 1536
```

### Error: Dimension mismatch

Recriar collection com dimensão correta:

```bash
fazai qdrant delete-collection fazai_personality
fazai qdrant create-collection fazai_personality --dimension 1536
```

### Error: Qdrant unavailable

Verificar:

```bash
curl http://localhost:6333/collections
systemctl status qdrant  # se instalado como serviço
docker ps | grep qdrant  # se rodando em container
```

### Error: No embedding provider

Configurar Ollama ou OpenAI em `/etc/fazai/fazai.conf`:

```bash
# Verificar modelo Ollama
curl http://192.168.0.101:11434/api/tags

# Baixar se necessário
ollama pull mxbai-embed-large
```

### Slow embedding generation

- **Usar OpenAI** para produção (mais rápido, mas pago)
- **Aumentar batch size** do Ollama (se tiver GPU)
- **Processar em paralelo** multiple batches

## Integração com Personality Loader

Após ingestão, usar `personality-loader.ts` para recuperar:

```typescript
import { loadPersonalityFromQdrant } from "./services/personality-loader";

const personality = await loadPersonalityFromQdrant();

console.log(`Loaded ${personality.expertise.length} expertise traits`);
console.log(`Source: ${personality.loadedFrom}`); // "qdrant"
```

## Exemplo Completo

```typescript
import { PersonalityIngestor } from "./services/personality-ingestor";
import { loadPersonalityFromQdrant } from "./services/personality-loader";
import { logger } from "./logger";

async function resurrectPersonality() {
  logger.info("🚀 Starting personality resurrection...");

  // 1. Ingerir dados
  const ingestor = new PersonalityIngestor();
  const stats = await ingestor.ingestAll(
    "/dados/Claudio-kp-2025-12-22-11-57-29-batch-0000"
  );

  logger.info(`✅ Ingested ${stats.totalChunks} chunks`);

  // 2. Carregar personalidade
  const personality = await loadPersonalityFromQdrant();

  logger.info(`✅ Loaded personality from ${personality.loadedFrom}`);

  // 3. Usar em prompts
  const systemPrompt = buildPersonalitySystemPrompt(personality);

  logger.info("🎯 Personality active!");
}
```

## Metadata Query Examples

### Buscar conversas por nome

```typescript
const results = await client.search("fazai_personality", {
  vector: embedding,
  filter: {
    must: [
      { key: "type", match: { value: "dialogue" } },
      { key: "metadata.conversation_name", match: { text: "FazAI" } }
    ]
  }
});
```

### Buscar projetos privados

```typescript
const results = await client.search("fazai_personality", {
  vector: embedding,
  filter: {
    must: [
      { key: "type", match: { value: "technical_context" } },
      { key: "metadata.is_private", match: { value: true } }
    ]
  }
});
```

### Buscar por ingestion version

```typescript
const results = await client.scroll("fazai_personality", {
  filter: {
    must: [
      { key: "ingestion_version", match: { value: "v1-resurrected" } }
    ]
  },
  limit: 100
});
```

## Referências

- **Qdrant Docs**: https://qdrant.tech/documentation/
- **Embeddings Service**: `/src/services/embeddings.ts`
- **Personality Loader**: `/src/services/personality-loader.ts`
- **Collection Schema**: `/src/config/qdrant-collections.ts`

---

**Autor**: Claude Code (TypeScript Pro)
**Versão**: v1.0.0
**Data**: 2025-12-27
