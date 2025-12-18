/**
 * Neural Flow - Multi-Collection RAG with Fusion Scoring
 *
 * Sistema de busca neural que combina resultados de múltiplas collections Qdrant
 * usando fusion scoring ponderado por relevância, recência e categoria.
 *
 * Estratégia de Fusion Scoring:
 * - Personality (15%): Como responder baseado em expertise e estilo
 * - Memory (20%): Contexto histórico de conversas e ações
 * - Learning (30%): Padrões aprendidos e soluções validadas
 * - KB (25%): Conhecimento técnico documentado
 * - Inference (10%): Regras operacionais e políticas
 *
 * Features:
 * - Busca paralela em 5 collections
 * - Re-ranking por relevância semântica + recência
 * - Boost temporal para informações mais recentes
 * - Filtragem por score mínimo
 * - Logging detalhado para debugging
 *
 * @module rag/neural-flow
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { logger } from "../logger";
import { getConfigValue } from "../config";
import { withRetry } from "../utils/retry";

/**
 * Resultado de busca em uma collection
 */
export interface CollectionResult {
  collection: string;
  points: Array<{
    id: string | number;
    score: number;
    payload: Record<string, any>;
    vector?: number[];
  }>;
}

/**
 * Resultado fusionado com score ponderado
 */
export interface FusedResult {
  collection: string;
  content: string;
  score: number; // Fusion score (0-1)
  metadata: Record<string, any>;
  id: string | number;
  vectorScore: number; // Score original do Qdrant
  recencyBoost: number; // Multiplicador de recência (0.5-1.2)
}

/**
 * Resultado completo de busca neural multi-collection
 */
export interface NeuralQueryResult {
  query: string;
  embedding: number[];
  results: CollectionResult[];
  fusedResults: FusedResult[];
  totalTime: number;
  stats: {
    totalPoints: number;
    collectionsQueried: number;
    averageScore: number;
    topScore: number;
  };
}

/**
 * Opções de busca neural
 */
export interface NeuralQueryOptions {
  /**
   * Número de resultados por collection (default: 5)
   */
  k?: number;

  /**
   * Top K resultados fusionados finais (default: 10)
   */
  topK?: number;

  /**
   * Incluir embedding no resultado (default: false)
   */
  includeEmbedding?: boolean;

  /**
   * Pesos customizados por collection (devem somar 1.0)
   */
  weights?: {
    personality?: number;
    memory?: number;
    learning?: number;
    kb?: number;
    inference?: number;
  };

  /**
   * Score mínimo para incluir no resultado (default: 0.3)
   */
  minScore?: number;

  /**
   * Collections específicas para buscar (default: todas)
   */
  collections?: string[];

  /**
   * Filtros adicionais por collection
   */
  filters?: Record<string, Record<string, any>>;
}

/**
 * Pesos padrão de fusion scoring
 * Baseados na relevância típica de cada collection
 */
const DEFAULT_WEIGHTS = {
  personality: 0.0, // Desabilitado para busca geral (foco em fatos)
  memory: 0.20, // Contexto histórico
  learning: 0.40, // Padrões aprendidos (mais importante)
  kb: 0.30, // Conhecimento técnico
  inference: 0.10, // Regras operacionais
} as const;

/**
 * Collections disponíveis no sistema
 */
const AVAILABLE_COLLECTIONS = [
  "fazai_personality",
  "fazai_memory",
  "fazai_learning",
  "fazai_kb",
  "fazai_inference",
] as const;

/**
 * Busca neural multi-collection com fusion scoring
 *
 * Realiza busca semântica em múltiplas collections Qdrant em paralelo,
 * combina os resultados com pesos específicos e aplica re-ranking.
 *
 * @param query Query de busca em linguagem natural
 * @param embedding Embedding pré-calculado da query (se disponível)
 * @param options Opções de configuração da busca
 * @returns Resultados fusionados e ordenados por relevância
 *
 * @example
 * ```typescript
 * const result = await neuralQuery(
 *   "Como configurar nginx como reverse proxy?",
 *   embeddingVector,
 *   { topK: 5, minScore: 0.5 }
 * );
 *
 * console.log(`Found ${result.fusedResults.length} relevant results`);
 * for (const r of result.fusedResults) {
 *   console.log(`[${r.collection}] (${r.score.toFixed(3)}) ${r.content}`);
 * }
 * ```
 */
export async function neuralQuery(
  query: string,
  embedding: number[],
  options: NeuralQueryOptions = {}
): Promise<NeuralQueryResult> {
  const startTime = Date.now();
  const k = options.k ?? 5;
  const topK = options.topK ?? 10;
  const minScore = options.minScore ?? 0.3;
  const collectionsToQuery = options.collections ?? AVAILABLE_COLLECTIONS;

  // Validar e normalizar pesos
  const weights = normalizeWeights(options.weights ?? DEFAULT_WEIGHTS);

  logger.info(`🧠 Neural Query: "${query.substring(0, 60)}${query.length > 60 ? "..." : ""}"`);
  logger.debug(`Query params: k=${k}, topK=${topK}, minScore=${minScore}`);

  // 1. Busca paralela nas collections
  const client = getQdrantClient();
  const searchPromises = collectionsToQuery.map(async (collection) => {
    return searchCollection(client, collection, embedding, k, options.filters?.[collection]);
  });

  const results = await Promise.all(searchPromises);

  // 2. Fusion scoring
  const fusedResults: FusedResult[] = [];

  for (const result of results) {
    const collectionName = result.collection.replace("fazai_", "");
    const weight = weights[collectionName as keyof typeof weights] ?? 0.1;

    for (const point of result.points) {
      // Score fusionado = vector_similarity * collection_weight * recency_boost
      const vectorScore = point.score;
      const recencyBoost = calculateRecencyBoost(point.payload);
      const fusedScore = vectorScore * weight * recencyBoost;

      // Filtrar por score mínimo
      if (fusedScore < minScore) {
        continue;
      }

      fusedResults.push({
        collection: result.collection,
        content: extractContent(point.payload),
        score: fusedScore,
        metadata: point.payload,
        id: point.id,
        vectorScore,
        recencyBoost,
      });
    }
  }

  // 3. Re-ranking por score fusionado (descendente)
  fusedResults.sort((a, b) => b.score - a.score);

  // 4. Top-K final
  const topResults = fusedResults.slice(0, topK);

  // 5. Estatísticas
  const stats = calculateStats(fusedResults);

  const totalTime = Date.now() - startTime;
  logger.info(
    `✅ Neural query completed in ${totalTime}ms | ` +
    `${topResults.length}/${fusedResults.length} results (top-${topK})`
  );

  if (topResults.length > 0) {
    logger.debug(`Top result: [${topResults[0].collection}] score=${topResults[0].score.toFixed(3)}`);
  }

  return {
    query,
    embedding: options.includeEmbedding ? embedding : [],
    results,
    fusedResults: topResults,
    totalTime,
    stats,
  };
}

/**
 * Busca em uma collection específica com retry logic
 */
async function searchCollection(
  client: QdrantClient,
  collection: string,
  embedding: number[],
  limit: number,
  filter?: Record<string, any>
): Promise<CollectionResult> {
  try {
    const searchResult = await withRetry(
      async () => {
        return client.search(collection, {
          vector: embedding,
          limit,
          with_payload: true,
          filter,
        });
      },
      {
        provider: "qdrant",
        maxRetries: 2,
      }
    );

    logger.debug(`${collection}: ${searchResult.length} results`);

    return {
      collection,
      points: searchResult.map((p) => ({
        id: p.id,
        score: p.score,
        payload: p.payload || {},
        vector: p.vector as number[] | undefined,
      })),
    };
  } catch (error: any) {
    logger.warn(`Failed to search ${collection}: ${error.message}`);
    return { collection, points: [] };
  }
}

/**
 * Calcula boost de recência temporal
 *
 * Implementa decaimento exponencial:
 * - 0 dias: 1.2x boost
 * - 30 dias: 1.0x (sem boost)
 * - 90 dias: 0.8x
 * - 180+ dias: 0.5x (mínimo)
 *
 * @param payload Payload do ponto Qdrant
 * @returns Multiplicador de boost (0.5-1.2)
 */
function calculateRecencyBoost(payload: Record<string, any>): number {
  // Tenta múltiplos campos de timestamp
  const timestamp =
    payload.timestamp ||
    payload.created_at ||
    payload.learned_at ||
    payload.last_applied ||
    payload.last_used_at;

  if (!timestamp) {
    return 1.0; // Sem timestamp, sem boost/penalidade
  }

  try {
    const age = Date.now() - new Date(timestamp).getTime();
    const daysOld = age / (1000 * 60 * 60 * 24);

    // Fórmula: 1.2 - (daysOld / 150)
    // 0 dias = 1.2x
    // 30 dias = 1.0x
    // 150 dias = 0.2x → clamp to 0.5
    const boost = Math.max(0.5, Math.min(1.2, 1.2 - daysOld / 150));

    return boost;
  } catch (error) {
    logger.debug(`Invalid timestamp format: ${timestamp}`);
    return 1.0;
  }
}

/**
 * Extrai conteúdo textual relevante do payload
 *
 * Prioriza campos com conteúdo semântico rico.
 *
 * @param payload Payload do ponto Qdrant
 * @returns String de conteúdo para apresentação
 */
function extractContent(payload: Record<string, any>): string {
  // Ordem de prioridade para extração de conteúdo
  const contentFields = [
    "content",
    "description",
    "summary",
    "problem",
    "solution",
    "title",
    "value",
    "name",
  ];

  for (const field of contentFields) {
    if (payload[field] && typeof payload[field] === "string") {
      // Limita a 500 caracteres para evitar resultados gigantes
      const content = payload[field];
      return content.length > 500 ? content.substring(0, 500) + "..." : content;
    }
  }

  // Fallback: serializa payload completo (limitado)
  const fallback = JSON.stringify(payload);
  return fallback.length > 200 ? fallback.substring(0, 200) + "..." : fallback;
}

/**
 * Normaliza pesos para somar 1.0
 *
 * Garante que os pesos sejam válidos e proporcionais.
 */
function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const sum = Object.values(weights).reduce((acc, w) => acc + w, 0);

  if (Math.abs(sum - 1.0) < 0.001) {
    return weights; // Já normalizado
  }

  if (sum === 0) {
    logger.warn("All weights are zero, using defaults");
    return DEFAULT_WEIGHTS;
  }

  // Normaliza dividindo pela soma
  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(weights)) {
    normalized[key] = value / sum;
  }

  logger.debug(`Weights normalized: ${JSON.stringify(normalized)}`);
  return normalized;
}

/**
 * Calcula estatísticas dos resultados
 */
function calculateStats(results: FusedResult[]): {
  totalPoints: number;
  collectionsQueried: number;
  averageScore: number;
  topScore: number;
} {
  if (results.length === 0) {
    return {
      totalPoints: 0,
      collectionsQueried: 0,
      averageScore: 0,
      topScore: 0,
    };
  }

  const uniqueCollections = new Set(results.map((r) => r.collection));
  const totalScore = results.reduce((sum, r) => sum + r.score, 0);
  const averageScore = totalScore / results.length;
  const topScore = results[0]?.score ?? 0;

  return {
    totalPoints: results.length,
    collectionsQueried: uniqueCollections.size,
    averageScore,
    topScore,
  };
}

/**
 * Obtém cliente Qdrant configurado
 *
 * Singleton pattern para reutilizar conexão.
 */
let qdrantClientInstance: QdrantClient | null = null;

function getQdrantClient(): QdrantClient {
  if (qdrantClientInstance) {
    return qdrantClientInstance;
  }

  const url = getConfigValue("QDRANT_URL") || process.env.QDRANT_URL || "http://localhost:6333";
  const apiKey = getConfigValue("QDRANT_API_KEY") || process.env.QDRANT_API_KEY;

  qdrantClientInstance = new QdrantClient({
    url,
    apiKey,
  });

  logger.debug(`Qdrant client initialized: ${url}`);
  return qdrantClientInstance;
}

/**
 * Helper: Busca por filtro adicional
 *
 * Útil para filtrar por categoria, tags, etc.
 *
 * @example
 * ```typescript
 * const results = await neuralQuery(query, embedding, {
 *   filters: {
 *     fazai_kb: { category: "networking" },
 *     fazai_learning: { validated: true }
 *   }
 * });
 * ```
 */
export function createCategoryFilter(category: string): Record<string, any> {
  return {
    must: [
      {
        key: "category",
        match: { value: category },
      },
    ],
  };
}

/**
 * Helper: Busca apenas em collections específicas
 *
 * @example
 * ```typescript
 * // Busca apenas em KB e Learning (ignora Memory, Personality, Inference)
 * const results = await neuralQuery(query, embedding, {
 *   collections: ["fazai_kb", "fazai_learning"]
 * });
 * ```
 */
export function createCollectionSubset(
  ...collections: Array<"personality" | "memory" | "learning" | "kb" | "inference">
): string[] {
  return collections.map((c) => `fazai_${c}`);
}
