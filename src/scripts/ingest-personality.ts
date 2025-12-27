#!/usr/bin/env tsx
/**
 * Personality Ingestion Script
 *
 * Script CLI para ingerir dados exportados do Claude (conversations, memories, projects, users)
 * na collection fazai_personality do Qdrant.
 *
 * Usage:
 *   tsx src/scripts/ingest-personality.ts <data-directory>
 *
 * Example:
 *   tsx src/scripts/ingest-personality.ts /path/to/claude-export-batch
 *
 * Requirements:
 * - Qdrant rodando (localhost:6333 ou configurado em fazai.conf)
 * - Collection fazai_personality criada (1536 dimensions)
 * - Embedding service configurado (Ollama ou OpenAI)
 */

import { PersonalityIngestor } from "../services/personality-ingestor";
import { logger } from "../logger";
import { getQdrantClient } from "../database/qdrant-pool";

/**
 * Verifica se a collection existe e tem a dimensão correta
 */
async function validateCollection(): Promise<void> {
  logger.info("Validating Qdrant collection...");

  const client = await getQdrantClient();
  const collections = await client.getCollections();

  const collection = collections.collections.find((c) => c.name === "fazai_personality");

  if (!collection) {
    logger.error("❌ Collection 'fazai_personality' not found");
    logger.info("Create it with:");
    logger.info("  fazai qdrant create-collection fazai_personality --dimension 1536");
    process.exit(1);
  }

  // Verificar dimensão (se disponível)
  const collectionInfo = await client.getCollection("fazai_personality");

  if (collectionInfo.config?.params?.vectors) {
    const vectorConfig = collectionInfo.config.params.vectors;

    // Pode ser objeto direto ou named vectors
    const dimension =
      typeof vectorConfig === "object" && "size" in vectorConfig
        ? vectorConfig.size
        : undefined;

    if (dimension && dimension !== 1536) {
      logger.warn(`⚠️  Collection has dimension ${dimension}, expected 1536`);
      logger.warn("This may cause issues. Consider recreating the collection.");
    } else {
      logger.info("✓ Collection validation passed");
    }
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: tsx src/scripts/ingest-personality.ts <data-directory>");
    console.error("");
    console.error("Example:");
    console.error("  tsx src/scripts/ingest-personality.ts /path/to/claude-export-batch");
    process.exit(1);
  }

  const dataDir = args[0];

  logger.info("=".repeat(60));
  logger.info("FazAI Personality Ingestion");
  logger.info("=".repeat(60));
  logger.info(`Data directory: ${dataDir}`);

  try {
    // Validar collection
    await validateCollection();

    // Executar ingestão
    const ingestor = new PersonalityIngestor();
    const stats = await ingestor.ingestAll(dataDir);

    // Resumo final
    logger.info("");
    logger.info("=".repeat(60));
    logger.info("✅ Ingestion completed successfully!");
    logger.info("=".repeat(60));
    logger.info(`Total chunks: ${stats.totalChunks}`);
    logger.info(`Total embeddings: ${stats.totalEmbeddings}`);
    logger.info(`Duration: ${stats.duration ? (stats.duration / 1000).toFixed(2) : "N/A"}s`);

    const totalErrors =
      stats.conversations.errors +
      stats.memories.errors +
      stats.projects.errors +
      stats.users.errors;

    if (totalErrors > 0) {
      logger.warn(`⚠️  Total errors: ${totalErrors}`);
    }

    logger.info("");
    logger.info("Next steps:");
    logger.info("1. Verify data with: fazai qdrant info fazai_personality");
    logger.info("2. Query personality traits with personality-loader service");
    logger.info("3. Test semantic search with: fazai qdrant search fazai_personality 'your query'");
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`❌ Ingestion failed: ${err.message}`);
    logger.error(err.stack || "");
    process.exit(1);
  }
}

// Execute
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
