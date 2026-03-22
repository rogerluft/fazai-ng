#!/usr/bin/env node
/**
 * Memory Injector Worker — Standalone Entry Point
 *
 * Can be executed:
 *   node dist/services/memory-injector-worker.js              (single-shot)
 *   node dist/services/memory-injector-worker.js --continuous  (daemon mode)
 *
 * For systemd timer: single-shot mode (default)
 * For daemon: use --continuous flag
 *
 * Exit codes:
 *   0 = success
 *   1 = error
 *
 * @module services/memory-injector-worker
 */

import { MemoryInjector, loadInjectorConfig } from "./memory-injector.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const continuous = args.includes("--continuous") || args.includes("-c");
  const verbose = args.includes("--verbose") || args.includes("-v");

  const config = loadInjectorConfig({ singleShot: !continuous });

  if (verbose) {
    console.log(`[MemoryInjectorWorker] Mode: ${continuous ? "continuous" : "single-shot"}`);
    console.log(`[MemoryInjectorWorker] Interval: ${config.intervalSeconds}s`);
    console.log(`[MemoryInjectorWorker] Log: ${config.logPath}`);
  }

  const injector = new MemoryInjector(config);

  // Handle shutdown signals
  const controller = new AbortController();

  const shutdown = async () => {
    console.log("[MemoryInjectorWorker] Shutting down...");
    controller.abort();
    await injector.shutdown();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  try {
    if (continuous) {
      // Daemon mode: run continuously until signal
      await injector.runContinuous(controller.signal);
    } else {
      // Single-shot: run once and exit
      const result = await injector.inject();

      if (verbose) {
        console.log(`[MemoryInjectorWorker] Result:`, JSON.stringify(result, null, 2));
      }

      await injector.shutdown();
      process.exit(result.success ? 0 : 1);
    }
  } catch (error: any) {
    console.error(`[MemoryInjectorWorker] Fatal: ${error.message}`);
    await injector.shutdown();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`[MemoryInjectorWorker] Unhandled: ${err.message}`);
  process.exit(1);
});
