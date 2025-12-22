/**
 * Qdrant CLI Command Handler
 *
 * Provides CLI commands for managing Qdrant vector database:
 * - fazai qdrant status
 * - fazai qdrant metrics
 * - fazai qdrant backup [collection]
 * - fazai qdrant restore [collection]
 * - fazai qdrant import <file> --collection <name>
 * - fazai qdrant export <collection> --output <file>
 * - fazai qdrant container start|stop|restart|logs
 *
 * Usage:
 *   import { handleQdrantCommand } from './commands/qdrant';
 *   await handleQdrantCommand(process.argv.slice(3));
 */

import chalk from "chalk";
import { logger } from "../logger";
import { qdrantPool } from "../database/qdrant-pool";
import {
  getAllMetrics,
  getCapacityRecommendations,
  printMetricsReport,
} from "../orchestrator/qdrant-metrics";
import {
  importFromJson,
  exportToJson,
  exportToJsonLines,
  exportToCsv,
  type ExportFormat,
} from "../orchestrator/qdrant-import-export";

/**
 * Main handler for qdrant commands
 */
export async function handleQdrantCommand(args: string[]): Promise<void> {
  if (args.length === 0 || args[0] === "help" || args[0] === "--help") {
    displayQdrantHelp();
    return;
  }

  const subcommand = args[0];

  try {
    switch (subcommand) {
      case "status":
        await handleStatus();
        break;

      case "metrics":
        await handleMetrics();
        break;

      case "backup":
        await handleBackup(args.slice(1));
        break;

      case "restore":
        await handleRestore(args.slice(1));
        break;

      case "import":
        await handleImport(args.slice(1));
        break;

      case "export":
        await handleExport(args.slice(1));
        break;

      case "container":
        await handleContainer(args.slice(1));
        break;

      case "recommendations":
      case "recommend":
        await handleRecommendations();
        break;

      default:
        logger.error(chalk.red(`✗ Unknown subcommand: ${subcommand}`));
        displayQdrantHelp();
        process.exit(1);
    }
  } catch (error: any) {
    logger.error(chalk.red(`✗ Error: ${error.message}`));
    if (error.stack) {
      logger.debug(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Display help for qdrant commands
 */
function displayQdrantHelp(): void {
  const help = `
${chalk.bold.cyan("QDRANT MANAGEMENT COMMANDS")}

${chalk.bold("Usage:")}
  fazai qdrant <command> [options]

${chalk.bold("Commands:")}
  ${chalk.cyan("status")}                           Show Qdrant connection status
  ${chalk.cyan("metrics")}                          Display collection metrics and alerts
  ${chalk.cyan("recommendations")}                  Get capacity and optimization recommendations
  ${chalk.cyan("backup [collection]")}              Backup collection(s) to /var/backups/fazai/qdrant/
  ${chalk.cyan("restore [collection]")}             Restore collection from backup
  ${chalk.cyan("import <file> --collection <name>")}  Import points from file
  ${chalk.cyan("export <collection> --output <file>")}  Export collection to file
  ${chalk.cyan("container <action>")}               Manage Qdrant Podman container

${chalk.bold("Container Actions:")}
  start                            Start Qdrant container
  stop                             Stop Qdrant container
  restart                          Restart Qdrant container
  status                           Show container status
  logs                             Show container logs

${chalk.bold("Import/Export Options:")}
  --format=<json|jsonl|csv>       File format (default: auto-detect)
  --batch-size=<number>            Batch size for operations (default: 100)
  --skip-errors                    Continue on errors (default: true)
  --no-validate                    Skip validation (faster, less safe)

${chalk.bold("Examples:")}
  # Check status
  fazai qdrant status

  # View metrics
  fazai qdrant metrics

  # Backup all collections
  fazai qdrant backup

  # Backup specific collection
  fazai qdrant backup fazai_kb

  # Export to JSON
  fazai qdrant export fazai_kb --output /tmp/kb-export.json

  # Import from JSONL
  fazai qdrant import /tmp/data.jsonl --collection fazai_learning

  # Container management
  fazai qdrant container start
  fazai qdrant container logs

${chalk.bold("Configuration:")}
  Qdrant URL:    QDRANT_URL in /etc/fazai/fazai.conf
  Backup Dir:    /var/backups/fazai/qdrant/
`;

  console.log(help);
}

/**
 * Handle status command
 */
async function handleStatus(): Promise<void> {
  console.log(chalk.bold.cyan("\n🔍 QDRANT STATUS\n"));

  const isAvailable = qdrantPool.isAvailable();
  const circuitState = qdrantPool.getCircuitState();
  const poolMetrics = qdrantPool.getMetrics();

  console.log(`Circuit Breaker: ${chalk.bold(circuitState)}`);
  console.log(`Available: ${isAvailable ? chalk.green("✓ Yes") : chalk.red("✗ No")}`);
  console.log(`State: ${poolMetrics.state}`);
  console.log(`Total Queries: ${poolMetrics.totalQueries}`);
  console.log(`Total Errors: ${poolMetrics.totalErrors}`);
  console.log(`Reconnection Attempts: ${poolMetrics.reconnectionAttempts}`);
  console.log(
    `Last Health Check: ${poolMetrics.lastHealthCheck?.toISOString() || "Never"}`
  );

  if (!isAvailable) {
    console.log(chalk.yellow("\n⚠ Qdrant is not available (circuit breaker is OPEN)"));
    console.log(chalk.gray("Run 'fazai qdrant container status' to check container health"));
  } else {
    console.log(chalk.green("\n✓ Qdrant is operational"));
  }
}

/**
 * Handle metrics command
 */
async function handleMetrics(): Promise<void> {
  logger.info(chalk.cyan("Fetching Qdrant metrics..."));

  const report = await getAllMetrics();
  printMetricsReport(report);
}

/**
 * Handle recommendations command
 */
async function handleRecommendations(): Promise<void> {
  logger.info(chalk.cyan("Analyzing Qdrant capacity and performance..."));

  const recommendations = await getCapacityRecommendations();

  console.log(chalk.bold.cyan("\n💡 RECOMMENDATIONS\n"));

  if (recommendations.length === 0) {
    console.log(chalk.green("✓ No recommendations at this time. System is healthy."));
  } else {
    for (let i = 0; i < recommendations.length; i++) {
      console.log(`${i + 1}. ${recommendations[i]}`);
    }
  }

  console.log("");
}

/**
 * Handle backup command
 */
async function handleBackup(args: string[]): Promise<void> {
  const collection = args[0] || "all";

  // Lazy load to avoid circular dependencies
  const { backupCollection, backupAllCollections } = await import(
    "../orchestrator/qdrant-backup"
  );

  if (collection === "all") {
    logger.info(chalk.cyan("Backing up all collections..."));
    const result = await backupAllCollections();

    console.log(chalk.bold.green(`\n✓ Backup completed:`));
    console.log(`  Successful: ${result.successful.join(", ") || "none"}`);
    console.log(`  Failed: ${result.failed.join(", ") || "none"}`);
    console.log(`  Backup directory: ${result.backupDir}`);
  } else {
    logger.info(chalk.cyan(`Backing up collection '${collection}'...`));
    const backupPath = await backupCollection(collection);

    console.log(chalk.green(`\n✓ Backup created: ${backupPath}`));
  }
}

/**
 * Handle restore command
 */
async function handleRestore(args: string[]): Promise<void> {
  if (args.length === 0) {
    logger.error(chalk.red("✗ Error: collection name is required"));
    logger.info(chalk.gray("Usage: fazai qdrant restore <collection>"));
    process.exit(1);
  }

  const collection = args[0];

  // Lazy load
  const { restoreCollection } = await import("../orchestrator/qdrant-backup");

  logger.info(chalk.cyan(`Restoring collection '${collection}'...`));
  await restoreCollection(collection);

  console.log(chalk.green(`\n✓ Collection '${collection}' restored successfully`));
}

/**
 * Handle import command
 */
async function handleImport(args: string[]): Promise<void> {
  let filePath: string | undefined;
  let collection: string | undefined;
  let batchSize = 100;
  let skipErrors = true;
  let validate = true;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--collection" && args[i + 1]) {
      collection = args[i + 1];
      i++;
      continue;
    }

    if (arg.startsWith("--collection=")) {
      collection = arg.split("=")[1];
      continue;
    }

    if (arg === "--batch-size" && args[i + 1]) {
      batchSize = parseInt(args[i + 1], 10);
      i++;
      continue;
    }

    if (arg.startsWith("--batch-size=")) {
      batchSize = parseInt(arg.split("=")[1], 10);
      continue;
    }

    if (arg === "--no-skip-errors") {
      skipErrors = false;
      continue;
    }

    if (arg === "--no-validate") {
      validate = false;
      continue;
    }

    // First non-flag argument is file path
    if (!arg.startsWith("--") && !filePath) {
      filePath = arg;
    }
  }

  // Validate required arguments
  if (!filePath) {
    logger.error(chalk.red("✗ Error: file path is required"));
    logger.info(chalk.gray("\nUsage:"));
    logger.info("  fazai qdrant import <file> --collection <name> [options]");
    logger.info(chalk.gray("\nOptions:"));
    logger.info("  --collection=<name>     Target collection name (required)");
    logger.info("  --batch-size=<number>   Batch size (default: 100)");
    logger.info("  --no-skip-errors        Stop on first error");
    logger.info("  --no-validate           Skip validation (faster)");
    process.exit(1);
  }

  if (!collection) {
    logger.error(chalk.red("✗ Error: collection name is required"));
    logger.info(chalk.gray("Use: --collection=<name>"));
    process.exit(1);
  }

  logger.info(chalk.cyan(`Importing from ${filePath} to collection '${collection}'...`));

  const result = await importFromJson(filePath, collection, {
    batchSize,
    skipErrors,
    validate,
    progressCallback: (progress, total) => {
      if (total > 0 && progress % 100 === 0) {
        logger.info(`Progress: ${progress}/${total} (${((progress / total) * 100).toFixed(1)}%)`);
      }
    },
  });

  console.log(chalk.bold.green(`\n✓ Import completed:`));
  console.log(`  Success: ${result.successCount}`);
  console.log(`  Errors: ${result.errorCount}`);
  console.log(`  Total Processed: ${result.totalProcessed}`);
  console.log(`  Duration: ${result.duration}ms`);

  if (result.errors.length > 0 && result.errors.length <= 10) {
    console.log(chalk.yellow(`\n⚠ Errors:`));
    for (const err of result.errors) {
      console.log(`  Line ${err.line}: ${err.error}`);
    }
  } else if (result.errors.length > 10) {
    console.log(chalk.yellow(`\n⚠ ${result.errors.length} errors occurred (showing first 5):`));
    for (let i = 0; i < 5; i++) {
      const err = result.errors[i];
      console.log(`  Line ${err.line}: ${err.error}`);
    }
  }
}

/**
 * Handle export command
 */
async function handleExport(args: string[]): Promise<void> {
  if (args.length === 0) {
    logger.error(chalk.red("✗ Error: collection name is required"));
    logger.info(chalk.gray("Usage: fazai qdrant export <collection> --output <file> [options]"));
    process.exit(1);
  }

  const collection = args[0];
  let outputPath: string | undefined;
  let format: ExportFormat | undefined;
  let batchSize = 100;
  let includeVectors = true;

  // Parse arguments
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--output" && args[i + 1]) {
      outputPath = args[i + 1];
      i++;
      continue;
    }

    if (arg.startsWith("--output=")) {
      outputPath = arg.split("=")[1];
      continue;
    }

    if (arg === "--format" && args[i + 1]) {
      format = args[i + 1] as ExportFormat;
      i++;
      continue;
    }

    if (arg.startsWith("--format=")) {
      format = arg.split("=")[1] as ExportFormat;
      continue;
    }

    if (arg === "--batch-size" && args[i + 1]) {
      batchSize = parseInt(args[i + 1], 10);
      i++;
      continue;
    }

    if (arg.startsWith("--batch-size=")) {
      batchSize = parseInt(arg.split("=")[1], 10);
      continue;
    }

    if (arg === "--no-vectors") {
      includeVectors = false;
      continue;
    }
  }

  // Validate required arguments
  if (!outputPath) {
    logger.error(chalk.red("✗ Error: output path is required"));
    logger.info(chalk.gray("Use: --output=<file>"));
    process.exit(1);
  }

  logger.info(
    chalk.cyan(`Exporting collection '${collection}' to ${outputPath}...`)
  );

  await exportToJson(collection, outputPath, {
    format,
    batchSize,
    includeVectors,
    progressCallback: (progress, total) => {
      if (progress % 100 === 0) {
        logger.info(`Progress: ${progress}/${total} (${((progress / total) * 100).toFixed(1)}%)`);
      }
    },
  });

  console.log(chalk.green(`\n✓ Export completed: ${outputPath}`));
}

/**
 * Handle container command
 */
async function handleContainer(args: string[]): Promise<void> {
  if (args.length === 0) {
    logger.error(chalk.red("✗ Error: container action is required"));
    logger.info(chalk.gray("Usage: fazai qdrant container <start|stop|restart|status|logs>"));
    process.exit(1);
  }

  const action = args[0];

  // Lazy load
  const {
    startQdrantContainer,
    stopQdrantContainer,
    restartQdrantContainer,
    getQdrantContainerStatus,
    getQdrantContainerLogs,
  } = await import("../orchestrator/qdrant-container");

  switch (action) {
    case "start":
      logger.info(chalk.cyan("Starting Qdrant container..."));
      await startQdrantContainer();
      console.log(chalk.green("\n✓ Qdrant container started"));
      break;

    case "stop":
      logger.info(chalk.cyan("Stopping Qdrant container..."));
      await stopQdrantContainer();
      console.log(chalk.green("\n✓ Qdrant container stopped"));
      break;

    case "restart":
      logger.info(chalk.cyan("Restarting Qdrant container..."));
      await restartQdrantContainer();
      console.log(chalk.green("\n✓ Qdrant container restarted"));
      break;

    case "status":
      logger.info(chalk.cyan("Fetching container status..."));
      const status = await getQdrantContainerStatus();
      console.log(chalk.bold("\n📦 CONTAINER STATUS\n"));
      console.log(`Name: ${status.name}`);
      console.log(`State: ${status.state}`);
      console.log(`Status: ${status.status}`);
      console.log(`Running: ${status.running ? chalk.green("Yes") : chalk.red("No")}`);
      if (status.ports) {
        console.log(`Ports: ${status.ports}`);
      }
      break;

    case "logs":
      logger.info(chalk.cyan("Fetching container logs..."));
      const logs = await getQdrantContainerLogs();
      console.log(chalk.bold("\n📋 CONTAINER LOGS (last 50 lines)\n"));
      console.log(logs);
      break;

    default:
      logger.error(chalk.red(`✗ Unknown container action: ${action}`));
      logger.info(chalk.gray("Available actions: start, stop, restart, status, logs"));
      process.exit(1);
  }
}
