# FazAI Personality System - Complete Index

Sistema completo de ingestão, armazenamento e recuperação de dados de personalidade via embeddings vetoriais.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Data Sources (JSON)                      │
│  ┌─────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │Conversations│ │ Memories │ │ Projects │ │  Users   │   │
│  └─────────────┘ └──────────┘ └──────────┘ └──────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              PersonalityIngestor Service                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Chunking Semantic (Q/A pairs)                       │   │
│  │ Type-specific payloads (dialogue/fact/technical)    │   │
│  │ Batch processing (50 chunks/batch)                  │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           UniversalLocalEmbedder (1536d)                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Ollama (mxbai-embed-large) → Zero Padding           │   │
│  │ OpenAI (text-embedding-3-small) → Native 1536d      │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│         Qdrant: fazai_personality (1536d, Cosine)           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Vector embeddings + Rich metadata                   │   │
│  │ Filterable by: type, source, project, version       │   │
│  │ Semantic search with score threshold                │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│            PersonalityLoader Service                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Load traits from Qdrant                             │   │
│  │ LRU Cache (5min TTL)                                │   │
│  │ Graceful fallback to local/default                  │   │
│  │ Build system prompts                                │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  FazAI Application                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Personality-aware prompts                           │   │
│  │ Context-augmented responses (RAG)                   │   │
│  │ Semantic search for relevant history                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

### Core Implementation

```
src/
├── services/
│   ├── personality-ingestor.ts     # Main ingestion logic (624 lines)
│   ├── personality-loader.ts       # Trait loading & caching (430 lines)
│   ├── embeddings.ts               # Embedding generation (437 lines)
│   └── semantic-cache.ts           # Embedding cache layer (419 lines)
│
├── scripts/
│   └── ingest-personality.ts       # CLI ingestion script (128 lines)
│
└── database/
    └── qdrant-pool.ts              # Qdrant connection pool (230 lines)
```

### Documentation

```
docs/
├── PERSONALITY_INGESTION.md        # Main documentation (600+ lines)
├── PERSONALITY_INGESTION_SETUP.md  # Quick setup guide (400+ lines)
└── PERSONALITY_SYSTEM_INDEX.md     # This file
```

### Examples & Tests

```
examples/
└── personality-ingestion-example.ts # 5 working examples (283 lines)

tests/
└── unit/
    └── personality-ingestor.test.ts # 10 unit tests (371 lines)
```

## Data Flow

### 1. Ingestion Phase

```typescript
// Input: 4 JSON files
conversations.json  → 150 conversations → ~300 Q/A pairs
memories.json       → 1 memory object   → 2-10 facts
projects.json       → 150 projects      → 150-500 chunks
users.json          → 1 user            → 1 chunk

// Processing
PersonalityIngestor.ingestAll()
  ├─> extractQAPairs()           // Semantic chunking
  ├─> generatePayloads()         // Type-specific metadata
  ├─> embedder.generateBatch()   // 1536d vectors
  └─> qdrant.upsert()            // Batch insert

// Output: ~450-800 vector points in Qdrant
```

### 2. Query Phase

```typescript
// Input: User query or system initialization
const query = "How to configure Qdrant?";

// Processing
embedder.generate(query)                    // Query → 1536d vector
  ↓
qdrant.search(vector, filters, threshold)   // Semantic search
  ↓
loadPersonalityFromQdrant()                 // Load traits
  ↓
buildPersonalitySystemPrompt()              // Generate prompt

// Output: Personality-aware system prompt + relevant context
```

## Payload Schemas

### Dialogue (Conversations)

```json
{
  "type": "dialogue",
  "style": "claudio",
  "emotional_layer": 0.8,
  "ressonancia": 1.2,
  "source_file": "conversations.json",
  "source_uuid": "conv-uuid",
  "created_at": "2025-11-17T05:34:19Z",
  "ingestion_version": "v1-resurrected",
  "ingested_at": "2025-12-27T15:00:00Z",
  "metadata": {
    "conversation_name": "Project review",
    "conversation_summary": "Discussion about...",
    "human_message_uuid": "msg-123",
    "assistant_message_uuid": "msg-456"
  }
}
```

### Fact (Memories)

```json
{
  "type": "fact",
  "context": "memory",
  "importance": 1.0,
  "source_file": "memories.json",
  "ingestion_version": "v1-resurrected",
  "ingested_at": "2025-12-27T15:00:00Z",
  "metadata": {
    "memory_type": "conversations",
    "account_uuid": "user-uuid"
  }
}
```

### Technical Context (Projects)

```json
{
  "type": "technical_context",
  "project": "fazai",
  "source_file": "projects.json",
  "source_uuid": "project-uuid",
  "created_at": "2025-08-24T02:42:00Z",
  "ingestion_version": "v1-resurrected",
  "ingested_at": "2025-12-27T15:00:00Z",
  "metadata": {
    "project_name": "fazai-ng",
    "is_private": false,
    "creator_name": "roger luft"
  }
}
```

### Social Context (Users)

```json
{
  "type": "social_context",
  "relation": true,
  "source_file": "users.json",
  "source_uuid": "user-uuid",
  "ingestion_version": "v1-resurrected",
  "ingested_at": "2025-12-27T15:00:00Z",
  "metadata": {
    "full_name": "roger luft",
    "email_address": "email@example.com"
  }
}
```

## Usage Patterns

### Pattern 1: One-time Ingestion

```bash
# Setup
fazai qdrant create-collection fazai_personality --dimension 1536

# Ingest
tsx src/scripts/ingest-personality.ts /path/to/data

# Verify
fazai qdrant info fazai_personality
```

### Pattern 2: Programmatic with Stats

```typescript
import { PersonalityIngestor } from "./services/personality-ingestor";

const ingestor = new PersonalityIngestor();
const stats = await ingestor.ingestAll("/path/to/data");

console.log(`✅ ${stats.totalChunks} chunks`);
console.log(`⚡ ${(stats.duration! / 1000).toFixed(2)}s`);
```

### Pattern 3: RAG with Personality

```typescript
import { loadPersonalityFromQdrant } from "./services/personality-loader";
import { createEmbeddingService } from "./services/embeddings";
import { getQdrantClient } from "./database/qdrant-pool";

// 1. Load personality
const personality = await loadPersonalityFromQdrant();
const basePrompt = buildPersonalitySystemPrompt(personality);

// 2. Find relevant context
const embedder = await createEmbeddingService();
const client = await getQdrantClient();

const userQuery = "How do I use FazAI?";
const queryVector = await embedder.generate(userQuery);

const results = await client.search("fazai_personality", {
  vector: queryVector,
  limit: 3,
  score_threshold: 0.7,
  filter: {
    must: [{ key: "type", match: { value: "dialogue" } }],
  },
});

// 3. Augment prompt
const context = results
  .map((r) => (r.payload as any).text)
  .join("\n\n---\n\n");

const finalPrompt = `${basePrompt}

Relevant context from past conversations:
${context}

User question: ${userQuery}`;
```

### Pattern 4: Filtered Queries

```typescript
// Query by type
const dialogues = await client.search("fazai_personality", {
  vector: queryVector,
  filter: {
    must: [{ key: "type", match: { value: "dialogue" } }],
  },
});

// Query by project
const fazaiProjects = await client.search("fazai_personality", {
  vector: queryVector,
  filter: {
    must: [
      { key: "type", match: { value: "technical_context" } },
      { key: "metadata.project_name", match: { text: "fazai" } },
    ],
  },
});

// Query by ingestion version
const resurrected = await client.scroll("fazai_personality", {
  filter: {
    must: [{ key: "ingestion_version", match: { value: "v1-resurrected" } }],
  },
  limit: 100,
});
```

## Performance Metrics

### Ollama (Local, CPU)

```
Model: mxbai-embed-large
Hardware: AMD Ryzen 7 / Intel Xeon
Throughput: 10-20 chunks/second
150 conversations (~300 chunks): 15-30 seconds
Memory: ~500MB peak
```

### OpenAI (Cloud, API)

```
Model: text-embedding-3-small
API: Batch parallel requests
Throughput: 50-100 chunks/second
150 conversations (~300 chunks): 3-10 seconds
Cost: ~$0.02 per 1M tokens (very cheap)
```

### Qdrant Insert

```
Batch size: 50 points
Network: Local (localhost:6333)
Throughput: ~1000 points/second
500 chunks: <1 second insert time
```

## Dependencies

### Runtime

- `@qdrant/js-client-rest`: ^1.15.1
- Node.js: >= 18.17.0 (fs/promises, crypto.randomUUID)

### Embedding Providers

- **Ollama** (local): mxbai-embed-large or nomic-embed-text
- **OpenAI** (cloud): text-embedding-3-small (1536d)

### Dev Dependencies

- `typescript`: ^5.5.3
- `vitest`: ^4.0.15
- `tsx`: ^4.0.0

## Configuration

### Qdrant

```bash
# /etc/fazai/fazai.conf
QDRANT_URL=http://localhost:6333
# QDRANT_API_KEY=optional-if-auth-enabled
```

### Embeddings

```bash
# /etc/fazai/fazai.conf

# Option 1: Ollama (recommended for dev)
OLLAMA_BASE_URL=http://192.168.0.101:11434

# Option 2: OpenAI (recommended for prod)
OPENAI_API_KEY=sk-...
```

## Integration Points

### 1. System Prompt Generation

```typescript
// src/app.ts or src/prompts/system.ts
import { loadPersonalityFromQdrant, buildPersonalitySystemPrompt } from "./services/personality-loader";

export async function generateSystemPrompt(): Promise<string> {
  const personality = await loadPersonalityFromQdrant();
  return buildPersonalitySystemPrompt(personality);
}
```

### 2. Context Augmentation (RAG)

```typescript
// src/services/context-augmenter.ts
import { createEmbeddingService } from "./embeddings";
import { getQdrantClient } from "./database/qdrant-pool";

export async function augmentWithPersonality(query: string): Promise<string[]> {
  const embedder = await createEmbeddingService();
  const client = await getQdrantClient();

  const vector = await embedder.generate(query);

  const results = await client.search("fazai_personality", {
    vector,
    limit: 5,
    score_threshold: 0.7,
  });

  return results.map((r) => (r.payload as any).text || "");
}
```

### 3. Memory Storage (Feedback Loop)

```typescript
// Store new conversations back to Qdrant
import { randomUUID } from "crypto";
import { getQdrantClient } from "./database/qdrant-pool";
import { createEmbeddingService } from "./embeddings";

export async function storeConversation(
  humanMessage: string,
  assistantMessage: string
): Promise<void> {
  const text = `Q: ${humanMessage}\n\nA: ${assistantMessage}`;

  const embedder = await createEmbeddingService();
  const embedding = await embedder.generate(text);

  const client = await getQdrantClient();

  await client.upsert("fazai_personality", {
    points: [
      {
        id: randomUUID(),
        vector: embedding,
        payload: {
          type: "dialogue",
          style: "claudio",
          emotional_layer: 0.8,
          ressonancia: 1.2,
          source_file: "runtime",
          ingestion_version: "v2-live",
          ingested_at: new Date().toISOString(),
          metadata: {
            conversation_name: "Live chat",
            timestamp: Date.now(),
          },
        },
      },
    ],
  });
}
```

## Testing

```bash
# Run unit tests
npm test -- tests/unit/personality-ingestor.test.ts

# Run all tests
npm test

# Coverage
npm run test:coverage
```

## Monitoring

```bash
# Collection stats
fazai qdrant info fazai_personality

# Count by type
tsx -e "
const client = await (await import('./src/database/qdrant-pool.js')).getQdrantClient();
const types = ['dialogue', 'fact', 'technical_context', 'social_context'];
for (const type of types) {
  const count = await client.count('fazai_personality', {
    filter: { must: [{ key: 'type', match: { value: type } }] }
  });
  console.log(\`\${type}: \${count.count}\`);
}
"

# Recent ingestions
tsx -e "
const client = await (await import('./src/database/qdrant-pool.js')).getQdrantClient();
const recent = await client.scroll('fazai_personality', {
  filter: {
    must: [{ key: 'ingestion_version', match: { value: 'v1-resurrected' } }]
  },
  limit: 5,
  with_payload: true
});
console.log(JSON.stringify(recent.points.map(p => p.payload), null, 2));
"
```

## Roadmap

### v1.0 (Current)

- ✅ Basic ingestion (4 data types)
- ✅ Semantic chunking (Q/A pairs)
- ✅ Type-specific payloads
- ✅ Batch processing
- ✅ Unit tests
- ✅ Documentation

### v1.1 (Planned)

- [ ] Incremental updates (only new data)
- [ ] Deduplication logic
- [ ] Multi-version support (v1, v2, v3)
- [ ] Compression for large texts

### v2.0 (Future)

- [ ] Auto-sync from Claude API
- [ ] Real-time conversation storage
- [ ] Sentiment analysis payloads
- [ ] Topic clustering
- [ ] Cross-collection search (personality + source code)

## References

### Internal

- `/src/services/personality-ingestor.ts` - Main implementation
- `/src/services/personality-loader.ts` - Trait loading
- `/src/services/embeddings.ts` - Embedding generation
- `/docs/PERSONALITY_INGESTION.md` - Full documentation
- `/docs/PERSONALITY_INGESTION_SETUP.md` - Setup guide

### External

- Qdrant: https://qdrant.tech/documentation/
- Ollama: https://ollama.ai/library/mxbai-embed-large
- OpenAI Embeddings: https://platform.openai.com/docs/guides/embeddings

---

**Author**: Claude Code (TypeScript Pro + Backend Architect)
**Version**: 1.0.0
**Date**: 2025-12-27
**Lines of Code**: ~1,400 (core + tests + examples)
**Documentation**: ~2,000 lines
**Test Coverage**: 10 unit tests, all passing
