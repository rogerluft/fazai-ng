/**
 * Error Tracking System
 *
 * Sistema de rastreamento de erros em memória para o dashboard CLI.
 * Mantém os últimos 50 erros reais (não comandos executados).
 *
 * @module error-tracker
 */

import { logger } from "./logger";

/**
 * Representa um erro capturado no sistema
 */
export interface ErrorEntry {
  /** Timestamp do erro */
  timestamp: Date;
  /** Tipo/categoria do erro */
  type: "api" | "cache" | "provider" | "system" | "network" | "validation";
  /** Mensagem do erro */
  message: string;
  /** Stack trace (opcional) */
  stack?: string;
  /** Contexto adicional */
  context?: Record<string, unknown>;
}

/**
 * Erro formatado para exibição no dashboard
 */
export interface FormattedError {
  /** Timestamp formatado (HH:MM) */
  timestamp: string;
  /** Tipo do erro */
  type: string;
  /** Mensagem curta */
  message: string;
  /** Status visual (sempre 'error') */
  status: "error";
}

/**
 * Classe singleton para rastreamento de erros em memória
 */
class ErrorTracker {
  private static instance: ErrorTracker | null = null;
  private errors: ErrorEntry[] = [];
  private readonly MAX_ERRORS = 50;

  private constructor() {}

  /**
   * Obtém instância única do tracker
   */
  public static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }

  /**
   * Captura um novo erro no sistema
   *
   * @param type - Categoria do erro
   * @param message - Mensagem descritiva
   * @param error - Objeto Error (opcional)
   * @param context - Contexto adicional (opcional)
   */
  public captureError(
    type: ErrorEntry["type"],
    message: string,
    error?: Error,
    context?: Record<string, unknown>
  ): void {
    const entry: ErrorEntry = {
      timestamp: new Date(),
      type,
      message,
      stack: error?.stack,
      context,
    };

    this.errors.push(entry);

    // Remove erros antigos se exceder o limite
    if (this.errors.length > this.MAX_ERRORS) {
      this.errors.shift(); // Remove o mais antigo
    }

    // Log para arquivo (opcional, mas recomendado)
    logger.error(`[${type.toUpperCase()}] ${message}`, context || "");
  }

  /**
   * Obtém últimos N erros
   *
   * @param limit - Número máximo de erros (padrão: 10)
   * @returns Array de erros formatados para dashboard
   */
  public getRecentErrors(limit: number = 10): FormattedError[] {
    return this.errors
      .slice(-limit)
      .reverse() // Mais recentes primeiro
      .map((err) => {
        const time = err.timestamp;
        const timestamp = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`;

        return {
          timestamp,
          type: err.type,
          message: err.message.substring(0, 60), // Limita tamanho
          status: "error" as const,
        };
      });
  }

  /**
   * Obtém estatísticas de erros
   *
   * @returns Objeto com contadores por tipo
   */
  public getStats(): Record<string, number> {
    const stats: Record<string, number> = {
      total: this.errors.length,
      api: 0,
      cache: 0,
      provider: 0,
      system: 0,
      network: 0,
      validation: 0,
    };

    for (const err of this.errors) {
      stats[err.type]++;
    }

    return stats;
  }

  /**
   * Obtém o erro mais recente
   *
   * @returns Último erro ou null se não houver
   */
  public getLastError(): ErrorEntry | null {
    return this.errors.length > 0 ? this.errors[this.errors.length - 1] : null;
  }

  /**
   * Limpa todos os erros rastreados
   */
  public clear(): void {
    this.errors = [];
    logger.info("Error tracker cleared");
  }

  /**
   * Verifica se há erros recentes (últimos 5 minutos)
   *
   * @returns true se houver erros recentes
   */
  public hasRecentErrors(): boolean {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return this.errors.some((err) => err.timestamp.getTime() > fiveMinutesAgo);
  }
}

/**
 * Exporta instância singleton do error tracker
 */
export const errorTracker = ErrorTracker.getInstance();

/**
 * Hook para integração com logger
 * Captura automaticamente erros logados
 *
 * @param type - Tipo do erro
 * @param message - Mensagem
 * @param error - Objeto Error (opcional)
 */
export function trackError(
  type: ErrorEntry["type"],
  message: string,
  error?: Error
): void {
  errorTracker.captureError(type, message, error);
}
