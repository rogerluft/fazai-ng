/**
 * Metrics and Analytics System - RAG Performance Tracking
 *
 * Coleta e analisa métricas de performance do sistema RAG:
 * - Neural flow hit rate
 * - Semantic cache performance
 * - Learning patterns statistics
 * - Collection usage analytics
 *
 * @module rag/metrics
 */

import { getQdrantClient } from "../database/qdrant-pool";
import { logger } from "../logger";
import { SemanticCache } from "../services/semantic-cache";
import chalk from "chalk";

/**
 * Métricas gerais do sistema RAG
 */
export interface RAGMetrics {
  neuralFlow: {
    totalQueries: number;
    hits: number;
    misses: number;
    hitRate: number; // Percentage
    avgQueryTime: number; // milliseconds
  };
  semanticCache: {
    totalEntries: number;
    hits: number;
    misses: number;
    hitRate: number;
    avgAge: number; // seconds
    storageSize: number; // KB estimate
  };
  learning: {
    totalPatterns: number;
    avgConfidence: number;
    avgApplications: number;
    successRate: number;
    byCategory: Record<string, number>;
  };
  collections: {
    personality: CollectionStats;
    memory: CollectionStats;
    learning: CollectionStats;
    kb: CollectionStats;
    inference: CollectionStats;
  };
}

/**
 * Estatísticas de uma collection
 */
export interface CollectionStats {
  name: string;
  totalPoints: number;
  avgVectorSize: number;
  storageSize: number; // KB estimate
  lastUpdated?: string;
}

/**
 * Métricas de performance de query
 */
export interface QueryPerformanceMetrics {
  totalQueries: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  cacheHitRate: number;
  neuralFlowHitRate: number;
}

/**
 * Coleta métricas completas do sistema RAG
 */
export async function collectRAGMetrics(): Promise<RAGMetrics> {
  logger.debug("📊 Coletando métricas do sistema RAG...");

  const [neuralFlowMetrics, cacheMetrics, learningMetrics, collectionMetrics] =
    await Promise.all([
      collectNeuralFlowMetrics(),
      collectCacheMetrics(),
      collectLearningMetrics(),
      collectCollectionMetrics(),
    ]);

  return {
    neuralFlow: neuralFlowMetrics,
    semanticCache: cacheMetrics,
    learning: learningMetrics,
    collections: collectionMetrics,
  };
}

/**
 * Coleta métricas do neural flow
 */
async function collectNeuralFlowMetrics() {
  // Métricas do interaction logger se disponível
  try {
    const { InteractionLogger } = await import("./interaction-logger");
    const logger = new InteractionLogger();
    const stats = logger.analyzePatterns();

    const totalQueries = stats.totalInteractions;
    const hits = Math.round(totalQueries * stats.successRate);
    const misses = totalQueries - hits;

    return {
      totalQueries,
      hits,
      misses,
      hitRate: stats.successRate * 100,
      avgQueryTime: stats.avgExecutionTime,
    };
  } catch {
    return {
      totalQueries: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      avgQueryTime: 0,
    };
  }
}

/**
 * Coleta métricas do semantic cache
 */
async function collectCacheMetrics() {
  try {
    const cache = await SemanticCache.getInstance();
    const stats = await cache.stats();

    return {
      totalEntries: stats.totalEntries,
      hits: stats.totalHits,
      misses: stats.totalMisses,
      hitRate: stats.hitRate,
      avgAge: stats.avgAge,
      storageSize: Math.round((stats.totalEntries * 10) / 1024), // ~10KB/entry → KB
    };
  } catch (error: any) {
    logger.debug(`Erro ao coletar cache metrics: ${error.message}`);
    return {
      totalEntries: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      avgAge: 0,
      storageSize: 0,
    };
  }
}

/**
 * Coleta métricas de learning patterns
 */
async function collectLearningMetrics() {
  try {
    const client = await getQdrantClient();

    // Scroll todos os learning patterns
    const scrollResult = await client.scroll("fazai_learning", {
      limit: 1000,
      with_payload: true,
    });

    const patterns = scrollResult.points;
    const totalPatterns = patterns.length;

    if (totalPatterns === 0) {
      return {
        totalPatterns: 0,
        avgConfidence: 0,
        avgApplications: 0,
        successRate: 0,
        byCategory: {},
      };
    }

    // Calcula estatísticas
    let totalConfidence = 0;
    let totalApplications = 0;
    let successCount = 0;
    const byCategory: Record<string, number> = {};

    for (const point of patterns) {
      const payload = point.payload as any;

      totalConfidence += payload.confidence || 0;
      totalApplications += payload.applied_count || 0;

      if (payload.outcome === "sucesso") {
        successCount++;
      }

      const category = payload.category || "unknown";
      byCategory[category] = (byCategory[category] || 0) + 1;
    }

    return {
      totalPatterns,
      avgConfidence: totalConfidence / totalPatterns,
      avgApplications: totalApplications / totalPatterns,
      successRate: (successCount / totalPatterns) * 100,
      byCategory,
    };
  } catch (error: any) {
    logger.debug(`Erro ao coletar learning metrics: ${error.message}`);
    return {
      totalPatterns: 0,
      avgConfidence: 0,
      avgApplications: 0,
      successRate: 0,
      byCategory: {},
    };
  }
}

/**
 * Coleta métricas das collections
 */
async function collectCollectionMetrics() {
  const collections = [
    "fazai_personality",
    "fazai_memory",
    "fazai_learning",
    "fazai_kb",
    "fazai_inference",
  ];

  const stats: Record<string, CollectionStats> = {};

  for (const collection of collections) {
    try {
      const collectionStats = await getCollectionStats(collection);
      const shortName = collection.replace("fazai_", "");
      stats[shortName] = collectionStats;
    } catch (error: any) {
      logger.debug(`Erro ao coletar stats de ${collection}: ${error.message}`);
      const shortName = collection.replace("fazai_", "");
      stats[shortName] = {
        name: collection,
        totalPoints: 0,
        avgVectorSize: 0,
        storageSize: 0,
      };
    }
  }

  return stats as RAGMetrics["collections"];
}

/**
 * Obtém estatísticas de uma collection específica
 */
async function getCollectionStats(collectionName: string): Promise<CollectionStats> {
  const client = await getQdrantClient();

  // Count total points
  const countResult = await client.count(collectionName);
  const totalPoints = countResult.count;

  // Get collection info
  const collectionInfo = await client.getCollection(collectionName);
  const vectorSize = collectionInfo.config?.params?.vectors?.size || 0;

  // Estima storage: points × (vector_size × 4 bytes + payload ~2KB)
  const vectorBytes = vectorSize * 4;
  const payloadBytes = 2048; // Estimativa
  const storageSize = Math.round((totalPoints * (vectorBytes + payloadBytes)) / 1024); // KB

  return {
    name: collectionName,
    totalPoints,
    avgVectorSize: vectorSize,
    storageSize,
  };
}

/**
 * Formata métricas para exibição no terminal
 */
export function formatRAGMetrics(metrics: RAGMetrics): string {
  const sections: string[] = [];

  // Header
  sections.push(chalk.bold.cyan("\n╔══════════════════════════════════════════════════╗"));
  sections.push(chalk.bold.cyan("║         FazAI RAG System Metrics                 ║"));
  sections.push(chalk.bold.cyan("╚══════════════════════════════════════════════════╝\n"));

  // Neural Flow
  sections.push(chalk.bold.yellow("🧠 Neural Flow Performance"));
  sections.push(`   Total Queries:     ${metrics.neuralFlow.totalQueries.toLocaleString()}`);
  sections.push(`   Hits:              ${metrics.neuralFlow.hits.toLocaleString()} ${chalk.green("✓")}`);
  sections.push(`   Misses:            ${metrics.neuralFlow.misses.toLocaleString()} ${chalk.red("✗")}`);
  sections.push(
    `   Hit Rate:          ${colorizeHitRate(metrics.neuralFlow.hitRate)}%`
  );
  sections.push(
    `   Avg Query Time:    ${metrics.neuralFlow.avgQueryTime.toFixed(0)}ms`
  );
  sections.push("");

  // Semantic Cache
  sections.push(chalk.bold.yellow("💾 Semantic Cache"));
  sections.push(
    `   Total Entries:     ${metrics.semanticCache.totalEntries.toLocaleString()}`
  );
  sections.push(`   Cache Hits:        ${metrics.semanticCache.hits.toLocaleString()} ${chalk.green("✓")}`);
  sections.push(`   Cache Misses:      ${metrics.semanticCache.misses.toLocaleString()} ${chalk.red("✗")}`);
  sections.push(
    `   Hit Rate:          ${colorizeHitRate(metrics.semanticCache.hitRate)}%`
  );
  sections.push(`   Avg Age:           ${metrics.semanticCache.avgAge}s`);
  sections.push(`   Storage Size:      ${metrics.semanticCache.storageSize} KB`);
  sections.push("");

  // Learning Patterns
  sections.push(chalk.bold.yellow("📚 Learning Patterns"));
  sections.push(
    `   Total Patterns:    ${metrics.learning.totalPatterns.toLocaleString()}`
  );
  sections.push(
    `   Avg Confidence:    ${colorizeConfidence(metrics.learning.avgConfidence)}`
  );
  sections.push(
    `   Avg Applications:  ${metrics.learning.avgApplications.toFixed(1)}`
  );
  sections.push(
    `   Success Rate:      ${colorizeHitRate(metrics.learning.successRate)}%`
  );
  sections.push("");

  // By Category
  if (Object.keys(metrics.learning.byCategory).length > 0) {
    sections.push(chalk.bold.gray("   By Category:"));
    const sortedCategories = Object.entries(metrics.learning.byCategory).sort(
      ([, a], [, b]) => b - a
    );
    for (const [category, count] of sortedCategories.slice(0, 5)) {
      const bar = createBar(count, metrics.learning.totalPatterns);
      sections.push(`     ${category.padEnd(15)} ${bar} ${count}`);
    }
    sections.push("");
  }

  // Collections
  sections.push(chalk.bold.yellow("🗂️  Collections"));
  const collectionsList = [
    { name: "Personality", key: "personality" as const },
    { name: "Memory", key: "memory" as const },
    { name: "Learning", key: "learning" as const },
    { name: "Knowledge Base", key: "kb" as const },
    { name: "Inference", key: "inference" as const },
  ];

  for (const { name, key } of collectionsList) {
    const stats = metrics.collections[key];
    sections.push(
      `   ${name.padEnd(16)} ${stats.totalPoints.toString().padStart(5)} points  ` +
        `(${stats.storageSize} KB)`
    );
  }

  sections.push("");
  return sections.join("\n");
}

/**
 * Coloriza hit rate baseado em thresholds
 */
function colorizeHitRate(rate: number): string {
  const formatted = rate.toFixed(1);
  if (rate >= 70) return chalk.green(formatted);
  if (rate >= 50) return chalk.yellow(formatted);
  if (rate >= 30) return chalk.orange(formatted);
  return chalk.red(formatted);
}

/**
 * Coloriza confidence score
 */
function colorizeConfidence(confidence: number): string {
  const formatted = confidence.toFixed(2);
  if (confidence >= 0.9) return chalk.green(formatted);
  if (confidence >= 0.7) return chalk.yellow(formatted);
  return chalk.orange(formatted);
}

/**
 * Cria barra de progresso ASCII
 */
function createBar(value: number, max: number, width: number = 20): string {
  const percentage = Math.min(1, value / max);
  const filled = Math.round(width * percentage);
  const empty = width - filled;

  return chalk.cyan("█".repeat(filled)) + chalk.gray("░".repeat(empty));
}

/**
 * Exporta métricas para JSON
 */
export async function exportMetricsToJSON(
  outputPath: string
): Promise<void> {
  const metrics = await collectRAGMetrics();
  const fs = await import("fs/promises");

  const json = JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      metrics,
    },
    null,
    2
  );

  await fs.writeFile(outputPath, json, "utf-8");
  logger.info(`✅ Métricas exportadas para: ${outputPath}`);
}

/**
 * Compara métricas ao longo do tempo
 */
export interface MetricsTrend {
  current: RAGMetrics;
  previous?: RAGMetrics;
  changes: {
    neuralFlowHitRate: number;
    cacheHitRate: number;
    learningPatterns: number;
    avgConfidence: number;
  };
}

/**
 * Analisa tendências de métricas
 */
export async function analyzeMetricsTrend(
  previousMetrics?: RAGMetrics
): Promise<MetricsTrend> {
  const current = await collectRAGMetrics();

  if (!previousMetrics) {
    return {
      current,
      changes: {
        neuralFlowHitRate: 0,
        cacheHitRate: 0,
        learningPatterns: 0,
        avgConfidence: 0,
      },
    };
  }

  return {
    current,
    previous: previousMetrics,
    changes: {
      neuralFlowHitRate: current.neuralFlow.hitRate - previousMetrics.neuralFlow.hitRate,
      cacheHitRate: current.semanticCache.hitRate - previousMetrics.semanticCache.hitRate,
      learningPatterns: current.learning.totalPatterns - previousMetrics.learning.totalPatterns,
      avgConfidence: current.learning.avgConfidence - previousMetrics.learning.avgConfidence,
    },
  };
}
