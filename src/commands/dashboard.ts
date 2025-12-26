/**
 * Dashboard CLI Command Handler
 *
 * Provides CLI commands for managing the FazAI Dashboard:
 * - fazai dashboard start
 * - fazai dashboard stop
 * - fazai dashboard status
 *
 * Usage:
 *   import { handleDashboardCommand } from './commands/dashboard';
 *   await handleDashboardCommand(process.argv.slice(3));
 */

import chalk from "chalk";
import { logger } from "../logger";
import { startDashboard, stopDashboard, getDashboardInstance } from "../dashboard/server";

/**
 * Main handler for dashboard commands
 */
export async function handleDashboardCommand(args: string[]): Promise<void> {
  if (args.length === 0 || args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    showDashboardHelp();
    return;
  }

  const subcommand = args[0];

  try {
    switch (subcommand) {
      case "start":
        await handleStart(args.slice(1));
        break;

      case "stop":
        await handleStop();
        break;

      case "status":
        await handleStatus();
        break;

      default:
        logger.error(chalk.red(`✗ Unknown subcommand: ${subcommand}`));
        showDashboardHelp();
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
 * Display help for dashboard commands
 */
function showDashboardHelp(): void {
  const help = `
${chalk.bold.cyan("FAZAI DASHBOARD COMMANDS")}

${chalk.bold("Usage:")}
  fazai dashboard <command> [options]

${chalk.bold("Commands:")}
  ${chalk.green("start")}              Start the Dashboard server
  ${chalk.green("stop")}               Stop the Dashboard server
  ${chalk.green("status")}             Check Dashboard status

${chalk.bold("Start Options:")}
  --port <number>      Port to run on (default: 3000)
  --host <string>      Host to bind to (default: localhost)
  --no-cors            Disable CORS
  --no-rate-limit      Disable rate limiting
  --no-logs            Disable request logging

${chalk.bold("Examples:")}
  ${chalk.gray("# Start with default settings")}
  fazai dashboard start

  ${chalk.gray("# Start on specific port")}
  fazai dashboard start --port 8080

  ${chalk.gray("# Start on all interfaces")}
  fazai dashboard start --host 0.0.0.0

  ${chalk.gray("# Stop the server")}
  fazai dashboard stop

${chalk.bold("API Endpoints:")}
  ${chalk.cyan("GET")}  /health                    Health check
  ${chalk.cyan("GET")}  /api/status                System status
  ${chalk.cyan("GET")}  /api/collections           List collections
  ${chalk.cyan("GET")}  /api/collections/:name     Collection details
  ${chalk.cyan("POST")} /api/search                Semantic search
  ${chalk.cyan("POST")} /api/agent/run             Execute agent
  ${chalk.cyan("POST")} /api/agent/reflect         Trigger reflection
  ${chalk.cyan("POST")} /api/skills/seek           Run skill seeker
  ${chalk.cyan("GET")}  /api/skills                List skills

${chalk.bold("Configuration:")}
  Environment variables in /etc/fazai/fazai.conf:
    DASHBOARD_PORT=3000
    DASHBOARD_HOST=localhost
    DASHBOARD_ENABLE_CORS=true
    DASHBOARD_ENABLE_RATE_LIMIT=true
    DASHBOARD_LOG_REQUESTS=true
    DASHBOARD_ALLOWED_ORIGINS=*

${chalk.bold("Documentation:")}
  https://github.com/your-repo/fazai-ng/docs/dashboard.md
`;

  console.log(help);
}

/**
 * Handle start command
 */
async function handleStart(args: string[]): Promise<void> {
  const config: any = {};

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--port":
        config.port = parseInt(args[++i], 10);
        if (isNaN(config.port)) {
          throw new Error("Invalid port number");
        }
        break;
      case "--host":
        config.host = args[++i];
        break;
      case "--no-cors":
        config.enableCors = false;
        break;
      case "--no-rate-limit":
        config.enableRateLimit = false;
        break;
      case "--no-logs":
        config.logRequests = false;
        break;
      default:
        logger.warn(`Unknown option: ${args[i]}`);
    }
  }

  logger.info(chalk.bold("Starting FazAI Dashboard..."));

  const server = await startDashboard(config);
  const serverConfig = server.getConfig();

  console.log(`
${chalk.green("✓")} Dashboard started successfully!

${chalk.bold("Server Information:")}
  URL:         ${chalk.cyan(`http://${serverConfig.host}:${serverConfig.port}`)}
  Health:      ${chalk.cyan(`http://${serverConfig.host}:${serverConfig.port}/health`)}
  API Docs:    ${chalk.cyan(`http://${serverConfig.host}:${serverConfig.port}/api`)}

${chalk.bold("Features:")}
  CORS:        ${serverConfig.enableCors ? chalk.green("enabled") : chalk.yellow("disabled")}
  Rate Limit:  ${serverConfig.enableRateLimit ? chalk.green("enabled") : chalk.yellow("disabled")}
  Logging:     ${serverConfig.logRequests ? chalk.green("enabled") : chalk.yellow("disabled")}

${chalk.gray("Press Ctrl+C to stop the server")}
`);

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n" + chalk.yellow("Received SIGINT, shutting down gracefully..."));
    await stopDashboard();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n" + chalk.yellow("Received SIGTERM, shutting down gracefully..."));
    await stopDashboard();
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => {});
}

/**
 * Handle stop command
 */
async function handleStop(): Promise<void> {
  logger.info("Stopping Dashboard...");
  await stopDashboard();
  console.log(chalk.green("✓ Dashboard stopped"));
}

/**
 * Handle status command
 */
async function handleStatus(): Promise<void> {
  try {
    const instance = await getDashboardInstance();
    const config = instance.getConfig();

    console.log(`
${chalk.bold.cyan("Dashboard Status:")}

${chalk.bold("Status:")}        ${chalk.green("Running")}
${chalk.bold("URL:")}           ${chalk.cyan(`http://${config.host}:${config.port}`)}
${chalk.bold("CORS:")}          ${config.enableCors ? chalk.green("enabled") : chalk.yellow("disabled")}
${chalk.bold("Rate Limit:")}    ${config.enableRateLimit ? chalk.green("enabled") : chalk.yellow("disabled")}
${chalk.bold("Logging:")}       ${config.logRequests ? chalk.green("enabled") : chalk.yellow("disabled")}
`);
  } catch (error) {
    console.log(`
${chalk.bold.cyan("Dashboard Status:")}

${chalk.bold("Status:")}        ${chalk.red("Not Running")}

Run ${chalk.cyan("fazai dashboard start")} to start the server.
`);
  }
}
