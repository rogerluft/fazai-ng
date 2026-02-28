# Universal Local Embedder

## Overview

The Universal Local Embedder provides a unified interface for generating text embeddings using ONNX BGE-base-en-v1.5 with native 768-dimensional vectors (Lei 768). Embeddings run entirely on-device via the `qdrant-universal-injection` npm package — no external API or Ollama server required for embedding.

## Features

- **Local ONNX Execution**: Uses BGE-base-en-v1.5 via ONNX runtime (no API costs)
- **Native 768d**: Uses BGE-base-en-v1.5 native dimension — no padding needed
- **Batch Processing**: Efficient multi-text embedding generation
- **Retry Logic**: Automatic retry on transient failures
- **Type Safety**: Full TypeScript support with strict typing
- **Cold Start**: ~11s for ONNX embedder initialization (subsequent calls are fast)

## Architecture

```
Input Text
    ↓
qdrant-universal-injection (ONNX runtime)
    ↓
BGE-base-en-v1.5 model
    ↓
Native Embedding (768 dimensions - Lei 768)
```

## Installation

The Universal Local Embedder depends on `qdrant-universal-injection`, which must be linked locally:

```bash
# 1. Build qdrant-universal-injection
cd /home/rluft/qdrant-universal-injection
npm install
npm run build

# 2. Link into fazai-ng
cd /home/rluft/fazai-ng
npm link /home/rluft/qdrant-universal-injection
```

**Note:** Ollama is no longer required for embeddings. Ollama remains in the fallback chain only for LLM inference (llama3.2, qwen, mistral, etc.).

## Requirements

- Node.js 18+
- `qdrant-universal-injection` linked via `npm link` (see Installation above)
- No Ollama required for embeddings

## Usage

### Single Embedding

```typescript
import { generateUniversalEmbedding } from "./services/universal-embedder";

// Generate single embedding
const embedding = await generateUniversalEmbedding("Hello world");
console.log(embedding.length); // 768
```

### Batch Embeddings

```typescript
import { UniversalLocalEmbedder } from "./services/universal-embedder";

const embedder = new UniversalLocalEmbedder();

const texts = [
  "Machine learning is fascinating",
  "Natural language processing",
  "Computer vision applications"
];

const embeddings = await embedder.embedBatch(texts);
console.log(embeddings.length); // 3
console.log(embeddings[0].length); // 768
```

### Custom Configuration

```typescript
import { UniversalLocalEmbedder } from "./services/universal-embedder";

const embedder = new UniversalLocalEmbedder(
  "bge-base-en-v1.5",  // Model name (ONNX)
  768                   // Native dimension
);

const embedding = await embedder.embed("Custom configuration example");
```

## Integration with Qdrant

All Qdrant collections in FazAI use **768-dimensional** vectors (Lei 768) with Cosine distance:

```typescript
import { UniversalLocalEmbedder } from "./services/universal-embedder";
import { QdrantClient } from "@qdrant/js-client-rest";

const embedder = new UniversalLocalEmbedder();
const qdrant = new QdrantClient({ url: "http://localhost:6333" });

// Create collection with 768 dimensions (Lei 768)
await qdrant.createCollection("my_collection", {
  vectors: {
    size: 768,
    distance: "Cosine"
  }
});

// Insert embeddings
const text = "Sample document";
const vector = await embedder.embed(text);

await qdrant.upsert("my_collection", {
  points: [{
    id: "doc1",
    vector: vector,
    payload: { text: text }
  }]
});

// Search
const queryVector = await embedder.embed("search query");
const results = await qdrant.search("my_collection", {
  vector: queryVector,
  limit: 5
});
```

## Error Handling

The embedder includes robust error handling:

```typescript
import { UniversalLocalEmbedder } from "./services/universal-embedder";

const embedder = new UniversalLocalEmbedder();

try {
  const embedding = await embedder.embed("Test text");
} catch (error) {
  // On failure, returns zero vector as fallback
  // Check logs for detailed error information
  console.error("Embedding failed:", error);
}
```

## Performance

### ONNX Initialization
- **Cold start**: ~11s (ONNX model load on first call)
- **Subsequent calls**: fast (model stays loaded in memory)

### Single Embedding
- **Latency**: ~50-200ms after initialization (depending on text length)
- **Context Window**: 512 tokens (BGE-base-en-v1.5 limit)

### Batch Embedding
- **Processing**: Sequential
- **Progress Logging**: Every 10 items for batches > 10
- **Recommended Batch Size**: 10-100 texts

### Optimization Tips

1. **Batch when possible**: Use `embedBatch()` for multiple texts
2. **Truncate long texts**: Pre-truncate to 512 tokens to match model window
3. **Cache embeddings**: Store in Qdrant or local cache to avoid re-embedding

## Troubleshooting

### qdrant-universal-injection Not Found

```bash
# Verify npm link is active
ls -la /home/rluft/fazai-ng/node_modules/qdrant-universal-injection

# Re-link if missing
cd /home/rluft/fazai-ng
npm link /home/rluft/qdrant-universal-injection
```

### Slow Cold Start

The ONNX embedder takes ~11s to initialize the first time. This is expected behavior — subsequent calls within the same process are fast.

### Dimension Mismatch

All FazAI Qdrant collections must use 768 dimensions (Lei 768). If you see dimension mismatch errors:

1. Verify the collection was created with `size: 768`
2. Run `fazai vector recreate --provider qdrant` to rebuild collections

## API Reference

### `generateUniversalEmbedding(text: string): Promise<number[]>`

Generate universal embedding for a single text.

**Parameters:**
- `text`: Input text

**Returns:** 768-dimensional embedding vector

---

### `class UniversalLocalEmbedder`

Main embedder class backed by ONNX BGE-base-en-v1.5 via `qdrant-universal-injection`.

#### Constructor

```typescript
constructor(
  model?: string,
  nativeDimension?: number
)
```

**Parameters:**
- `model`: Model name (default: `bge-base-en-v1.5`)
- `nativeDimension`: Model's native dimension (default: 768)

#### Methods

##### `embed(text: string): Promise<number[]>`

Generate embedding for a single text.

**Parameters:**
- `text`: Input text

**Returns:** 768-dimensional embedding vector

---

##### `embedBatch(texts: string[]): Promise<number[][]>`

Generate embeddings for multiple texts.

**Parameters:**
- `texts`: Array of input texts

**Returns:** Array of 768-dimensional embedding vectors

---

##### `getInfo(): object`

Get embedder configuration.

**Returns:**
```typescript
{
  model: string;
  nativeDimension: number;
  backend: "onnx";
}
```

## Testing

Run unit tests:

```bash
npm test -- tests/unit/universal-embedder.test.ts
```

Run integration tests (requires qdrant-universal-injection linked):

```bash
npm test -- tests/integration/universal-embedder.test.ts
```

## Migration from nomic-embed-text (Ollama)

If you have existing Qdrant collections created with `nomic-embed-text` (768d via Ollama), they are dimensionally compatible with BGE-base-en-v1.5 (also 768d). However, since the two models use different embedding spaces, existing vectors should be re-indexed for best similarity accuracy:

```bash
# Recreate all collections and re-index
fazai vector recreate --provider qdrant
fazai index --force
```

## License

Apache-2.0

---

**Last Updated:** 2026-02-28
**Author:** FazAI Team
**Version:** 3.14.1
