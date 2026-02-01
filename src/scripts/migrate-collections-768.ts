
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

// Target dimension: nomic-embed-text native (768d)
const TARGET_DIMENSION = 768;

// Use fast server 101 with aggressive truncation + fallback to localhost
const OLLAMA_PRIMARY = "http://192.168.0.101:11434";
const OLLAMA_FALLBACK = "http://localhost:11434";
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const BATCH_SIZE = 32; // Process 32 documents at a time for embedding
const UPSERT_BATCH_SIZE = 500; // Upsert 500 points at a time to avoid timeout

/**
 * Embedding service with primary/fallback servers and aggressive truncation
 */
class MigrationEmbeddingService {
  private readonly primaryUrl: string;
  private readonly fallbackUrl: string;
  private readonly model: string = "nomic-embed-text";
  private readonly dimension: number = 768;
  private readonly MAX_CHARS = 10000; // Aggressive truncation to avoid 500 errors

  constructor(primaryUrl: string, fallbackUrl: string) {
    this.primaryUrl = primaryUrl;
    this.fallbackUrl = fallbackUrl;
  }

  private async tryEmbed(text: string, baseUrl: string): Promise<number[] | null> {
    try {
      const response = await fetch(`${baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt: text || " ",
        }),
      });

      if (!response.ok) {
        return null; // Try fallback
      }

      const data = await response.json();
      return data.embedding;
    } catch (e) {
      return null;
    }
  }

  async generateBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];

    for (const text of texts) {
      // Aggressive truncation
      const truncated = text.length > this.MAX_CHARS ? text.substring(0, this.MAX_CHARS) : text;

      // Try primary (fast)
      let embedding = await this.tryEmbed(truncated, this.primaryUrl);

      // Fallback to localhost if primary fails
      if (!embedding || embedding.length !== this.dimension) {
        logger.debug(`Primary failed, trying fallback for text of ${truncated.length} chars`);
        embedding = await this.tryEmbed(truncated, this.fallbackUrl);
      }

      if (!embedding || embedding.length !== this.dimension) {
        throw new Error(`Both servers failed! Expected ${this.dimension}d, got ${embedding?.length}`);
      }

      results.push(embedding);
    }

    return results;
  }

  getInfo() {
    return {
      provider: "ollama",
      model: this.model,
      dimension: this.dimension,
      primaryUrl: this.primaryUrl,
      fallbackUrl: this.fallbackUrl,
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
  logger.info(chalk.gray(`   Primary: ${chalk.bold(OLLAMA_PRIMARY)} (fast GPU)`));
  logger.info(chalk.gray(`   Fallback: ${chalk.bold(OLLAMA_FALLBACK)} (stable CPU)`));
  const embeddingService = new MigrationEmbeddingService(OLLAMA_PRIMARY, OLLAMA_FALLBACK);
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
