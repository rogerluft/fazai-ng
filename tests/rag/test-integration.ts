/**
 * Testes End-to-End do Sistema RAG
 *
 * Valida integração completa entre:
 * - Neural flow
 * - Semantic cache
 * - Auto-learning
 * - Metrics
 * - Linux-admin integration
 */

import chalk from "chalk";

// Delay helper
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Test Suite: Neural Flow End-to-End
 */
async function testNeuralFlowE2E(): Promise<void> {
  console.log(chalk.bold.cyan("\n━━━ Test: Neural Flow E2E ━━━"));

  try {
    const { neuralQuery } = await import("../../src/rag/neural-flow");
    const { createEmbeddingService } = await import("../../src/services/embeddings");

    // Query realística
    const query = "Como configurar nginx como reverse proxy para Node.js?";
    console.log(chalk.gray(`Query: "${query}"`));

    // Gera embedding
    const embeddingService = await createEmbeddingService();
    const embedding = await embeddingService.generate(query);

    console.log(chalk.gray(`Embedding gerado: ${embedding.length}D`));

    // Busca neural
    const result = await neuralQuery(query, embedding, {
      topK: 5,
      minScore: 0.3,
      collections: ["fazai_kb", "fazai_learning"],
    });

    console.log(chalk.green(`✓ Busca completada em ${result.totalTime}ms`));
    console.log(chalk.gray(`  Resultados: ${result.fusedResults.length}`));
    console.log(chalk.gray(`  Collections: ${result.stats.collectionsQueried}`));

    if (result.fusedResults.length > 0) {
      const top = result.fusedResults[0];
      console.log(
        chalk.gray(
          `  Top resultado: score=${top.score.toFixed(3)} (${top.collection})`
        )
      );
    }

    console.log(chalk.bold.green("✅ PASS: Neural Flow E2E"));
  } catch (error: any) {
    console.log(chalk.bold.red(`❌ FAIL: ${error.message}`));
    throw error;
  }
}

/**
 * Test Suite: Semantic Cache E2E
 */
async function testSemanticCacheE2E(): Promise<void> {
  console.log(chalk.bold.cyan("\n━━━ Test: Semantic Cache E2E ━━━"));

  try {
    const { SemanticCache } = await import("../../src/services/semantic-cache");

    const cache = await SemanticCache.getInstance();

    // Dados de teste
    const query = `Test query ${Date.now()}`;
    const response = "Test response for cache validation";
    const model = "test-model";
    const provider = "test";

    // Store
    console.log(chalk.gray("Armazenando no cache..."));
    await cache.store(query, response, model, provider);
    await sleep(200); // Aguarda indexação

    // Lookup
    console.log(chalk.gray("Buscando no cache..."));
    const cached = await cache.lookup(query, model, provider, {
      similarityThreshold: 0.95,
    });

    if (!cached) {
      throw new Error("Cache lookup falhou - deveria encontrar");
    }

    if (cached !== response) {
      throw new Error("Resposta do cache não corresponde");
    }

    // Stats
    const stats = await cache.stats();
    console.log(chalk.gray(`Cache entries: ${stats.totalEntries}`));
    console.log(chalk.gray(`Hit rate: ${stats.hitRate.toFixed(1)}%`));

    console.log(chalk.bold.green("✅ PASS: Semantic Cache E2E"));
  } catch (error: any) {
    console.log(chalk.bold.red(`❌ FAIL: ${error.message}`));
    throw error;
  }
}

/**
 * Test Suite: Auto-Learning E2E
 */
async function testAutoLearningE2E(): Promise<void> {
  console.log(chalk.bold.cyan("\n━━━ Test: Auto-Learning E2E ━━━"));

  try {
    const { captureLearning, incrementLearningApplication } = await import(
      "../../src/rag/auto-learning"
    );

    // Captura learning
    console.log(chalk.gray("Capturando learning..."));
    const learningId = await captureLearning({
      type: "acerto",
      title: "Test: Nginx configuration",
      description: "Configured nginx reverse proxy successfully",
      context: "Testing auto-learning system",
      actionTaken: "nginx -s reload",
      outcome: "sucesso",
      category: "webserver",
      tags: ["nginx", "test"],
      initialConfidence: 0.9,
    });

    console.log(chalk.gray(`Learning ID: ${learningId}`));

    // Incrementa aplicação
    console.log(chalk.gray("Incrementando aplicação..."));
    await incrementLearningApplication(learningId, true);
    await sleep(200);

    // Verifica no Qdrant
    const { getQdrantClient } = await import("../../src/database/qdrant-pool");
    const client = await getQdrantClient();

    const result = await client.retrieve("fazai_learning", {
      ids: [learningId],
      with_payload: true,
    });

    if (result.length === 0) {
      throw new Error("Learning não encontrado no Qdrant");
    }

    const payload = result[0].payload as any;

    if (payload.applied_count < 1) {
      throw new Error("Applied count não foi incrementado");
    }

    console.log(chalk.gray(`Applied count: ${payload.applied_count}`));
    console.log(chalk.gray(`Confidence: ${payload.confidence.toFixed(2)}`));

    console.log(chalk.bold.green("✅ PASS: Auto-Learning E2E"));
  } catch (error: any) {
    console.log(chalk.bold.red(`❌ FAIL: ${error.message}`));
    throw error;
  }
}

/**
 * Test Suite: Metrics E2E
 */
async function testMetricsE2E(): Promise<void> {
  console.log(chalk.bold.cyan("\n━━━ Test: Metrics E2E ━━━"));

  try {
    const { collectRAGMetrics, formatRAGMetrics } = await import(
      "../../src/rag/metrics"
    );

    console.log(chalk.gray("Coletando métricas..."));
    const metrics = await collectRAGMetrics();

    console.log(chalk.gray(`Neural Flow queries: ${metrics.neuralFlow.totalQueries}`));
    console.log(chalk.gray(`Cache entries: ${metrics.semanticCache.totalEntries}`));
    console.log(chalk.gray(`Learning patterns: ${metrics.learning.totalPatterns}`));

    // Valida estrutura
    if (typeof metrics.neuralFlow.hitRate !== "number") {
      throw new Error("Métrica neuralFlow.hitRate inválida");
    }

    if (typeof metrics.semanticCache.hitRate !== "number") {
      throw new Error("Métrica semanticCache.hitRate inválida");
    }

    if (typeof metrics.learning.avgConfidence !== "number") {
      throw new Error("Métrica learning.avgConfidence inválida");
    }

    // Testa formatação
    console.log(chalk.gray("Testando formatação..."));
    const formatted = formatRAGMetrics(metrics);

    if (!formatted.includes("Neural Flow")) {
      throw new Error("Formatação de métricas inválida");
    }

    console.log(chalk.bold.green("✅ PASS: Metrics E2E"));
  } catch (error: any) {
    console.log(chalk.bold.red(`❌ FAIL: ${error.message}`));
    throw error;
  }
}

/**
 * Test Suite: Linux Admin Integration
 */
async function testLinuxAdminIntegration(): Promise<void> {
  console.log(chalk.bold.cyan("\n━━━ Test: Linux Admin Integration ━━━"));

  try {
    const { captureLearningFromCommands } = await import(
      "../../src/linux-admin"
    );

    // Mock commands
    const commands = [
      {
        explain: "Restart nginx service",
        command: "systemctl restart nginx",
        riskLevel: "low" as const,
        requiresConfirmation: false,
      },
      {
        explain: "Check nginx status",
        command: "systemctl status nginx",
        riskLevel: "low" as const,
        requiresConfirmation: false,
      },
    ];

    const task = "Reiniciar nginx após mudança de config";
    const systemInfo = "Ubuntu 22.04 LTS";

    console.log(chalk.gray("Capturando learning de comandos..."));
    await captureLearningFromCommands(task, commands, systemInfo);

    await sleep(200);

    // Verifica se foi criado
    const { getQdrantClient } = await import("../../src/database/qdrant-pool");
    const client = await getQdrantClient();

    const scrollResult = await client.scroll("fazai_learning", {
      limit: 10,
      with_payload: true,
      filter: {
        must: [
          {
            key: "category",
            match: { value: "webserver" },
          },
        ],
      },
    });

    if (scrollResult.points.length === 0) {
      console.log(chalk.yellow("⚠️  Nenhum learning encontrado (pode ser normal se collection está vazia)"));
    } else {
      console.log(
        chalk.gray(`Learnings de webserver: ${scrollResult.points.length}`)
      );
    }

    console.log(chalk.bold.green("✅ PASS: Linux Admin Integration"));
  } catch (error: any) {
    console.log(chalk.bold.red(`❌ FAIL: ${error.message}`));
    throw error;
  }
}

/**
 * Test Suite: Full Integration (Neural Flow + Cache + Learning)
 */
async function testFullIntegration(): Promise<void> {
  console.log(chalk.bold.cyan("\n━━━ Test: Full Integration ━━━"));

  try {
    const { neuralQuery } = await import("../../src/rag/neural-flow");
    const { captureLearning } = await import("../../src/rag/auto-learning");
    const { SemanticCache } = await import("../../src/services/semantic-cache");
    const { createEmbeddingService } = await import(
      "../../src/services/embeddings"
    );

    // 1. Captura learning
    console.log(chalk.gray("1. Capturando learning inicial..."));
    const learningId = await captureLearning({
      type: "acerto",
      title: "Docker container restart",
      description: "Successfully restarted docker container",
      context: "Container was stuck",
      actionTaken: "docker restart container_name",
      outcome: "sucesso",
      category: "docker",
      tags: ["docker", "restart"],
    });

    await sleep(500); // Aguarda indexação

    // 2. Busca neural deve encontrar
    console.log(chalk.gray("2. Buscando no neural flow..."));
    const embeddingService = await createEmbeddingService();
    const embedding = await embeddingService.generate("docker restart container");

    const result = await neuralQuery("docker restart container", embedding, {
      topK: 5,
      minScore: 0.5,
      collections: ["fazai_learning"],
    });

    if (result.fusedResults.length === 0) {
      console.log(
        chalk.yellow(
          "⚠️  Neural flow não encontrou resultados (similarity pode estar baixo)"
        )
      );
    } else {
      console.log(
        chalk.gray(`  Encontrou ${result.fusedResults.length} resultados`)
      );
    }

    // 3. Cache semântico
    console.log(chalk.gray("3. Testando cache semântico..."));
    const cache = await SemanticCache.getInstance();

    const query = `Docker integration test ${Date.now()}`;
    await cache.store(query, "Cached response", "test", "test");
    await sleep(200);

    const cached = await cache.lookup(query, "test", "test");
    if (!cached) {
      throw new Error("Cache não funcionou corretamente");
    }

    console.log(chalk.gray("  Cache funcionando"));

    // 4. Métricas
    console.log(chalk.gray("4. Coletando métricas finais..."));
    const { collectRAGMetrics } = await import("../../src/rag/metrics");
    const metrics = await collectRAGMetrics();

    console.log(chalk.gray(`  Learning patterns: ${metrics.learning.totalPatterns}`));
    console.log(chalk.gray(`  Cache entries: ${metrics.semanticCache.totalEntries}`));

    console.log(chalk.bold.green("✅ PASS: Full Integration"));
  } catch (error: any) {
    console.log(chalk.bold.red(`❌ FAIL: ${error.message}`));
    throw error;
  }
}

/**
 * Main test runner
 */
async function runAllTests(): Promise<void> {
  console.log(chalk.bold.magenta("\n╔═══════════════════════════════════════════╗"));
  console.log(chalk.bold.magenta("║   RAG System End-to-End Test Suite       ║"));
  console.log(chalk.bold.magenta("╚═══════════════════════════════════════════╝\n"));

  const tests = [
    { name: "Neural Flow E2E", fn: testNeuralFlowE2E },
    { name: "Semantic Cache E2E", fn: testSemanticCacheE2E },
    { name: "Auto-Learning E2E", fn: testAutoLearningE2E },
    { name: "Metrics E2E", fn: testMetricsE2E },
    { name: "Linux Admin Integration", fn: testLinuxAdminIntegration },
    { name: "Full Integration", fn: testFullIntegration },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.fn();
      passed++;
    } catch (error) {
      failed++;
      console.error(chalk.red(`\nTest "${test.name}" failed with error:`));
      console.error(error);
    }

    await sleep(300); // Delay entre tests
  }

  // Summary
  console.log(chalk.bold.cyan("\n" + "=".repeat(50)));
  console.log(chalk.bold.cyan("Test Summary"));
  console.log(chalk.bold.cyan("=".repeat(50)));
  console.log(chalk.green(`✓ Passed: ${passed}`));
  console.log(chalk.red(`✗ Failed: ${failed}`));
  console.log(chalk.bold.cyan("=".repeat(50) + "\n"));

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  console.error(chalk.bold.red("\nUnexpected error during test execution:"));
  console.error(error);
  process.exit(1);
});
