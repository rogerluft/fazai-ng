/**
 * Qdrant Collections Migration Script
 *
 * Migrates existing collections to new optimized schemas:
 * - Native 768 dimensions (BGE-base-en-v1.5, no zero padding)
 * - Proper distance metrics (Dot for personality/learning, Cosine for memory/kb)
 * - Collection-specific embedding models
 * - Semantic chunking (no hard truncation)
 *
 * CRITICAL: This is a BREAKING CHANGE. Backup data before running.
 *
 * Usage:
 *   npx tsx src/scripts/migrate-qdrant-collections.ts [--dry-run] [--collection=name]
 *
 * Options:
 *   --dry-run: Preview changes without applying
 *   --collection=name: Migrate only specific collection
 *   --skip-backup: Skip automatic backup (NOT RECOMMENDED)
 *
 * @module scripts/migrate-qdrant-collections
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { logger } from "../logger";
import chalk from "chalk";
import { getConfigValue } from "../config";
import {
  CollectionType,
  getEmbeddingStrategy,
} from "../services/embedding-strategies";
import { createEmbeddingService } from "../services/embeddings-refactored";

const QDRANT_URL =
  getConfigValue("QDRANT_URL") ||
  process.env.QDRANT_URL ||
  "http://localhost:6333";

interface MigrationConfig {
  dryRun: boolean;
  targetCollection?: string;
  skipBackup: boolean;
}

interface CollectionMigrationPlan {
  name: string;
  oldConfig: {
    vectorSize: number;
    distance: string;
    pointsCount: number;
  };
  newConfig: {
    vectorSize: number;
    distance: string;
  };
  requiresReembedding: boolean;
}

/**
 * Parse CLI arguments
 */
function parseArgs(): MigrationConfig {
  const args = process.argv.slice(2);

  return {
    dryRun: args.includes("--dry-run"),
    targetCollection: args
      .find((a) => a.startsWith("--collection="))
      ?.split("=")[1],
    skipBackup: args.includes("--skip-backup"),
  };
}

/**
 * Get collection type from name
 */
function getCollectionType(name: string): CollectionType | null {
  const mapping: Record<string, CollectionType> = {
    fazai_personality: "personality",
    fazai_memory: "memory",
    fazai_learning: "learning",
    fazai_kb: "kb",
    fazai_inference: "inference",
  };

  return mapping[name] || null;
}

/**
 * Analyze current collection configuration
 */
async function analyzeCollection(
  client: QdrantClient,
  name: string
): Promise<CollectionMigrationPlan | null> {
  try {
    const collectionInfo = await client.getCollection(name);
    const collectionType = getCollectionType(name);

    if (!collectionType) {
      logger.warn(`Unknown collection: ${name} (skipping)`);
      return null;
    }

    const strategy = getEmbeddingStrategy(collectionType);
    const oldVectorSize = collectionInfo.config?.params?.vectors?.size || 0;
    const oldDistance = collectionInfo.config?.params?.vectors?.distance || "Cosine";

    const plan: CollectionMigrationPlan = {
      name,
      oldConfig: {
        vectorSize: oldVectorSize,
        distance: oldDistance,
        pointsCount: collectionInfo.points_count || 0,
      },
      newConfig: {
        vectorSize: strategy.dimension,
        distance: strategy.distanceMetric,
      },
      requiresReembedding:
        oldVectorSize !== strategy.dimension ||
        oldDistance !== strategy.distanceMetric,
    };

    return plan;
  } catch (error: any) {
    logger.error(`Failed to analyze ${name}: ${error.message}`);
    return null;
  }
}

/**
 * Display migration plan
 */
function displayMigrationPlan(plans: CollectionMigrationPlan[]): void {
  console.log(
    chalk.bold.cyan("\n╔══════════════════════════════════════════════════╗")
  );
  console.log(chalk.bold.cyan("║           MIGRATION PLAN                         ║"));
  console.log(
    chalk.bold.cyan("╚══════════════════════════════════════════════════╝\n")
  );

  for (const plan of plans) {
    const needsMigration = plan.requiresReembedding;
    const status = needsMigration
      ? chalk.yellow("⚠️  REQUIRES MIGRATION")
      : chalk.green("✓ OK (no changes needed)");

    console.log(chalk.bold(`\n${plan.name}:`));
    console.log(`  Status: ${status}`);
    console.log(
      chalk.gray(`  Points: ${plan.oldConfig.pointsCount.toLocaleString()}`)
    );

    if (needsMigration) {
      console.log(chalk.yellow("\n  Changes:"));
      console.log(
        `    Vector Size: ${plan.oldConfig.vectorSize} → ${plan.newConfig.vectorSize}`
      );
      console.log(
        `    Distance:    ${plan.oldConfig.distance} → ${plan.newConfig.distance}`
      );
      console.log(
        chalk.red(
          `    ⚠️  All ${plan.oldConfig.pointsCount} points must be re-embedded!`
        )
      );
    } else {
      console.log(chalk.green("  ✓ Already using optimal configuration"));
    }
  }

  console.log("\n");

  // Summary
  const needsMigration = plans.filter((p) => p.requiresReembedding);
  const totalPoints = needsMigration.reduce(
    (sum, p) => sum + p.oldConfig.pointsCount,
    0
  );

  console.log(chalk.bold("Summary:"));
  console.log(
    `  Collections needing migration: ${needsMigration.length}/${plans.length}`
  );
  console.log(`  Total points to re-embed: ${totalPoints.toLocaleString()}`);

  if (totalPoints > 0) {
    const estimatedTime = Math.ceil(totalPoints / 10); // Rough estimate: 10 points/sec
    console.log(
      chalk.yellow(
        `  Estimated time: ~${estimatedTime}s (${Math.ceil(estimatedTime / 60)}min)`
      )
    );
  }
}

/**
 * Backup collection data
 */
async function backupCollection(
  client: QdrantClient,
  name: string
): Promise<void> {
  logger.info(chalk.cyan(`📦 Backing up ${name}...`));

  try {
    // Scroll through all points
    let offset: string | number | null = null;
    let allPoints: any[] = [];

    do {
      const result = await client.scroll(name, {
        limit: 100,
        offset,
        with_payload: true,
        with_vector: true,
      });

      allPoints.push(...result.points);
      offset = result.next_page_offset || null;

      logger.debug(`  Backed up ${allPoints.length} points...`);
    } while (offset !== null);

    // Save to file
    const backupPath = `/tmp/fazai_backup_${name}_${Date.now()}.json`;
    const fs = await import("fs/promises");
    await fs.writeFile(backupPath, JSON.stringify(allPoints, null, 2));

    logger.info(
      chalk.green(
        `  ✓ Backup saved: ${backupPath} (${allPoints.length} points)`
      )
    );
  } catch (error: any) {
    logger.error(chalk.red(`  ❌ Backup failed: ${error.message}`));
    throw error;
  }
}

/**
 * Recreate collection with new schema
 */
async function recreateCollection(
  client: QdrantClient,
  plan: CollectionMigrationPlan
): Promise<void> {
  const collectionType = getCollectionType(plan.name);
  if (!collectionType) {
    throw new Error(`Unknown collection type: ${plan.name}`);
  }

  const strategy = getEmbeddingStrategy(collectionType);

  logger.info(chalk.cyan(`🔧 Recreating ${plan.name}...`));

  // 1. Delete old collection
  try {
    await client.deleteCollection(plan.name);
    logger.debug(`  ✓ Old collection deleted`);
  } catch (error: any) {
    logger.warn(`  Warning: ${error.message}`);
  }

  // 2. Create new collection with optimized config
  if (strategy.requiresEmbedding) {
    await client.createCollection(plan.name, {
      vectors: {
        size: plan.newConfig.vectorSize,
        distance: plan.newConfig.distance as any,
      },
      optimizers_config: {
        default_segment_number: plan.oldConfig.pointsCount > 50000 ? 8 : 4,
      },
      replication_factor: 1,
    });
  } else {
    // Payload-only collection (for inference)
    logger.warn(
      chalk.yellow(
        `  ⚠️  ${plan.name} should not use embeddings. Creating minimal collection.`
      )
    );
    // For now, create with minimal vector (Qdrant requires vectors)
    await client.createCollection(plan.name, {
      vectors: {
        size: 1,
        distance: "Dot",
      },
      optimizers_config: {
        default_segment_number: 1,
      },
      replication_factor: 1,
    });
  }

  logger.info(
    chalk.green(
      `  ✓ Collection recreated (${plan.newConfig.vectorSize}D, ${plan.newConfig.distance})`
    )
  );
}

/**
 * Re-embed and restore points
 */
async function reembedAndRestore(
  client: QdrantClient,
  plan: CollectionMigrationPlan,
  backupPath: string
): Promise<void> {
  logger.info(chalk.cyan(`🔄 Re-embedding points for ${plan.name}...`));

  const collectionType = getCollectionType(plan.name);
  if (!collectionType) {
    throw new Error(`Unknown collection type: ${plan.name}`);
  }

  const strategy = getEmbeddingStrategy(collectionType);

  if (!strategy.requiresEmbedding) {
    logger.info(
      chalk.yellow(`  ⚠️  ${plan.name} does not require embeddings. Skipping.`)
    );
    return;
  }

  // Load backup
  const fs = await import("fs/promises");
  const backupData = JSON.parse(await fs.readFile(backupPath, "utf-8"));

  logger.info(`  Loaded ${backupData.length} points from backup`);

  // Create embedding service
  const embeddingService = await createEmbeddingService();

  // Process in batches
  const BATCH_SIZE = 10;
  let processed = 0;

  for (let i = 0; i < backupData.length; i += BATCH_SIZE) {
    const batch = backupData.slice(i, i + BATCH_SIZE);

    // Extract text from each point
    const texts = batch.map((point: any) => {
      const payload = point.payload || {};
      // Try common content fields
      return (
        payload.content ||
        payload.action_taken ||
        payload.example ||
        payload.user_message ||
        JSON.stringify(payload).substring(0, 500)
      );
    });

    try {
      // Generate new embeddings
      const embeddings = await embeddingService.generateBatch(
        texts,
        collectionType
      );

      // Upsert points with new embeddings
      const points = batch.map((point: any, idx: number) => ({
        id: point.id,
        vector: embeddings[idx],
        payload: point.payload,
      }));

      await client.upsert(plan.name, {
        wait: true,
        points,
      });

      processed += batch.length;
      const progress = Math.round((processed / backupData.length) * 100);

      logger.debug(`  Progress: ${processed}/${backupData.length} (${progress}%)`);
    } catch (error: any) {
      logger.error(
        chalk.red(`  ❌ Failed to process batch ${i}: ${error.message}`)
      );
      throw error;
    }
  }

  logger.info(
    chalk.green(`  ✓ Re-embedded and restored ${processed} points`)
  );
}

/**
 * Main migration function
 */
async function migrate(config: MigrationConfig): Promise<void> {
  console.log(chalk.bold.cyan("\n╔══════════════════════════════════════════════════╗"));
  console.log(chalk.bold.cyan("║     FazAI Qdrant Collection Migration           ║"));
  console.log(chalk.bold.cyan("╚══════════════════════════════════════════════════╝\n"));

  if (config.dryRun) {
    console.log(chalk.yellow("🔍 DRY RUN MODE - No changes will be made\n"));
  }

  logger.info(chalk.gray(`Connecting to Qdrant at: ${QDRANT_URL}\n`));

  const client = new QdrantClient({ url: QDRANT_URL });

  // Test connection
  try {
    await client.getCollections();
    logger.info(chalk.green("✅ Qdrant connection OK\n"));
  } catch (error: any) {
    logger.error(chalk.red(`❌ Cannot connect to Qdrant: ${error.message}`));
    process.exit(1);
  }

  // Get collections to migrate
  const allCollections = await client.getCollections();
  const targetCollections = config.targetCollection
    ? allCollections.collections.filter(
        (c) => c.name === config.targetCollection
      )
    : allCollections.collections.filter((c) => c.name.startsWith("fazai_"));

  if (targetCollections.length === 0) {
    logger.error(chalk.red("❌ No collections to migrate"));
    process.exit(1);
  }

  // Analyze all collections
  const plans: CollectionMigrationPlan[] = [];

  for (const collection of targetCollections) {
    const plan = await analyzeCollection(client, collection.name);
    if (plan) {
      plans.push(plan);
    }
  }

  // Display plan
  displayMigrationPlan(plans);

  // If dry-run, exit here
  if (config.dryRun) {
    console.log(
      chalk.yellow("\n🔍 Dry run complete. Run without --dry-run to migrate.\n")
    );
    return;
  }

  // Confirm migration
  const needsMigration = plans.filter((p) => p.requiresReembedding);

  if (needsMigration.length === 0) {
    console.log(chalk.green("\n✓ All collections are already optimized!\n"));
    return;
  }

  console.log(
    chalk.bold.red(
      "\n⚠️  WARNING: This will DELETE and RECREATE collections!"
    )
  );
  console.log(chalk.yellow("Press Ctrl+C to cancel, or wait 10 seconds...\n"));

  await new Promise((resolve) => setTimeout(resolve, 10000));

  // Execute migration
  for (const plan of needsMigration) {
    console.log(
      chalk.bold.cyan(`\n━━━ Migrating ${plan.name} ━━━━━━━━━━━━━━━━━━━━\n`)
    );

    try {
      // 1. Backup
      if (!config.skipBackup) {
        await backupCollection(client, plan.name);
      } else {
        logger.warn(chalk.yellow("  ⚠️  Skipping backup (--skip-backup)"));
      }

      // 2. Recreate collection
      await recreateCollection(client, plan);

      // 3. Re-embed and restore
      const backupPath = `/tmp/fazai_backup_${plan.name}_*.json`;
      const fs = await import("fs/promises");
      const backupFiles = await fs.readdir("/tmp");
      const latestBackup = backupFiles
        .filter((f) => f.startsWith(`fazai_backup_${plan.name}_`))
        .sort()
        .reverse()[0];

      if (latestBackup) {
        await reembedAndRestore(
          client,
          plan,
          `/tmp/${latestBackup}`
        );
      } else {
        logger.warn(chalk.yellow("  ⚠️  No backup found, skipping restore"));
      }

      logger.info(chalk.bold.green(`\n✅ ${plan.name} migration complete!\n`));
    } catch (error: any) {
      logger.error(
        chalk.bold.red(`\n❌ ${plan.name} migration FAILED: ${error.message}\n`)
      );
      logger.error(chalk.yellow("  You can restore from backup in /tmp/\n"));
      throw error;
    }
  }

  console.log(
    chalk.bold.green("\n╔══════════════════════════════════════════════════╗")
  );
  console.log(chalk.bold.green("║        MIGRATION COMPLETED SUCCESSFULLY          ║"));
  console.log(
    chalk.bold.green("╚══════════════════════════════════════════════════╝\n")
  );

  logger.info(chalk.cyan("Next steps:"));
  logger.info(chalk.gray("  1. Test RAG queries: fazai ask \"test query\""));
  logger.info(chalk.gray("  2. Verify collection stats: fazai qdrant stats"));
  logger.info(chalk.gray("  3. Keep backups for 30 days in /tmp/\n"));
}

// Run migration
const config = parseArgs();
migrate(config)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    logger.error(chalk.red("Migration failed:"), error);
    process.exit(1);
  });
