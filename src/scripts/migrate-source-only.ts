/**
 * Migrate ONLY fazai_source collection from 1536d to 768d
 * With batched upserts to avoid timeout
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { logger } from "../logger";
import chalk from "chalk";

const TARGET_DIMENSION = 768;
const OLLAMA_PRIMARY = "http://192.168.0.101:11434";
const OLLAMA_FALLBACK = "http://localhost:11434";
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const BATCH_SIZE = 32;
const UPSERT_BATCH_SIZE = 500;
const COLLECTION = "fazai_source";

class MigrationEmbeddingService {
  private readonly primaryUrl: string;
  private readonly fallbackUrl: string;
  private readonly model: string = "nomic-embed-text";
  private readonly dimension: number = 768;
  private readonly MAX_CHARS = 10000;

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

      if (!response.ok) return null;

      const data = await response.json();
      return data.embedding;
    } catch {
      return null;
    }
  }

  async generateBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];

    for (const text of texts) {
      const truncated = text.length > this.MAX_CHARS ? text.substring(0, this.MAX_CHARS) : text;

      let embedding = await this.tryEmbed(truncated, this.primaryUrl);

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
}

async function migrateSource() {
  console.log(chalk.bold.cyan("\n╔══════════════════════════════════════════════════╗"));
  console.log(chalk.bold.cyan("║   Migrate fazai_source ONLY (1536 → 768d)       ║"));
  console.log(chalk.bold.cyan("╚══════════════════════════════════════════════════╝\n"));

  const client = new QdrantClient({ url: QDRANT_URL });
  const embeddingService = new MigrationEmbeddingService(OLLAMA_PRIMARY, OLLAMA_FALLBACK);

  logger.info(`Primary: ${OLLAMA_PRIMARY} | Fallback: ${OLLAMA_FALLBACK}`);

  // Check current state
  const collectionInfo = await client.getCollection(COLLECTION);
  // @ts-ignore
  const currentDim = collectionInfo.config.params.vectors.size;
  const currentPoints = collectionInfo.points_count;

  logger.info(`Current: ${currentPoints} points @ ${currentDim}d`);

  if (currentDim === TARGET_DIMENSION) {
    logger.info(chalk.yellow("Already at 768d. Nothing to do."));
    return;
  }

  // Step 1: Fetch all points
  logger.info("Step 1/4: Fetching all points...");
  const allPoints: any[] = [];
  let offset = undefined;
  do {
    const page = await client.scroll(COLLECTION, {
      limit: 256,
      with_payload: true,
      with_vector: false,
      offset,
    });
    allPoints.push(...page.points);
    offset = page.next_page_offset;
    if (allPoints.length % 2048 === 0) {
      logger.info(`   > Fetched ${allPoints.length} points...`);
    }
  } while (offset);
  logger.info(chalk.green(`   > Total: ${allPoints.length} points fetched`));

  // Step 2: Re-embed
  logger.info("Step 2/4: Re-generating embeddings...");
  const newPoints: any[] = [];
  for (let i = 0; i < allPoints.length; i += BATCH_SIZE) {
    const batch = allPoints.slice(i, i + BATCH_SIZE);
    const texts = batch.map(p => (p.payload?.pageContent || p.payload?.content || ''));

    const newEmbeddings = await embeddingService.generateBatch(texts);

    for (let j = 0; j < batch.length; j++) {
      newPoints.push({
        id: batch[j].id,
        vector: newEmbeddings[j],
        payload: batch[j].payload,
      });
    }

    if ((i + batch.length) % 1000 === 0 || i + batch.length === allPoints.length) {
      logger.info(`   > Embedded ${i + batch.length}/${allPoints.length} (${((i + batch.length) / allPoints.length * 100).toFixed(1)}%)`);
    }
  }

  // Step 3: Recreate collection
  logger.info("Step 3/4: Recreating collection with 768d...");
  // @ts-ignore
  const distance = collectionInfo.config.params.vectors.distance;
  await client.deleteCollection(COLLECTION);
  await client.createCollection(COLLECTION, {
    vectors: {
      size: TARGET_DIMENSION,
      distance: distance,
    },
  });
  logger.info(chalk.green("   > Collection recreated"));

  // Step 4: Batched upsert
  logger.info(`Step 4/4: Upserting ${newPoints.length} points in batches of ${UPSERT_BATCH_SIZE}...`);
  const totalBatches = Math.ceil(newPoints.length / UPSERT_BATCH_SIZE);

  for (let i = 0; i < newPoints.length; i += UPSERT_BATCH_SIZE) {
    const batch = newPoints.slice(i, i + UPSERT_BATCH_SIZE);

    try {
      await client.upsert(COLLECTION, {
        wait: true,
        points: batch,
      });

      const batchNum = Math.floor(i / UPSERT_BATCH_SIZE) + 1;
      logger.info(`   > Batch ${batchNum}/${totalBatches} (${i + batch.length}/${newPoints.length} points)`);
    } catch (error: any) {
      logger.error(chalk.red(`   > FAILED at batch starting at ${i}: ${error.message}`));
      throw error;
    }
  }

  // Verify
  const finalInfo = await client.getCollection(COLLECTION);
  logger.info(chalk.bold.green(`\n✅ Migration complete! ${finalInfo.points_count} points @ 768d\n`));
}

migrateSource().catch(err => {
  logger.error(chalk.red("FATAL:"), err);
  process.exit(1);
});
