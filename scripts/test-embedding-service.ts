#!/usr/bin/env npx tsx
/**
 * FazAI - Teste do Embedding Service
 *
 * Testa a geração de embeddings com Ollama e OpenAI.
 *
 * Uso:
 *   npx tsx scripts/test-embedding-service.ts
 *   npx tsx scripts/test-embedding-service.ts --verbose
 */

import { createEmbeddingService } from "../src/services/embeddings.js";
import { getConfigValue } from "../src/config.js";

const verbose = process.argv.includes("--verbose") || process.argv.includes("-v");

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

const TEST_TEXTS = [
  "Como instalar nginx no Ubuntu?",
  "Reiniciar serviço docker",
  "Verificar uso de memória do sistema",
];

async function main() {
  log("\n╔══════════════════════════════════════════════════════════════╗", "cyan");
  log("║         FazAI - Teste do Embedding Service                   ║", "cyan");
  log("╚══════════════════════════════════════════════════════════════╝\n", "cyan");

  // Mostra configuração
  const ollamaUrl = getConfigValue("OLLAMA_BASE_URL") || "http://192.168.0.101:11434";
  const hasOpenAI = !!getConfigValue("OPENAI_API_KEY");

  log("📋 Configuração:", "blue");
  log(`   OLLAMA_BASE_URL: ${ollamaUrl}`);
  log(`   OPENAI_API_KEY: ${hasOpenAI ? "✅ Configurada" : "❌ Não configurada"}`);

  // Cria serviço
  log("\n🔧 Inicializando serviço de embeddings...", "blue");

  let service;
  try {
    service = await createEmbeddingService();
  } catch (error: any) {
    log(`\n❌ Falha ao criar serviço: ${error.message}`, "red");
    process.exit(1);
  }

  const info = service.getInfo();
  log("\n✅ Serviço criado:", "green");
  log(`   Provider: ${info.provider}`);
  log(`   Modelo: ${info.model}`);
  log(`   Dimensão: ${info.dimension}`);
  log(`   Local: ${info.isLocal ? "Sim" : "Não"}`);

  // Testa geração individual
  log("\n🧪 Testando geração individual...", "blue");
  log("─".repeat(50), "dim");

  for (const text of TEST_TEXTS) {
    const start = Date.now();

    try {
      const embedding = await service.generate(text);
      const elapsed = Date.now() - start;

      log(`\n   📝 "${text.substring(0, 40)}..."`, "dim");
      log(`   ✅ Gerado em ${elapsed}ms`, "green");
      log(`   📐 Dimensão: ${embedding.length}`);

      if (verbose) {
        log(`   🔢 Primeiros valores: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(", ")}, ...]`, "dim");
        log(`   📊 Magnitude: ${Math.sqrt(embedding.reduce((a, b) => a + b * b, 0)).toFixed(4)}`, "dim");
      }
    } catch (error: any) {
      log(`\n   📝 "${text.substring(0, 40)}..."`, "dim");
      log(`   ❌ Erro: ${error.message}`, "red");
    }
  }

  // Testa geração em batch
  log("\n\n🧪 Testando geração em batch...", "blue");
  log("─".repeat(50), "dim");

  const startBatch = Date.now();
  try {
    const embeddings = await service.generateBatch(TEST_TEXTS);
    const elapsedBatch = Date.now() - startBatch;

    log(`\n   ✅ Batch de ${TEST_TEXTS.length} textos em ${elapsedBatch}ms`, "green");
    log(`   ⏱️  Média: ${Math.round(elapsedBatch / TEST_TEXTS.length)}ms por texto`);

    // Verifica similaridade entre embeddings
    if (verbose && embeddings.length >= 2) {
      log("\n   📊 Similaridade entre embeddings:", "dim");

      for (let i = 0; i < embeddings.length; i++) {
        for (let j = i + 1; j < embeddings.length; j++) {
          const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
          log(`      ${i} ↔ ${j}: ${(similarity * 100).toFixed(2)}%`, "dim");
        }
      }
    }
  } catch (error: any) {
    log(`\n   ❌ Erro no batch: ${error.message}`, "red");
  }

  // Sumário
  log("\n\n╔══════════════════════════════════════════════════════════════╗", "cyan");
  log("║                         SUMÁRIO                              ║", "cyan");
  log("╚══════════════════════════════════════════════════════════════╝", "cyan");

  log(`\n   Provider ativo: ${info.provider}`, "green");
  log(`   Modelo: ${info.model}`);
  log(`   Dimensão: ${info.dimension}`);
  log(`   Tipo: ${info.isLocal ? "Local (grátis)" : "Cloud (pago)"}`);

  if (!info.isLocal) {
    log("\n   ⚠️  Usando provider cloud. Considere configurar Ollama local.", "yellow");
  }

  log("\n");
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

main().catch((error) => {
  log(`\n❌ Erro fatal: ${error.message}`, "red");
  process.exit(1);
});
