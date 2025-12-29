/**
 * Execution Composer - Composição Semântica de Blocos (ECOA)
 *
 * Sistema inspirado em ZFS dedup: reutiliza blocos atômicos de execução
 * conhecidos antes de chamar LLM para gerar novos comandos.
 *
 * Workflow:
 * 1. Quebra tarefa em intents atômicos
 * 2. Busca blocos existentes para cada intent
 * 3. Se todos encontrados → COMPÕE solução (skip LLM)
 * 4. Se falta alguns → Chama LLM só pro que falta
 * 5. Após executar → Salva blocos atômicos novos
 *
 * Analogia ZFS:
 * Arquivo1: [bloco-A] [bloco-B] [bloco-C]
 * Arquivo2: [bloco-A] [bloco-D] [bloco-C] ← A e C reutilizados
 *
 * Tarefa1: [instalar-nginx] [config-proxy] [reload]
 * Tarefa2: [instalar-nginx] [config-ssl] [reload] ← Só aprende config-ssl
 *
 * @module agentic/execution-composer
 */

import { logger } from "../logger";

/**
 * Passo atômico de execução
 */
export interface ExecutionStep {
  /** Comando a executar */
  command: string;

  /** Descrição legível */
  description: string;

  /** Comando para verificar sucesso (exit 0 = ok) */
  validation?: string;

  /** Se pode continuar mesmo se falhar */
  optional?: boolean;
}

/**
 * Bloco atômico de execução - equivalente a um "inode" no ZFS
 * Pode ser reutilizado em múltiplas tarefas
 */
export interface ExecutionBlock {
  /** ID único do bloco (UUID) */
  block_id: string;

  /** Intent em linguagem natural (para busca semântica) */
  intent: string;

  /** Embedding do intent (1536 dims, ECOA) */
  intent_embedding?: number[];

  /** Passos atômicos deste bloco */
  steps: ExecutionStep[];

  /** Comando para validar se o bloco já foi executado */
  validation_command?: string;

  /** Requisitos de contexto (quando usar este bloco) */
  context_requirements?: {
    os?: string[];           // ["ubuntu", "debian"]
    pkg_manager?: string[];  // ["apt", "dnf"]
    requires_root?: boolean;
  };

  /** IDs de blocos que combinam bem com este */
  composable_with?: string[];

  /** Estatísticas de uso */
  stats: {
    times_used: number;
    success_rate: number;    // 0.0 - 1.0
    last_used?: string;      // ISO timestamp
    learned_from: string[];  // Session IDs que ensinaram
  };
}

/**
 * Contexto do sistema para matching de blocos
 */
export interface SystemContext {
  os: string;               // "ubuntu", "fedora", "debian"
  os_version?: string;      // "22.04", "40"
  pkg_manager: string;      // "apt", "dnf", "yum"
  is_root: boolean;
  arch?: string;            // "x86_64", "aarch64"
}

/**
 * Resultado da tentativa de composição
 */
export interface CompositionResult {
  /** Se conseguiu compor 100% da solução */
  fully_composed: boolean;

  /** Blocos encontrados que serão reutilizados */
  matched_blocks: ExecutionBlock[];

  /** Intents que não encontrou (precisam LLM) */
  missing_intents: string[];

  /** Cobertura (0.0 - 1.0) */
  coverage: number;

  /** Plano de execução montado (se fully_composed) */
  execution_plan?: ExecutionStep[];

  /** Tempo gasto na composição (ms) */
  composition_time_ms?: number;
}

/**
 * Resultado de busca de bloco
 */
export interface BlockMatch {
  block: ExecutionBlock;
  similarity: number;  // 0.0 - 1.0
}

/**
 * Opções para limpeza de blocos
 */
export interface CleanupOptions {
  /** Remove blocos não usados há N dias */
  maxAgeDays?: number;
  /** Remove blocos com success_rate < N */
  minSuccessRate?: number;
}

// ============================================================================
// FUNÇÕES PRINCIPAIS (implementação nas próximas fases)
// ============================================================================

/**
 * Quebra tarefa em intents atômicos para busca
 *
 * Exemplo: "instalar nginx como reverse proxy"
 *       → ["instalar nginx", "configurar reverse proxy"]
 *
 * @param task Tarefa em linguagem natural
 * @returns Array de intents atômicos
 */
export async function decomposeToIntents(task: string): Promise<string[]> {
  // Fase 3: Implementar decomposição
  // Por enquanto, usa heurísticas simples
  const intents: string[] = [];

  // Palavras-chave que indicam múltiplas ações
  const separators = [
    " e depois ",
    " e também ",
    " além de ",
    ", depois ",
    " seguido de ",
    " e ",
  ];

  let remaining = task.toLowerCase().trim();

  // Tenta separar por conectores
  for (const sep of separators) {
    if (remaining.includes(sep)) {
      const parts = remaining.split(sep);
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.length > 3) {
          intents.push(trimmed);
        }
      }
      return intents;
    }
  }

  // Se não encontrou separadores, retorna tarefa como único intent
  intents.push(remaining);
  return intents;
}

/**
 * Compõe execução a partir de blocos conhecidos
 *
 * FUNÇÃO PRINCIPAL do Execution Composer
 *
 * @param task Tarefa em linguagem natural
 * @param context Contexto do sistema
 * @returns Resultado da composição
 */
export async function composeExecution(
  task: string,
  context: SystemContext
): Promise<CompositionResult> {
  const startTime = Date.now();

  logger.debug(`🧩 Tentando compor execução para: "${task}"`);

  // 1. Quebra em intents
  const intents = await decomposeToIntents(task);
  logger.debug(`Intents identificados: ${intents.length}`);

  // 2. Busca blocos para cada intent
  const { findBlocksForIntents } = await import("./block-storage/factory");
  const blocksMap = await findBlocksForIntents(intents, context);

  // 3. Analisa cobertura
  const matchedBlocks: ExecutionBlock[] = [];
  const missingIntents: string[] = [];

  for (const [intent, match] of blocksMap.entries()) {
    if (match) {
      matchedBlocks.push(match.block);
    } else {
      missingIntents.push(intent);
    }
  }

  const coverage = intents.length > 0
    ? matchedBlocks.length / intents.length
    : 0;

  const fullyComposed = missingIntents.length === 0 && matchedBlocks.length > 0;

  // 4. Monta plano se fully_composed
  let executionPlan: ExecutionStep[] | undefined;

  if (fullyComposed) {
    executionPlan = [];
    for (const block of matchedBlocks) {
      executionPlan.push(...block.steps);
    }
    logger.info(`✅ Composição completa: ${matchedBlocks.length} blocos reutilizados`);
  } else if (matchedBlocks.length > 0) {
    logger.info(
      `📦 Composição parcial: ${matchedBlocks.length}/${intents.length} blocos ` +
      `(${Math.round(coverage * 100)}% cobertura)`
    );
  } else {
    logger.debug("❌ Nenhum bloco encontrado, LLM necessário");
  }

  return {
    fully_composed: fullyComposed,
    matched_blocks: matchedBlocks,
    missing_intents: missingIntents,
    coverage,
    execution_plan: executionPlan,
    composition_time_ms: Date.now() - startTime,
  };
}

/**
 * Salva bloco atômico após execução bem-sucedida
 *
 * Verifica deduplicação antes (não salva se já existe similar >0.90)
 *
 * @param block Dados do bloco (sem ID e stats)
 * @returns ID do bloco salvo (ou existente se duplicado)
 */
export async function saveExecutionBlock(
  block: Omit<ExecutionBlock, "block_id" | "stats">,
  sessionId?: string
): Promise<string> {
  const { createBlockStorage } = await import("./block-storage/factory");
  const storage = createBlockStorage();

  return storage.save({
    ...block,
    stats: {
      times_used: 1,
      success_rate: 1.0,
      learned_from: sessionId ? [sessionId] : [],
    },
  });
}

/**
 * Atualiza estatísticas de um bloco após uso
 *
 * @param blockId ID do bloco
 * @param wasSuccessful Se a execução foi bem-sucedida
 */
export async function updateBlockStats(
  blockId: string,
  wasSuccessful: boolean
): Promise<void> {
  const { createBlockStorage } = await import("./block-storage/factory");
  const storage = createBlockStorage();

  await storage.updateStats(blockId, wasSuccessful);
}

/**
 * Lista todos os blocos (para debug/CLI)
 *
 * @param limit Máximo de blocos
 */
export async function listAllBlocks(limit: number = 50): Promise<ExecutionBlock[]> {
  const { createBlockStorage } = await import("./block-storage/factory");
  const storage = createBlockStorage();

  return storage.listAll(limit);
}

/**
 * Limpa blocos antigos ou com baixa taxa de sucesso
 *
 * @param options Opções de limpeza
 * @returns Número de blocos removidos
 */
export async function cleanupBlocks(options?: CleanupOptions): Promise<number> {
  const { createBlockStorage } = await import("./block-storage/factory");
  const storage = createBlockStorage();

  return storage.cleanup(options);
}
