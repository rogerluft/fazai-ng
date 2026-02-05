/**
 * Block Storage Factory
 *
 * Cria backend de storage baseado na configuração.
 * Singleton para reutilização.
 *
 * Configuração via fazai.conf:
 * - EXECUTION_BLOCKS_BACKEND=json | qdrant
 * - EXECUTION_BLOCKS_PATH=/opt/fazai/data/execution-blocks.json
 *
 * @module agentic/block-storage/factory
 */

import { BlockStorageBackend, StorageBackendType, SystemContext, BlockMatch } from "./types";
import { JsonBlockStorage } from "./json-backend";
import { QdrantBlockStorage } from "./qdrant-backend";
import { SqliteBlockStorage } from "./sqlite-backend";
import { getConfigValue } from "../../config";
import { logger } from "../../logger";

let instance: BlockStorageBackend | null = null;

/**
 * Cria backend de storage baseado na configuração
 *
 * @returns Backend de storage (singleton)
 */
export function createBlockStorage(): BlockStorageBackend {
  if (instance) return instance;

  const backendType = (getConfigValue("EXECUTION_BLOCKS_BACKEND") || "json") as StorageBackendType;

  logger.debug(`Using execution blocks backend: ${backendType}`);

  switch (backendType) {
    case "json":
      instance = new JsonBlockStorage();
      break;

    case "qdrant":
      instance = new QdrantBlockStorage();
      break;

    case "sqlite":
      instance = new SqliteBlockStorage();
      break;

    default:
      logger.warn(`Unknown backend "${backendType}", using JSON`);
      instance = new JsonBlockStorage();
  }

  return instance;
}

/**
 * Força reset do singleton (para testes)
 */
export function resetBlockStorage(): void {
  instance = null;
}

/**
 * Busca blocos para múltiplos intents
 *
 * Função de conveniência usada pelo execution-composer.
 *
 * @param intents Array de intents para buscar
 * @param context Contexto do sistema
 * @param threshold Similaridade mínima
 * @returns Map de intent → BlockMatch ou null
 */
export async function findBlocksForIntents(
  intents: string[],
  context?: SystemContext,
  threshold: number = 0.6
): Promise<Map<string, BlockMatch | null>> {
  const storage = createBlockStorage();
  const results = new Map<string, BlockMatch | null>();

  const searchPromises = intents.map(async (intent) => {
    try {
      const matches = await storage.findSimilar(intent, context, threshold, 1);
      return { intent, match: matches.length > 0 ? matches[0] : null };
    } catch (error) {
      logger.debug(`Failed to find block for intent "${intent}": ${error}`);
      return { intent, match: null };
    }
  });

  const searchResults = await Promise.all(searchPromises);
  for (const { intent, match } of searchResults) {
    results.set(intent, match);
  }

  return results;
}

/**
 * Obtém tipo de backend atual
 */
export function getCurrentBackendType(): StorageBackendType {
  return (getConfigValue("EXECUTION_BLOCKS_BACKEND") || "json") as StorageBackendType;
}
