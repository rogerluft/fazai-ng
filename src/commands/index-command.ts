
import chalk from "chalk";
import { runSourceIndexer } from "../services/source-indexer";

function showIndexHelp(): void {
  console.log(chalk.bold.cyan("\n🔎 FazAI Index Command\n"));
  console.log("Manage the source code index for metacognition.\n");

  console.log(chalk.bold("USAGE:"));
  console.log("  fazai index [options]\n");

  console.log(chalk.bold("OPTIONS:"));
  console.log("  --force, -f      Force re-indexing of all files.");
  console.log("  --verbose, -v    Enable verbose logging.\n");

  console.log(chalk.bold("EXAMPLES:"));
  console.log("  fazai index");
  console.log("  fazai index --force");
}

export async function handleIndexCommand(args: string[]): Promise<void> {
    if (args.includes("--help") || args.includes("-h")) {
    showIndexHelp();
    return;
  }
  const force = args.includes("--force") || args.includes("-f");
  const verbose = args.includes("--verbose") || args.includes("-v");

  await runSourceIndexer({ force, verbose });
}
