# SkillSeeker Service

## Overview

SkillSeeker is an automatic knowledge ingestion service for FazAI. It monitors the `/etc/fazai/ingest` directory for new knowledge files and automatically indexes them into the `fazai_kb` Qdrant collection for semantic search and RAG (Retrieval-Augmented Generation).

## Features

- **Real-time Monitoring**: Uses `chokidar` to watch for file changes
- **Multi-format Support**: PDF, Markdown (.md), and plain text (.txt)
- **Semantic Chunking**: Intelligently splits documents into chunks with context overlap
- **Lei 768 Compliant**: Uses 768-dimensional vectors (nomic-embed-text native)
- **Duplicate Detection**: Hash-based tracking prevents re-processing unchanged files
- **Automatic Retry**: Handles transient failures gracefully
- **Registry Tracking**: Maintains a registry of processed files

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SkillSeeker Service                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  File Monitor (chokidar)                                    │
│       ↓                                                     │
│  Extract Text (pdf-parse / fs.readFile)                    │
│       ↓                                                     │
│  Semantic Chunking (max 1000 tokens, 100 char overlap)     │
│       ↓                                                     │
│  Generate Embeddings (UniversalLocalEmbedder - 1536 dim)   │
│       ↓                                                     │
│  Store in Qdrant (fazai_kb collection)                     │
│       ↓                                                     │
│  Update Registry (/opt/fazai/data/skill-seeker-registry.json) │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Usage

### Start the Service

```typescript
import { getSkillSeeker } from "./services/skill-seeker";

const skillSeeker = getSkillSeeker();

// Start monitoring
await skillSeeker.start();

// Get statistics
const stats = skillSeeker.getStats();
console.log(stats);

// Stop monitoring
await skillSeeker.stop();
```

### CLI Integration

Add a command to FazAI CLI:

```typescript
// In src/app.ts or command handler

import { getSkillSeeker } from "./services/skill-seeker";

// Start as background service
if (command === "skill-seeker" && subcommand === "start") {
  const seeker = getSkillSeeker();
  await seeker.start();
  console.log("✓ SkillSeeker started");
}

// Get stats
if (command === "skill-seeker" && subcommand === "status") {
  const seeker = getSkillSeeker();
  const stats = seeker.getStats();
  console.log(stats);
}

// Stop service
if (command === "skill-seeker" && subcommand === "stop") {
  const seeker = getSkillSeeker();
  await seeker.stop();
  console.log("✓ SkillSeeker stopped");
}
```

### Manual File Processing

```typescript
import { getSkillSeeker } from "./services/skill-seeker";

const seeker = getSkillSeeker();

// Process a specific file
await seeker.processFile("/etc/fazai/ingest/my-knowledge.pdf");
```

## Configuration

### Directory Setup

The service requires the following directories:

```bash
# Ingest directory (monitored for new files)
sudo mkdir -p /etc/fazai/ingest
sudo chmod 755 /etc/fazai/ingest

# Data directory (for registry and state)
sudo mkdir -p /opt/fazai/data
sudo chmod 755 /opt/fazai/data
```

### Qdrant Collection

The service automatically creates the `fazai_kb` collection if it doesn't exist:

```typescript
Collection: fazai_kb
Vector Size: 768 (Lei 768 / nomic-embed-text native)
Distance Metric: Cosine
```

## File Processing

### Supported Formats

| Format | Extension | Processing Method |
|--------|-----------|-------------------|
| PDF | `.pdf` | `pdf-parse` library |
| Markdown | `.md` | Direct file read (UTF-8) |
| Text | `.txt` | Direct file read (UTF-8) |

### Chunking Strategy

1. **Paragraph-based**: Splits by double newlines (`\n\n`)
2. **Size limit**: Max ~1000 tokens (~3000-4000 characters)
3. **Overlap**: 100 characters from previous chunk for context
4. **Fallback**: Sentence-based splitting for large paragraphs

### Payload Structure

Each chunk stored in Qdrant contains:

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

## Registry

The service maintains a registry of processed files to avoid duplicates:

```json
{
  "files": {
    "my-knowledge.pdf": {
      "filename": "my-knowledge.pdf",
      "hash": "sha256_hash",
      "processedAt": "2025-12-27T10:30:00.000Z",
      "chunks": 5,
      "size": 102400
    }
  },
  "lastUpdated": "2025-12-27T10:30:00.000Z",
  "totalFilesProcessed": 1,
  "totalChunksIndexed": 5
}
```

**Location**: `/opt/fazai/data/skill-seeker-registry.json`

## Statistics

Get service statistics:

```typescript
const stats = seeker.getStats();

// Returns:
{
  isRunning: boolean,
  filesProcessed: number,
  chunksIndexed: number,
  errors: number,
  lastProcessedFile: string | null,
  lastProcessedAt: string | null,
  watchedDirectory: string
}
```

## Error Handling

- **Transient Failures**: Automatically logged, processing continues
- **Unsupported Files**: Silently skipped
- **Duplicate Files**: Skipped based on hash comparison
- **Qdrant Unavailable**: Service fails to start with error message
- **File Read Errors**: Logged and counted in error statistics

## Best Practices

1. **File Naming**: Use descriptive names (e.g., `linux-security-guide.pdf`)
2. **File Size**: Keep files under 10MB for optimal processing
3. **File Format**: Use PDF for structured documents, MD for notes
4. **Monitoring**: Check stats regularly to ensure processing is working
5. **Registry Backup**: Backup `/opt/fazai/data/skill-seeker-registry.json`

## Integration with RAG

Once indexed, knowledge can be retrieved using semantic search:

```typescript
import { getQdrantClient } from "./database/qdrant-pool";

const qdrant = await getQdrantClient();

// Search for relevant knowledge
const results = await qdrant.search("fazai_kb", {
  vector: queryEmbedding, // 1536-dim vector from query
  limit: 5,
  filter: {
    must: [{ key: "type", match: { value: "knowledge" } }],
  },
});

// Use results for RAG
const context = results
  .map((r) => r.payload.content)
  .join("\n\n");
```

## Troubleshooting

### Service Won't Start

- **Check Qdrant**: Ensure Qdrant is running (`systemctl status qdrant`)
- **Check Permissions**: Verify `/etc/fazai/ingest` is readable
- **Check Logs**: Look for errors in `/var/log/fazai/`

### Files Not Processing

- **Check Extension**: Only `.pdf`, `.md`, `.txt` are supported
- **Check Hash**: File may already be processed (check registry)
- **Check Size**: Very large files may timeout
- **Check Content**: Empty files are skipped

### Embeddings Failing

- **Check Ollama**: Ensure Ollama is running with `mxbai-embed-large`
- **Check OpenAI Key**: If using OpenAI fallback, verify API key
- **Check Network**: Verify connectivity to embedding service

## Performance

- **Processing Speed**: ~10-50 chunks/second (depends on embedding service)
- **Memory Usage**: ~100-500MB (depends on file size)
- **Disk Usage**: Registry file ~1KB per processed file
- **Qdrant Storage**: ~6KB per chunk (1536 floats + payload)

## Future Enhancements

- [ ] Support for DOCX, HTML, EPUB formats
- [ ] OCR support for scanned PDFs
- [ ] Image extraction and indexing
- [ ] Table extraction and structured data indexing
- [ ] Language detection and multi-language support
- [ ] Configurable chunking strategies
- [ ] Web UI for monitoring and management
- [ ] Batch processing API
- [ ] Export/import registry for backup

## Version History

- **1.0.0** (2025-12-27): Initial implementation
  - PDF, MD, TXT support
  - Chokidar file monitoring
  - Hash-based duplicate detection
  - ECOA 1536-dim vectors
  - Registry tracking

---

**Author**: ClaudiÃO (Claude Opus 4.5)
**Project**: FazAI v3.10.0
