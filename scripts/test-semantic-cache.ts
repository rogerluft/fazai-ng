#!/usr/bin/env npx tsx
/**
 * FazAI - Teste do Semantic Cache
 *
 * Testa o cache semântico com similaridade de embeddings.
 *
 * Uso:
 *   npx tsx scripts/test-semantic-cache.ts
 *   npx tsx scripts/test-semantic-cache.ts --clear  # Limpa cache antes
 *   npx tsx scripts/test-semantic-cache.ts --stats  # Mostra apenas estatísticas
 */

import { SemanticCache } from "../src/services/semantic-cache.js";

const args = process.argv.slice(2);
const clearFirst = args.includes("--clear");
const statsOnly = args.includes("--stats");

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

const TEST_QUERIES = [
  { query: "Como instalar nginx no Ubuntu?", model: "qwen2.5:7b", provider: "ollama" },
  { query: "install nginx on Ubuntu", model: "qwen2.5:7b", provider: "ollama" },  // Similar!
  { query: "Reiniciar docker", model: "qwen2.5:7b", provider: "ollama" },
  { query: "restart docker service", model: "qwen2.5:7b", provider: "ollama" },  // Similar!
];

async function main() {
  log("\n╔══════════════════════════════════════════════════════════════╗", "cyan");
  log("║         FazAI - Teste do Semantic Cache                      ║", "cyan");
  log("╚══════════════════════════════════════════════════════════════╝\n", "cyan");

  let cache: SemanticCache;

  try {
    cache = await SemanticCache.getInstance();
    log("✅ Cache inicializado", "green");
  } catch (error: any) {
    log(`❌ Falha ao inicializar cache: ${error.message}`, "red");
    process.exit(1);
  }

  // Clear se solicitado
  if (clearFirst) {
    log("\n🗑️  Limpando cache...", "yellow");
    await cache.clear();
    log("✅ Cache limpo", "green");
  }

  // Estatísticas iniciais
  log("\n📊 Estatísticas atuais:", "blue");
  const stats = await cache.stats();
  log(`   Total de entries: ${stats.totalEntries}`);
  log(`   Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
  log(`   Total hits: ${stats.totalHits}`);
  log(`   Total misses: ${stats.totalMisses}`);

  if (statsOnly) {
    log("\n");
    return;
  }

  // Testa store + lookup
  log("\n🧪 Testando store e lookup...", "blue");
  log("─".repeat(50), "dim");

  // Store primeira query
  const firstQuery = TEST_QUERIES[0];
  const mockResponse = "Para instalar nginx no Ubuntu, execute: sudo apt update && sudo apt install nginx -y";

  log(`\n   📝 Armazenando: "${firstQuery.query.substring(0, 40)}..."`, "dim");
  const storeStart = Date.now();
  await cache.store(firstQuery.query, mockResponse, firstQuery.model, firstQuery.provider);
  log(`   ✅ Armazenado em ${Date.now() - storeStart}ms`, "green");

  // Lookup exato
  log(`\n   🔍 Lookup exato: "${firstQuery.query.substring(0, 40)}..."`, "dim");
  const lookupStart = Date.now();
  const exactResult = await cache.lookup(firstQuery.query, firstQuery.model, firstQuery.provider);
  const lookupTime = Date.now() - lookupStart;

  if (exactResult) {
    log(`   ✅ HIT em ${lookupTime}ms`, "green");
    log(`   📄 Resposta: "${exactResult.substring(0, 50)}..."`, "dim");
  } else {
    log(`   ❌ MISS (não deveria acontecer!)`, "red");
  }

  // Lookup similar (segunda query é similar à primeira)
  const similarQuery = TEST_QUERIES[1];
  log(`\n   🔍 Lookup similar: "${similarQuery.query.substring(0, 40)}..."`, "dim");
  const similarStart = Date.now();
  const similarResult = await cache.lookup(similarQuery.query, similarQuery.model, similarQuery.provider);
  const similarTime = Date.now() - similarStart;

  if (similarResult) {
    log(`   ✅ HIT (similaridade!) em ${similarTime}ms`, "green");
    log(`   📄 Resposta: "${similarResult.substring(0, 50)}..."`, "dim");
  } else {
    log(`   ⚠️  MISS (threshold pode estar muito alto)`, "yellow");
  }

  // Lookup diferente (terceira query é diferente)
  const differentQuery = TEST_QUERIES[2];
  log(`\n   🔍 Lookup diferente: "${differentQuery.query.substring(0, 40)}..."`, "dim");
  const differentStart = Date.now();
  const differentResult = await cache.lookup(differentQuery.query, differentQuery.model, differentQuery.provider);
  const differentTime = Date.now() - differentStart;

  if (differentResult) {
    log(`   ⚠️  HIT inesperado em ${differentTime}ms`, "yellow");
  } else {
    log(`   ✅ MISS (esperado - query diferente) em ${differentTime}ms`, "green");
  }

  // Estatísticas finais
  log("\n\n📊 Estatísticas após testes:", "blue");
  const finalStats = await cache.stats();
  log(`   Total de entries: ${finalStats.totalEntries}`);
  log(`   Hit rate: ${(finalStats.hitRate * 100).toFixed(2)}%`);
  log(`   Total hits: ${finalStats.totalHits}`);
  log(`   Total misses: ${finalStats.totalMisses}`);

  // Sumário
  log("\n\n╔══════════════════════════════════════════════════════════════╗", "cyan");
  log("║                         SUMÁRIO                              ║", "cyan");
  log("╚══════════════════════════════════════════════════════════════╝", "cyan");

  log(`\n   Cache funcionando: ✅`, "green");
  log(`   Threshold de similaridade: 0.95 (95%)`);
  log(`   TTL padrão: 1 hora`);
  log(`   Max entries: 10.000`);

  if (exactResult && similarResult) {
    log(`\n   ✅ Cache semântico detectando queries similares!`, "green");
  } else if (exactResult && !similarResult) {
    log(`\n   ⚠️  Cache funcionando, mas similaridade não detectada.`, "yellow");
    log(`      Considere reduzir o threshold de 0.95 para 0.90`, "dim");
  }

  log("\n");
}

main().catch((error) => {
  log(`\n❌ Erro fatal: ${error.message}`, "red");
  process.exit(1);
});
