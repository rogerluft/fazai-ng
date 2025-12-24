
import chalk from "chalk";
import { logger } from "../logger";
import type {
  VectorValidationOptions,
  VectorValidationResult,
} from "../vector-store";

function showVectorHelp(): void {
  console.log(chalk.bold.cyan("\n📦 FazAI Vector Command\n"));
  console.log("Validate and manage Qdrant vector collections.\n");

  console.log(chalk.bold("USAGE:"));
  console.log("  fazai vector [command] [options]\n");

  console.log(chalk.bold("COMMANDS:"));
  console.log("  validate      (default) Validate vector collections.");
  console.log("  recreate      Recreate vector collections.\n");

  console.log(chalk.bold("OPTIONS:"));
  console.log("  --provider    Specify the vector store provider (e.g., qdrant).");
  console.log("  --dimension   Set the vector dimension.");
  console.log("  --distance    Define the distance metric (e.g., Cosine).\n");

  console.log(chalk.bold("EXAMPLES:"));
  console.log("  fazai vector");
  console.log("  fazai vector recreate --provider=qdrant");
  console.log("  fazai vector validate --dimension=768");
}

function parseVectorArgs(
  rawArgs: string[]
): { options: VectorValidationOptions; action: "validate" | "recreate" } {
  const options: VectorValidationOptions = {};
  let action: "validate" | "recreate" = "validate";

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (!arg) {
      continue;
    }

    if (arg === "validate") {
      action = "validate";
      continue;
    }

    if (arg === "recreate" || arg === "reset") {
      action = "recreate";
      options.recreate = true;
      continue;
    }

    if (arg === "--recreate" || arg === "--reset") {
      options.recreate = true;
      action = "recreate";
      continue;
    }

    if (arg === "--provider" && rawArgs[i + 1]) {
      options.provider = parseProvider(rawArgs[i + 1]);
      i += 1;
      continue;
    }

    if (arg.startsWith("--provider=")) {
      options.provider = parseProvider(arg.split("=")[1]);
      continue;
    }

    if (arg === "--dimension" && rawArgs[i + 1]) {
      options.dimension = parseDimension(rawArgs[i + 1]);
      i += 1;
      continue;
    }

    if (arg.startsWith("--dimension=")) {
      options.dimension = parseDimension(arg.split("=")[1]);
      continue;
    }

    if (arg === "--distance" && rawArgs[i + 1]) {
      const parsedDistance = parseDistance(rawArgs[i + 1]);
      if (parsedDistance) {
        options.distance = parsedDistance;
      }
      i += 1;
      continue;
    }

    if (arg.startsWith("--distance=")) {
      const parsedDistance = parseDistance(arg.split("=")[1]);
      if (parsedDistance) {
        options.distance = parsedDistance;
      }
      continue;
    }
  }

  if (action === "recreate" && options.recreate !== true) {
    options.recreate = true;
  }

  return { options, action };
}

function parseProvider(raw?: string): VectorValidationOptions["provider"] {
  if (!raw) {
    return undefined;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "qdrant") {
    return "qdrant";
  }
  if (normalized === "milvus" || normalized === "zilliz") {
    return "milvus";
  }

  logger.warn(
    chalk.yellow(`⚠️  Provedor desconhecido "${raw}". Use "qdrant" ou "milvus".`)
  );
  return undefined;
}

function parseDimension(raw?: string): number | undefined {
  if (!raw) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    logger.warn(
      chalk.yellow(
        `⚠️  Dimensão inválida "${raw}". Informe um inteiro maior que zero.`
      )
    );
    return undefined;
  }
  return parsed;
}

function parseDistance(raw?: string): VectorValidationOptions["distance"] {
  if (!raw) {
    return undefined;
  }
  const normalized = raw.trim().toLowerCase();
  if (
    normalized === "cosine" ||
    normalized === "cos" ||
    normalized === "angular"
  ) {
    return "Cosine";
  }
  if (
    normalized === "euclid" ||
    normalized === "l2" ||
    normalized === "euclidean"
  ) {
    return "Euclid";
  }
  if (
    normalized === "dot" ||
    normalized === "dot_product" ||
    normalized === "ip"
  ) {
    return "Dot";
  }
  logger.warn(
    chalk.yellow(
      `⚠️  Distância desconhecida "${raw}". Valores aceitos: cosine, euclid, dot.`
    )
  );
  return undefined;
}

function reportVectorResult(
  result: VectorValidationResult,
  action: "validate" | "recreate"
): void {
  logger.info(
    chalk.cyan(`\n📦 Vetor store: ${result.provider} (${action})`)
  );
  logger.info(
    chalk.gray(`Dimensão: ${result.dimension} · Distância: ${result.distance}`)
  );

  if (result.created.length) {
    logger.info(chalk.green(`✅ Criadas: ${result.created.join(", ")}`));
  }

  if (result.verified.length) {
    logger.info(
      chalk.green(`✅ Já em conformidade: ${result.verified.join(", ")}`)
    );
  }

  if (result.updated.length) {
    logger.info(
      chalk.yellow(`ℹ️  Necessitam ajuste manual: ${result.updated.join(", ")}`)
    );
  }

  if (
    !result.created.length &&
    !result.verified.length &&
    !result.updated.length
  ) {
    logger.info(chalk.gray("Nenhuma collection processada."));
  }

  if (result.errors.length) {
    logger.error(chalk.red("\n❌ Ocorreram erros:"));
    for (const entry of result.errors) {
      logger.error(` - ${entry.collection}: ${entry.message}`);
    }
  } else {
    logger.info(chalk.green("\nTudo certo com as collections vetoriais."));
  }
}

export async function handleVectorCommand(rawArgs: string[]): Promise<void> {
  if (
    rawArgs.length === 0 ||
    rawArgs.includes("--help") ||
    rawArgs.includes("-h")
  ) {
    showVectorHelp();
    return;
  }
  const { options, action } = parseVectorArgs(rawArgs);
  const { validateVectorCollections } = await import("../vector-store");
  const result = await validateVectorCollections(options);

  reportVectorResult(result, action);

  if (result.errors.length > 0) {
    process.exitCode = 1;
  }
}
