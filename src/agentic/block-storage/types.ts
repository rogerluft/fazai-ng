/**
 * Block Storage Types
 *
 * Interfaces para backends de storage de ExecutionBlocks.
 * Permite trocar entre JSON (dev), SQLite (intermediário), Qdrant (prod).
 *
 * @module agentic/block-storage/types
 */

import { ExecutionBlock, BlockMatch, CleanupOptions, SystemContext } from "../execution-composer";

// Re-export para conveniência
export type { ExecutionBlock, BlockMatch, CleanupOptions, SystemContext };

/**
 * Interface para backends de storage de ExecutionBlocks
 */
export interface BlockStorageBackend {
  /**
   * Busca blocos similares ao intent
   *
   * @param intent Texto do intent para buscar
   * @param context Contexto do sistema (para filtrar por OS/pkg_manager)
   * @param threshold Similaridade mínima (0.0-1.0)
   * @param limit Máximo de resultados
   * @returns Array de matches ordenados por similaridade
   */
  findSimilar(
    intent: string,
    context?: SystemContext,
    threshold?: number,
    limit?: number
  ): Promise<BlockMatch[]>;

  /**
   * Salva novo bloco (com deduplicação)
   *
   * Retorna ID do bloco existente se já houver similar >0.90
   *
   * @param block Dados do bloco (sem block_id)
   * @returns ID do bloco (novo ou existente se duplicado)
   */
  save(block: Omit<ExecutionBlock, "block_id">): Promise<string>;

  /**
   * Atualiza estatísticas de um bloco
   *
   * @param blockId ID do bloco
   * @param wasSuccessful Se a execução foi bem-sucedida
   */
  updateStats(blockId: string, wasSuccessful: boolean): Promise<void>;

  /**
   * Busca bloco por ID
   *
   * @param blockId ID do bloco
   * @returns Bloco ou null se não encontrado
   */
  getById(blockId: string): Promise<ExecutionBlock | null>;

  /**
   * Lista todos os blocos (para debug)
   *
   * @param limit Máximo de blocos
   * @returns Array de blocos
   */
  listAll(limit?: number): Promise<ExecutionBlock[]>;

  /**
   * Limpa blocos antigos ou com baixo success_rate
   *
   * @param options Opções de limpeza
   * @returns Número de blocos removidos
   */
  cleanup(options?: CleanupOptions): Promise<number>;

  /**
   * Conta total de blocos
   */
  count(): Promise<number>;
}

/**
 * Tipo de backend de storage
 */
export type StorageBackendType = "json" | "sqlite" | "qdrant";
