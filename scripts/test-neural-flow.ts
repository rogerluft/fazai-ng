#!/usr/bin/env npx tsx
/**
 * FazAI - Teste do Neural Flow (RAG Multi-Collection)
 *
 * Testa a busca paralela em múltiplas collections com fusion scoring.
 *
 * Uso:
 *   npx tsx scripts/test-neural-flow.ts
 *   npx tsx scripts/test-neural-flow.ts "como instalar nginx"
 *   npx tsx scripts/test-neural-flow.ts --verbose
 */

import { neuralQuery } from "../src/rag/neural-flow.js";
import { createEmbeddingService } from "../src/services/embeddings.js";

const args = process.argv.slice(2);
const verbose = args.includes("--verbose") || args.includes("-v");
const customQuery = args.find((a) => !a.startsWith("-"));

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  magenta: "\x1b[35m",
};

function log(msg: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

const DEFAULT_QUERIES = [
  "Como instalar nginx no Ubuntu?",
  "Erro 502 bad gateway nginx",
  "Verificar logs do systemd",
];

async function main() {
  log("\n╔══════════════════════════════════════════════════════════════╗", "cyan");
  log("║         FazAI - Teste do Neural Flow (RAG)                   ║", "cyan");
  log("╚══════════════════════════════════════════════════════════════╝\n", "cyan");

  // Inicializa embedding service
  log("🔧 Inicializando embedding service...", "blue");
  const embedService = await createEmbeddingService();
  const info = embedService.getInfo();
  log(`   Provider: ${info.provider} | Modelo: ${info.model} | Dim: ${info.dimension}`, "dim");

  // Pesos das collections
  log("\n📊 Pesos das collections (Fusion Scoring):", "blue");
  log("   ┌────────────────────┬────────┐");
  log("   │ Collection         │ Peso   │");
  log("   ├────────────────────┼────────┤");
  log("   │ fazai_personality  │  15%   │");
  log("   │ fazai_memory       │  20%   │");
  log("   │ fazai_learning     │  30%   │ ← Mais importante");
  log("   │ fazai_kb           │  25%   │");
  log("   │ fazai_inference    │  10%   │");
  log("   └────────────────────┴────────┘");

  // Queries a testar
  const queries = customQuery ? [customQuery] : DEFAULT_QUERIES;

  for (const query of queries) {
    log("\n" + "═".repeat(60), "cyan");
    log(`\n🔍 Query: "${query}"`, "blue");
    log("─".repeat(50), "dim");

    // Gera embedding
    const startEmbed = Date.now();
    const embedding = await embedService.generate(query);
    const embedTime = Date.now() - startEmbed;
    log(`   📐 Embedding gerado em ${embedTime}ms (${embedding.length} dimensões)`, "dim");

    // Neural Query
    const startQuery = Date.now();
    try {
      const result = await neuralQuery(query, embedding, {
        topK: 5,
        minScore: 0.3,
        includeEmbedding: false,
        weights: {
          personality: 0.15,
          memory: 0.20,
          learning: 0.30,
          kb: 0.25,
          inference: 0.10,
        },
      });
      const queryTime = Date.now() - startQuery;

      // Resultados por collection
      log(`\n   ⏱️  Query executada em ${queryTime}ms`, "green");
      log(`   📊 Estatísticas:`, "blue");
      log(`      Total de pontos: ${result.stats.totalPoints}`);
      log(`      Collections consultadas: ${result.stats.collectionsQueried}`);
      log(`      Score médio: ${result.stats.averageScore.toFixed(4)}`);
      log(`      Score máximo: ${result.stats.topScore.toFixed(4)}`);

      // Resultados por collection
      log(`\n   📦 Resultados por collection:`, "blue");
      for (const collResult of result.results) {
        const count = collResult.points.length;
        const icon = count > 0 ? "✅" : "📭";
        log(`      ${icon} ${collResult.collection}: ${count} pontos`);

        if (verbose && count > 0) {
          for (const point of collResult.points.slice(0, 2)) {
            log(`         • Score: ${point.score.toFixed(4)} | ID: ${point.id}`, "dim");
          }
        }
      }

      // Resultados fusionados
      log(`\n   🔀 Top 5 Resultados Fusionados:`, "magenta");
      if (result.fusedResults.length === 0) {
        log(`      ⚠️  Nenhum resultado acima do minScore (0.3)`, "yellow");
      } else {
        for (let i = 0; i < Math.min(5, result.fusedResults.length); i++) {
          const r = result.fusedResults[i];
          log(`\n      ${i + 1}. [${r.collection}] Score: ${r.score.toFixed(4)}`, "green");
          log(`         Vector Score: ${r.vectorScore.toFixed(4)} | Recency Boost: ${r.recencyBoost.toFixed(2)}x`, "dim");

          const content = r.content.substring(0, 100).replace(/\n/g, " ");
          log(`         "${content}..."`, "dim");

          if (verbose && r.metadata) {
            const metaKeys = Object.keys(r.metadata).slice(0, 5);
            log(`         Metadata: ${metaKeys.join(", ")}`, "dim");
          }
        }
      }

      // Decisão RAG
      const topScore = result.fusedResults[0]?.score || 0;
      log(`\n   🎯 Decisão RAG:`, "blue");
      if (topScore >= 0.5) {
        log(`      ✅ Score ${topScore.toFixed(4)} >= 0.5 → USAR RESULTADO DO RAG`, "green");
        log(`      💡 Pode usar resposta direto sem chamar IA!`, "green");
      } else if (topScore > 0) {
        log(`      ⚠️  Score ${topScore.toFixed(4)} < 0.5 → ENRIQUECER CONTEXTO`, "yellow");
        log(`      💡 Adicionar resultados RAG ao prompt da IA`, "yellow");
      } else {
        log(`      ❌ Nenhum resultado → SEM CONTEXTO RAG`, "red");
        log(`      💡 Chamar IA sem contexto adicional`, "red");
      }
    } catch (error: any) {
      log(`   ❌ Erro: ${error.message}`, "red");
    }
  }

  // Sumário
  log("\n\n╔══════════════════════════════════════════════════════════════╗", "cyan");
  log("║                         SUMÁRIO                              ║", "cyan");
  log("╚══════════════════════════════════════════════════════════════╝", "cyan");

  log(`\n   Neural Flow testado com ${queries.length} query(ies)`, "green");
  log(`   Embedding: ${info.provider} (${info.model})`);
  log(`\n   Thresholds:`);
  log(`   • Score >= 0.5: Usar RAG direto (não chama IA)`);
  log(`   • Score < 0.5: Enriquecer contexto e chamar IA`);
  log(`   • Score = 0: Sem contexto RAG`);

  log("\n   Dica: Popule as collections para obter melhores resultados!", "dim");
  log("\n");
}

main().catch((error) => {
  log(`\n❌ Erro fatal: ${error.message}`, "red");
  process.exit(1);
});
