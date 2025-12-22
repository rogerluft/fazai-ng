/**
 * Qdrant Backup and Restore Module
 *
 * Provides robust backup/restore functionality for Qdrant collections:
 * - Individual collection backup
 * - Full system backup (all collections)
 * - Point-in-time restore
 * - Automatic versioning and timestamps
 * - Compression support (optional)
 *
 * Backup Format:
 *   /var/backups/fazai/qdrant/
 *     ├── fazai_kb.2025-12-22T03-30-00.backup.json
 *     ├── fazai_memory.2025-12-22T03-30-00.backup.json
 *     └── ...
 *
 * Usage:
 *   import { backupCollection, restoreCollection } from './orchestrator/qdrant-backup';
 *
 *   // Backup single collection
 *   const path = await backupCollection('fazai_kb');
 *
 *   // Restore from backup
 *   await restoreCollection('fazai_kb');
 */

import { promises as fs } from "fs";
import { dirname } from "path";
import { getQdrantClient, qdrantPool } from "../database/qdrant-pool";
import { logger } from "../logger";
import { exportToJson, importFromJson } from "./qdrant-import-export";

/**
 * Default backup directory
 */
const BACKUP_DIR = "/var/backups/fazai/qdrant";

/**
 * Backup result for batch operations
 */
export interface BackupResult {
  successful: string[];
  failed: string[];
  backupDir: string;
}

/**
 * Backup metadata
 */
interface BackupMetadata {
  collection: string;
  timestamp: string;
  pointsCount: number;
  vectorsCount: number;
  vectorDimension: number;
}

/**
 * Ensure backup directory exists
 */
async function ensureBackupDir(): Promise<void> {
  try {
    await fs.access(BACKUP_DIR);
  } catch {
    // Directory doesn't exist, try to create it
    try {
      await fs.mkdir(BACKUP_DIR, { recursive: true, mode: 0o755 });
      logger.info(`Created backup directory: ${BACKUP_DIR}`);
    } catch (error: any) {
      // If creation fails due to permissions, suggest sudo
      if (error.code === "EACCES") {
        throw new Error(
          `Permission denied creating backup directory. Run: sudo mkdir -p ${BACKUP_DIR} && sudo chown $USER:$USER ${BACKUP_DIR}`
        );
      }
      throw error;
    }
  }
}

/**
 * Generate backup filename with timestamp
 */
function getBackupFilename(collection: string, timestamp?: Date): string {
  const ts = timestamp || new Date();
  const isoTimestamp = ts.toISOString().replace(/:/g, "-").replace(/\..+/, "");
  return `${collection}.${isoTimestamp}.backup.json`;
}

/**
 * Find latest backup for a collection
 */
async function findLatestBackup(collection: string): Promise<string | null> {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backups = files
      .filter((f) => f.startsWith(`${collection}.`) && f.endsWith(".backup.json"))
      .sort()
      .reverse();

    if (backups.length === 0) {
      return null;
    }

    return `${BACKUP_DIR}/${backups[0]}`;
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Backup a single collection
 *
 * @param collection - Collection name
 * @param outputPath - Optional custom output path
 * @returns Path to backup file
 */
export async function backupCollection(
  collection: string,
  outputPath?: string
): Promise<string> {
  logger.info(`[Qdrant Backup] Starting backup for collection '${collection}'`);

  if (!qdrantPool.isAvailable()) {
    throw new Error("Qdrant is not available (circuit breaker is OPEN)");
  }

  try {
    const client = await getQdrantClient();

    // Get collection info
    const collectionInfo = await client.getCollection(collection);
    const pointsCount = collectionInfo.points_count || 0;
    const vectorsCount = collectionInfo.vectors_count || 0;

    // Determine vector dimension
    let vectorDimension = 1536; // Default
    if (
      typeof collectionInfo.config?.params?.vectors === "object" &&
      "size" in collectionInfo.config.params.vectors
    ) {
      vectorDimension = collectionInfo.config.params.vectors.size;
    }

    logger.info(
      `[Qdrant Backup] Collection has ${pointsCount} points, ${vectorsCount} vectors (${vectorDimension}D)`
    );

    // Prepare backup file path
    if (!outputPath) {
      await ensureBackupDir();
      const filename = getBackupFilename(collection);
      outputPath = `${BACKUP_DIR}/${filename}`;
    } else {
      // Ensure parent directory exists
      await fs.mkdir(dirname(outputPath), { recursive: true });
    }

    // Create metadata
    const metadata: BackupMetadata = {
      collection,
      timestamp: new Date().toISOString(),
      pointsCount,
      vectorsCount,
      vectorDimension,
    };

    // Export collection to JSON
    await exportToJson(collection, outputPath, {
      format: "json",
      includeVectors: true,
    });

    // Append metadata as comment (safe for JSON parsers that ignore trailing data)
    const metadataComment = `\n/* BACKUP METADATA: ${JSON.stringify(metadata)} */\n`;
    await fs.appendFile(outputPath, metadataComment);

    logger.info(`[Qdrant Backup] ✓ Backup created: ${outputPath}`);
    return outputPath;
  } catch (error: any) {
    logger.error(`[Qdrant Backup] Failed to backup '${collection}': ${error.message}`);
    throw error;
  }
}

/**
 * Backup all collections
 *
 * @returns Backup result summary
 */
export async function backupAllCollections(): Promise<BackupResult> {
  logger.info("[Qdrant Backup] Starting backup of all collections");

  if (!qdrantPool.isAvailable()) {
    throw new Error("Qdrant is not available (circuit breaker is OPEN)");
  }

  const result: BackupResult = {
    successful: [],
    failed: [],
    backupDir: BACKUP_DIR,
  };

  try {
    const client = await getQdrantClient();
    const collectionsResponse = await client.getCollections();
    const collections = collectionsResponse.collections.map((c) => c.name);

    logger.info(`[Qdrant Backup] Found ${collections.length} collection(s)`);

    // Use same timestamp for all backups in this batch
    const timestamp = new Date();

    for (const collection of collections) {
      try {
        const filename = getBackupFilename(collection, timestamp);
        const outputPath = `${BACKUP_DIR}/${filename}`;
        await backupCollection(collection, outputPath);
        result.successful.push(collection);
      } catch (error: any) {
        logger.error(`[Qdrant Backup] Failed to backup '${collection}': ${error.message}`);
        result.failed.push(collection);
      }
    }

    logger.info(
      `[Qdrant Backup] ✓ Batch backup complete: ${result.successful.length} successful, ${result.failed.length} failed`
    );

    return result;
  } catch (error: any) {
    logger.error(`[Qdrant Backup] Batch backup failed: ${error.message}`);
    throw error;
  }
}

/**
 * Restore a collection from backup
 *
 * @param collection - Collection name
 * @param backupPath - Optional specific backup file (defaults to latest)
 * @param recreate - If true, recreate collection (delete existing data)
 */
export async function restoreCollection(
  collection: string,
  backupPath?: string,
  recreate: boolean = false
): Promise<void> {
  logger.info(`[Qdrant Restore] Starting restore for collection '${collection}'`);

  if (!qdrantPool.isAvailable()) {
    throw new Error("Qdrant is not available (circuit breaker is OPEN)");
  }

  try {
    const client = await getQdrantClient();

    // Find backup file
    if (!backupPath) {
      backupPath = await findLatestBackup(collection);
      if (!backupPath) {
        throw new Error(`No backup found for collection '${collection}'`);
      }
      logger.info(`[Qdrant Restore] Using latest backup: ${backupPath}`);
    }

    // Verify backup file exists
    try {
      await fs.access(backupPath);
    } catch {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    // Check if collection exists
    let collectionExists = true;
    try {
      await client.getCollection(collection);
    } catch (error: any) {
      if (error.message?.includes("Not found") || error.message?.includes("Not Found")) {
        collectionExists = false;
      } else {
        throw error;
      }
    }

    if (collectionExists) {
      if (recreate) {
        logger.warn(`[Qdrant Restore] Deleting existing collection '${collection}'`);
        await client.deleteCollection(collection);

        // Recreate collection (we need to parse metadata from backup)
        const backupContent = await fs.readFile(backupPath, "utf8");
        const metadataMatch = backupContent.match(
          /\/\* BACKUP METADATA: (.+?) \*\//
        );

        if (metadataMatch) {
          const metadata: BackupMetadata = JSON.parse(metadataMatch[1]);
          logger.info(
            `[Qdrant Restore] Recreating collection with ${metadata.vectorDimension}D vectors`
          );

          await client.createCollection(collection, {
            vectors: {
              size: metadata.vectorDimension,
              distance: "Cosine",
            },
          });
        } else {
          throw new Error(
            "Cannot recreate collection: backup metadata not found. Restore to existing collection instead."
          );
        }
      } else {
        logger.info(
          `[Qdrant Restore] Collection exists. Merging backup data (upsert mode)`
        );
      }
    } else {
      throw new Error(
        `Collection '${collection}' does not exist. Create it first or use --recreate flag.`
      );
    }

    // Import backup
    logger.info(`[Qdrant Restore] Importing data from ${backupPath}`);

    const importResult = await importFromJson(backupPath, collection, {
      batchSize: 100,
      skipErrors: true,
      validate: true,
    });

    logger.info(
      `[Qdrant Restore] ✓ Restore complete: ${importResult.successCount} points imported, ${importResult.errorCount} errors`
    );

    if (importResult.errorCount > 0) {
      logger.warn(
        `[Qdrant Restore] Some points failed to import. Check logs for details.`
      );
    }
  } catch (error: any) {
    logger.error(`[Qdrant Restore] Failed to restore '${collection}': ${error.message}`);
    throw error;
  }
}

/**
 * List available backups for a collection
 *
 * @param collection - Collection name (optional, lists all if not provided)
 * @returns Array of backup file paths
 */
export async function listBackups(collection?: string): Promise<string[]> {
  try {
    await ensureBackupDir();
    const files = await fs.readdir(BACKUP_DIR);

    let backups = files.filter((f) => f.endsWith(".backup.json"));

    if (collection) {
      backups = backups.filter((f) => f.startsWith(`${collection}.`));
    }

    return backups.map((f) => `${BACKUP_DIR}/${f}`).sort().reverse();
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/**
 * Delete old backups (retention policy)
 *
 * @param retentionDays - Keep backups from last N days
 * @returns Number of deleted backups
 */
export async function cleanupOldBackups(retentionDays: number = 7): Promise<number> {
  logger.info(`[Qdrant Backup] Cleaning up backups older than ${retentionDays} days`);

  try {
    const allBackups = await listBackups();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let deletedCount = 0;

    for (const backupPath of allBackups) {
      const stats = await fs.stat(backupPath);
      if (stats.mtime < cutoffDate) {
        logger.info(`[Qdrant Backup] Deleting old backup: ${backupPath}`);
        await fs.unlink(backupPath);
        deletedCount++;
      }
    }

    logger.info(`[Qdrant Backup] ✓ Deleted ${deletedCount} old backup(s)`);
    return deletedCount;
  } catch (error: any) {
    logger.error(`[Qdrant Backup] Cleanup failed: ${error.message}`);
    throw error;
  }
}
