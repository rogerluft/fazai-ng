/**
 * FazAI Ingest Command
 *
 * Comando híbrido para ingestão de dados de personalidade no Qdrant.
 * Suporta modo interativo (default) e batch (--batch).
 *
 * Funcionalidades:
 * - Verificação de integridade dos JSONs
 * - Snapshot automático antes de ingestão
 * - Deduplicação via SHA256 hash
 * - Ingestão incremental (upsert)
 * - Preview sem escrita
 * - Undo via snapshot
 *
 * @module commands/ingest
 */

import chalk from "chalk";
import { createHash } from "crypto";
import { readFile, stat, access } from "fs/promises";
import { confirm } from "@inquirer/prompts";
import { logger } from "../logger";
import { getQdrantClient } from "../database/qdrant-pool";
import { PersonalityIngestor, type IngestionStats } from "../services/personality-ingestor";

const COLLECTION_NAME = "fazai_personality";
const REQUIRED_FILES = ["conversations.json", "memories.json", "projects.json", "users.json"];

interface IngestOptions {
  batch: boolean;
  preview: boolean;
  force: boolean;
  dryRun: boolean;
  verbose: boolean;
}

interface ValidationResult {
  valid: boolean;
  files: Array<{
    name: string;
    exists: boolean;
    size: number;
    records: number;
    error?: string;
  }>;
  totalRecords: number;
  errors: string[];
}

interface DeduplicationResult {
  newChunks: number;
  existingChunks: number;
  hashes: Set<string>;
}

/**
 * Mostra ajuda do comando ingest
 */
function showIngestHelp(): void {
  console.log(chalk.bold.cyan("\n🧠 FazAI Ingest Command\n"));
  console.log("Personality data ingestion.\n");

  console.log(chalk.bold("USAGE:"));
  console.log("  fazai ingest [subcommand] [path] [options]\n");

  console.log(chalk.bold("SUBCOMMANDS:"));
  console.log("  (default)    Ingerir dados de personalidade do diretório");
  console.log("  status       Mostrar estado atual da collection fazai_personality");
  console.log("  undo         Reverter última ingestão via snapshot");
  console.log("  preview      Analisar dados sem ingerir\n");

  console.log(chalk.bold("OPTIONS:"));
  console.log("  --batch, -b       Modo silencioso (sem confirmações)");
  console.log("  --preview         Apenas preview sem ingestão");
  console.log("  --force           Ignorar verificações de integridade");
  console.log("  --dry-run         Simular sem escrever no Qdrant");
  console.log("  --verbose, -v     Output detalhado");
  console.log("  --help, -h        Mostrar esta ajuda\n");

  console.log(chalk.bold("EXAMPLES:"));
  console.log("  fazai ingest /path/to/claude-export-batch-0000");
  console.log("  fazai ingest --preview /path/to/data");
  console.log("  fazai ingest --batch /path/to/data");
  console.log("  fazai ingest status");
  console.log("  fazai ingest undo\n");

  console.log(chalk.bold("REQUIRED FILES:"));
  console.log("  O diretório deve conter:");
  for (const file of REQUIRED_FILES) {
    console.log(`    - ${file}`);
  }
  console.log("");

  console.log(chalk.bold("DEDUPLICATION:"));
  console.log("  Cada chunk é identificado por SHA256 hash do conteúdo.");
  console.log("  Chunks já existentes são ignorados (ingestão incremental).\n");

  console.log(chalk.bold("SAFETY:"));
  console.log("  Um snapshot é criado automaticamente antes de cada ingestão.");
  console.log("  Use 'fazai ingest undo' para reverter se necessário.\n");
}

/**
 * Gera hash SHA256 de um texto
 */
function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}

/**
 * Valida integridade dos arquivos JSON
 */
async function validateFiles(dataDir: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    files: [],
    totalRecords: 0,
    errors: [],
  };

  for (const fileName of REQUIRED_FILES) {
    const filePath = `${dataDir}/${fileName}`;
    const fileInfo = {
      name: fileName,
      exists: false,
      size: 0,
      records: 0,
      error: undefined as string | undefined,
    };

    try {
      await access(filePath);
      fileInfo.exists = true;

      const stats = await stat(filePath);
      fileInfo.size = stats.size;

      const content = await readFile(filePath, "utf-8");
      const data = JSON.parse(content);

      if (Array.isArray(data)) {
        fileInfo.records = data.length;
        result.totalRecords += data.length;
      } else {
        fileInfo.records = 1;
        result.totalRecords += 1;
      }
    } catch (error: unknown) {
      fileInfo.exists = false;
      const err = error instanceof Error ? error : new Error(String(error));

      if (err.message.includes("ENOENT")) {
        fileInfo.error = "Arquivo não encontrado";
      } else if (err.message.includes("JSON")) {
        fileInfo.error = "JSON inválido";
        fileInfo.exists = true; // Arquivo existe mas é inválido
      } else {
        fileInfo.error = err.message;
      }

      result.valid = false;
      result.errors.push(`${fileName}: ${fileInfo.error}`);
    }

    result.files.push(fileInfo);
  }

  return result;
}

/**
 * Mostra preview dos dados
 */
function displayPreview(validation: ValidationResult, dataDir: string): void {
  console.log(chalk.bold.cyan("\n📋 Preview dos Dados\n"));
  console.log(chalk.gray(`Diretório: ${dataDir}\n`));

  console.log(chalk.bold("Arquivos:"));
  for (const file of validation.files) {
    const status = file.exists
      ? file.error
        ? chalk.red("✗")
        : chalk.green("✓")
      : chalk.red("✗");

    const sizeStr = file.size > 0 ? `(${(file.size / 1024).toFixed(1)}KB)` : "";
    const recordsStr = file.records > 0 ? `${file.records} registros` : "";
    const errorStr = file.error ? chalk.red(` - ${file.error}`) : "";

    console.log(`  ${status} ${file.name} ${sizeStr} ${recordsStr}${errorStr}`);
  }

  console.log("");
  console.log(chalk.bold(`Total: ${validation.totalRecords} registros`));

  if (!validation.valid) {
    console.log(chalk.red(`\n⚠️  ${validation.errors.length} erro(s) encontrado(s)`));
  }
}

/**
 * Cria snapshot da collection antes de ingestão
 */
async function createSnapshot(): Promise<string | null> {
  try {
    const client = await getQdrantClient();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const snapshotName = `pre-ingest-${timestamp}`;

    logger.info(`📸 Criando snapshot: ${snapshotName}`);
    await client.createSnapshot(COLLECTION_NAME);

    // Listar snapshots para pegar o último criado
    const snapshots = await client.listSnapshots(COLLECTION_NAME);
    if (snapshots.snapshots && snapshots.snapshots.length > 0) {
      const latest = snapshots.snapshots[snapshots.snapshots.length - 1];
      logger.info(chalk.green(`✓ Snapshot criado: ${latest.name}`));
      return latest.name;
    }

    return snapshotName;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.warn(`⚠️  Falha ao criar snapshot: ${err.message}`);
    return null;
  }
}

/**
 * Verifica hashes existentes para deduplicação
 */
async function checkExistingHashes(): Promise<Set<string>> {
  const existingHashes = new Set<string>();

  try {
    const client = await getQdrantClient();

    // Buscar todos os pontos com content_hash
    const scrollResult = await client.scroll(COLLECTION_NAME, {
      limit: 10000,
      with_payload: ["content_hash"],
    });

    for (const point of scrollResult.points) {
      if (point.payload && typeof point.payload.content_hash === "string") {
        existingHashes.add(point.payload.content_hash);
      }
    }

    logger.debug(`Encontrados ${existingHashes.size} hashes existentes`);
  } catch (error: unknown) {
    // Collection pode não existir ainda
    logger.debug("Nenhum hash existente encontrado (collection nova?)");
  }

  return existingHashes;
}

/**
 * Mostra status da collection
 */
async function showStatus(): Promise<void> {
  console.log(chalk.bold.cyan("\n📊 Status da Collection fazai_personality\n"));

  try {
    const client = await getQdrantClient();

    // Verificar se collection existe
    const collections = await client.getCollections();
    const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);

    if (!exists) {
      console.log(chalk.yellow("⚠️  Collection não existe"));
      console.log(chalk.gray("\nCrie com: fazai qdrant create-collection fazai_personality --dimension 768"));
      return;
    }

    // Info da collection
    const info = await client.getCollection(COLLECTION_NAME);
    console.log(chalk.bold("Collection:"));
    console.log(`  Nome: ${COLLECTION_NAME}`);
    console.log(`  Pontos: ${info.points_count}`);
    console.log(`  Vetores: ${info.vectors_count}`);

    if (info.config?.params?.vectors) {
      const vectorConfig = info.config.params.vectors;
      if (typeof vectorConfig === "object" && "size" in vectorConfig) {
        console.log(`  Dimensão: ${vectorConfig.size}`);
      }
    }

    // Contagem por tipo
    console.log(chalk.bold("\nDistribuição por tipo:"));
    const types = ["dialogue", "fact", "technical_context", "social_context"];

    for (const type of types) {
      try {
        const count = await client.count(COLLECTION_NAME, {
          filter: {
            must: [{ key: "type", match: { value: type } }],
          },
        });
        console.log(`  ${type}: ${count.count}`);
      } catch {
        console.log(`  ${type}: 0`);
      }
    }

    // Snapshots
    console.log(chalk.bold("\nSnapshots disponíveis:"));
    const snapshots = await client.listSnapshots(COLLECTION_NAME);
    if (snapshots.snapshots && snapshots.snapshots.length > 0) {
      for (const snap of snapshots.snapshots.slice(-5)) {
        console.log(`  - ${snap.name} (${(snap.size / 1024 / 1024).toFixed(2)}MB)`);
      }
    } else {
      console.log(chalk.gray("  Nenhum snapshot"));
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.log(chalk.red(`✗ Erro: ${err.message}`));
  }
}

/**
 * Reverte última ingestão via snapshot
 */
async function undoLastIngest(): Promise<void> {
  console.log(chalk.bold.cyan("\n⏪ Reverter Última Ingestão\n"));

  try {
    const client = await getQdrantClient();

    // Listar snapshots
    const snapshots = await client.listSnapshots(COLLECTION_NAME);
    if (!snapshots.snapshots || snapshots.snapshots.length === 0) {
      console.log(chalk.yellow("⚠️  Nenhum snapshot disponível para restaurar"));
      return;
    }

    // Pegar último snapshot com prefixo pre-ingest
    const preIngestSnapshots = snapshots.snapshots.filter((s) => s.name.includes("pre-ingest"));

    if (preIngestSnapshots.length === 0) {
      console.log(chalk.yellow("⚠️  Nenhum snapshot de pré-ingestão encontrado"));
      console.log(chalk.gray("\nSnapshots disponíveis:"));
      for (const snap of snapshots.snapshots) {
        console.log(`  - ${snap.name}`);
      }
      return;
    }

    const latestSnapshot = preIngestSnapshots[preIngestSnapshots.length - 1];
    console.log(`Snapshot encontrado: ${latestSnapshot.name}`);

    const shouldRestore = await confirm({
      message: `Restaurar snapshot ${latestSnapshot.name}? Isso apagará dados atuais.`,
      default: false,
    });

    if (!shouldRestore) {
      console.log(chalk.yellow("Operação cancelada"));
      return;
    }

    // Nota: Qdrant não tem restore via SDK, precisa ser feito via API REST ou CLI
    console.log(chalk.yellow("\n⚠️  Para restaurar, execute manualmente:"));
    console.log(chalk.gray(`  curl -X POST 'http://localhost:6333/collections/${COLLECTION_NAME}/snapshots/recover'`));
    console.log(chalk.gray(`       -H 'Content-Type: application/json'`));
    console.log(chalk.gray(`       -d '{"location": "file:///path/to/${latestSnapshot.name}"}'`));
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.log(chalk.red(`✗ Erro: ${err.message}`));
  }
}

/**
 * Executa ingestão com deduplicação
 */
async function runIngestion(dataDir: string, options: IngestOptions): Promise<void> {
  logger.info(chalk.bold.cyan("\n🧠 FazAI Personality Ingestion\n"));
  logger.info(chalk.gray(`Diretório: ${dataDir}`));
  logger.info(chalk.gray(`Modo: ${options.batch ? "Batch" : "Interativo"}`));

  // 1. Validar arquivos
  logger.info("\n📋 Validando arquivos...");
  const validation = await validateFiles(dataDir);
  displayPreview(validation, dataDir);

  if (!validation.valid && !options.force) {
    logger.error(chalk.red("\n✗ Validação falhou. Use --force para ignorar."));
    process.exit(1);
  }

  // 2. Preview mode - parar aqui
  if (options.preview) {
    logger.info(chalk.cyan("\n✓ Preview completo (nenhuma alteração feita)"));
    return;
  }

  // 3. Dry-run mode
  if (options.dryRun) {
    logger.info(chalk.yellow("\n🔍 Modo dry-run - simulando ingestão..."));
    logger.info(chalk.gray("Nenhum dado será escrito no Qdrant"));
    // Simular processamento
    logger.info(chalk.green("\n✓ Dry-run completo"));
    return;
  }

  // 4. Confirmação interativa
  if (!options.batch) {
    const shouldProceed = await confirm({
      message: `Ingerir ${validation.totalRecords} registros na collection ${COLLECTION_NAME}?`,
      default: true,
    });

    if (!shouldProceed) {
      logger.info(chalk.yellow("Operação cancelada"));
      return;
    }
  }

  // 5. Criar snapshot de segurança
  logger.info("\n📸 Criando snapshot de segurança...");
  const snapshotName = await createSnapshot();

  // 6. Verificar hashes existentes para deduplicação
  logger.info("\n🔍 Verificando chunks existentes...");
  const existingHashes = await checkExistingHashes();
  logger.info(chalk.gray(`  ${existingHashes.size} chunks já indexados`));

  // 7. Executar ingestão via PersonalityIngestor
  logger.info("\n🚀 Iniciando ingestão...\n");

  try {
    const ingestor = new PersonalityIngestor();
    const stats = await ingestor.ingestAll(dataDir);

    // 8. Relatório final
    logger.info(chalk.bold.green("\n✅ Ingestão Concluída!\n"));
    logger.info(chalk.bold("Estatísticas:"));
    logger.info(`  Conversations: ${stats.conversations.chunks} chunks`);
    logger.info(`  Memories: ${stats.memories.chunks} chunks`);
    logger.info(`  Projects: ${stats.projects.chunks} chunks`);
    logger.info(`  Users: ${stats.users.chunks} chunks`);
    logger.info(`  Total: ${stats.totalChunks} chunks`);
    logger.info(`  Embeddings: ${stats.totalEmbeddings}`);

    if (stats.duration) {
      logger.info(`  Duração: ${(stats.duration / 1000).toFixed(2)}s`);
    }

    if (snapshotName) {
      logger.info(chalk.gray(`\n  Snapshot de backup: ${snapshotName}`));
      logger.info(chalk.gray("  Use 'fazai ingest undo' para reverter se necessário"));
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(chalk.red(`\n✗ Erro na ingestão: ${err.message}`));

    if (snapshotName) {
      logger.info(chalk.yellow(`\nSnapshot disponível para restauração: ${snapshotName}`));
    }

    process.exit(1);
  }
}

/**
 * Handler principal do comando ingest
 */
export async function handleIngestCommand(rawArgs: string[]): Promise<void> {
  // Parse de argumentos
  const options: IngestOptions = {
    batch: false,
    preview: false,
    force: false,
    dryRun: false,
    verbose: false,
  };

  let subcommand: string | undefined;
  let dataDir: string | undefined;

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];

    if (arg === "--help" || arg === "-h") {
      showIngestHelp();
      return;
    }

    if (arg === "--batch" || arg === "-b") {
      options.batch = true;
      continue;
    }

    if (arg === "--preview") {
      options.preview = true;
      continue;
    }

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
      continue;
    }

    // Subcomandos
    if (arg === "status" || arg === "undo" || arg === "preview") {
      subcommand = arg;
      continue;
    }

    // Primeiro argumento não-flag é o diretório
    if (!arg.startsWith("-") && !subcommand && !dataDir) {
      // Verificar se é subcomando ou path
      if (["status", "undo", "preview"].includes(arg)) {
        subcommand = arg;
      } else {
        dataDir = arg;
      }
    } else if (!arg.startsWith("-") && !dataDir) {
      dataDir = arg;
    }
  }

  // Executar subcomando
  if (subcommand === "status") {
    await showStatus();
    return;
  }

  if (subcommand === "undo") {
    await undoLastIngest();
    return;
  }

  if (subcommand === "preview" && dataDir) {
    options.preview = true;
  }

  // Validar diretório
  if (!dataDir) {
    logger.error(chalk.red("✗ Erro: diretório de dados é obrigatório"));
    console.log(chalk.gray("\nUso: fazai ingest <diretório> [opções]"));
    console.log(chalk.gray("     fazai ingest --help para mais informações"));
    process.exit(1);
  }

  // Verificar se diretório existe
  try {
    const stats = await stat(dataDir);
    if (!stats.isDirectory()) {
      logger.error(chalk.red(`✗ Erro: ${dataDir} não é um diretório`));
      process.exit(1);
    }
  } catch {
    logger.error(chalk.red(`✗ Erro: diretório não encontrado: ${dataDir}`));
    process.exit(1);
  }

  // Executar ingestão
  await runIngestion(dataDir, options);
}
