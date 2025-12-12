/**
 * Test: Neural Flow Multi-Collection Query
 *
 * Demonstra o uso completo do sistema RAG neural com fusion scoring.
 *
 * Requisitos:
 * - Qdrant rodando em http://localhost:6333 (ou QDRANT_URL configurado)
 * - Collections fazai_* criadas e populadas
 * - Ollama ou OpenAI configurado para embeddings
 *
 * Uso:
 * ```bash
 * npx tsx tests/rag/test-neural-flow.ts
 * ```
 */

import { neuralQuery, createCollectionSubset } from "../../src/rag/neural-flow";
import { captureLearning, findSimilarLearnings } from "../../src/rag/auto-learning";
import { interactionLogger, logQuerySuccess } from "../../src/rag/interaction-logger";
import { createEmbeddingService } from "../../src/services/embeddings";
import { logger } from "../../src/logger";

/**
 * Teste básico de busca neural
 */
async function testBasicQuery() {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  TEST 1: Basic Neural Query");
  console.log("═══════════════════════════════════════════════\n");

  const query = "Como configurar nginx como reverse proxy?";
  console.log(`Query: "${query}"\n`);

  // Gera embedding
  const embeddingService = await createEmbeddingService();
  const embedding = await embeddingService.generate(query);
  console.log(`✓ Generated embedding (${embedding.length}D)\n`);

  // Busca neural
  const result = await neuralQuery(query, embedding, {
    topK: 5,
    minScore: 0.3,
  });

  console.log(`\n✅ Query completed in ${result.totalTime}ms`);
  console.log(`   Total results: ${result.fusedResults.length}`);
  console.log(`   Collections queried: ${result.stats.collectionsQueried}`);
  console.log(`   Average score: ${result.stats.averageScore.toFixed(3)}`);
  console.log(`   Top score: ${result.stats.topScore.toFixed(3)}\n`);

  // Exibe top 5 resultados
  console.log("Top Results:");
  for (let i = 0; i < Math.min(5, result.fusedResults.length); i++) {
    const r = result.fusedResults[i];
    const collection = r.collection.replace("fazai_", "").toUpperCase();
    console.log(`\n${i + 1}. [${collection}] (score: ${r.score.toFixed(3)})`);
    console.log(`   ${r.content.substring(0, 150)}${r.content.length > 150 ? "..." : ""}`);
    console.log(`   Vector: ${r.vectorScore.toFixed(3)} | Recency: ${r.recencyBoost.toFixed(2)}x`);
  }

  // Log interação
  await logQuerySuccess(
    "ask",
    query,
    result.results.map((r) => r.collection),
    result.fusedResults.length,
    result.stats.averageScore,
    result.totalTime
  );
}

/**
 * Teste de busca filtrada por collection
 */
async function testFilteredQuery() {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  TEST 2: Filtered Query (KB + Learning only)");
  console.log("═══════════════════════════════════════════════\n");

  const query = "Troubleshooting de problemas de rede";
  console.log(`Query: "${query}"\n`);

  const embeddingService = await createEmbeddingService();
  const embedding = await embeddingService.generate(query);

  // Busca apenas em KB e Learning
  const result = await neuralQuery(query, embedding, {
    collections: createCollectionSubset("kb", "learning"),
    topK: 3,
    minScore: 0.4,
  });

  console.log(`\n✅ Query completed in ${result.totalTime}ms`);
  console.log(`   Collections used: ${result.results.map((r) => r.collection).join(", ")}`);
  console.log(`   Results: ${result.fusedResults.length}\n`);

  for (const r of result.fusedResults) {
    const collection = r.collection.replace("fazai_", "").toUpperCase();
    console.log(`- [${collection}] ${r.score.toFixed(3)}: ${r.content.substring(0, 100)}...`);
  }
}

/**
 * Teste de captura de aprendizado
 */
async function testLearningCapture() {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  TEST 3: Learning Capture");
  console.log("═══════════════════════════════════════════════\n");

  const learningId = await captureLearning({
    type: "acerto",
    title: "Configuração nginx reverse proxy para aplicação Node.js",
    description:
      "Configurado nginx como reverse proxy para app Node.js rodando na porta 3000. " +
      "Incluído proxy_set_header para preservar IP real do cliente.",
    context:
      "Cliente reportou que aplicação estava inacessível via domínio. " +
      "Nginx estava instalado mas sem configuração de proxy.",
    actionTaken:
      "Criado /etc/nginx/sites-available/app.conf com proxy_pass para localhost:3000 " +
      "e headers X-Real-IP, X-Forwarded-For",
    outcome: "sucesso",
    category: "nginx",
    tags: ["reverse-proxy", "nodejs", "proxy_pass"],
  });

  console.log(`✅ Learning captured: ${learningId}\n`);

  // Busca learnings similares
  console.log("Searching for similar learnings...\n");
  const similar = await findSimilarLearnings("configurar nginx proxy nodejs", undefined, 3);

  if (similar.length > 0) {
    console.log("Similar learnings found:");
    for (const l of similar) {
      console.log(`- ${l.title}`);
      console.log(`  Category: ${l.category} | Confidence: ${l.confidence.toFixed(2)} | Applied: ${l.applied_count}x`);
    }
  } else {
    console.log("No similar learnings found (collection may be empty)");
  }
}

/**
 * Teste de estatísticas do logger
 */
async function testInteractionStats() {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  TEST 4: Interaction Logger Statistics");
  console.log("═══════════════════════════════════════════════\n");

  const stats = interactionLogger.analyzePatterns();
  console.log(interactionLogger.formatStats());
}

/**
 * Executa todos os testes
 */
async function runAllTests() {
  console.log("\n");
  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║   FazAI Neural Flow & Auto-Learning Tests    ║");
  console.log("╚═══════════════════════════════════════════════╝");

  try {
    await testBasicQuery();
    await testFilteredQuery();
    await testLearningCapture();
    await testInteractionStats();

    console.log("\n═══════════════════════════════════════════════");
    console.log("  ✅ All tests completed successfully!");
    console.log("═══════════════════════════════════════════════\n");

    // Flush logs
    await interactionLogger.flush();
  } catch (error: any) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Executa se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}
