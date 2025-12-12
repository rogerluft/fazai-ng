/**
 * Qdrant Collections Initializer
 *
 * Cria todas as collections necessárias para o FazAI RAG system
 *
 * Collections:
 * - fazai_personality: AI personality traits
 * - fazai_memory: Conversation history
 * - fazai_kb: Knowledge base (Linux/network docs)
 * - fazai_learning: Auto-learning patterns
 * - fazai_inference: Security policies and rules
 *
 * Usage:
 *   npx tsx src/scripts/init-qdrant-collections.ts
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { logger } from "../logger";
import chalk from "chalk";

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const EMBEDDING_DIM = 1024; // mxbai-embed-large

interface CollectionConfig {
  name: string;
  description: string;
  vectorSize: number;
  distance: "Cosine" | "Euclid" | "Dot";
}

const COLLECTIONS: CollectionConfig[] = [
  {
    name: "fazai_personality",
    description: "AI personality traits and expertise",
    vectorSize: EMBEDDING_DIM,
    distance: "Cosine",
  },
  {
    name: "fazai_memory",
    description: "Conversation history and operational memory",
    vectorSize: EMBEDDING_DIM,
    distance: "Cosine",
  },
  {
    name: "fazai_kb",
    description: "Knowledge base - Linux/network solutions",
    vectorSize: EMBEDDING_DIM,
    distance: "Cosine",
  },
  {
    name: "fazai_learning",
    description: "Auto-learning patterns and solutions",
    vectorSize: EMBEDDING_DIM,
    distance: "Cosine",
  },
  {
    name: "fazai_inference",
    description: "Security policies and operational rules",
    vectorSize: EMBEDDING_DIM,
    distance: "Cosine",
  },
];

async function collectionExists(client: QdrantClient, name: string): Promise<boolean> {
  try {
    await client.getCollection(name);
    return true;
  } catch (error: any) {
    if (error.message?.includes("Not found") || error.message?.includes("Not Found")) {
      return false;
    }
    throw error;
  }
}

async function createCollection(client: QdrantClient, config: CollectionConfig): Promise<void> {
  logger.info(chalk.cyan(`📦 Creating collection: ${config.name}`));
  logger.info(chalk.gray(`   Description: ${config.description}`));
  logger.info(chalk.gray(`   Vector size: ${config.vectorSize}D`));
  logger.info(chalk.gray(`   Distance: ${config.distance}`));

  try {
    await client.createCollection(config.name, {
      vectors: {
        size: config.vectorSize,
        distance: config.distance,
      },
      optimizers_config: {
        default_segment_number: 2,
      },
      replication_factor: 1,
    });

    logger.info(chalk.green(`✅ Collection '${config.name}' created successfully\n`));
  } catch (error: any) {
    logger.error(chalk.red(`❌ Failed to create '${config.name}': ${error.message}\n`));
    throw error;
  }
}

async function initializeCollections(): Promise<void> {
  console.log(chalk.bold.cyan("\n╔══════════════════════════════════════════════════╗"));
  console.log(chalk.bold.cyan("║   FazAI Qdrant Collections Initializer          ║"));
  console.log(chalk.bold.cyan("╚══════════════════════════════════════════════════╝\n"));

  logger.info(chalk.gray(`Connecting to Qdrant at: ${QDRANT_URL}\n`));

  const client = new QdrantClient({ url: QDRANT_URL });

  // Test connection
  try {
    await client.getCollections();
    logger.info(chalk.green("✅ Qdrant connection OK\n"));
  } catch (error: any) {
    logger.error(chalk.red(`❌ Cannot connect to Qdrant: ${error.message}`));
    logger.error(chalk.yellow(`   Make sure Qdrant is running at ${QDRANT_URL}`));
    process.exit(1);
  }

  // Check and create collections
  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const config of COLLECTIONS) {
    try {
      const exists = await collectionExists(client, config.name);

      if (exists) {
        logger.info(chalk.yellow(`⚠️  Collection '${config.name}' already exists (skipping)\n`));
        skippedCount++;
        continue;
      }

      await createCollection(client, config);
      createdCount++;
    } catch (error: any) {
      logger.error(chalk.red(`❌ Error with collection '${config.name}': ${error.message}\n`));
      errorCount++;
    }
  }

  // Summary
  console.log(chalk.bold.cyan("\n╔══════════════════════════════════════════════════╗"));
  console.log(chalk.bold.cyan("║                 SUMMARY                          ║"));
  console.log(chalk.bold.cyan("╚══════════════════════════════════════════════════╝\n"));

  logger.info(chalk.green(`✅ Created: ${createdCount} collection(s)`));
  logger.info(chalk.yellow(`⚠️  Skipped: ${skippedCount} collection(s) (already exist)`));
  if (errorCount > 0) {
    logger.info(chalk.red(`❌ Errors: ${errorCount} collection(s)`));
  }
  logger.info(chalk.gray(`\nTotal collections: ${COLLECTIONS.length}\n`));

  // List all collections
  try {
    const collections = await client.getCollections();
    logger.info(chalk.cyan("📋 All collections in Qdrant:"));
    for (const coll of collections.collections) {
      const info = await client.getCollection(coll.name);
      logger.info(chalk.gray(`   • ${coll.name} (${info.points_count} points, ${info.vectors_count} vectors)`));
    }
  } catch (error: any) {
    logger.warn(chalk.yellow(`\n⚠️  Could not list collections: ${error.message}`));
  }

  console.log("\n");
}

export { initializeCollections };

// Run if executed directly (ESM check)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  initializeCollections()
    .then(() => {
      logger.info(chalk.green("✨ Initialization complete!"));
      process.exit(0);
    })
    .catch((error) => {
      logger.error(chalk.red("❌ Initialization failed:"), error);
      process.exit(1);
    });
}
