/**
 * Qdrant Collection Metrics Module
 *
 * Provides comprehensive metrics and monitoring for Qdrant collections:
 * - Collection size and storage estimation
 * - Point count, vector count, and indexing status
 * - Memory usage and disk space analysis
 * - Capacity alerts and recommendations
 * - Health checks and performance metrics
 *
 * Usage:
 *   import { getCollectionMetrics, getAllMetrics } from './orchestrator/qdrant-metrics';
 *
 *   // Get metrics for specific collection
 *   const metrics = await getCollectionMetrics('fazai_kb');
 *   console.log(`Storage: ${metrics.estimatedSizeMB}MB`);
 *
 *   // Get full system report
 *   const report = await getAllMetrics();
 *   console.log(report.summary.totalPoints);
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { getQdrantClient, qdrantPool } from "../database/qdrant-pool";
import { logger } from "../logger";
import { CircuitState } from "../resilience/circuit-breaker";

/**
 * Collection size details
 */
export interface CollectionSize {
  name: string;
  pointsCount: number;
  vectorsCount: number;
  indexedVectorsCount: number;
  segmentsCount: number;
  estimatedSizeMB: number;
  estimatedDiskUsageMB: number;
  status: "green" | "yellow" | "red";
  vectorDimension: number;
}

/**
 * System-wide metrics summary
 */
export interface MetricsSummary {
  totalCollections: number;
  totalPoints: number;
  totalVectors: number;
  totalEstimatedSizeMB: number;
  totalEstimatedDiskUsageMB: number;
  qdrantStatus: "connected" | "disconnected" | "degraded";
  circuitBreakerState: CircuitState;
}

/**
 * Full metrics report
 */
export interface MetricsReport {
  timestamp: Date;
  summary: MetricsSummary;
  collections: CollectionSize[];
  alerts: MetricsAlert[];
  poolMetrics: {
    totalQueries: number;
    totalErrors: number;
    lastHealthCheck: Date | null;
    reconnectionAttempts: number;
    state: string;
  };
}

/**
 * Metrics alert
 */
export interface MetricsAlert {
  severity: "info" | "warning" | "critical";
  collection: string | null;
  message: string;
  recommendation: string;
}

/**
 * Capacity thresholds for alerts
 */
const THRESHOLDS = {
  POINTS_WARNING: 50000,      // Warn at 50k points
  POINTS_CRITICAL: 100000,    // Critical at 100k points
  SIZE_WARNING_MB: 500,       // Warn at 500MB
  SIZE_CRITICAL_MB: 1000,     // Critical at 1GB
  ERROR_RATE_WARNING: 0.05,   // 5% error rate
  ERROR_RATE_CRITICAL: 0.10,  // 10% error rate
};

/**
 * Get metrics for a specific collection
 *
 * @param name - Collection name
 * @returns Collection size and metrics
 */
export async function getCollectionSize(name: string): Promise<CollectionSize> {
  if (!qdrantPool.isAvailable()) {
    throw new Error("Qdrant is not available (circuit breaker is OPEN)");
  }

  try {
    const client = await getQdrantClient();
    const collection = await client.getCollection(name);

    // Calculate estimated size
    const vectorDimension = typeof collection.config?.params?.vectors === "object" && "size" in collection.config.params.vectors
      ? collection.config.params.vectors.size
      : 1536; // Default dimension

    const pointsCount = collection.points_count || 0;
    const vectorsCount = collection.vectors_count || 0;
    const indexedVectorsCount = collection.indexed_vectors_count || 0;
    const segmentsCount = collection.segments_count || 1;

    // Estimation: vector (4 bytes/float) + payload (~1KB average) + overhead (20%)
    const vectorSizeBytes = vectorDimension * 4;
    const payloadSizeBytes = 1024; // Average payload size
    const overheadMultiplier = 1.2;

    const estimatedSizeBytes = pointsCount * (vectorSizeBytes + payloadSizeBytes) * overheadMultiplier;
    const estimatedSizeMB = estimatedSizeBytes / (1024 * 1024);

    // Disk usage (with indexes, typically 1.5x memory)
    const estimatedDiskUsageMB = estimatedSizeMB * 1.5;

    // Status based on thresholds
    let status: "green" | "yellow" | "red" = "green";
    if (pointsCount >= THRESHOLDS.POINTS_CRITICAL || estimatedSizeMB >= THRESHOLDS.SIZE_CRITICAL_MB) {
      status = "red";
    } else if (pointsCount >= THRESHOLDS.POINTS_WARNING || estimatedSizeMB >= THRESHOLDS.SIZE_WARNING_MB) {
      status = "yellow";
    }

    return {
      name,
      pointsCount,
      vectorsCount,
      indexedVectorsCount,
      segmentsCount,
      estimatedSizeMB: Math.round(estimatedSizeMB * 100) / 100,
      estimatedDiskUsageMB: Math.round(estimatedDiskUsageMB * 100) / 100,
      status,
      vectorDimension,
    };
  } catch (error: any) {
    logger.error(`[Qdrant Metrics] Failed to get size for '${name}': ${error.message}`);
    throw error;
  }
}

/**
 * Get metrics for all collections
 *
 * @returns Complete metrics report
 */
export async function getAllMetrics(): Promise<MetricsReport> {
  const timestamp = new Date();
  const alerts: MetricsAlert[] = [];

  // Check circuit breaker state
  const circuitBreakerState = qdrantPool.getCircuitState();
  const poolMetrics = qdrantPool.getMetrics();

  let qdrantStatus: "connected" | "disconnected" | "degraded" = "connected";

  if (circuitBreakerState === CircuitState.OPEN) {
    qdrantStatus = "disconnected";
    alerts.push({
      severity: "critical",
      collection: null,
      message: "Qdrant circuit breaker is OPEN - service unavailable",
      recommendation: "Check Qdrant container status with 'fazai qdrant container status'",
    });
  } else if (circuitBreakerState === CircuitState.HALF_OPEN) {
    qdrantStatus = "degraded";
    alerts.push({
      severity: "warning",
      collection: null,
      message: "Qdrant circuit breaker is HALF_OPEN - testing recovery",
      recommendation: "Monitor system logs. Circuit may fully recover or reopen.",
    });
  }

  // If Qdrant is down, return minimal report
  if (!qdrantPool.isAvailable()) {
    return {
      timestamp,
      summary: {
        totalCollections: 0,
        totalPoints: 0,
        totalVectors: 0,
        totalEstimatedSizeMB: 0,
        totalEstimatedDiskUsageMB: 0,
        qdrantStatus,
        circuitBreakerState,
      },
      collections: [],
      alerts,
      poolMetrics,
    };
  }

  try {
    const client = await getQdrantClient();
    const collectionsResponse = await client.getCollections();
    const collectionNames = collectionsResponse.collections.map((c) => c.name);

    // Get metrics for each collection
    const collections: CollectionSize[] = [];
    for (const name of collectionNames) {
      try {
        const size = await getCollectionSize(name);
        collections.push(size);

        // Generate alerts for individual collections
        if (size.status === "red") {
          alerts.push({
            severity: "critical",
            collection: name,
            message: `Collection '${name}' has ${size.pointsCount} points (${size.estimatedSizeMB}MB)`,
            recommendation: "Consider archiving old data or implementing data retention policy",
          });
        } else if (size.status === "yellow") {
          alerts.push({
            severity: "warning",
            collection: name,
            message: `Collection '${name}' is growing: ${size.pointsCount} points (${size.estimatedSizeMB}MB)`,
            recommendation: "Monitor growth rate and plan for scaling",
          });
        }
      } catch (error: any) {
        logger.warn(`[Qdrant Metrics] Failed to get metrics for '${name}': ${error.message}`);
      }
    }

    // Calculate summary
    const summary: MetricsSummary = {
      totalCollections: collections.length,
      totalPoints: collections.reduce((sum, c) => sum + c.pointsCount, 0),
      totalVectors: collections.reduce((sum, c) => sum + c.vectorsCount, 0),
      totalEstimatedSizeMB: Math.round(
        collections.reduce((sum, c) => sum + c.estimatedSizeMB, 0) * 100
      ) / 100,
      totalEstimatedDiskUsageMB: Math.round(
        collections.reduce((sum, c) => sum + c.estimatedDiskUsageMB, 0) * 100
      ) / 100,
      qdrantStatus,
      circuitBreakerState,
    };

    // Check error rate
    const totalOperations = poolMetrics.totalQueries;
    const errorRate = totalOperations > 0 ? poolMetrics.totalErrors / totalOperations : 0;

    if (errorRate >= THRESHOLDS.ERROR_RATE_CRITICAL) {
      alerts.push({
        severity: "critical",
        collection: null,
        message: `High error rate: ${(errorRate * 100).toFixed(1)}% (${poolMetrics.totalErrors}/${totalOperations})`,
        recommendation: "Investigate connection issues or query failures",
      });
    } else if (errorRate >= THRESHOLDS.ERROR_RATE_WARNING) {
      alerts.push({
        severity: "warning",
        collection: null,
        message: `Elevated error rate: ${(errorRate * 100).toFixed(1)}% (${poolMetrics.totalErrors}/${totalOperations})`,
        recommendation: "Review logs for recurring errors",
      });
    }

    return {
      timestamp,
      summary,
      collections,
      alerts,
      poolMetrics,
    };
  } catch (error: any) {
    logger.error(`[Qdrant Metrics] Failed to generate report: ${error.message}`);
    throw error;
  }
}

/**
 * Estimate storage needs for a given number of points
 *
 * @param pointsCount - Number of points
 * @param vectorDimension - Vector dimension (default: 1536)
 * @param avgPayloadSizeKB - Average payload size in KB (default: 1)
 * @returns Estimated storage in MB
 */
export function estimateStorageNeeds(
  pointsCount: number,
  vectorDimension: number = 1536,
  avgPayloadSizeKB: number = 1
): number {
  const vectorSizeBytes = vectorDimension * 4; // 4 bytes per float32
  const payloadSizeBytes = avgPayloadSizeKB * 1024;
  const overheadMultiplier = 1.2; // 20% overhead for indexes/metadata

  const totalSizeBytes = pointsCount * (vectorSizeBytes + payloadSizeBytes) * overheadMultiplier;
  const totalSizeMB = totalSizeBytes / (1024 * 1024);

  return Math.round(totalSizeMB * 100) / 100;
}

/**
 * Get capacity recommendations based on current metrics
 *
 * @returns Array of recommendations
 */
export async function getCapacityRecommendations(): Promise<string[]> {
  const recommendations: string[] = [];

  try {
    const report = await getAllMetrics();

    // Overall system recommendations
    if (report.summary.totalEstimatedSizeMB > 800) {
      recommendations.push(
        "System approaching 1GB storage. Consider implementing data retention policies."
      );
    }

    if (report.summary.totalPoints > 80000) {
      recommendations.push(
        "Total points approaching 100k. Consider archiving historical data."
      );
    }

    // Per-collection recommendations
    for (const collection of report.collections) {
      if (collection.indexedVectorsCount < collection.vectorsCount * 0.8) {
        recommendations.push(
          `Collection '${collection.name}': Only ${
            ((collection.indexedVectorsCount / collection.vectorsCount) * 100).toFixed(1)
          }% vectors indexed. Performance may be degraded.`
        );
      }

      if (collection.segmentsCount > 10) {
        recommendations.push(
          `Collection '${collection.name}': High segment count (${collection.segmentsCount}). Consider optimization.`
        );
      }
    }

    // Circuit breaker recommendations
    if (report.summary.circuitBreakerState === CircuitState.OPEN) {
      recommendations.push(
        "Circuit breaker is OPEN. Service is unavailable. Check Qdrant container health."
      );
    }

    // Error rate recommendations
    const errorRate =
      report.poolMetrics.totalQueries > 0
        ? report.poolMetrics.totalErrors / report.poolMetrics.totalQueries
        : 0;

    if (errorRate > 0.05) {
      recommendations.push(
        `Error rate is ${(errorRate * 100).toFixed(1)}%. Review logs for recurring failures.`
      );
    }

    return recommendations;
  } catch (error: any) {
    logger.error(`[Qdrant Metrics] Failed to generate recommendations: ${error.message}`);
    return ["Unable to generate recommendations: Qdrant service unavailable"];
  }
}

/**
 * Print metrics report to console (formatted)
 */
export function printMetricsReport(report: MetricsReport): void {
  console.log("\n═══════════════════════════════════════════════════");
  console.log("           QDRANT METRICS REPORT");
  console.log("═══════════════════════════════════════════════════\n");

  console.log(`Timestamp: ${report.timestamp.toISOString()}`);
  console.log(`Status: ${report.summary.qdrantStatus.toUpperCase()}`);
  console.log(`Circuit Breaker: ${report.summary.circuitBreakerState}`);
  console.log("");

  // Summary
  console.log("SUMMARY:");
  console.log(`  Total Collections: ${report.summary.totalCollections}`);
  console.log(`  Total Points: ${report.summary.totalPoints.toLocaleString()}`);
  console.log(`  Total Vectors: ${report.summary.totalVectors.toLocaleString()}`);
  console.log(`  Estimated Memory: ${report.summary.totalEstimatedSizeMB} MB`);
  console.log(`  Estimated Disk: ${report.summary.totalEstimatedDiskUsageMB} MB`);
  console.log("");

  // Collections
  if (report.collections.length > 0) {
    console.log("COLLECTIONS:");
    for (const coll of report.collections) {
      const statusIcon = coll.status === "green" ? "✓" : coll.status === "yellow" ? "⚠" : "✗";
      console.log(`  ${statusIcon} ${coll.name}:`);
      console.log(`      Points: ${coll.pointsCount.toLocaleString()}`);
      console.log(`      Vectors: ${coll.vectorsCount.toLocaleString()} (${coll.indexedVectorsCount.toLocaleString()} indexed)`);
      console.log(`      Dimension: ${coll.vectorDimension}D`);
      console.log(`      Segments: ${coll.segmentsCount}`);
      console.log(`      Size: ${coll.estimatedSizeMB} MB (disk: ${coll.estimatedDiskUsageMB} MB)`);
    }
    console.log("");
  }

  // Pool Metrics
  console.log("CONNECTION POOL:");
  console.log(`  Total Queries: ${report.poolMetrics.totalQueries}`);
  console.log(`  Total Errors: ${report.poolMetrics.totalErrors}`);
  console.log(`  Reconnection Attempts: ${report.poolMetrics.reconnectionAttempts}`);
  console.log(`  State: ${report.poolMetrics.state}`);
  console.log(`  Last Health Check: ${report.poolMetrics.lastHealthCheck?.toISOString() || "Never"}`);
  console.log("");

  // Alerts
  if (report.alerts.length > 0) {
    console.log("ALERTS:");
    for (const alert of report.alerts) {
      const icon = alert.severity === "critical" ? "🔴" : alert.severity === "warning" ? "🟡" : "🔵";
      const prefix = alert.collection ? `[${alert.collection}]` : "[SYSTEM]";
      console.log(`  ${icon} ${prefix} ${alert.message}`);
      console.log(`      → ${alert.recommendation}`);
    }
    console.log("");
  }

  console.log("═══════════════════════════════════════════════════\n");
}
