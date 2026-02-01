/**
 * SkillSeeker Service Usage Examples
 *
 * Demonstrates how to use the SkillSeeker service for automatic
 * knowledge ingestion and indexing.
 */

import { getSkillSeeker } from "../src/services/skill-seeker";
import { logger } from "../src/logger";

/**
 * Example 1: Start the service and monitor directory
 */
async function example1_startMonitoring(): Promise<void> {
  console.log("=== Example 1: Start Monitoring ===\n");

  const seeker = getSkillSeeker();

  try {
    // Start monitoring
    await seeker.start();

    console.log("✓ SkillSeeker started");
    console.log("📁 Drop files in /etc/fazai/ingest to index them\n");

    // Show stats every 5 seconds
    const intervalId = setInterval(() => {
      const stats = seeker.getStats();
      console.log("Stats:", stats);
    }, 5000);

    // Stop after 30 seconds (for demo purposes)
    setTimeout(async () => {
      clearInterval(intervalId);
      await seeker.stop();
      console.log("✓ SkillSeeker stopped");
      process.exit(0);
    }, 30000);
  } catch (error: any) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

/**
 * Example 2: Process a specific file
 */
async function example2_processFile(): Promise<void> {
  console.log("=== Example 2: Process Specific File ===\n");

  const seeker = getSkillSeeker();

  try {
    // Process a file
    const filePath = "/etc/fazai/ingest/example.pdf";
    await seeker.processFile(filePath);

    console.log("✓ File processed successfully");

    // Show stats
    const stats = seeker.getStats();
    console.log("\nStatistics:");
    console.log(`  Files Processed: ${stats.filesProcessed}`);
    console.log(`  Chunks Indexed: ${stats.chunksIndexed}`);
    console.log(`  Errors: ${stats.errors}`);
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

/**
 * Example 3: Get service statistics
 */
async function example3_getStats(): Promise<void> {
  console.log("=== Example 3: Get Statistics ===\n");

  const seeker = getSkillSeeker();

  const stats = seeker.getStats();

  console.log("Service Status:", stats.isRunning ? "Running" : "Stopped");
  console.log("Watched Directory:", stats.watchedDirectory);
  console.log("Files Processed:", stats.filesProcessed);
  console.log("Chunks Indexed:", stats.chunksIndexed);
  console.log("Errors:", stats.errors);

  if (stats.lastProcessedFile) {
    console.log("\nLast Processed:");
    console.log("  File:", stats.lastProcessedFile);
    console.log("  At:", stats.lastProcessedAt);
  }
}

/**
 * Example 4: Integration with RAG
 */
async function example4_ragIntegration(): Promise<void> {
  console.log("=== Example 4: RAG Integration ===\n");

  // Import Qdrant client
  const { getQdrantClient } = await import("../src/database/qdrant-pool");
  const { createEmbeddingService } = await import("../src/services/embeddings");

  try {
    // 1. Index knowledge files
    const seeker = getSkillSeeker();
    await seeker.start();
    console.log("✓ SkillSeeker monitoring started");

    // Wait for some files to be processed (simulated)
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 2. Query the knowledge base
    const query = "What are the best practices for Linux security?";
    console.log(`\nQuery: "${query}"`);

    // Generate query embedding
    const embeddingService = await createEmbeddingService();
    const queryEmbedding = await embeddingService.generate(query);

    // Search Qdrant
    const qdrant = await getQdrantClient();
    const results = await qdrant.search("fazai_kb", {
      vector: queryEmbedding,
      limit: 3,
      filter: {
        must: [{ key: "type", match: { value: "knowledge" } }],
      },
    });

    console.log(`\nFound ${results.length} relevant chunks:\n`);

    results.forEach((result, i) => {
      console.log(`${i + 1}. Score: ${result.score?.toFixed(4)}`);
      console.log(`   Source: ${result.payload?.source}`);
      console.log(`   Content: ${(result.payload?.content as string).substring(0, 100)}...`);
      console.log();
    });

    // 3. Build RAG context
    const context = results
      .map((r) => r.payload?.content)
      .join("\n\n---\n\n");

    console.log("RAG Context built successfully");
    console.log(`Context length: ${context.length} characters`);

    // Stop monitoring
    await seeker.stop();
    console.log("\n✓ SkillSeeker stopped");
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

/**
 * Example 5: Background service with systemd
 */
async function example5_backgroundService(): Promise<void> {
  console.log("=== Example 5: Background Service Setup ===\n");

  console.log("To run SkillSeeker as a background service:");
  console.log();
  console.log("1. Create systemd service file:");
  console.log("   sudo nano /etc/systemd/system/fazai-skill-seeker.service");
  console.log();
  console.log("[Unit]");
  console.log("Description=FazAI SkillSeeker - Automatic Knowledge Ingestion");
  console.log("After=network.target qdrant.service");
  console.log();
  console.log("[Service]");
  console.log("Type=simple");
  console.log("User=fazai");
  console.log("WorkingDirectory=/opt/fazai");
  console.log("ExecStart=/usr/local/bin/fazai skill-seeker start");
  console.log("Restart=on-failure");
  console.log("RestartSec=10s");
  console.log();
  console.log("[Install]");
  console.log("WantedBy=multi-user.target");
  console.log();
  console.log("2. Enable and start service:");
  console.log("   sudo systemctl daemon-reload");
  console.log("   sudo systemctl enable fazai-skill-seeker");
  console.log("   sudo systemctl start fazai-skill-seeker");
  console.log();
  console.log("3. Check status:");
  console.log("   sudo systemctl status fazai-skill-seeker");
  console.log("   sudo journalctl -u fazai-skill-seeker -f");
  console.log();
}

/**
 * Main function - run examples
 */
async function main(): Promise<void> {
  const example = process.argv[2] || "1";

  switch (example) {
    case "1":
      await example1_startMonitoring();
      break;
    case "2":
      await example2_processFile();
      break;
    case "3":
      await example3_getStats();
      break;
    case "4":
      await example4_ragIntegration();
      break;
    case "5":
      await example5_backgroundService();
      break;
    default:
      console.log("Usage: tsx examples/skill-seeker-usage.ts [1-5]");
      console.log();
      console.log("Examples:");
      console.log("  1 - Start monitoring");
      console.log("  2 - Process specific file");
      console.log("  3 - Get statistics");
      console.log("  4 - RAG integration");
      console.log("  5 - Background service setup");
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  example1_startMonitoring,
  example2_processFile,
  example3_getStats,
  example4_ragIntegration,
  example5_backgroundService,
};
