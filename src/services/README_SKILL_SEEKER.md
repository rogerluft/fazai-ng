# SkillSeeker Service

## Quick Start

```typescript
import { getSkillSeeker } from "./services/skill-seeker";

// Get singleton instance
const seeker = getSkillSeeker();

// Start monitoring
await seeker.start();

// Get stats
const stats = seeker.getStats();
console.log(stats);

// Stop monitoring
await seeker.stop();
```

## CLI Usage

```bash
# Start monitoring (foreground)
fazai skill-seeker start

# Get status
fazai skill-seeker status

# Get detailed stats
fazai skill-seeker stats

# Process specific file
fazai skill-seeker process /path/to/document.pdf

# Stop service
fazai skill-seeker stop

# Show help
fazai skill-seeker help
```

## Supported Formats

- PDF (`.pdf`) - Extracted with pdf-parse
- Markdown (`.md`) - Direct UTF-8 read
- Text (`.txt`) - Direct UTF-8 read

## Configuration

```bash
# Ingest directory (monitored for new files)
/etc/fazai/ingest/

# Registry file (processed files tracking)
/opt/fazai/data/skill-seeker-registry.json

# Qdrant collection
fazai_kb (1536 dim, Cosine distance)
```

## Architecture

```
File System Event (chokidar)
    ↓
Extract Text (pdf-parse / fs.readFile)
    ↓
Semantic Chunking (~1000 tokens, 100 char overlap)
    ↓
Generate Embeddings (UniversalLocalEmbedder - 1536 dim)
    ↓
Store in Qdrant (fazai_kb collection)
    ↓
Update Registry (hash-based tracking)
```

## Features

- **Real-time Monitoring**: Watches `/etc/fazai/ingest` for new/changed files
- **Multi-format Support**: PDF, Markdown, Text
- **Semantic Chunking**: Paragraph-based with context overlap
- **ECOA Compliant**: 1536-dimensional vectors (Lei 1536)
- **Duplicate Detection**: Hash-based tracking prevents re-processing
- **Error Recovery**: Automatic retry and graceful degradation
- **Statistics Tracking**: Files processed, chunks indexed, errors

## Payload Structure

```typescript
{
  type: "knowledge",
  source: "filename.pdf",
  chunk_index: 0,
  total_chunks: 5,
  content: "The actual text content...",
  file_hash: "sha256_hash",
  ingested_at: "2025-12-27T10:30:00.000Z",
  file_type: "pdf",
  semantic_id: "filename.pdf:0:abcd1234"
}
```

## Performance

- **Processing Speed**: ~10-50 chunks/second
- **Memory Usage**: ~100-500MB
- **Disk Usage**: Registry ~1KB per file
- **Qdrant Storage**: ~6KB per chunk

## See Also

- [Complete Documentation](../../docs/SKILL_SEEKER.md)
- [Usage Examples](../../examples/skill-seeker-usage.ts)
- [Tests](../../tests/unit/services/skill-seeker.test.ts)
