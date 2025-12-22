/**
 * Memory Loader Service
 *
 * Gerencia persistencia e recuperacao de memorias de conversacao
 * no Qdrant, permitindo contexto semantico entre sessoes.
 *
 * Features:
 * - Busca semantica em `fazai_memory` por similaridade
 * - Armazenamento de novas memorias com embeddings
 * - Sumarizacao de memorias para contexto compacto
 * - Graceful degradation quando Qdrant offline
 * - Integracao com embedding service existente
 *
 * @module services/memory-loader
 */

import { randomUUID } from "crypto";
import { logger } from "../logger";
import { qdrantPool, getQdrantClient } from "../database/qdrant-pool";
import { createEmbeddingService } from "./embeddings";
import { withRetry } from "../utils/retry";

const MEMORY_COLLECTION = "fazai_memory";

/**
 * Entrada de memoria para armazenamento
 */
export interface MemoryEntry {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  embedding?: number[];
  sessionId?: string;
  context?: string;
  importance?: number; // 0-1, usado para priorizacao
  tags?: string[];
}

/**
 * Memoria recuperada do Qdrant
 */
export interface Memory {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  score: number; // Similaridade semantica
  sessionId?: string;
  context?: string;
  importance?: number;
  tags?: string[];
}

/**
 * Opcoes para busca de memorias
 */
export interface MemorySearchOptions {
  /**
   * Numero maximo de memorias a retornar
   * Default: 5
   */
  limit?: number;

  /**
   * Score minimo de similaridade (0-1)
   * Default: 0.5
   */
  minScore?: number;

  /**
   * Idade maxima em milissegundos
   * Default: 7 dias
   */
  maxAge?: number;

  /**
   * Filtrar por role especifico
   */
  role?: "user" | "assistant";

  /**
   * Filtrar por session
   */
  sessionId?: string;
}

/**
 * Carrega memorias relevantes do Qdrant baseado em similaridade semantica
 *
 * Busca conversas anteriores que sao semanticamente similares ao input atual,
 * permitindo que a IA tenha contexto de interacoes passadas.
 *
 * @param query - Texto do input atual do usuario
 * @param options - Opcoes de busca
 * @returns Array de memorias relevantes ordenadas por similaridade
 *
 * @example
 * ```typescript
 * const memories = await loadRelevantMemories("Como configurar nginx?");
 * console.log(`Found ${memories.length} relevant memories`);
 * ```
 */
export async function loadRelevantMemories(
  query: string,
  options: MemorySearchOptions = {}
): Promise<Memory[]> {
  const limit = options.limit ?? 5;
  const minScore = options.minScore ?? 0.5;
  const maxAge = options.maxAge ?? 7 * 24 * 60 * 60 * 1000; // 7 dias

  // Verifica disponibilidade do Qdrant
  if (!qdrantPool.isAvailable()) {
    logger.debug("Qdrant unavailable, skipping memory search");
    return [];
  }

  try {
    const startTime = Date.now();

    // 1. Gera embedding da query
    const embeddingService = await createEmbeddingService();
    const queryEmbedding = await embeddingService.generate(query);

    // 2. Monta filtros
    const filter: Record<string, unknown> = {
      must: [] as Array<Record<string, unknown>>,
    };

    const mustFilters = filter.must as Array<Record<string, unknown>>;

    // Filtro de idade
    const minTimestamp = new Date(Date.now() - maxAge).toISOString();
    mustFilters.push({
      key: "timestamp",
      range: {
        gte: minTimestamp,
      },
    });

    // Filtro de role (opcional)
    if (options.role) {
      mustFilters.push({
        key: "role",
        match: { value: options.role },
      });
    }

    // Filtro de session (opcional)
    if (options.sessionId) {
      mustFilters.push({
        key: "sessionId",
        match: { value: options.sessionId },
      });
    }

    // 3. Busca semantica no Qdrant
    const client = await getQdrantClient();

    // Verifica se collection existe
    const collections = await client.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === MEMORY_COLLECTION
    );

    if (!exists) {
      logger.debug(`Collection ${MEMORY_COLLECTION} not found`);
      return [];
    }

    const results = await client.search(MEMORY_COLLECTION, {
      vector: queryEmbedding,
      limit: limit * 2, // Busca mais para filtrar por score depois
      with_payload: true,
      filter: mustFilters.length > 0 ? filter : undefined,
    });

    // 4. Filtra e formata resultados
    const memories: Memory[] = [];

    for (const point of results) {
      if (point.score < minScore) continue;

      const payload = point.payload as Record<string, unknown>;

      memories.push({
        id: String(point.id),
        role: (payload.role as Memory["role"]) || "user",
        content: String(payload.content || ""),
        timestamp: String(payload.timestamp || new Date().toISOString()),
        score: point.score,
        sessionId: payload.sessionId ? String(payload.sessionId) : undefined,
        context: payload.context ? String(payload.context) : undefined,
        importance: typeof payload.importance === "number" ? payload.importance : undefined,
        tags: Array.isArray(payload.tags) ? payload.tags.map(String) : undefined,
      });

      if (memories.length >= limit) break;
    }

    const elapsed = Date.now() - startTime;
    logger.debug(
      `Memory search completed in ${elapsed}ms: ${memories.length} relevant memories ` +
      `(query: "${query.substring(0, 40)}...")`
    );

    return memories;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.debug(`Memory search failed: ${err.message}`);
    return [];
  }
}

/**
 * Armazena uma nova memoria no Qdrant
 *
 * Gera embedding e persiste a memoria para recuperacao futura.
 * Usado apos cada turno de conversacao.
 *
 * @param memory - Entrada de memoria a ser armazenada
 * @returns ID da memoria armazenada ou null em caso de falha
 *
 * @example
 * ```typescript
 * await storeMemoryInQdrant({
 *   role: "user",
 *   content: "Como configurar nginx?",
 *   timestamp: new Date().toISOString()
 * });
 * ```
 */
export async function storeMemoryInQdrant(
  memory: MemoryEntry
): Promise<string | null> {
  // Verifica disponibilidade do Qdrant
  if (!qdrantPool.isAvailable()) {
    logger.debug("Qdrant unavailable, skipping memory storage");
    return null;
  }

  // Ignora conteudo muito curto
  if (memory.content.length < 10) {
    logger.debug("Memory content too short, skipping storage");
    return null;
  }

  try {
    const startTime = Date.now();

    // 1. Gera embedding se nao fornecido
    let embedding = memory.embedding;
    if (!embedding) {
      const embeddingService = await createEmbeddingService();
      embedding = await embeddingService.generate(memory.content);
    }

    // 2. Garante que collection existe
    await ensureMemoryCollection(embedding.length);

    // 3. Gera ID unico
    const id = randomUUID();

    // 4. Monta payload
    const payload: Record<string, unknown> = {
      role: memory.role,
      content: memory.content,
      timestamp: memory.timestamp,
      importance: memory.importance ?? calculateImportance(memory.content),
    };

    if (memory.sessionId) payload.sessionId = memory.sessionId;
    if (memory.context) payload.context = memory.context;
    if (memory.tags) payload.tags = memory.tags;

    // 5. Armazena no Qdrant
    const client = await getQdrantClient();

    await client.upsert(MEMORY_COLLECTION, {
      points: [
        {
          id,
          vector: embedding,
          payload,
        },
      ],
    });

    const elapsed = Date.now() - startTime;
    logger.debug(
      `Memory stored in ${elapsed}ms: ${id} (role: ${memory.role}, ` +
      `length: ${memory.content.length} chars)`
    );

    return id;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.debug(`Memory storage failed: ${err.message}`);
    return null;
  }
}

/**
 * Garante que a collection de memoria existe
 */
async function ensureMemoryCollection(dimension: number): Promise<void> {
  try {
    const client = await getQdrantClient();

    const collections = await client.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === MEMORY_COLLECTION
    );

    if (!exists) {
      logger.info(`Creating memory collection: ${MEMORY_COLLECTION}`);

      await client.createCollection(MEMORY_COLLECTION, {
        vectors: {
          size: dimension,
          distance: "Cosine",
        },
      });

      // Cria indices para filtragem eficiente
      await client.createPayloadIndex(MEMORY_COLLECTION, {
        field_name: "role",
        field_schema: "keyword",
      });

      await client.createPayloadIndex(MEMORY_COLLECTION, {
        field_name: "timestamp",
        field_schema: "keyword",
      });

      await client.createPayloadIndex(MEMORY_COLLECTION, {
        field_name: "sessionId",
        field_schema: "keyword",
      });

      logger.info(`Memory collection created: ${MEMORY_COLLECTION}`);
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.debug(`Failed to ensure memory collection: ${err.message}`);
  }
}

/**
 * Calcula importancia baseada no conteudo
 *
 * Heuristica simples: conteudo mais longo e com palavras-chave tecnicas
 * recebe maior importancia.
 */
function calculateImportance(content: string): number {
  const lower = content.toLowerCase();
  let importance = 0.5; // Base

  // Comprimento contribui
  if (content.length > 100) importance += 0.1;
  if (content.length > 500) importance += 0.1;

  // Palavras-chave tecnicas
  const techKeywords = [
    "error", "bug", "fix", "configure", "install",
    "nginx", "docker", "kubernetes", "firewall",
    "importante", "urgente", "critico", "lembrar"
  ];

  for (const keyword of techKeywords) {
    if (lower.includes(keyword)) {
      importance += 0.05;
    }
  }

  // Clamp to 0-1
  return Math.min(1, Math.max(0, importance));
}

/**
 * Sumariza array de memorias para contexto compacto
 *
 * Gera um resumo textual das memorias para injecao no contexto
 * da conversa sem consumir muitos tokens.
 *
 * @param memories - Array de memorias a sumarizar
 * @param maxLength - Comprimento maximo do resumo em caracteres
 * @returns String sumarizada das memorias
 */
export function summarizeMemories(
  memories: Memory[],
  maxLength: number = 800
): string {
  if (memories.length === 0) {
    return "";
  }

  const lines: string[] = [];
  lines.push("CONTEXTO DE CONVERSAS ANTERIORES:");

  let currentLength = lines[0].length;

  for (const memory of memories) {
    // Trunca conteudo individual
    const contentPreview = memory.content.length > 150
      ? memory.content.substring(0, 150) + "..."
      : memory.content;

    const line = `- [${memory.role}] ${contentPreview}`;

    if (currentLength + line.length > maxLength) {
      lines.push(`... e mais ${memories.length - lines.length + 1} memorias relevantes`);
      break;
    }

    lines.push(line);
    currentLength += line.length;
  }

  return lines.join("\n");
}

/**
 * Armazena batch de memorias de uma vez
 *
 * Mais eficiente que chamar storeMemoryInQdrant individualmente.
 *
 * @param memories - Array de memorias a armazenar
 * @returns Array de IDs armazenados
 */
export async function storeMemoriesBatch(
  memories: MemoryEntry[]
): Promise<string[]> {
  if (memories.length === 0) return [];

  // Verifica disponibilidade do Qdrant
  if (!qdrantPool.isAvailable()) {
    logger.debug("Qdrant unavailable, skipping batch memory storage");
    return [];
  }

  try {
    const startTime = Date.now();

    // 1. Gera embeddings em batch
    const embeddingService = await createEmbeddingService();
    const texts = memories.map((m) => m.content);
    const embeddings = await embeddingService.generateBatch(texts);

    // 2. Garante collection
    await ensureMemoryCollection(embeddings[0].length);

    // 3. Prepara pontos
    const points = memories.map((memory, index) => {
      const id = randomUUID();
      return {
        id,
        vector: embeddings[index],
        payload: {
          role: memory.role,
          content: memory.content,
          timestamp: memory.timestamp,
          importance: memory.importance ?? calculateImportance(memory.content),
          sessionId: memory.sessionId,
          context: memory.context,
          tags: memory.tags,
        },
      };
    });

    // 4. Armazena em batch
    const client = await getQdrantClient();
    await client.upsert(MEMORY_COLLECTION, { points });

    const ids = points.map((p) => p.id);
    const elapsed = Date.now() - startTime;

    logger.info(
      `Batch memory storage completed in ${elapsed}ms: ${ids.length} memories stored`
    );

    return ids;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.warn(`Batch memory storage failed: ${err.message}`);
    return [];
  }
}

/**
 * Remove memorias antigas para manter o tamanho da collection
 *
 * @param maxAge - Idade maxima em milissegundos
 * @returns Numero de memorias removidas
 */
export async function cleanupOldMemories(
  maxAge: number = 30 * 24 * 60 * 60 * 1000 // 30 dias default
): Promise<number> {
  if (!qdrantPool.isAvailable()) {
    return 0;
  }

  try {
    const client = await getQdrantClient();
    const cutoffDate = new Date(Date.now() - maxAge).toISOString();

    // Busca memorias antigas
    const result = await client.scroll(MEMORY_COLLECTION, {
      limit: 100,
      with_payload: true,
      filter: {
        must: [
          {
            key: "timestamp",
            range: {
              lt: cutoffDate,
            },
          },
        ],
      },
    });

    if (result.points.length === 0) {
      return 0;
    }

    // Remove memorias antigas
    const idsToDelete = result.points.map((p) => String(p.id));

    await client.delete(MEMORY_COLLECTION, {
      points: idsToDelete,
    });

    logger.info(`Cleaned up ${idsToDelete.length} old memories (older than ${maxAge}ms)`);
    return idsToDelete.length;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.debug(`Memory cleanup failed: ${err.message}`);
    return 0;
  }
}
