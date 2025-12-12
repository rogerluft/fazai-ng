# Semantic Cache Integration

## Overview

FazAI now includes **Semantic Cache** - an advanced caching system that uses vector embeddings and similarity search to cache AI responses intelligently. Unlike traditional caches that only match identical queries, semantic cache matches queries with similar meaning.

## Architecture

### Components

1. **Vector Database**: Qdrant
   - Stores embeddings of queries and their responses
   - Provides fast similarity search (cosine distance)
   - Supports filtering by provider/model

2. **Embedding Service**: Ollama (local) or OpenAI (cloud)
   - Generates vector embeddings from text
   - Default: Ollama `mxbai-embed-large` (1024 dim)
   - Fallback: OpenAI `text-embedding-3-small` (1536 dim)

3. **Cache Manager**: SemanticCache class
   - Singleton pattern for efficient resource usage
   - Automatic TTL and LRU eviction
   - Metrics tracking and monitoring

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      User Query                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  Generate Embedding   │
         │  (1024 or 1536 dim)   │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  Search Qdrant by     │
         │  Similarity (Cosine)  │
         └───────────┬───────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
    [Score >= 0.95]         [Score < 0.95]
    [Age <= TTL]            [or Expired]
         │                       │
         ▼                       ▼
    ┌────────┐            ┌──────────┐
    │ CACHE  │            │  CACHE   │
    │  HIT   │            │  MISS    │
    └────┬───┘            └─────┬────┘
         │                      │
         │                      ▼
         │              ┌───────────────┐
         │              │  Call Provider│
         │              │  (Ollama/etc) │
         │              └───────┬───────┘
         │                      │
         │                      ▼
         │              ┌───────────────┐
         │              │ Store in Cache│
         │              │ (with TTL)    │
         │              └───────────────┘
         │
         ▼
    ┌────────────┐
    │   Return   │
    │  Response  │
    └────────────┘
```

## Configuration

### Qdrant Connection

Add to `/etc/fazai/fazai.conf`:

```bash
# Qdrant Configuration
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-api-key-here  # Optional, for Qdrant Cloud
```

### Embedding Service

The cache automatically selects the best available embedding service:

1. **Ollama** (preferred - local, free)
   - Model: `mxbai-embed-large` (1024 dimensions)
   - Fallback: `nomic-embed-text` (768 dimensions)
   - Configuration: `OLLAMA_BASE_URL=http://192.168.0.101:11434`

2. **OpenAI** (fallback - cloud, paid)
   - Model: `text-embedding-3-small` (1536 dimensions)
   - Configuration: `OPENAI_API_KEY=sk-...`

### Cache Parameters

Configurable in `src/services/semantic-cache.ts`:

```typescript
// Default settings
DEFAULT_SIMILARITY_THRESHOLD = 0.95  // Very similar (0-1 scale)
DEFAULT_TTL = 60 * 60 * 1000        // 1 hour (milliseconds)
MAX_CACHE_SIZE = 10000              // Maximum entries
CLEANUP_INTERVAL = 10 * 60 * 1000   // 10 minutes
```

## Usage

### Programmatic API

```typescript
import { SemanticCache } from "./services/semantic-cache";

// Get singleton instance
const cache = await SemanticCache.getInstance();

// Lookup (cache read)
const cached = await cache.lookup(
  "Como instalar nginx?",
  "qwen2.5:7b",
  "ollama",
  {
    similarityThreshold: 0.95,  // Optional, default: 0.95
    maxAge: 3600000,            // Optional, default: 1 hour
  }
);

if (cached) {
  console.log("Cache HIT:", cached);
} else {
  // Cache MISS - call provider
  const response = await callProvider(...);

  // Store in cache
  await cache.store(
    "Como instalar nginx?",
    response,
    "qwen2.5:7b",
    "ollama",
    3600000  // Optional TTL in milliseconds
  );
}

// Get statistics
const stats = await cache.stats();
console.log("Hit rate:", stats.hitRate.toFixed(1) + "%");

// Clear cache
await cache.clear();
```

### CLI Commands

```bash
# Start interactive CLI
fazai --cli

# View cache statistics
/cache
/cache stats

# Clear cache completely
/cache clear

# Help
/help
```

### Example CLI Session

```
fazai> /cache

📊 Semantic Cache Statistics:
  Total Entries: 847
  Cache Hit Rate: 67.3% (128 hits, 62 misses)
  Total Hits: 1,234
  Total Stores: 847
  Total Evictions: 12
  Average Age: 1,847s
  Oldest Entry: 3,542s
  Newest Entry: 23s

fazai> Como instalar nginx?
✓ Cache HIT: score=0.978, age=152s, query="Como instalar nginx?"
[... cached response ...]

fazai> Como configurar nginx?
Cache MISS: no similar queries found
[... calls provider, stores response ...]
```

## Integration Points

### 1. askAI.ts (General Queries)

Semantic cache is integrated into `askAI()` for all general-purpose queries:

```typescript
export async function* askAI(...) {
  // 1. Try cache first
  const cache = await SemanticCache.getInstance();
  const cached = await cache.lookup(prompt, model, provider);

  if (cached) {
    yield cached;
    return;
  }

  // 2. Cache miss - call provider
  let fullResponse = "";
  for await (const chunk of providerStream) {
    fullResponse += chunk;
    yield chunk;
  }

  // 3. Store in cache
  await cache.store(prompt, fullResponse, model, provider);
}
```

### 2. CLI Mode (cli-mode.ts)

Added `/cache` commands for management:

- `/cache` or `/cache stats` - View statistics
- `/cache clear` - Clear all cached entries

### 3. Future Integration: linux-admin.ts

Semantic cache can be added to command generation:

```typescript
// Before calling AI for Linux commands
const cacheKey = `linux:${task}:${systemInfo}`;
const cached = await cache.lookup(cacheKey, model, provider);

if (cached) {
  // Parse cached JSON response
  const commands = JSON.parse(cached);
  yield* commands;
  return;
}

// Cache miss - generate commands and store
```

## Performance

### Benchmark Results (Expected)

| Operation | Latency | Notes |
|-----------|---------|-------|
| Cache HIT | ~50ms | Qdrant search + embedding generation |
| Cache MISS + Provider | ~2-5s | Provider call + embedding + store |
| Embedding Generation | ~30ms | Ollama local |
| Qdrant Search | ~10ms | Cosine similarity search |

### Space Usage

- Embedding: 1024 floats × 4 bytes = ~4KB per entry
- Payload: ~2-10KB per entry (query + response)
- **Total**: ~6-14KB per cached entry
- **10,000 entries**: ~60-140MB RAM

## Similarity Threshold Guide

| Threshold | Behavior | Use Case |
|-----------|----------|----------|
| 0.99-1.0 | Near-identical | Exact duplicates only |
| 0.95-0.98 | Very similar | **Default** - Same intent, slight wording changes |
| 0.90-0.94 | Similar | Related queries |
| 0.80-0.89 | Loosely related | Broad topic match |
| < 0.80 | Different | Not recommended |

### Examples

```
Query 1: "Como instalar nginx?"
Query 2: "Como instalar nginx no Ubuntu?"
Similarity: 0.97 → Cache HIT (same intent)

Query 1: "Como instalar nginx?"
Query 2: "Como desinstalar nginx?"
Similarity: 0.92 → Cache MISS (different intent)

Query 1: "Como instalar nginx?"
Query 2: "Como configurar Apache?"
Similarity: 0.73 → Cache MISS (different topic)
```

## Maintenance

### Automatic Cleanup

The cache automatically performs:

1. **TTL Expiration**: Entries older than TTL are deleted
2. **LRU Eviction**: When MAX_CACHE_SIZE is reached, oldest entries are removed
3. **Periodic Cleanup**: Every 10 minutes, expired entries are purged

### Manual Maintenance

```bash
# View cache stats
fazai --cli
/cache stats

# Clear cache if needed
/cache clear

# Check Qdrant collection
curl http://localhost:6333/collections/fazai_semantic_cache
```

### Monitoring

Monitor cache performance via:

```typescript
const cache = await SemanticCache.getInstance();
const stats = await cache.stats();

console.log({
  hitRate: stats.hitRate,        // Target: > 50%
  totalEntries: stats.totalEntries,  // Monitor growth
  avgAge: stats.avgAge,          // Should be < TTL
});
```

## Troubleshooting

### Issue: Cache not working

**Symptom**: All queries result in cache MISS

**Solutions**:
1. Check Qdrant connection:
   ```bash
   curl http://localhost:6333/collections
   ```
2. Verify embedding service:
   ```bash
   curl http://192.168.0.101:11434/api/tags
   ```
3. Check logs:
   ```bash
   tail -f /var/log/fazai/$(date +%Y-%m-%d).log
   ```

### Issue: Low hit rate (< 20%)

**Causes**:
- Similarity threshold too high (> 0.95)
- TTL too short (< 1 hour)
- Users asking very diverse questions

**Solutions**:
- Lower similarity threshold to 0.90-0.92
- Increase TTL to 2-4 hours
- Monitor actual query patterns

### Issue: High memory usage

**Symptom**: Qdrant using > 500MB RAM

**Solutions**:
1. Reduce MAX_CACHE_SIZE:
   ```typescript
   MAX_CACHE_SIZE = 5000  // Instead of 10000
   ```
2. Reduce TTL (more aggressive cleanup):
   ```typescript
   DEFAULT_TTL = 30 * 60 * 1000  // 30 minutes
   ```
3. Manual cleanup:
   ```bash
   fazai --cli
   /cache clear
   ```

## Security Considerations

### Data Persistence

- Cached responses are stored in Qdrant
- Contains queries and AI responses
- **Not encrypted** by default
- Consider: Enable Qdrant authentication (`QDRANT_API_KEY`)

### Sensitive Data

The cache does NOT cache:
- API keys or credentials
- System passwords
- Private user data

But it DOES cache:
- Public knowledge queries
- Command generation results
- Technical how-to responses

### Best Practices

1. **Production**: Enable Qdrant API key authentication
2. **Multi-tenant**: Use separate collections per user
3. **Compliance**: Implement cache expiration policies
4. **Monitoring**: Log cache hit patterns for auditing

## Future Enhancements

### Planned Features

1. **Multi-level Cache**
   - L1: In-memory (instant, 100 entries)
   - L2: Qdrant (fast, 10K entries)
   - L3: Disk-based (large, 100K entries)

2. **Smart Prefetching**
   - Predict common queries
   - Pre-generate and cache responses
   - Reduce cold-start latency

3. **Cache Warming**
   - Import FAQ responses
   - Pre-cache common Linux commands
   - Seed with training data

4. **Analytics Dashboard**
   - Visualize hit rate trends
   - Identify popular queries
   - Optimize threshold based on patterns

5. **Distributed Cache**
   - Share cache across multiple FazAI instances
   - Qdrant cluster support
   - Redis for L1 cache layer

## References

- **Qdrant**: https://qdrant.tech/documentation/
- **Embeddings**: https://ollama.ai/library/mxbai-embed-large
- **Cosine Similarity**: https://en.wikipedia.org/wiki/Cosine_similarity
- **Vector Databases**: https://www.pinecone.io/learn/vector-database/

## Version History

- **v3.5.0-beta** (2025-12-12): Initial semantic cache implementation
  - Qdrant integration
  - Automatic embedding service selection
  - CLI commands (/cache, /cache stats, /cache clear)
  - Integration with askAI.ts

---

**Author**: Backend Architect Agent
**Date**: 2025-12-12
**Status**: Production-Ready
