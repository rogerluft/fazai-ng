import * as fs from "fs/promises";
import * as path from "path";
import { getQdrantClient } from "../src/database/qdrant-pool";
import { logger, initLogger } from "../src/logger";

/**
 * FazAI Vector Backup Tool
 *
 * Exports all Qdrant collections to JSONL files for safekeeping.
 * Usage: npx tsx scripts/backup-vectors.ts
 */

const BACKUP_DIR = "/opt/fazai/backups/vectors";

async function main() {
  initLogger();
  logger.info("📦 Starting Vector Store Backup...");

  try {
    const client = await getQdrantClient();
    const collections = await client.getCollections();

    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const sessionDir = path.join(BACKUP_DIR, timestamp);
    await fs.mkdir(sessionDir, { recursive: true });

    logger.info(`📂 Backup directory: ${sessionDir}`);

    for (const col of collections.collections) {
      const name = col.name;
      logger.info(`⬇️  Exporting collection: ${name}...`);
      
      const filePath = path.join(sessionDir, `${name}.jsonl`);
      const fileHandle = await fs.open(filePath, "w");

      // Scroll through all points
      let offset: string | undefined = undefined;
      let total = 0;

      while (true) {
        const result = await client.scroll(name, {
          limit: 100,
          with_payload: true,
          with_vector: true,
          offset,
        });

        const points = result.points;
        if (points.length === 0) break;

        const lines = points.map(p => JSON.stringify(p)).join("\n") + "\n";
        await fileHandle.write(lines);

        total += points.length;
        offset = result.next_page_offset;

        if (!offset) break;
      }

      await fileHandle.close();
      logger.info(`✅ Exported ${total} points to ${name}.jsonl`);
    }

    logger.info("✨ Backup completed successfully!");
    console.log(`Backup location: ${sessionDir}`);

  } catch (error: any) {
    logger.error(`❌ Backup failed: ${error.message}`);
    process.exit(1);
  }
}

main();
