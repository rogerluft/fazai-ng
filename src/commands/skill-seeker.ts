/**
 * SkillSeeker CLI Commands
 *
 * Manage the SkillSeeker service for automatic knowledge ingestion.
 */

import { getSkillSeeker } from "../services/skill-seeker";
import { logger } from "../logger";
import chalk from "chalk";
import Table from "cli-table3";

/**
 * Handle skill-seeker commands
 */
export async function handleSkillSeekerCommand(
  subcommand: string,
  args: string[] = []
): Promise<void> {
  const seeker = getSkillSeeker();

  switch (subcommand) {
    case "start":
      await startCommand(seeker);
      break;

    case "stop":
      await stopCommand(seeker);
      break;

    case "status":
      await statusCommand(seeker);
      break;

    case "stats":
      await statsCommand(seeker);
      break;

    case "process":
      await processCommand(seeker, args);
      break;

    case "help":
      showHelp();
      break;

    default:
      console.log(chalk.yellow(`Unknown subcommand: ${subcommand}`));
      showHelp();
      process.exit(1);
  }
}

/**
 * Start SkillSeeker service
 */
async function startCommand(seeker: ReturnType<typeof getSkillSeeker>): Promise<void> {
  try {
    console.log(chalk.blue("Starting SkillSeeker service..."));
    await seeker.start();

    const stats = seeker.getStats();
    console.log(chalk.green("✓ SkillSeeker started successfully"));
    console.log(chalk.gray(`  Watching: ${stats.watchedDirectory}`));
    console.log(chalk.gray(`  Supported formats: PDF, Markdown, Text`));
    console.log();
    console.log(chalk.yellow("📁 Drop files in /etc/fazai/ingest to index them"));
    console.log(chalk.gray("   Press Ctrl+C to stop monitoring"));

    // Keep process alive
    process.on("SIGINT", async () => {
      console.log(chalk.yellow("\n\nStopping SkillSeeker..."));
      await seeker.stop();
      console.log(chalk.green("✓ SkillSeeker stopped"));
      process.exit(0);
    });

    // Prevent exit
    await new Promise(() => {}); // Infinite wait
  } catch (error: any) {
    console.error(chalk.red(`✗ Failed to start SkillSeeker: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Stop SkillSeeker service
 */
async function stopCommand(seeker: ReturnType<typeof getSkillSeeker>): Promise<void> {
  try {
    console.log(chalk.blue("Stopping SkillSeeker service..."));
    await seeker.stop();
    console.log(chalk.green("✓ SkillSeeker stopped"));
  } catch (error: any) {
    console.error(chalk.red(`✗ Failed to stop SkillSeeker: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Show SkillSeeker status
 */
async function statusCommand(seeker: ReturnType<typeof getSkillSeeker>): Promise<void> {
  const stats = seeker.getStats();

  console.log(chalk.bold("\nSkillSeeker Status\n"));

  const table = new Table({
    head: [chalk.cyan("Property"), chalk.cyan("Value")],
    colWidths: [25, 50],
  });

  table.push(
    ["Status", stats.isRunning ? chalk.green("Running") : chalk.gray("Stopped")],
    ["Watched Directory", stats.watchedDirectory],
    ["Files Processed", stats.filesProcessed.toString()],
    ["Chunks Indexed", stats.chunksIndexed.toString()],
    ["Errors", stats.errors > 0 ? chalk.red(stats.errors.toString()) : "0"],
    [
      "Last Processed File",
      stats.lastProcessedFile || chalk.gray("None"),
    ],
    [
      "Last Processed At",
      stats.lastProcessedAt
        ? new Date(stats.lastProcessedAt).toLocaleString()
        : chalk.gray("Never"),
    ]
  );

  console.log(table.toString());
  console.log();
}

/**
 * Show detailed statistics
 */
async function statsCommand(seeker: ReturnType<typeof getSkillSeeker>): Promise<void> {
  const stats = seeker.getStats();

  console.log(chalk.bold("\nSkillSeeker Statistics\n"));

  // Status indicator
  const statusIcon = stats.isRunning ? "🟢" : "🔴";
  const statusText = stats.isRunning ? "Running" : "Stopped";
  console.log(`${statusIcon} ${chalk.bold(statusText)}`);
  console.log();

  // Metrics
  console.log(chalk.cyan("📊 Metrics:"));
  console.log(`   Files Processed: ${chalk.yellow(stats.filesProcessed)}`);
  console.log(`   Chunks Indexed:  ${chalk.yellow(stats.chunksIndexed)}`);
  console.log(
    `   Errors:          ${stats.errors > 0 ? chalk.red(stats.errors) : chalk.green("0")}`
  );
  console.log();

  // Configuration
  console.log(chalk.cyan("⚙️  Configuration:"));
  console.log(`   Watching:        ${chalk.gray(stats.watchedDirectory)}`);
  console.log(`   Formats:         ${chalk.gray("PDF, Markdown, Text")}`);
  console.log(`   Collection:      ${chalk.gray("fazai_kb")}`);
  console.log(`   Vector Dim:      ${chalk.gray("768 (native)")}`);
  console.log();

  // Last activity
  if (stats.lastProcessedFile) {
    console.log(chalk.cyan("📄 Last Activity:"));
    console.log(`   File:            ${chalk.gray(stats.lastProcessedFile)}`);
    console.log(
      `   Processed:       ${chalk.gray(new Date(stats.lastProcessedAt!).toLocaleString())}`
    );
    console.log();
  }

  // Instructions
  if (stats.isRunning) {
    console.log(chalk.yellow("💡 Drop files in /etc/fazai/ingest to index them"));
  } else {
    console.log(chalk.yellow("💡 Run 'fazai skill-seeker start' to begin monitoring"));
  }
  console.log();
}

/**
 * Process a specific file
 */
async function processCommand(
  seeker: ReturnType<typeof getSkillSeeker>,
  args: string[]
): Promise<void> {
  if (args.length === 0) {
    console.error(chalk.red("✗ Missing file path"));
    console.log(chalk.gray("Usage: fazai skill-seeker process <file-path>"));
    process.exit(1);
  }

  const filePath = args[0];

  try {
    console.log(chalk.blue(`Processing file: ${filePath}`));
    await seeker.processFile(filePath);
    console.log(chalk.green(`✓ File processed successfully`));

    const stats = seeker.getStats();
    console.log(chalk.gray(`  Chunks indexed: ${stats.chunksIndexed}`));
  } catch (error: any) {
    console.error(chalk.red(`✗ Failed to process file: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Show help
 */
function showHelp(): void {
  console.log(chalk.bold("\nSkillSeeker - Automatic Knowledge Ingestion\n"));

  console.log(chalk.cyan("Usage:"));
  console.log("  fazai skill-seeker <command> [options]\n");

  console.log(chalk.cyan("Commands:"));

  const commands = [
    ["start", "Start monitoring /etc/fazai/ingest for new files"],
    ["stop", "Stop the monitoring service"],
    ["status", "Show current status and statistics"],
    ["stats", "Show detailed statistics"],
    ["process <file>", "Process a specific file immediately"],
    ["help", "Show this help message"],
  ];

  const maxCmdLen = Math.max(...commands.map((c) => c[0].length));

  commands.forEach(([cmd, desc]) => {
    console.log(`  ${chalk.yellow(cmd.padEnd(maxCmdLen + 2))} ${desc}`);
  });

  console.log();
  console.log(chalk.cyan("Examples:"));
  console.log(chalk.gray("  fazai skill-seeker start"));
  console.log(chalk.gray("  fazai skill-seeker status"));
  console.log(chalk.gray("  fazai skill-seeker process /path/to/document.pdf"));
  console.log();

  console.log(chalk.cyan("Supported Formats:"));
  console.log(chalk.gray("  • PDF (.pdf) - Extracted with pdf-parse"));
  console.log(chalk.gray("  • Markdown (.md) - Direct text read"));
  console.log(chalk.gray("  • Text (.txt) - Direct text read"));
  console.log();

  console.log(chalk.cyan("Configuration:"));
  console.log(chalk.gray("  Ingest Dir:  /etc/fazai/ingest"));
  console.log(chalk.gray("  Collection:  fazai_kb (Qdrant)"));
  console.log(chalk.gray("  Vector Dim:  768 (native)"));
  console.log(chalk.gray("  Registry:    /opt/fazai/data/skill-seeker-registry.json"));
  console.log();
}

/**
 * Export for CLI integration
 */
export default handleSkillSeekerCommand;
