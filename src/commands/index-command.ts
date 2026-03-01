
import chalk from "chalk";
import { runSourceIndexer, searchSourceIndex } from "../services/source-indexer";

function showIndexHelp(): void {
  console.log(chalk.bold.cyan("\n🔎 FazAI Index Command\n"));
  console.log("Manage the source code index for metacognition.\n");

  console.log(chalk.bold("USAGE:"));
  console.log("  fazai index [options]");
  console.log("  fazai index search <query>\n");

  console.log(chalk.bold("OPTIONS:"));
  console.log("  --force, -f      Force re-indexing of all files.");
  console.log("  --verbose, -v    Enable verbose logging.\n");

  console.log(chalk.bold("EXAMPLES:"));
  console.log("  fazai index");
  console.log("  fazai index --force");
  console.log("  fazai index search \"como funciona a memoria do fazai?\"");
}

export async function handleIndexCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    showIndexHelp();
    return;
  }

  // Handle 'search' subcommand
  if (args[0] === "search") {
    const query = args.slice(1).join(" ");
    if (!query) {
      console.log(chalk.red("Error: Missing search query."));
      console.log(chalk.gray("Usage: fazai index search <query>"));
      return;
    }

    await searchSourceIndex(query);
    return;
  }

  const force = args.includes("--force") || args.includes("-f");
  const verbose = args.includes("--verbose") || args.includes("-v");

  await runSourceIndexer({ force, verbose });
}
