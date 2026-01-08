# Universal Local Embedder

## Overview

The Universal Local Embedder provides a unified interface for generating text embeddings using Ollama's local models with automatic dimension normalization via Zero Padding.

## Features

- **Local Execution**: Uses Ollama (no API costs)
- **Zero Padding**: Normalizes 768d vectors to 1536d (OpenAI standard)
- **Batch Processing**: Efficient multi-text embedding generation
- **Retry Logic**: Automatic retry on transient failures
- **Type Safety**: Full TypeScript support with strict typing

## Architecture

```
Input Text
    ↓
Ollama API (nomic-embed-text)
    ↓
Raw Embedding (768 dimensions)
    ↓
Zero Padding
    ↓
Universal Embedding (1536 dimensions)
```

## Installation

The Universal Local Embedder is built into FazAI. No additional installation required.

## Requirements

- Ollama server running (default: http://192.168.0.101:11434)
- Model `nomic-embed-text` pulled in Ollama

```bash
# Pull the model
ollama pull nomic-embed-text
```

## Usage

### Single Embedding

```typescript
import { generateUniversalEmbedding } from "./services/universal-embedder";

// Generate single embedding
const embedding = await generateUniversalEmbedding("Hello world");
console.log(embedding.length); // 1536
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
console.log(embeddings[0].length); // 1536
```

### Custom Configuration

```typescript
import { UniversalLocalEmbedder } from "./services/universal-embedder";

const embedder = new UniversalLocalEmbedder(
  "http://localhost:11434",  // Custom Ollama URL
  "nomic-embed-text",        // Model name
  768,                       // Native dimension
  1536                       // Target dimension
);

const embedding = await embedder.embed("Custom configuration example");
```

### Direct Padding Function

```typescript
import { padVector } from "./services/universal-embedder";

const vec768 = new Array(768).fill(0.5);
const vec1536 = padVector(vec768, 1536);

console.log(vec1536.length); // 1536
console.log(vec1536.slice(0, 768)); // Original values
console.log(vec1536.slice(768));    // Zeros
```

## Zero Padding Explained

Zero Padding extends a lower-dimensional vector to a higher dimension by appending zeros. This technique:

1. **Preserves Semantic Information**: Original values remain unchanged
2. **Maintains Cosine Similarity**: Similarity relationships are preserved
3. **Enables Migration**: Allows switching between models without re-embedding
4. **No Magnitude Bias**: Zeros don't affect vector magnitude

### Mathematical Properties

```
Original Vector:  [0.1, 0.2, 0.3, ..., 0.768] (768 dimensions)
Padded Vector:    [0.1, 0.2, 0.3, ..., 0.768, 0, 0, ..., 0] (1536 dimensions)

Cosine Similarity: cos(θ) = (A·B) / (||A|| × ||B||)
- The dot product A·B only uses non-zero components
- Zeros don't contribute to magnitude ||A||
- Therefore, similarity is preserved
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

### Single Embedding
- **Latency**: ~50-200ms (depending on text length)
- **Context Window**: 2048 characters (safe limit)

### Batch Embedding
- **Processing**: Sequential (Ollama API limitation)
- **Progress Logging**: Every 10 items for batches > 10
- **Recommended Batch Size**: 10-100 texts

### Optimization Tips

1. **Batch when possible**: Use `embedBatch()` for multiple texts
2. **Truncate long texts**: Pre-truncate to avoid API errors
3. **Cache embeddings**: Store in Qdrant or local cache
4. **Use local Ollama**: Faster than cloud APIs

## Integration with Qdrant

```typescript
import { UniversalLocalEmbedder } from "./services/universal-embedder";
import { QdrantClient } from "@qdrant/js-client-rest";

const embedder = new UniversalLocalEmbedder();
const qdrant = new QdrantClient({ url: "http://localhost:6333" });

// Create collection with 1536 dimensions
await qdrant.createCollection("my_collection", {
  vectors: {
    size: 1536,
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

## Comparison with Other Approaches

| Approach | Pros | Cons |
|----------|------|------|
| **Zero Padding** | Simple, preserves similarity, no re-embedding | Larger vectors (more storage) |
| **Truncation** | Smaller vectors | Data loss, similarity distortion |
| **PCA Projection** | Optimal compression | Requires training, complex |
| **Re-embedding** | Native dimensions | Expensive, time-consuming |

## Troubleshooting

### Ollama Connection Failed

```bash
# Check if Ollama is running
curl http://192.168.0.101:11434/api/tags

# Start Ollama
systemctl start ollama

# Check model availability
ollama list
```

### Model Not Found

```bash
# Pull the model
ollama pull nomic-embed-text

# Verify
ollama list | grep nomic-embed-text
```

### Dimension Mismatch

If you see dimension warnings in logs:

1. Check the model's native dimension
2. Verify Qdrant collection dimension
3. Update `targetDimension` parameter if needed

### Performance Issues

If embeddings are slow:

1. Check Ollama server resources (CPU/RAM)
2. Reduce batch size
3. Use local Ollama instance (avoid network latency)
4. Consider caching frequently used embeddings

## API Reference

### `padVector(vector: number[], targetDim?: number): number[]`

Pad or truncate a vector to target dimension.

**Parameters:**
- `vector`: Input vector
- `targetDim`: Target dimension (default: 1536)

**Returns:** Padded/truncated vector

---

### `generateUniversalEmbedding(text: string, ollamaUrl?: string): Promise<number[]>`

Generate universal embedding for a single text.

**Parameters:**
- `text`: Input text
- `ollamaUrl`: Ollama server URL (default: http://192.168.0.101:11434)

**Returns:** 1536-dimensional embedding vector

---

### `class UniversalLocalEmbedder`

Main embedder class.

#### Constructor

```typescript
constructor(
  ollamaUrl?: string,
  model?: string,
  nativeDimension?: number,
  targetDimension?: number
)
```

**Parameters:**
- `ollamaUrl`: Ollama server URL (default: http://192.168.0.101:11434)
- `model`: Model name (default: nomic-embed-text)
- `nativeDimension`: Model's native dimension (default: 768)
- `targetDimension`: Output dimension (default: 1536)

#### Methods

##### `embed(text: string): Promise<number[]>`

Generate embedding for a single text.

**Parameters:**
- `text`: Input text

**Returns:** 1536-dimensional embedding vector

---

##### `embedBatch(texts: string[]): Promise<number[][]>`

Generate embeddings for multiple texts.

**Parameters:**
- `texts`: Array of input texts

**Returns:** Array of 1536-dimensional embedding vectors

---

##### `getInfo(): object`

Get embedder configuration.

**Returns:**
```typescript
{
  model: string;
  nativeDimension: number;
  targetDimension: number;
  ollamaUrl: string;
}
```

## Testing

Run unit tests:

```bash
npm test -- tests/unit/universal-embedder.test.ts
```

Run integration tests (requires Ollama):

```bash
npm test -- tests/integration/universal-embedder.test.ts
```

## License

Apache-2.0

---

**Last Updated:** 2025-12-27
**Author:** FazAI Team
**Version:** 3.10.0
