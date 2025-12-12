/**
 * Interaction Logger - Análise de Uso de Collections RAG
 *
 * Sistema de logging e análise de interações entre collections do FazAI.
 * Rastreia como as collections são usadas em conjunto, performance de queries,
 * e padrões de uso para otimização contínua.
 *
 * Features:
 * - Logging estruturado de queries multi-collection
 * - Análise de padrões de uso por tipo de query
 * - Métricas de performance (tempo, score, taxa de sucesso)
 * - Persistência em JSONL para análise offline
 * - Agregação de estatísticas em tempo real
 *
 * Casos de Uso:
 * - Identificar collections mais relevantes por contexto
 * - Otimizar pesos de fusion scoring
 * - Detectar queries lentas ou problemáticas
 * - Gerar insights para auto-aprendizado
 *
 * @module rag/interaction-logger
 */

import { logger } from "../logger";
import { promises as fs } from "fs";
import * as path from "path";

/**
 * Tipo de query executada
 */
export type QueryType = "admin" | "ask" | "research" | "general";

/**
 * Resultado de uma query
 */
export type QueryOutcome = "success" | "partial" | "failure";

/**
 * Evento de interação registrado
 */
export interface InteractionEvent {
  /**
   * Tipo de query executada
   */
  queryType: QueryType;

  /**
   * Query original do usuário
   */
  query: string;

  /**
   * Collections consultadas
   */
  collectionsUsed: string[];

  /**
   * Número total de resultados retornados
   */
  resultsCount: number;

  /**
   * Score médio dos resultados
   */
  fusionScore: number;

  /**
   * Tempo de execução em ms
   */
  executionTime: number;

  /**
   * Resultado da operação
   */
  outcome: QueryOutcome;

  /**
   * Mensagem de erro (se falha)
   */
  errorMessage?: string;

  /**
   * Timestamp do evento
   */
  timestamp?: string;

  /**
   * Metadados adicionais
   */
  metadata?: Record<string, any>;
}

/**
 * Estatísticas agregadas de uso
 */
export interface UsageStatistics {
  /**
   * Total de interações registradas
   */
  totalInteractions: number;

  /**
   * Tempo médio de execução (ms)
   */
  avgExecutionTime: number;

  /**
   * Taxa de sucesso (0-1)
   */
  successRate: number;

  /**
   * Uso por collection (count)
   */
  collectionUsage: Record<string, number>;

  /**
   * Uso por tipo de query (count)
   */
  queryTypeUsage: Record<string, number>;

  /**
   * Score médio de fusion
   */
  avgFusionScore: number;

  /**
   * Query mais lenta (ms)
   */
  slowestQuery: number;

  /**
   * Query mais rápida (ms)
   */
  fastestQuery: number;
}

/**
 * Logger de interações entre collections
 *
 * Registra eventos de query e gera estatísticas de uso.
 * Persistente através de JSONL append-only log.
 */
export class InteractionLogger {
  private events: InteractionEvent[] = [];
  private logFile: string;
  private logDir: string;

  /**
   * Número máximo de eventos em memória antes de flush
   */
  private readonly MAX_MEMORY_EVENTS = 1000;

  /**
   * Flag para controlar se o logger foi inicializado
   */
  private initialized: boolean = false;

  /**
   * Cria nova instância do logger
   *
   * @param logDir Diretório para armazenar logs (default: /var/log/fazai)
   */
  constructor(logDir: string = "/var/log/fazai") {
    this.logDir = logDir;
    const logDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    this.logFile = path.join(logDir, `interactions-${logDate}.jsonl`);
  }

  /**
   * Inicializa o logger criando diretório se necessário
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Tenta criar diretório de logs
      await fs.mkdir(this.logDir, { recursive: true });
      this.initialized = true;
      logger.debug(`Interaction logger initialized: ${this.logFile}`);
    } catch (error: any) {
      // Fallback para diretório local se /var/log não acessível
      this.logDir = path.join(process.cwd(), ".fazai", "logs");
      const logDate = new Date().toISOString().split("T")[0];
      this.logFile = path.join(this.logDir, `interactions-${logDate}.jsonl`);

      try {
        await fs.mkdir(this.logDir, { recursive: true });
        this.initialized = true;
        logger.warn(`Using fallback log directory: ${this.logDir}`);
      } catch (fallbackError: any) {
        logger.error(`Failed to initialize interaction logger: ${fallbackError.message}`);
        // Logger fica desabilitado mas não quebra a aplicação
      }
    }
  }

  /**
   * Registra evento de interação
   *
   * @param event Dados do evento
   *
   * @example
   * ```typescript
   * await interactionLogger.logInteraction({
   *   queryType: "admin",
   *   query: "Como configurar nginx?",
   *   collectionsUsed: ["fazai_kb", "fazai_learning"],
   *   resultsCount: 5,
   *   fusionScore: 0.85,
   *   executionTime: 127,
   *   outcome: "success",
   * });
   * ```
   */
  async logInteraction(event: InteractionEvent): Promise<void> {
    // Adiciona timestamp se não fornecido
    const eventWithTimestamp: InteractionEvent = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    };

    // Adiciona à memória
    this.events.push(eventWithTimestamp);

    // Log console formatado
    const collectionsStr = event.collectionsUsed.join(", ");
    const outcomeEmoji = event.outcome === "success" ? "✅" : event.outcome === "partial" ? "⚠️" : "❌";

    logger.info(
      `🔗 ${outcomeEmoji} ${event.queryType} | ${collectionsStr} | ` +
      `${event.resultsCount} results | ${event.executionTime}ms | ` +
      `score: ${event.fusionScore.toFixed(3)}`
    );

    // Flush para arquivo se atingiu limite
    if (this.events.length >= this.MAX_MEMORY_EVENTS) {
      await this.flush();
    }

    // Tenta escrever no arquivo JSONL (non-blocking)
    this.writeToFileAsync(eventWithTimestamp);
  }

  /**
   * Escreve evento em arquivo JSONL (async, non-blocking)
   */
  private async writeToFileAsync(event: InteractionEvent): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.initialized) {
      return; // Logger desabilitado
    }

    try {
      const line = JSON.stringify(event) + "\n";
      await fs.appendFile(this.logFile, line, "utf-8");
    } catch (error: any) {
      logger.debug(`Failed to write interaction log: ${error.message}`);
    }
  }

  /**
   * Flush eventos em memória para arquivo
   */
  async flush(): Promise<void> {
    if (this.events.length === 0) {
      return;
    }

    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.initialized) {
      logger.warn("Interaction logger not initialized, discarding events");
      this.events = [];
      return;
    }

    try {
      const lines = this.events.map((e) => JSON.stringify(e)).join("\n") + "\n";
      await fs.appendFile(this.logFile, lines, "utf-8");
      logger.debug(`Flushed ${this.events.length} interaction events to ${this.logFile}`);
      this.events = [];
    } catch (error: any) {
      logger.error(`Failed to flush interaction events: ${error.message}`);
    }
  }

  /**
   * Analisa padrões de uso das collections
   *
   * Calcula estatísticas agregadas dos eventos em memória.
   *
   * @returns Estatísticas de uso
   *
   * @example
   * ```typescript
   * const stats = interactionLogger.analyzePatterns();
   * console.log(`Total queries: ${stats.totalInteractions}`);
   * console.log(`Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
   * console.log(`Avg time: ${stats.avgExecutionTime}ms`);
   * ```
   */
  analyzePatterns(): UsageStatistics {
    const total = this.events.length;

    if (total === 0) {
      return {
        totalInteractions: 0,
        avgExecutionTime: 0,
        successRate: 0,
        collectionUsage: {},
        queryTypeUsage: {},
        avgFusionScore: 0,
        slowestQuery: 0,
        fastestQuery: 0,
      };
    }

    // Tempo médio de execução
    const totalTime = this.events.reduce((sum, e) => sum + e.executionTime, 0);
    const avgExecutionTime = Math.round(totalTime / total);

    // Taxa de sucesso
    const successCount = this.events.filter((e) => e.outcome === "success").length;
    const successRate = successCount / total;

    // Uso por collection
    const collectionUsage: Record<string, number> = {};
    for (const event of this.events) {
      for (const collection of event.collectionsUsed) {
        collectionUsage[collection] = (collectionUsage[collection] || 0) + 1;
      }
    }

    // Uso por tipo de query
    const queryTypeUsage: Record<string, number> = {};
    for (const event of this.events) {
      queryTypeUsage[event.queryType] = (queryTypeUsage[event.queryType] || 0) + 1;
    }

    // Score médio
    const totalScore = this.events.reduce((sum, e) => sum + e.fusionScore, 0);
    const avgFusionScore = totalScore / total;

    // Query mais lenta/rápida
    const executionTimes = this.events.map((e) => e.executionTime);
    const slowestQuery = Math.max(...executionTimes);
    const fastestQuery = Math.min(...executionTimes);

    return {
      totalInteractions: total,
      avgExecutionTime,
      successRate,
      collectionUsage,
      queryTypeUsage,
      avgFusionScore,
      slowestQuery,
      fastestQuery,
    };
  }

  /**
   * Carrega eventos históricos de arquivo JSONL
   *
   * @param filePath Caminho do arquivo (default: arquivo atual)
   * @param limit Número máximo de eventos a carregar
   * @returns Array de eventos carregados
   */
  async loadFromFile(filePath?: string, limit?: number): Promise<InteractionEvent[]> {
    const targetFile = filePath || this.logFile;

    try {
      const content = await fs.readFile(targetFile, "utf-8");
      const lines = content.trim().split("\n");

      const events: InteractionEvent[] = [];
      const maxLines = limit ? Math.min(limit, lines.length) : lines.length;

      for (let i = 0; i < maxLines; i++) {
        try {
          const event = JSON.parse(lines[i]) as InteractionEvent;
          events.push(event);
        } catch (parseError) {
          logger.warn(`Failed to parse line ${i + 1} in ${targetFile}`);
        }
      }

      logger.info(`Loaded ${events.length} events from ${targetFile}`);
      return events;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        logger.debug(`Log file not found: ${targetFile}`);
        return [];
      }
      logger.error(`Failed to load events from file: ${error.message}`);
      return [];
    }
  }

  /**
   * Analisa padrões históricos de arquivo
   *
   * Útil para análise offline de logs antigos.
   *
   * @param filePath Caminho do arquivo JSONL
   * @returns Estatísticas históricas
   */
  async analyzeHistoricalPatterns(filePath?: string): Promise<UsageStatistics> {
    const events = await this.loadFromFile(filePath);

    if (events.length === 0) {
      return {
        totalInteractions: 0,
        avgExecutionTime: 0,
        successRate: 0,
        collectionUsage: {},
        queryTypeUsage: {},
        avgFusionScore: 0,
        slowestQuery: 0,
        fastestQuery: 0,
      };
    }

    // Calcula estatísticas dos eventos carregados
    const totalTime = events.reduce((sum, e) => sum + e.executionTime, 0);
    const avgExecutionTime = Math.round(totalTime / events.length);

    const successCount = events.filter((e) => e.outcome === "success").length;
    const successRate = successCount / events.length;

    const collectionUsage: Record<string, number> = {};
    for (const event of events) {
      for (const collection of event.collectionsUsed) {
        collectionUsage[collection] = (collectionUsage[collection] || 0) + 1;
      }
    }

    const queryTypeUsage: Record<string, number> = {};
    for (const event of events) {
      queryTypeUsage[event.queryType] = (queryTypeUsage[event.queryType] || 0) + 1;
    }

    const totalScore = events.reduce((sum, e) => sum + e.fusionScore, 0);
    const avgFusionScore = totalScore / events.length;

    const executionTimes = events.map((e) => e.executionTime);
    const slowestQuery = Math.max(...executionTimes);
    const fastestQuery = Math.min(...executionTimes);

    return {
      totalInteractions: events.length,
      avgExecutionTime,
      successRate,
      collectionUsage,
      queryTypeUsage,
      avgFusionScore,
      slowestQuery,
      fastestQuery,
    };
  }

  /**
   * Limpa eventos em memória
   */
  clear(): void {
    this.events = [];
    logger.debug("Interaction logger memory cleared");
  }

  /**
   * Exporta estatísticas formatadas
   *
   * @returns String formatada com estatísticas
   */
  formatStats(): string {
    const stats = this.analyzePatterns();

    const lines: string[] = [
      "═══════════════════════════════════════════════",
      "  INTERACTION LOGGER STATISTICS",
      "═══════════════════════════════════════════════",
      "",
      `Total Interactions:     ${stats.totalInteractions}`,
      `Success Rate:           ${(stats.successRate * 100).toFixed(1)}%`,
      `Avg Execution Time:     ${stats.avgExecutionTime}ms`,
      `Avg Fusion Score:       ${stats.avgFusionScore.toFixed(3)}`,
      `Fastest Query:          ${stats.fastestQuery}ms`,
      `Slowest Query:          ${stats.slowestQuery}ms`,
      "",
      "Collection Usage:",
    ];

    // Collections ordenadas por uso
    const sortedCollections = Object.entries(stats.collectionUsage).sort(
      ([, a], [, b]) => b - a
    );

    for (const [collection, count] of sortedCollections) {
      const percentage = ((count / stats.totalInteractions) * 100).toFixed(1);
      lines.push(`  ${collection.padEnd(25)} ${count.toString().padStart(5)} (${percentage}%)`);
    }

    lines.push("");
    lines.push("Query Type Usage:");

    // Tipos ordenados por uso
    const sortedTypes = Object.entries(stats.queryTypeUsage).sort(([, a], [, b]) => b - a);

    for (const [type, count] of sortedTypes) {
      const percentage = ((count / stats.totalInteractions) * 100).toFixed(1);
      lines.push(`  ${type.padEnd(25)} ${count.toString().padStart(5)} (${percentage}%)`);
    }

    lines.push("");
    lines.push("═══════════════════════════════════════════════");

    return lines.join("\n");
  }
}

/**
 * Instância singleton do logger
 */
export const interactionLogger = new InteractionLogger();

/**
 * Helper: Registra sucesso de query
 *
 * @example
 * ```typescript
 * await logQuerySuccess("admin", query, ["fazai_kb"], 5, 0.85, 127);
 * ```
 */
export async function logQuerySuccess(
  queryType: QueryType,
  query: string,
  collectionsUsed: string[],
  resultsCount: number,
  fusionScore: number,
  executionTime: number
): Promise<void> {
  await interactionLogger.logInteraction({
    queryType,
    query,
    collectionsUsed,
    resultsCount,
    fusionScore,
    executionTime,
    outcome: "success",
  });
}

/**
 * Helper: Registra falha de query
 *
 * @example
 * ```typescript
 * await logQueryFailure("ask", query, [], 0, 0, 50, "Timeout connecting to Qdrant");
 * ```
 */
export async function logQueryFailure(
  queryType: QueryType,
  query: string,
  collectionsUsed: string[],
  resultsCount: number,
  fusionScore: number,
  executionTime: number,
  errorMessage: string
): Promise<void> {
  await interactionLogger.logInteraction({
    queryType,
    query,
    collectionsUsed,
    resultsCount,
    fusionScore,
    executionTime,
    outcome: "failure",
    errorMessage,
  });
}
