
/**
 * Qdrant Data Migration Script (1536 -> 768 dimensions)
 *
 * This script migrates all existing Qdrant collections from a legacy
 * dimension (e.g., 1536) to the new standard dimension (768) by
 * re-embedding all documents.
 *
 * Usage:
 *   npx tsx src/scripts/migrate-collections-768.ts
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { logger } from "../logger";
import chalk from "chalk";

// Target dimension: BGE-base-en-v1.5 native (768d)
const TARGET_DIMENSION = 768;

const QDRANT_URL = process.env.QDRANT_URL || "http://home.rogeruft.com.br:3336";
const BATCH_SIZE = 32;
const UPSERT_BATCH_SIZE = 500;

/**
 * Embedding service using ONNX BGE-base-en-v1.5 via qdrant-universal-injection
 */
class MigrationEmbeddingService {
  private embedder: any = null;
  private readonly dimension: number = 768;

  private async ensureInit(): Promise<void> {
    if (this.embedder) return;
    const { getEmbedder } = await import("qdrant-universal-injection");
    this.embedder = getEmbedder();
    if (!this.embedder.isReady) await this.embedder.init();
  }

  async generateBatch(texts: string[]): Promise<number[][]> {
    await this.ensureInit();
    return this.embedder.embedBatch(texts);
  }

  getInfo() {
    return {
      provider: "onnx",
      model: "BGE-base-en-v1.5",
      dimension: this.dimension,
    };
  }
}

/**
 * Extracts the correct text content from a point's payload based on its collection.
 * This is CRITICAL to avoid data corruption during re-embedding.
 */
function getTextForCollection(payload: Record<string, any>, collectionName: string): string {
  switch (collectionName) {
    case 'fazai_memory':
      return payload.content || '';
    case 'fazai_kb':
      return `${payload.title || ''}\n${payload.summary || ''}`;
    case 'fazai_personality':
      return payload.value || '';
    case 'fazai_learning':
      return `${payload.problem_description || ''}\n${payload.solution_description || ''}`;
    case 'fazai_inference':
        return `${payload.title || ''}\n${payload.description || ''}`;
    case 'fazai_source':
      return payload.pageContent || payload.content || '';
    default:
      // Fallback for unknown collections, though it might be inaccurate.
      return payload.pageContent || payload.document || payload.content || '';
  }
}

async function migrateCollections() {
  console.log(chalk.bold.cyan("\n╔══════════════════════════════════════════════════╗"));
  console.log(chalk.bold.cyan("║   FazAI Qdrant Data Migration Tool (→ 768d)    ║"));
  console.log(chalk.bold.cyan("╚══════════════════════════════════════════════════╝\n"));

  logger.info(chalk.gray(`Connecting to Qdrant at: ${QDRANT_URL}`));
  const client = new QdrantClient({ url: QDRANT_URL });

  logger.info(chalk.gray(`Initializing embedding service:`));
  logger.info(chalk.gray(`   Embedder: ONNX BGE-base-en-v1.5 (local)`));
  const embeddingService = new MigrationEmbeddingService();
  const info = embeddingService.getInfo();
  logger.info(chalk.green(`✅ Embedding Service ready: ${info.provider} (${info.model}, ${info.dimension}d)`));

  const { collections } = await client.getCollections();
  const collectionNames = collections.map(c => c.name);

  logger.info(chalk.cyan(`\nFound ${collectionNames.length} collections to migrate.`));

  for (const collectionName of collectionNames) {
    try {
      logger.info(chalk.cyan(`\n--- Migrating collection: ${chalk.bold(collectionName)} ---`));
      const collectionInfo = await client.getCollection(collectionName);
      // @ts-ignore
      const currentDim = collectionInfo.config.params.vectors.size;

      if (currentDim === TARGET_DIMENSION) {
        logger.info(chalk.yellow(`⚠️  Collection already has ${TARGET_DIMENSION} dimensions. Skipping.`));
        continue;
      }
      logger.info(`Current dimension: ${currentDim}d. Target: ${TARGET_DIMENSION}d.`);

      // 1. Fetch all points from the collection
      logger.info("Step 1/4: Fetching all existing points...");
      const allPoints = [];
      let offset = undefined;
      do {
        const page = await client.scroll(collectionName, {
          limit: 256,
          with_payload: true,
          with_vector: false,
          offset,
        });
        allPoints.push(...page.points);
        offset = page.next_page_offset;
      } while (offset);
      logger.info(`   > Found ${allPoints.length} points.`);

      // 2. Re-embed all documents in batches
      logger.info("Step 2/4: Re-generating embeddings for all points...");
      const newPoints = [];
      for (let i = 0; i < allPoints.length; i += BATCH_SIZE) {
        const batch = allPoints.slice(i, i + BATCH_SIZE);
        const texts = batch.map(p => getTextForCollection(p.payload || {}, collectionName));

        const newEmbeddings = await embeddingService.generateBatch(texts);

        for (let j = 0; j < batch.length; j++) {
          newPoints.push({
            id: batch[j].id,
            vector: newEmbeddings[j],
            payload: batch[j].payload,
          });
        }
        logger.info(`   > Batch ${Math.floor(i / BATCH_SIZE) + 1} processed. (${i + batch.length}/${allPoints.length})`);
      }

      // 3. Re-create the collection with the new dimension
      logger.info(`Step 3/4: Re-creating collection '${collectionName}' with ${TARGET_DIMENSION} dimensions...`);
      await client.deleteCollection(collectionName);
      await client.createCollection(collectionName, {
        vectors: {
          size: TARGET_DIMENSION,
          // @ts-ignore
          distance: collectionInfo.config.params.vectors.distance,
        },
      });

      // 4. Upsert the points with new embeddings IN BATCHES
      logger.info(`Step 4/4: Inserting ${newPoints.length} points in batches of ${UPSERT_BATCH_SIZE}...`);
      const totalUpsertBatches = Math.ceil(newPoints.length / UPSERT_BATCH_SIZE);
      for (let i = 0; i < newPoints.length; i += UPSERT_BATCH_SIZE) {
        const upsertBatch = newPoints.slice(i, i + UPSERT_BATCH_SIZE);
        await client.upsert(collectionName, {
          wait: true,
          points: upsertBatch,
        });
        const currentBatch = Math.floor(i / UPSERT_BATCH_SIZE) + 1;
        logger.info(`   > Upsert batch ${currentBatch}/${totalUpsertBatches} completed. (${i + upsertBatch.length}/${newPoints.length} points)`);
      }

      logger.info(chalk.green(`✅ Collection '${collectionName}' migrated successfully!`));

    } catch (error: any) {
      logger.error(chalk.red(`❌ Failed to migrate '${collectionName}': ${error.message}`));
    }
  }

  logger.info(chalk.bold.green("\n✨ All collections have been processed. Migration complete! ✨\n"));
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  migrateCollections().catch(err => {
    logger.error(chalk.red("\n❌ A critical error occurred during migration:"), err);
    process.exit(1);
  });
}
