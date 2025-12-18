#!/usr/bin/env npx tsx
/**
 * FazAI - Teste das Collections Qdrant
 *
 * Este script testa a conectividade e funcionalidade de cada collection.
 *
 * Uso:
 *   npx tsx scripts/test-qdrant-collections.ts
 *   npx tsx scripts/test-qdrant-collections.ts --collection=fazai_learning
 *   npx tsx scripts/test-qdrant-collections.ts --verbose
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { getConfigValue } from "../src/config.js";

// Configuração
const QDRANT_URL = getConfigValue("QDRANT_URL") || "http://localhost:6333";
const COLLECTIONS = [
  "fazai_personality",
  "fazai_memory",
  "fazai_learning",
  "fazai_kb",
  "fazai_inference",
  "fazai_semantic_cache",
];

interface CollectionStats {
  name: string;
  exists: boolean;
  pointsCount: number;
  vectorsCount: number;
  vectorDimension: number | null;
  distance: string | null;
  status: string;
  error?: string;
}

interface TestResult {
  timestamp: string;
  qdrantUrl: string;
  qdrantHealthy: boolean;
  collections: CollectionStats[];
  summary: {
    total: number;
    existing: number;
    empty: number;
    withData: number;
  };
}

// Parse args
const args = process.argv.slice(2);
const verbose = args.includes("--verbose") || args.includes("-v");
const specificCollection = args.find((a) => a.startsWith("--collection="))?.split("=")[1];

// Cores para output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

function log(msg: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

async function testQdrantHealth(client: QdrantClient): Promise<boolean> {
  try {
    const health = await client.api("cluster").clusterStatus();
    return true;
  } catch {
    try {
      // Fallback: tenta listar collections
      await client.getCollections();
      return true;
    } catch {
      return false;
    }
  }
}

async function getCollectionStats(
  client: QdrantClient,
  collectionName: string
): Promise<CollectionStats> {
  const stats: CollectionStats = {
    name: collectionName,
    exists: false,
    pointsCount: 0,
    vectorsCount: 0,
    vectorDimension: null,
    distance: null,
    status: "unknown",
  };

  try {
    const info = await client.getCollection(collectionName);
    stats.exists = true;
    stats.pointsCount = info.points_count || 0;
    stats.vectorsCount = info.vectors_count || 0;
    stats.status = info.status || "unknown";

    // Extrair dimensão e distância
    if (info.config?.params?.vectors) {
      const vectorsConfig = info.config.params.vectors;
      if (typeof vectorsConfig === "object" && "size" in vectorsConfig) {
        stats.vectorDimension = vectorsConfig.size as number;
        stats.distance = (vectorsConfig as any).distance || null;
      }
    }
  } catch (error: any) {
    if (error.message?.includes("not found") || error.status === 404) {
      stats.status = "not_found";
    } else {
      stats.status = "error";
      stats.error = error.message;
    }
  }

  return stats;
}

async function testCollectionOperations(
  client: QdrantClient,
  collectionName: string
): Promise<{ canRead: boolean; canSearch: boolean; samplePoint: any }> {
  const result = {
    canRead: false,
    canSearch: false,
    samplePoint: null as any,
  };

  try {
    // Testa leitura (scroll)
    const scrollResult = await client.scroll(collectionName, {
      limit: 1,
      with_payload: true,
      with_vector: false,
    });
    result.canRead = true;

    if (scrollResult.points.length > 0) {
      result.samplePoint = scrollResult.points[0];
    }

    // Testa busca (se tiver pontos)
    if (scrollResult.points.length > 0) {
      // Gera vetor fake para teste (dimensão da collection)
      const info = await client.getCollection(collectionName);
      let dimension = 1024;
      if (info.config?.params?.vectors && typeof info.config.params.vectors === "object") {
        dimension = (info.config.params.vectors as any).size || 1024;
      }

      const fakeVector = Array(dimension).fill(0).map(() => Math.random() - 0.5);

      const searchResult = await client.search(collectionName, {
        vector: fakeVector,
        limit: 1,
      });
      result.canSearch = true;
    } else {
      result.canSearch = true; // Vazio mas funcional
    }
  } catch (error: any) {
    if (verbose) {
      log(`  ⚠️  Erro em operações: ${error.message}`, "yellow");
    }
  }

  return result;
}

async function main() {
  log("\n╔══════════════════════════════════════════════════════════════╗", "cyan");
  log("║         FazAI - Teste das Collections Qdrant                 ║", "cyan");
  log("╚══════════════════════════════════════════════════════════════╝\n", "cyan");

  log(`📡 Conectando ao Qdrant: ${QDRANT_URL}`, "blue");

  const client = new QdrantClient({
    url: QDRANT_URL,
    timeout: 30000,
  });

  // Teste de saúde
  const isHealthy = await testQdrantHealth(client);
  if (!isHealthy) {
    log("\n❌ Qdrant não está acessível!", "red");
    log(`   Verifique se o servidor está rodando em ${QDRANT_URL}`, "dim");
    process.exit(1);
  }
  log("✅ Qdrant está saudável\n", "green");

  // Determina quais collections testar
  const collectionsToTest = specificCollection
    ? [specificCollection]
    : COLLECTIONS;

  const results: CollectionStats[] = [];

  // Testa cada collection
  for (const collectionName of collectionsToTest) {
    log(`\n📦 Testando: ${collectionName}`, "blue");
    log("─".repeat(50), "dim");

    const stats = await getCollectionStats(client, collectionName);
    results.push(stats);

    if (!stats.exists) {
      log(`   ❌ Collection não existe`, "red");
      if (stats.error) {
        log(`   Erro: ${stats.error}`, "dim");
      }
      continue;
    }

    log(`   ✅ Existe`, "green");
    log(`   📊 Status: ${stats.status}`);
    log(`   📍 Pontos: ${stats.pointsCount.toLocaleString()}`);
    log(`   🔢 Vetores: ${stats.vectorsCount.toLocaleString()}`);

    if (stats.vectorDimension) {
      log(`   📐 Dimensão: ${stats.vectorDimension}`);
    }
    if (stats.distance) {
      log(`   📏 Distância: ${stats.distance}`);
    }

    // Testes de operações
    if (verbose) {
      log(`\n   🧪 Testando operações...`, "dim");
      const ops = await testCollectionOperations(client, collectionName);

      log(`   ${ops.canRead ? "✅" : "❌"} Leitura (scroll)`);
      log(`   ${ops.canSearch ? "✅" : "❌"} Busca (search)`);

      if (ops.samplePoint && verbose) {
        log(`\n   📝 Amostra de payload:`, "dim");
        const payloadKeys = Object.keys(ops.samplePoint.payload || {});
        log(`      Campos: ${payloadKeys.join(", ")}`, "dim");
      }
    }
  }

  // Sumário
  log("\n\n╔══════════════════════════════════════════════════════════════╗", "cyan");
  log("║                         SUMÁRIO                              ║", "cyan");
  log("╚══════════════════════════════════════════════════════════════╝", "cyan");

  const existing = results.filter((r) => r.exists);
  const empty = existing.filter((r) => r.pointsCount === 0);
  const withData = existing.filter((r) => r.pointsCount > 0);

  log(`\n📊 Collections testadas: ${results.length}`);
  log(`   ✅ Existentes: ${existing.length}`, existing.length > 0 ? "green" : "yellow");
  log(`   📭 Vazias: ${empty.length}`, empty.length > 0 ? "yellow" : "green");
  log(`   📦 Com dados: ${withData.length}`, withData.length > 0 ? "green" : "yellow");

  // Tabela de resultados
  log("\n┌────────────────────────┬──────────┬───────────┬───────────┐");
  log("│ Collection             │ Status   │ Pontos    │ Dimensão  │");
  log("├────────────────────────┼──────────┼───────────┼───────────┤");

  for (const r of results) {
    const name = r.name.padEnd(22);
    const status = r.exists ? "OK".padEnd(8) : "MISSING".padEnd(8);
    const points = r.pointsCount.toString().padStart(9);
    const dim = (r.vectorDimension?.toString() || "-").padStart(9);

    const statusColor = r.exists ? (r.pointsCount > 0 ? "green" : "yellow") : "red";
    log(`│ ${name} │ ${colors[statusColor]}${status}${colors.reset} │ ${points} │ ${dim} │`);
  }

  log("└────────────────────────┴──────────┴───────────┴───────────┘");

  // Alertas
  const missingCollections = results.filter((r) => !r.exists);
  if (missingCollections.length > 0) {
    log("\n⚠️  Collections faltando:", "yellow");
    for (const c of missingCollections) {
      log(`   - ${c.name}`, "yellow");
    }
    log("\n   Execute para criar:", "dim");
    log("   npx tsx src/scripts/init-qdrant-collections.ts", "dim");
  }

  if (empty.length > 0) {
    log("\n⚠️  Collections vazias:", "yellow");
    for (const c of empty) {
      log(`   - ${c.name}`, "yellow");
    }
    log("\n   Popule com dados para o RAG funcionar corretamente.", "dim");
  }

  // JSON output se verbose
  if (verbose) {
    const output: TestResult = {
      timestamp: new Date().toISOString(),
      qdrantUrl: QDRANT_URL,
      qdrantHealthy: isHealthy,
      collections: results,
      summary: {
        total: results.length,
        existing: existing.length,
        empty: empty.length,
        withData: withData.length,
      },
    };

    log("\n📄 JSON Output:", "dim");
    console.log(JSON.stringify(output, null, 2));
  }

  log("\n");
  process.exit(missingCollections.length > 0 ? 1 : 0);
}

main().catch((error) => {
  log(`\n❌ Erro fatal: ${error.message}`, "red");
  process.exit(1);
});
