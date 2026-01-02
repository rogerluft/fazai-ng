/**
 * Inference Command - Gerencia conhecimento injetado pelo usuário
 *
 * A collection fazai_inference armazena conhecimento que o USUÁRIO
 * ensina explicitamente ao FazAI, diferente do kb que é aprendizado
 * automático.
 *
 * @module commands/inference
 */

import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import { logger } from "../logger";
import { getQdrantClient } from "../database/qdrant-pool";
import { createEmbeddingService } from "../services/embeddings";
import { randomUUID } from "crypto";

const INFERENCE_COLLECTION = "fazai_inference";

interface InferenceEntry {
  id: string;
  content: string;
  category: "doc" | "rule" | "example" | "fact";
  source?: string;
  timestamp: string;
}

/**
 * Handler principal do comando inference
 */
export async function handleInferenceCommand(args: string[]): Promise<void> {
  if (args.length === 0 || args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    showInferenceHelp();
    return;
  }

  const subcommand = args[0];

  switch (subcommand) {
    case "add":
      await handleAdd(args.slice(1));
      break;
    case "import":
      await handleImportFile(args.slice(1));
      break;
    case "list":
      await handleList(args.slice(1));
      break;
    case "search":
      await handleSearch(args.slice(1));
      break;
    case "remove":
      await handleRemove(args.slice(1));
      break;
    case "clear":
      await handleClear();
      break;
    default:
      logger.error(chalk.red(`Subcomando desconhecido: ${subcommand}`));
      showInferenceHelp();
      process.exit(1);
  }
}

/**
 * Adiciona conhecimento inline
 */
async function handleAdd(args: string[]): Promise<void> {
  if (args.length < 2) {
    logger.error(chalk.red("Uso: fazai inference add <category> <content>"));
    logger.info("Categorias: doc, rule, example, fact");
    return;
  }

  const category = args[0] as InferenceEntry["category"];
  const content = args.slice(1).join(" ");

  if (!["doc", "rule", "example", "fact"].includes(category)) {
    logger.error(chalk.red(`Categoria inválida: ${category}`));
    logger.info("Categorias válidas: doc, rule, example, fact");
    return;
  }

  try {
    const client = await getQdrantClient();
    const embedService = await createEmbeddingService();
    const embedding = await embedService.generate(content);

    const entry: InferenceEntry = {
      id: randomUUID(),
      content,
      category,
      timestamp: new Date().toISOString(),
    };

    await client.upsert(INFERENCE_COLLECTION, {
      wait: true,
      points: [
        {
          id: entry.id,
          vector: embedding,
          payload: entry,
        },
      ],
    });

    logger.info(chalk.green(`✓ Conhecimento adicionado (${category}): "${content.substring(0, 50)}..."`));
  } catch (error: any) {
    logger.error(chalk.red(`Erro ao adicionar: ${error.message}`));
  }
}

/**
 * Importa conhecimento de arquivo (txt, md, json)
 */
async function handleImportFile(args: string[]): Promise<void> {
  if (args.length < 1) {
    logger.error(chalk.red("Uso: fazai inference import <arquivo> [--category=doc]"));
    return;
  }

  const filePath = args[0];
  const categoryArg = args.find((a) => a.startsWith("--category="));
  const category = (categoryArg?.split("=")[1] || "doc") as InferenceEntry["category"];

  if (!fs.existsSync(filePath)) {
    logger.error(chalk.red(`Arquivo não encontrado: ${filePath}`));
    return;
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const ext = path.extname(filePath).toLowerCase();

    let entries: string[] = [];

    if (ext === ".json") {
      const data = JSON.parse(content);
      entries = Array.isArray(data) ? data.map((d) => (typeof d === "string" ? d : JSON.stringify(d))) : [content];
    } else {
      // Para txt/md, divide por parágrafos ou linhas duplas
      entries = content.split(/\n\n+/).filter((e) => e.trim().length > 20);
    }

    const client = await getQdrantClient();
    const embedService = await createEmbeddingService();
    let count = 0;

    for (const entry of entries) {
      const trimmed = entry.trim();
      if (trimmed.length < 10) continue;

      const embedding = await embedService.generate(trimmed);
      const id = randomUUID();

      await client.upsert(INFERENCE_COLLECTION, {
        wait: true,
        points: [
          {
            id,
            vector: embedding,
            payload: {
              id,
              content: trimmed,
              category,
              source: filePath,
              timestamp: new Date().toISOString(),
            },
          },
        ],
      });
      count++;
    }

    logger.info(chalk.green(`✓ Importados ${count} entries de ${filePath}`));
  } catch (error: any) {
    logger.error(chalk.red(`Erro ao importar: ${error.message}`));
  }
}

/**
 * Lista conhecimento armazenado
 */
async function handleList(args: string[]): Promise<void> {
  const limit = parseInt(args[0]) || 20;

  try {
    const client = await getQdrantClient();
    const result = await client.scroll(INFERENCE_COLLECTION, {
      limit,
      with_payload: true,
    });

    if (result.points.length === 0) {
      logger.info(chalk.yellow("Nenhum conhecimento armazenado na collection inference."));
      return;
    }

    console.log(chalk.bold.cyan("\nCONHECIMENTO ARMAZENADO (fazai_inference)\n"));
    for (const point of result.points) {
      const payload = point.payload as unknown as InferenceEntry;
      const preview = payload.content?.substring(0, 60) || "(sem conteúdo)";
      console.log(`  [${chalk.cyan(payload.category || "?")}] ${preview}...`);
    }
    console.log(`\nTotal: ${result.points.length} entries\n`);
  } catch (error: any) {
    logger.error(chalk.red(`Erro ao listar: ${error.message}`));
  }
}

/**
 * Busca semântica no conhecimento
 */
async function handleSearch(args: string[]): Promise<void> {
  if (args.length < 1) {
    logger.error(chalk.red("Uso: fazai inference search <query>"));
    return;
  }

  const query = args.join(" ");

  try {
    const client = await getQdrantClient();
    const embedService = await createEmbeddingService();
    const embedding = await embedService.generate(query);

    const results = await client.search(INFERENCE_COLLECTION, {
      vector: embedding,
      limit: 5,
      with_payload: true,
    });

    if (results.length === 0) {
      logger.info(chalk.yellow("Nenhum resultado encontrado."));
      return;
    }

    console.log(chalk.bold.cyan(`\nResultados para: "${query}"\n`));
    for (const result of results) {
      const payload = result.payload as unknown as InferenceEntry;
      const score = (result.score * 100).toFixed(1);
      console.log(`  [${chalk.green(score + "%")}] [${payload.category}] ${payload.content?.substring(0, 80)}...`);
    }
    console.log();
  } catch (error: any) {
    logger.error(chalk.red(`Erro na busca: ${error.message}`));
  }
}

/**
 * Remove entry específico
 */
async function handleRemove(args: string[]): Promise<void> {
  if (args.length < 1) {
    logger.error(chalk.red("Uso: fazai inference remove <id>"));
    return;
  }

  const id = args[0];

  try {
    const client = await getQdrantClient();
    await client.delete(INFERENCE_COLLECTION, {
      wait: true,
      points: [id],
    });
    logger.info(chalk.green(`✓ Entry ${id} removido`));
  } catch (error: any) {
    logger.error(chalk.red(`Erro ao remover: ${error.message}`));
  }
}

/**
 * Limpa toda a collection
 */
async function handleClear(): Promise<void> {
  logger.warn(chalk.yellow("⚠️  Isso vai apagar TODO o conhecimento da collection inference!"));
  logger.info("Pressione Ctrl+C para cancelar ou aguarde 3 segundos...");

  await new Promise((resolve) => setTimeout(resolve, 3000));

  try {
    const client = await getQdrantClient();
    await client.delete(INFERENCE_COLLECTION, {
      wait: true,
      filter: { must: [] }, // Deleta tudo
    });
    logger.info(chalk.green("✓ Collection inference limpa"));
  } catch (error: any) {
    logger.error(chalk.red(`Erro ao limpar: ${error.message}`));
  }
}

/**
 * Exibe help do comando
 */
function showInferenceHelp(): void {
  const help = `
${chalk.bold.cyan("INFERENCE - Gerenciamento de Conhecimento")}

${chalk.bold("Uso:")}
  fazai inference <comando> [opções]

${chalk.bold("Comandos:")}
  ${chalk.cyan("add <category> <content>")}    Adiciona conhecimento inline
  ${chalk.cyan("import <arquivo>")}            Importa de arquivo (txt, md, json)
  ${chalk.cyan("list [limit]")}                Lista conhecimento armazenado
  ${chalk.cyan("search <query>")}              Busca semântica
  ${chalk.cyan("remove <id>")}                 Remove entry específico
  ${chalk.cyan("clear")}                       Limpa toda a collection

${chalk.bold("Categorias:")}
  ${chalk.yellow("doc")}       Documentação, tutoriais
  ${chalk.yellow("rule")}      Regras operacionais
  ${chalk.yellow("example")}   Exemplos de uso
  ${chalk.yellow("fact")}      Fatos, dados específicos

${chalk.bold("Exemplos:")}
  fazai inference add doc "O nginx deve sempre usar worker_processes auto"
  fazai inference import ~/docs/linux-tips.md --category=doc
  fazai inference search "como configurar nginx"
  fazai inference list 10
`;
  console.log(help);
}
