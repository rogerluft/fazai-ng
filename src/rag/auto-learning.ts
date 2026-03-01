/**
 * Auto-Learning System - Captura de Padrões e Aprendizado Contínuo
 *
 * Sistema que captura eventos de sucesso/falha em operações do FazAI
 * e os armazena na collection fazai_learning para aprendizado incremental.
 *
 * Features:
 * - Captura de erros operacionais e suas soluções
 * - Tracking de padrões bem-sucedidos
 * - Incremento de confiança por uso repetido
 * - Validação por feedback do usuário
 * - Categorização automática por contexto
 *
 * Workflow:
 * 1. Evento ocorre (erro, acerto, padrão identificado)
 * 2. Sistema captura contexto completo
 * 3. Gera embedding do aprendizado
 * 4. Armazena em fazai_learning
 * 5. Incrementa applied_count quando reutilizado
 * 6. Aumenta confidence score com uso validado
 *
 * @module rag/auto-learning
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { logger } from "../logger";
import { getConfigValue } from "../config";
import { withRetry } from "../utils/retry";
import { randomUUID } from "crypto";

/**
 * Tipos de aprendizado
 */
export type LearningType = "erro" | "acerto" | "padrão" | "otimização";

/**
 * Resultado de uma ação
 */
export type LearningOutcome = "sucesso" | "falha" | "parcial";

/**
 * Evento de aprendizado capturado
 */
export interface LearningCapture {
  /**
   * Tipo de aprendizado
   */
  type: LearningType;

  /**
   * Título resumido (max 256 chars)
   */
  title: string;

  /**
   * Descrição detalhada do aprendizado
   */
  description: string;

  /**
   * Contexto completo da situação
   */
  context: string;

  /**
   * Ação tomada (comando, decisão, etc.)
   */
  actionTaken?: string;

  /**
   * Resultado da ação
   */
  outcome: LearningOutcome;

  /**
   * Categoria (linux, network, security, docker, etc.)
   */
  category: string;

  /**
   * Tags para busca contextual
   */
  tags?: string[];

  /**
   * Confiança inicial (0.0-1.0)
   * Default: 0.9 para sucesso, 0.6 para falha/parcial
   */
  initialConfidence?: number;
}

/**
 * Estatísticas de um learning
 */
export interface LearningStats {
  learning_id: string;
  title: string;
  type: LearningType;
  category: string;
  applied_count: number;
  confidence: number;
  timestamp: string;
  last_applied?: string;
}

/**
 * Captura evento de aprendizado e armazena em fazai_learning
 *
 * Gera embedding do conteúdo e persiste no Qdrant para busca semântica futura.
 *
 * @param capture Dados do aprendizado capturado
 * @param embedding Embedding pré-calculado (opcional)
 * @returns ID do learning criado
 *
 * @example
 * ```typescript
 * await captureLearning({
 *   type: "erro",
 *   title: "Falha ao reiniciar nginx - config syntax error",
 *   description: "nginx -t reportou erro de sintaxe na linha 45",
 *   context: "Usuário adicionou upstream sem fechar bloco corretamente",
 *   actionTaken: "Corrigido fechamento de bloco upstream {} em nginx.conf",
 *   outcome: "sucesso",
 *   category: "nginx",
 *   tags: ["config", "syntax", "upstream"],
 * });
 * ```
 */
export async function captureLearning(
  capture: LearningCapture,
  embedding?: number[]
): Promise<string> {
  // Qdrant requires pure UUID (no prefix)
  const learningId = randomUUID();

  logger.info(`📚 Capturing learning: ${capture.title}`);
  logger.debug(`Type: ${capture.type}, Outcome: ${capture.outcome}, Category: ${capture.category}`);

  // Importa dinamicamente para evitar dependência circular
  const { createEmbeddingService } = await import("../services/embeddings");

  // Gera embedding se não fornecido
  let finalEmbedding: number[];
  if (embedding) {
    finalEmbedding = embedding;
  } else {
    const embeddingService = await createEmbeddingService();
    const textToEmbed = `${capture.title}\n${capture.description}\n${capture.context}`;
    finalEmbedding = await embeddingService.generate(textToEmbed);
    logger.debug(`Generated embedding (${finalEmbedding.length}D)`);
  }

  // Calcula confiança inicial
  const confidence = capture.initialConfidence ?? (capture.outcome === "sucesso" ? 0.9 : 0.6);

  // Monta payload
  const payload = {
    learning_id: learningId,
    type: capture.type,
    title: capture.title,
    description: capture.description,
    context: capture.context,
    action_taken: capture.actionTaken || null,
    outcome: capture.outcome,
    confidence,
    category: capture.category,
    timestamp: new Date().toISOString(),
    applied_count: 0,
    tags: capture.tags || [],
  };

  // Persiste no Qdrant
  const client = getQdrantClient();

  await withRetry(
    async () => {
      await client.upsert("fazai_learning", {
        points: [
          {
            id: learningId,
            vector: finalEmbedding,
            payload,
          },
        ],
      });
    },
    {
      provider: "qdrant",
      maxRetries: 3,
    }
  );

  logger.info(`✅ Learning captured: ${learningId}`);
  return learningId;
}

/**
 * Incrementa contador de aplicação de um learning
 *
 * Chamado quando um padrão aprendido é reutilizado com sucesso.
 * Aumenta confidence score gradualmente (max 0.99).
 *
 * @param learningId ID do learning
 * @param wasSuccessful Se a aplicação foi bem-sucedida (aumenta confidence)
 *
 * @example
 * ```typescript
 * // Após aplicar solução aprendida com sucesso
 * await incrementLearningApplication("learning_abc123", true);
 * ```
 */
export async function incrementLearningApplication(
  learningId: string,
  wasSuccessful: boolean = true
): Promise<void> {
  const client = getQdrantClient();

  try {
    // Buscar learning atual
    const results = await withRetry(
      async () => {
        return client.scroll("fazai_learning", {
          filter: {
            must: [
              {
                key: "learning_id",
                match: { value: learningId },
              },
            ],
          },
          limit: 1,
          with_payload: true,
        });
      },
      {
        provider: "qdrant",
        maxRetries: 2,
      }
    );

    if (results.points.length === 0) {
      logger.warn(`Learning ${learningId} not found`);
      return;
    }

    const point = results.points[0];
    const currentCount = (point.payload?.applied_count as number) || 0;
    const currentConfidence = (point.payload?.confidence as number) || 0.5;

    // Calcula novo confidence
    // Aumenta +0.05 por aplicação bem-sucedida, até max 0.99
    // Diminui -0.10 se falhou, até min 0.3
    let newConfidence = currentConfidence;
    if (wasSuccessful) {
      newConfidence = Math.min(0.99, currentConfidence + 0.05);
    } else {
      newConfidence = Math.max(0.3, currentConfidence - 0.10);
    }

    // Atualizar payload
    await withRetry(
      async () => {
        await client.setPayload("fazai_learning", {
          points: [point.id],
          payload: {
            applied_count: currentCount + 1,
            last_applied: new Date().toISOString(),
            confidence: newConfidence,
          },
        });
      },
      {
        provider: "qdrant",
        maxRetries: 3,
      }
    );

    logger.debug(
      `Learning ${learningId}: applied_count ${currentCount} → ${currentCount + 1}, ` +
      `confidence ${currentConfidence.toFixed(2)} → ${newConfidence.toFixed(2)}`
    );
  } catch (error: any) {
    logger.error(`Failed to increment learning application: ${error.message}`);
  }
}

/**
 * Busca learnings similares por contexto
 *
 * Útil para evitar duplicação de learnings ou encontrar padrões relacionados.
 *
 * @param context Texto de contexto para buscar
 * @param embedding Embedding pré-calculado (opcional)
 * @param limit Número máximo de resultados
 * @returns Array de learnings similares
 *
 * @example
 * ```typescript
 * const similar = await findSimilarLearnings(
 *   "Erro ao reiniciar nginx",
 *   undefined,
 *   5
 * );
 *
 * if (similar.length > 0) {
 *   console.log("Padrões similares já conhecidos:");
 *   for (const l of similar) {
 *     console.log(`- ${l.title} (confidence: ${l.confidence})`);
 *   }
 * }
 * ```
 */
export async function findSimilarLearnings(
  context: string,
  embedding?: number[],
  limit: number = 5
): Promise<LearningStats[]> {
  const client = getQdrantClient();

  // Gera embedding se não fornecido
  let searchEmbedding: number[];
  if (embedding) {
    searchEmbedding = embedding;
  } else {
    const { createEmbeddingService } = await import("../services/embeddings");
    const embeddingService = await createEmbeddingService();
    searchEmbedding = await embeddingService.generate(context);
  }

  try {
    const results = await withRetry(
      async () => {
        return client.search("fazai_learning", {
          vector: searchEmbedding,
          limit,
          with_payload: true,
        });
      },
      {
        provider: "qdrant",
        maxRetries: 2,
      }
    );

    return results.map((point) => ({
      learning_id: (point.payload?.learning_id as string) || String(point.id),
      title: (point.payload?.title as string) || "",
      type: (point.payload?.type as LearningType) || "padrão",
      category: (point.payload?.category as string) || "general",
      applied_count: (point.payload?.applied_count as number) || 0,
      confidence: (point.payload?.confidence as number) || 0.5,
      timestamp: (point.payload?.timestamp as string) || "",
      last_applied: point.payload?.last_applied as string | undefined,
    }));
  } catch (error: any) {
    logger.error(`Failed to find similar learnings: ${error.message}`);
    return [];
  }
}

/**
 * Lista top learnings por categoria
 *
 * @param category Categoria (ex: "linux", "network", "docker")
 * @param limit Número de resultados
 * @returns Top learnings ordenados por confidence e applied_count
 *
 * @example
 * ```typescript
 * const topNginx = await getTopLearningsByCategory("nginx", 10);
 * console.log("Top 10 learnings de nginx:");
 * for (const l of topNginx) {
 *   console.log(`${l.title} - ${l.applied_count} vezes (${l.confidence})`);
 * }
 * ```
 */
export async function getTopLearningsByCategory(
  category: string,
  limit: number = 10
): Promise<LearningStats[]> {
  const client = getQdrantClient();

  try {
    const results = await withRetry(
      async () => {
        return client.scroll("fazai_learning", {
          filter: {
            must: [
              {
                key: "category",
                match: { value: category },
              },
            ],
          },
          limit: 100, // Busca mais para ordenar
          with_payload: true,
        });
      },
      {
        provider: "qdrant",
        maxRetries: 2,
      }
    );

    // Converte para LearningStats
    const stats: LearningStats[] = results.points.map((point) => ({
      learning_id: (point.payload?.learning_id as string) || String(point.id),
      title: (point.payload?.title as string) || "",
      type: (point.payload?.type as LearningType) || "padrão",
      category: (point.payload?.category as string) || "general",
      applied_count: (point.payload?.applied_count as number) || 0,
      confidence: (point.payload?.confidence as number) || 0.5,
      timestamp: (point.payload?.timestamp as string) || "",
      last_applied: point.payload?.last_applied as string | undefined,
    }));

    // Ordena por score combinado: confidence * (1 + log(applied_count + 1))
    stats.sort((a, b) => {
      const scoreA = a.confidence * (1 + Math.log10(a.applied_count + 1));
      const scoreB = b.confidence * (1 + Math.log10(b.applied_count + 1));
      return scoreB - scoreA;
    });

    return stats.slice(0, limit);
  } catch (error: any) {
    logger.error(`Failed to get top learnings: ${error.message}`);
    return [];
  }
}

/**
 * Marca learning como validado
 *
 * Aumenta confiança para 0.95 quando validado por humano.
 *
 * @param learningId ID do learning
 *
 * @example
 * ```typescript
 * // Após usuário confirmar que solução funcionou
 * await markLearningAsValidated("learning_abc123");
 * ```
 */
export async function markLearningAsValidated(learningId: string): Promise<void> {
  const client = getQdrantClient();

  try {
    const results = await withRetry(
      async () => {
        return client.scroll("fazai_learning", {
          filter: {
            must: [
              {
                key: "learning_id",
                match: { value: learningId },
              },
            ],
          },
          limit: 1,
          with_payload: true,
        });
      },
      {
        provider: "qdrant",
        maxRetries: 2,
      }
    );

    if (results.points.length === 0) {
      logger.warn(`Learning ${learningId} not found`);
      return;
    }

    const point = results.points[0];

    await withRetry(
      async () => {
        await client.setPayload("fazai_learning", {
          points: [point.id],
          payload: {
            confidence: 0.95, // Alta confiança após validação humana
            validated: true,
            validated_at: new Date().toISOString(),
          },
        });
      },
      {
        provider: "qdrant",
        maxRetries: 3,
      }
    );

    logger.info(`✅ Learning ${learningId} marked as validated (confidence → 0.95)`);
  } catch (error: any) {
    logger.error(`Failed to mark learning as validated: ${error.message}`);
  }
}

/**
 * Obtém cliente Qdrant (singleton)
 */
let qdrantClientInstance: QdrantClient | null = null;

function getQdrantClient(): QdrantClient {
  if (qdrantClientInstance) {
    return qdrantClientInstance;
  }

  const url = getConfigValue("QDRANT_URL") || process.env.QDRANT_URL || "http://home.rogeruft.com.br:3336";
  const apiKey = getConfigValue("QDRANT_API_KEY") || process.env.QDRANT_API_KEY;

  qdrantClientInstance = new QdrantClient({
    url,
    apiKey,
  });

  return qdrantClientInstance;
}
