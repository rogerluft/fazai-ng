/**
 * RAG System - Multi-Collection Neural Flow with Auto-Learning
 *
 * Sistema completo de RAG (Retrieval-Augmented Generation) para FazAI
 * com busca neural multi-collection, fusion scoring e auto-aprendizado.
 *
 * Módulos:
 * - neural-flow: Busca multi-collection com fusion scoring
 * - auto-learning: Sistema de captura e aprendizado contínuo
 * - interaction-logger: Análise de uso e performance
 *
 * @module rag
 */

// Neural Flow
export {
  neuralQuery,
  createCategoryFilter,
  createCollectionSubset,
  type NeuralQueryOptions,
  type NeuralQueryResult,
  type CollectionResult,
  type FusedResult,
} from "./neural-flow";

// Auto-Learning
export {
  captureLearning,
  incrementLearningApplication,
  findSimilarLearnings,
  getTopLearningsByCategory,
  markLearningAsValidated,
  type LearningCapture,
  type LearningType,
  type LearningOutcome,
  type LearningStats,
} from "./auto-learning";

// Interaction Logger
export {
  interactionLogger,
  logQuerySuccess,
  logQueryFailure,
  InteractionLogger,
  type InteractionEvent,
  type QueryType,
  type QueryOutcome,
  type UsageStatistics,
} from "./interaction-logger";

// Metrics and Analytics
export {
  collectRAGMetrics,
  formatRAGMetrics,
  exportMetricsToJSON,
  analyzeMetricsTrend,
  type RAGMetrics,
  type CollectionStats,
  type QueryPerformanceMetrics,
  type MetricsTrend,
} from "./metrics";
