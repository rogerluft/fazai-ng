/**
 * Personality Ingestion Example
 *
 * Exemplo completo de uso do PersonalityIngestor para processar
 * dados exportados do Claude e criar uma base de conhecimento persistente.
 *
 * Usage:
 *   tsx examples/personality-ingestion-example.ts
 */

import { PersonalityIngestor, ingestPersonalityData } from "../src/services/personality-ingestor";
import { loadPersonalityFromQdrant } from "../src/services/personality-loader";
import { getQdrantClient } from "../src/database/qdrant-pool";
import { logger } from "../src/logger";

/**
 * Exemplo 1: Ingestão básica com helper function
 */
async function example1_basicIngestion(): Promise<void> {
  logger.info("=== Example 1: Basic Ingestion ===");

  const dataDir = "/dados/Claudio-kp-2025-12-22-11-57-29-batch-0000";

  try {
    const stats = await ingestPersonalityData(dataDir);

    logger.info("✅ Ingestion completed!");
    logger.info(`  Total chunks: ${stats.totalChunks}`);
    logger.info(`  Total embeddings: ${stats.totalEmbeddings}`);
    logger.info(`  Duration: ${stats.duration ? (stats.duration / 1000).toFixed(2) : "N/A"}s`);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Ingestion failed: ${err.message}`);
  }
}

/**
 * Exemplo 2: Ingestão com monitoramento detalhado
 */
async function example2_detailedIngestion(): Promise<void> {
  logger.info("=== Example 2: Detailed Ingestion ===");

  const dataDir = "/dados/Claudio-kp-2025-12-22-11-57-29-batch-0000";

  const ingestor = new PersonalityIngestor();

  try {
    const stats = await ingestor.ingestAll(dataDir);

    logger.info("📊 Detailed Statistics:");
    logger.info(`  Conversations:`);
    logger.info(`    - Total: ${stats.conversations.total}`);
    logger.info(`    - Chunks: ${stats.conversations.chunks}`);
    logger.info(`    - Errors: ${stats.conversations.errors}`);
    logger.info(`  Memories:`);
    logger.info(`    - Total: ${stats.memories.total}`);
    logger.info(`    - Chunks: ${stats.memories.chunks}`);
    logger.info(`    - Errors: ${stats.memories.errors}`);
    logger.info(`  Projects:`);
    logger.info(`    - Total: ${stats.projects.total}`);
    logger.info(`    - Chunks: ${stats.projects.chunks}`);
    logger.info(`    - Errors: ${stats.projects.errors}`);
    logger.info(`  Users:`);
    logger.info(`    - Total: ${stats.users.total}`);
    logger.info(`    - Chunks: ${stats.users.chunks}`);
    logger.info(`    - Errors: ${stats.users.errors}`);

    if (stats.duration) {
      const throughput = (stats.totalChunks / (stats.duration / 1000)).toFixed(2);
      logger.info(`  Throughput: ${throughput} chunks/sec`);
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Ingestion failed: ${err.message}`);
  }
}

/**
 * Exemplo 3: Ingestão + Verificação
 */
async function example3_ingestAndVerify(): Promise<void> {
  logger.info("=== Example 3: Ingest and Verify ===");

  const dataDir = "/dados/Claudio-kp-2025-12-22-11-57-29-batch-0000";

  try {
    // 1. Ingerir dados
    logger.info("Step 1: Ingesting data...");
    const stats = await ingestPersonalityData(dataDir);
    logger.info(`✅ Ingested ${stats.totalChunks} chunks`);

    // 2. Verificar collection
    logger.info("\nStep 2: Verifying collection...");
    const client = await getQdrantClient();
    const collectionInfo = await client.getCollection("fazai_personality");

    logger.info(`  Points count: ${collectionInfo.points_count}`);
    logger.info(`  Vectors count: ${collectionInfo.vectors_count}`);
    logger.info(`  Indexed vectors: ${collectionInfo.indexed_vectors_count}`);

    // 3. Busca de teste
    logger.info("\nStep 3: Test semantic search...");
    const testQuery = "What is FazAI?";
    logger.info(`  Query: "${testQuery}"`);

    // Nota: Precisa gerar embedding para a query
    // (simplificado para o exemplo)
    logger.info("  (Embedding generation skipped in example)");

    // 4. Carregar personalidade
    logger.info("\nStep 4: Loading personality traits...");
    const personality = await loadPersonalityFromQdrant();

    logger.info(`  Loaded from: ${personality.loadedFrom}`);
    logger.info(`  Expertise traits: ${personality.expertise.length}`);
    logger.info(`  Communication traits: ${personality.communication.length}`);
    logger.info(`  Behavior traits: ${personality.behavior.length}`);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed: ${err.message}`);
  }
}

/**
 * Exemplo 4: Query por tipo de dados
 */
async function example4_queryByType(): Promise<void> {
  logger.info("=== Example 4: Query by Data Type ===");

  try {
    const client = await getQdrantClient();

    // Contar chunks por tipo
    const types = ["dialogue", "fact", "technical_context", "social_context"];

    logger.info("Chunks by type:");

    for (const type of types) {
      const result = await client.scroll("fazai_personality", {
        limit: 1,
        with_payload: false,
        filter: {
          must: [{ key: "type", match: { value: type } }],
        },
      });

      // Nota: scroll retorna até 'limit' points, não o total
      // Para contar todos, seria necessário paginar ou usar count API
      logger.info(`  ${type}: ${result.points.length}+ points`);
    }

    // Query por ingestion version
    logger.info("\nChunks by ingestion version:");
    const versionResult = await client.scroll("fazai_personality", {
      limit: 1,
      with_payload: true,
      filter: {
        must: [{ key: "ingestion_version", match: { value: "v1-resurrected" } }],
      },
    });

    if (versionResult.points.length > 0) {
      const payload = versionResult.points[0].payload;
      logger.info(`  v1-resurrected: Found (sample payload keys: ${Object.keys(payload || {}).join(", ")})`);
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Query failed: ${err.message}`);
  }
}

/**
 * Exemplo 5: Filtro por metadata
 */
async function example5_metadataFilters(): Promise<void> {
  logger.info("=== Example 5: Metadata Filters ===");

  try {
    const client = await getQdrantClient();

    // Buscar conversas específicas
    logger.info("Searching for conversations about 'FazAI':");

    const result = await client.scroll("fazai_personality", {
      limit: 5,
      with_payload: true,
      filter: {
        must: [
          { key: "type", match: { value: "dialogue" } },
          { key: "metadata.conversation_name", match: { text: "fazai" } },
        ],
      },
    });

    logger.info(`  Found ${result.points.length} chunks`);

    for (const point of result.points) {
      const payload = point.payload as Record<string, unknown>;
      const metadata = payload.metadata as Record<string, unknown>;

      logger.info(`    - Conversation: ${metadata.conversation_name}`);
      logger.info(`      Created: ${payload.created_at}`);
    }

    // Buscar projetos privados
    logger.info("\nSearching for private projects:");

    const privateProjects = await client.scroll("fazai_personality", {
      limit: 10,
      with_payload: true,
      filter: {
        must: [
          { key: "type", match: { value: "technical_context" } },
          { key: "metadata.is_private", match: { value: true } },
        ],
      },
    });

    logger.info(`  Found ${privateProjects.points.length} private project chunks`);

    for (const point of privateProjects.points) {
      const payload = point.payload as Record<string, unknown>;
      const metadata = payload.metadata as Record<string, unknown>;

      logger.info(`    - Project: ${metadata.project_name}`);
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Query failed: ${err.message}`);
  }
}

/**
 * Main: Executar todos os exemplos
 */
async function main(): Promise<void> {
  const examples = [
    { name: "Basic Ingestion", fn: example1_basicIngestion },
    { name: "Detailed Ingestion", fn: example2_detailedIngestion },
    { name: "Ingest and Verify", fn: example3_ingestAndVerify },
    { name: "Query by Type", fn: example4_queryByType },
    { name: "Metadata Filters", fn: example5_metadataFilters },
  ];

  // Escolher exemplo via arg ou rodar o primeiro
  const exampleIndex = process.argv[2] ? parseInt(process.argv[2]) - 1 : 0;

  if (exampleIndex < 0 || exampleIndex >= examples.length) {
    console.error("Usage: tsx examples/personality-ingestion-example.ts [1-5]");
    console.error("");
    console.error("Examples:");
    examples.forEach((ex, i) => {
      console.error(`  ${i + 1}. ${ex.name}`);
    });
    process.exit(1);
  }

  const example = examples[exampleIndex];

  logger.info(`Running example ${exampleIndex + 1}: ${example.name}`);
  logger.info("=".repeat(60));

  await example.fn();

  logger.info("\n" + "=".repeat(60));
  logger.info("Example completed!");
}

// Execute
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export {
  example1_basicIngestion,
  example2_detailedIngestion,
  example3_ingestAndVerify,
  example4_queryByType,
  example5_metadataFilters,
};
