# FazAI Qdrant Architecture

**Complete Qdrant Management System**

Version: 3.8.1
Date: 2025-12-22
Author: Claude Code (Backend Architect)

---

## Overview

This document describes the complete Qdrant vector database management architecture for FazAI, including backup/restore, metrics monitoring, import/export, and container lifecycle management.

## Architecture Components

### 1. Connection Pool (`src/database/qdrant-pool.ts`)

**Purpose:** Singleton connection manager with circuit breaker protection

**Features:**
- Connection pooling and retry logic
- Circuit breaker to prevent infinite retries (BUG-002 fix)
- Periodic health checks (every 5 minutes)
- Automatic reconnection on failure
- Metrics tracking (queries, errors, reconnection attempts)
- Graceful degradation when Qdrant is offline

**Usage:**
```typescript
import { getQdrantClient, qdrantPool } from './database/qdrant-pool';

// Check availability
if (qdrantPool.isAvailable()) {
  const client = await getQdrantClient();
  // Use client...
}

// Get metrics
const metrics = qdrantPool.getMetrics();
console.log(`Queries: ${metrics.totalQueries}, Errors: ${metrics.totalErrors}`);
```

**Circuit Breaker States:**
- **CLOSED:** Normal operation (failures increment counter)
- **OPEN:** All operations fail fast (no execution attempted)
- **HALF_OPEN:** Allow ONE test operation to check recovery

### 2. Backup & Restore (`src/orchestrator/qdrant-backup.ts`)

**Purpose:** Robust backup/restore system with versioning

**Features:**
- Individual collection backup
- Full system backup (all collections)
- Point-in-time restore
- Automatic versioning with timestamps
- Metadata preservation
- Retention policy (default: 7 days)

**Backup Format:**
```
/var/backups/fazai/qdrant/
  ├── fazai_kb.2025-12-22T03-30-00.backup.json
  ├── fazai_memory.2025-12-22T03-30-00.backup.json
  └── ...
```

**Usage:**
```typescript
import { backupCollection, restoreCollection } from './orchestrator/qdrant-backup';

// Backup single collection
const path = await backupCollection('fazai_kb');
console.log(`Backup created: ${path}`);

// Restore from backup
await restoreCollection('fazai_kb');

// Cleanup old backups (older than 7 days)
const deleted = await cleanupOldBackups(7);
```

**CLI Commands:**
```bash
fazai qdrant backup                  # Backup all collections
fazai qdrant backup fazai_kb         # Backup specific collection
fazai qdrant restore fazai_kb        # Restore from latest backup
```

### 3. Metrics & Monitoring (`src/orchestrator/qdrant-metrics.ts`)

**Purpose:** Comprehensive metrics and capacity planning

**Features:**
- Collection size estimation
- Point count, vector count, indexing status
- Memory and disk usage analysis
- Capacity alerts (warning/critical thresholds)
- Health checks and performance metrics
- Recommendations engine

**Metrics Provided:**
- Total collections
- Total points/vectors
- Estimated memory usage (MB)
- Estimated disk usage (MB)
- Circuit breaker state
- Error rates
- Per-collection statistics

**Thresholds:**
```typescript
POINTS_WARNING: 50,000      // Warn at 50k points
POINTS_CRITICAL: 100,000    // Critical at 100k points
SIZE_WARNING_MB: 500        // Warn at 500MB
SIZE_CRITICAL_MB: 1000      // Critical at 1GB
ERROR_RATE_WARNING: 5%      // 5% error rate
ERROR_RATE_CRITICAL: 10%    // 10% error rate
```

**Usage:**
```typescript
import { getAllMetrics, getCapacityRecommendations } from './orchestrator/qdrant-metrics';

// Get full metrics report
const report = await getAllMetrics();
console.log(`Total points: ${report.summary.totalPoints}`);

// Get recommendations
const recommendations = await getCapacityRecommendations();
for (const rec of recommendations) {
  console.log(rec);
}
```

**CLI Commands:**
```bash
fazai qdrant status            # Quick status check
fazai qdrant metrics           # Full metrics report
fazai qdrant recommendations   # Capacity recommendations
```

### 4. Import/Export (`src/orchestrator/qdrant-import-export.ts`)

**Purpose:** Data migration and bulk operations

**Features:**
- Multiple format support (JSON, JSONL, CSV)
- Batch processing for large datasets
- Progress tracking with callbacks
- Automatic schema validation (Zod)
- Resume capability for interrupted operations
- Memory-efficient streaming

**Supported Formats:**
- **JSON:** Standard JSON array (best for small datasets)
- **JSONL:** JSON Lines / NDJSON (memory-efficient for large datasets)
- **CSV:** Comma-separated values (simple exports)

**Point Schema:**
```typescript
{
  id: string | number,
  vector: number[] | Record<string, number[]>,
  payload?: Record<string, any>
}
```

**Usage:**
```typescript
import { importFromJson, exportToJson } from './orchestrator/qdrant-import-export';

// Export to JSON
await exportToJson('fazai_kb', '/tmp/kb-export.json', {
  format: 'json',
  includeVectors: true,
  progressCallback: (progress, total) => {
    console.log(`${progress}/${total}`);
  }
});

// Import from JSONL
const result = await importFromJson('/tmp/data.jsonl', 'fazai_learning', {
  batchSize: 100,
  skipErrors: true,
  validate: true
});

console.log(`Imported: ${result.successCount}, Errors: ${result.errorCount}`);
```

**CLI Commands:**
```bash
# Export collection
fazai qdrant export fazai_kb --output /tmp/kb-export.json --format json

# Import from file
fazai qdrant import /tmp/data.jsonl --collection fazai_learning --batch-size 100

# Export to CSV
fazai qdrant export fazai_memory --output /tmp/memory.csv --format csv
```

### 5. Container Management (`src/orchestrator/qdrant-container.ts`)

**Purpose:** Podman container lifecycle management

**Features:**
- Start/Stop/Restart container
- Health checks and status monitoring
- Log retrieval (tail, follow)
- Automatic recovery on crash
- Container creation with proper configuration

**Container Configuration:**
```yaml
Name: qdrant
Image: docker.io/qdrant/qdrant:latest
Ports:
  - 6333:6333  # HTTP API
  - 6334:6334  # gRPC
Storage: /var/lib/qdrant
Restart Policy: unless-stopped
```

**Usage:**
```typescript
import {
  startQdrantContainer,
  getQdrantContainerStatus,
  ensureQdrantRunning
} from './orchestrator/qdrant-container';

// Start container
await startQdrantContainer();

// Check status
const status = await getQdrantContainerStatus();
console.log(`Running: ${status.running}`);

// Ensure running (with auto-start)
const isRunning = await ensureQdrantRunning();
```

**CLI Commands:**
```bash
fazai qdrant container start     # Start container
fazai qdrant container stop      # Stop container
fazai qdrant container restart   # Restart container
fazai qdrant container status    # Show status
fazai qdrant container logs      # Show logs (last 50 lines)
```

### 6. CLI Command Handler (`src/commands/qdrant.ts`)

**Purpose:** Unified CLI interface for all Qdrant operations

**Available Commands:**
```bash
fazai qdrant status                           # Connection status
fazai qdrant metrics                          # Full metrics report
fazai qdrant recommendations                  # Capacity recommendations
fazai qdrant backup [collection]              # Backup collections
fazai qdrant restore [collection]             # Restore from backup
fazai qdrant import <file> --collection <name>  # Import data
fazai qdrant export <collection> --output <file>  # Export data
fazai qdrant container <action>               # Container management
```

**Options:**
```bash
--format=<json|jsonl|csv>       # File format
--batch-size=<number>           # Batch size (default: 100)
--skip-errors                   # Continue on errors
--no-validate                   # Skip validation (faster)
--output=<file>                 # Output path
--collection=<name>             # Collection name
```

---

## Automation Scripts

### Daily Backup (`scripts/backup-qdrant.sh`)

**Purpose:** Automated daily backup with rotation

**Installation:**
```bash
sudo cp scripts/backup-qdrant.sh /opt/fazai/scripts/
sudo chmod +x /opt/fazai/scripts/backup-qdrant.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
0 2 * * * /opt/fazai/scripts/backup-qdrant.sh >> /var/log/fazai/qdrant-backup.log 2>&1
```

**Features:**
- Backs up all collections
- Automatic cleanup (keep last 7 days)
- Disk usage reporting
- Error logging

### Backup Cleanup (`scripts/cleanup-qdrant-backups.sh`)

**Purpose:** Manual cleanup of old backups

**Usage:**
```bash
# Use default retention (7 days)
/opt/fazai/scripts/cleanup-qdrant-backups.sh

# Custom retention (14 days)
/opt/fazai/scripts/cleanup-qdrant-backups.sh 14
```

---

## Storage Estimation

### Formula
```
Total Size (MB) = Points × (VectorSize + PayloadSize) × OverheadMultiplier

Where:
- VectorSize = Dimension × 4 bytes (float32)
- PayloadSize ≈ 1KB average
- OverheadMultiplier = 1.2 (20% for indexes/metadata)
```

### Examples
```typescript
// 1,000 points with 1536D vectors
estimateStorageNeeds(1000)  // ≈ 8.4 MB

// 100,000 points with 1536D vectors
estimateStorageNeeds(100000)  // ≈ 840 MB

// 1,000 points with 384D vectors (smaller model)
estimateStorageNeeds(1000, 384)  // ≈ 2.4 MB
```

---

## Circuit Breaker Pattern

### States
1. **CLOSED** (Normal)
   - Operations execute normally
   - Failures increment counter
   - Opens after 3 consecutive failures

2. **OPEN** (Service Down)
   - All operations fail fast (no execution)
   - No resource waste on dead service
   - Transitions to HALF_OPEN after 30s

3. **HALF_OPEN** (Testing Recovery)
   - Allows ONE test operation
   - Success → CLOSED
   - Failure → OPEN (retry after 30s)

### Benefits
- Prevents infinite retry loops (BUG-002)
- Fast failure detection
- Automatic recovery
- Resource protection

---

## Error Handling

### Graceful Degradation
```typescript
try {
  if (!qdrantPool.isAvailable()) {
    logger.warn("Qdrant unavailable, skipping operation");
    return null;  // Graceful fallback
  }

  const client = await getQdrantClient();
  // ... operation
} catch (error) {
  logger.error(`Operation failed: ${error.message}`);
  // Handle or rethrow
}
```

### Error Types
- **CircuitBreakerOpenError:** Service unavailable (fail fast)
- **CircuitBreakerTimeoutError:** Operation timeout (10s)
- **Connection errors:** Network/auth issues
- **Validation errors:** Invalid data format

---

## Best Practices

### 1. Always Check Availability
```typescript
if (qdrantPool.isAvailable()) {
  // Safe to proceed
}
```

### 2. Use Batch Operations
```typescript
// Good: Batch upsert
await client.upsert(collection, { points: batch });

// Bad: Individual inserts
for (const point of points) {
  await client.upsert(collection, { points: [point] });
}
```

### 3. Monitor Metrics
```bash
# Regular health checks
fazai qdrant status
fazai qdrant metrics
fazai qdrant recommendations
```

### 4. Automate Backups
```bash
# Cron job for daily backups
0 2 * * * /opt/fazai/scripts/backup-qdrant.sh
```

### 5. Use Validation
```typescript
await importFromJson(file, collection, {
  validate: true,      // Always validate in production
  skipErrors: true,    // Continue on individual errors
  batchSize: 100       // Tune for performance
});
```

---

## Performance Tuning

### Batch Size
```typescript
// Small datasets (< 1,000 points)
batchSize: 50

// Medium datasets (1,000 - 10,000 points)
batchSize: 100  // Default

// Large datasets (> 10,000 points)
batchSize: 500
```

### Circuit Breaker Timeouts
```typescript
failureThreshold: 3,      // Open after 3 failures
resetTimeout: 30000,      // 30s before retry
operationTimeout: 10000   // 10s per operation
```

### Health Check Interval
```typescript
HEALTH_CHECK_INTERVAL: 5 * 60 * 1000  // 5 minutes
```

---

## Troubleshooting

### Container Not Starting
```bash
# Check Podman
which podman

# Check permissions
sudo mkdir -p /var/lib/qdrant
sudo chown $USER:$USER /var/lib/qdrant

# Start manually
fazai qdrant container start
```

### Circuit Breaker Stuck OPEN
```bash
# Check container health
fazai qdrant container status
fazai qdrant container logs

# Restart container
fazai qdrant container restart

# Manual reset (if needed)
# Circuit breaker auto-resets after 30s
```

### Import Failing
```bash
# Validate file format
head -5 /path/to/file.json

# Check collection exists
fazai qdrant metrics

# Import with debugging
fazai qdrant import /path/to/file.json --collection test --batch-size 10 --verbose
```

### High Memory Usage
```bash
# Check metrics
fazai qdrant metrics

# Get recommendations
fazai qdrant recommendations

# Archive old data
fazai qdrant backup fazai_memory
# Then manually delete old points
```

---

## Testing

### Unit Tests
```bash
npm test -- tests/qdrant-orchestrator.test.ts
```

### Integration Tests
```bash
# Start Qdrant container
fazai qdrant container start

# Run full test suite
npm test

# Manual CLI tests
fazai qdrant status
fazai qdrant metrics
fazai qdrant backup
```

---

## Dependencies

### NPM Packages
```json
{
  "@qdrant/js-client-rest": "^1.15.1",
  "zod": "^4.1.12"
}
```

### System Requirements
- Podman (container runtime)
- Node.js >= 18.17.0
- Disk space: /var/backups/fazai/qdrant (for backups)
- Disk space: /var/lib/qdrant (for Qdrant data)

---

## Security Considerations

### 1. API Key Protection
```bash
# Store in config file (not in code)
QDRANT_API_KEY=your-key-here  # /etc/fazai/fazai.conf
```

### 2. Backup Directory Permissions
```bash
sudo mkdir -p /var/backups/fazai/qdrant
sudo chown $USER:$USER /var/backups/fazai/qdrant
chmod 755 /var/backups/fazai/qdrant
```

### 3. Container Network Isolation
```bash
# Qdrant only listens on localhost by default
# No external exposure unless explicitly configured
```

---

## Future Enhancements

### Planned Features
- [ ] Encryption for backups at rest
- [ ] Compression for backup files (gzip)
- [ ] Differential backups (only changed points)
- [ ] Multi-node Qdrant cluster support
- [ ] Prometheus metrics export
- [ ] Web UI for metrics visualization

### Known Limitations
- Backup/restore is collection-wide (no point filtering yet)
- No built-in backup encryption
- Container management assumes single-node setup
- No automatic scaling based on metrics

---

## References

- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [FazAI AGENTS.md](/home/rluft/fazai-ng/AGENTS.md)
- [FazAI CHANGELOG.md](/home/rluft/fazai-ng/CHANGELOG.md)

---

**Document Version:** 1.0.0
**Last Updated:** 2025-12-22
**Maintainer:** FazAI Team (Claude Code)
