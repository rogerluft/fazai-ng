import { logger } from "../logger";

/**
 * Circuit Breaker states
 */
export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

/**
 * Circuit Breaker configuration options
 */
export interface CircuitBreakerConfig {
  /**
   * Number of consecutive failures before opening the circuit
   */
  failureThreshold: number;

  /**
   * Time in milliseconds to wait before transitioning from OPEN to HALF_OPEN
   */
  resetTimeout: number;

  /**
   * Maximum time in milliseconds to wait for an operation to complete
   */
  operationTimeout: number;

  /**
   * Service name for logging and metrics
   */
  serviceName: string;
}

/**
 * Circuit Breaker metrics for monitoring
 */
export interface CircuitBreakerMetrics {
  /**
   * Current state of the circuit
   */
  state: CircuitState;

  /**
   * Number of consecutive failures
   */
  consecutiveFailures: number;

  /**
   * Total number of successful operations
   */
  totalSuccesses: number;

  /**
   * Total number of failed operations
   */
  totalFailures: number;

  /**
   * Total number of rejected operations (when circuit is OPEN)
   */
  totalRejections: number;

  /**
   * Timestamp of last state transition
   */
  lastStateTransition: Date;

  /**
   * Timestamp of last failure
   */
  lastFailure: Date | null;

  /**
   * Timestamp when circuit will transition from OPEN to HALF_OPEN
   */
  nextAttemptTime: Date | null;
}

/**
 * Error thrown when circuit breaker is in OPEN state
 */
export class CircuitBreakerOpenError extends Error {
  constructor(serviceName: string, nextAttemptTime: Date | null) {
    const timeMsg = nextAttemptTime
      ? ` Próxima tentativa em: ${nextAttemptTime.toISOString()}`
      : "";
    super(
      `Circuit breaker está OPEN para serviço "${serviceName}". Operação rejeitada (FAIL FAST).${timeMsg}`
    );
    this.name = "CircuitBreakerOpenError";
  }
}

/**
 * Error thrown when operation times out
 */
export class CircuitBreakerTimeoutError extends Error {
  constructor(serviceName: string, timeout: number) {
    super(
      `Operação do serviço "${serviceName}" excedeu timeout de ${timeout}ms`
    );
    this.name = "CircuitBreakerTimeoutError";
  }
}

/**
 * Generic Circuit Breaker implementation with CLOSED, OPEN, HALF_OPEN states
 *
 * Behavior:
 * - CLOSED: Normal operation, failures increment counter
 * - OPEN: All operations fail fast, no execution attempted
 * - HALF_OPEN: Allow ONE test operation, success → CLOSED, failure → OPEN
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private consecutiveFailures = 0;
  private totalSuccesses = 0;
  private totalFailures = 0;
  private totalRejections = 0;
  private lastStateTransition = new Date();
  private lastFailure: Date | null = null;
  private nextAttemptTime: Date | null = null;
  private halfOpenTestInProgress = false;
  private resetTimer: NodeJS.Timeout | null = null;

  constructor(private readonly config: CircuitBreakerConfig) {
    logger.info(
      `[CircuitBreaker] Inicializado para serviço "${config.serviceName}" ` +
        `(threshold: ${config.failureThreshold}, resetTimeout: ${config.resetTimeout}ms, ` +
        `operationTimeout: ${config.operationTimeout}ms)`
    );
  }

  /**
   * Execute an operation with circuit breaker protection
   *
   * @param operation - Async function to execute
   * @returns Promise with operation result
   * @throws CircuitBreakerOpenError if circuit is OPEN
   * @throws CircuitBreakerTimeoutError if operation exceeds timeout
   * @throws Any error thrown by the operation
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit should transition from OPEN to HALF_OPEN
    this.checkForReset();

    // FAIL FAST: Reject immediately if circuit is OPEN
    if (this.state === CircuitState.OPEN) {
      this.totalRejections++;
      logger.warn(
        `[CircuitBreaker] FAIL FAST: Operação rejeitada para "${this.config.serviceName}" ` +
          `(estado: OPEN, rejections: ${this.totalRejections})`
      );
      throw new CircuitBreakerOpenError(
        this.config.serviceName,
        this.nextAttemptTime
      );
    }

    // HALF_OPEN: Only allow ONE test operation at a time
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenTestInProgress) {
        this.totalRejections++;
        logger.warn(
          `[CircuitBreaker] HALF_OPEN: Teste já em progresso para "${this.config.serviceName}", rejeitando operação`
        );
        throw new CircuitBreakerOpenError(
          this.config.serviceName,
          this.nextAttemptTime
        );
      }
      this.halfOpenTestInProgress = true;
      logger.info(
        `[CircuitBreaker] HALF_OPEN: Tentando operação de teste para "${this.config.serviceName}"`
      );
    }

    try {
      // Execute operation with timeout
      const result = await this.executeWithTimeout(operation);

      // Success: Reset failures and potentially close circuit
      this.onSuccess();

      return result;
    } catch (error) {
      // Failure: Increment counter and potentially open circuit
      this.onFailure(error);
      throw error;
    } finally {
      // Reset half-open test flag
      if (this.state === CircuitState.HALF_OPEN) {
        this.halfOpenTestInProgress = false;
      }
    }
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      totalSuccesses: this.totalSuccesses,
      totalFailures: this.totalFailures,
      totalRejections: this.totalRejections,
      lastStateTransition: this.lastStateTransition,
      lastFailure: this.lastFailure,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  /**
   * Reset circuit breaker to CLOSED state (for testing or manual recovery)
   */
  reset(): void {
    logger.info(
      `[CircuitBreaker] Reset manual para "${this.config.serviceName}"`
    );
    this.transitionTo(CircuitState.CLOSED);
    this.consecutiveFailures = 0;
    this.halfOpenTestInProgress = false;
    this.clearResetTimer();
  }

  /**
   * Execute operation with timeout protection
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new CircuitBreakerTimeoutError(
            this.config.serviceName,
            this.config.operationTimeout
          )
        );
      }, this.config.operationTimeout);

      operation()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.totalSuccesses++;

    if (this.state === CircuitState.HALF_OPEN) {
      logger.info(
        `[CircuitBreaker] HALF_OPEN → CLOSED: Teste bem-sucedido para "${this.config.serviceName}" ` +
          `(successes: ${this.totalSuccesses})`
      );
      this.transitionTo(CircuitState.CLOSED);
      this.consecutiveFailures = 0;
    } else if (this.state === CircuitState.CLOSED) {
      // Reset consecutive failures on success
      if (this.consecutiveFailures > 0) {
        logger.debug(
          `[CircuitBreaker] Resetando contador de falhas para "${this.config.serviceName}" ` +
            `(era ${this.consecutiveFailures})`
        );
        this.consecutiveFailures = 0;
      }
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(error: unknown): void {
    this.totalFailures++;
    this.consecutiveFailures++;
    this.lastFailure = new Date();

    const errorMessage =
      error instanceof Error ? error.message : String(error);

    logger.warn(
      `[CircuitBreaker] Falha na operação para "${this.config.serviceName}" ` +
        `(consecutivas: ${this.consecutiveFailures}/${this.config.failureThreshold}): ${errorMessage}`
    );

    if (this.state === CircuitState.HALF_OPEN) {
      logger.warn(
        `[CircuitBreaker] HALF_OPEN → OPEN: Teste falhou para "${this.config.serviceName}"`
      );
      this.transitionTo(CircuitState.OPEN);
      this.scheduleReset();
    } else if (
      this.state === CircuitState.CLOSED &&
      this.consecutiveFailures >= this.config.failureThreshold
    ) {
      logger.error(
        `[CircuitBreaker] CLOSED → OPEN: Threshold atingido para "${this.config.serviceName}" ` +
          `(${this.consecutiveFailures} falhas consecutivas)`
      );
      this.transitionTo(CircuitState.OPEN);
      this.scheduleReset();
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateTransition = new Date();

    if (oldState !== newState) {
      logger.info(
        `[CircuitBreaker] Transição de estado: ${oldState} → ${newState} ` +
          `(serviço: "${this.config.serviceName}")`
      );
    }

    // Clear next attempt time when closing
    if (newState === CircuitState.CLOSED) {
      this.nextAttemptTime = null;
      this.clearResetTimer();
    }
  }

  /**
   * Schedule automatic transition from OPEN to HALF_OPEN
   */
  private scheduleReset(): void {
    this.clearResetTimer();

    this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeout);

    logger.info(
      `[CircuitBreaker] Agendando reset para "${this.config.serviceName}" ` +
        `em ${this.config.resetTimeout}ms (às ${this.nextAttemptTime.toISOString()})`
    );

    this.resetTimer = setTimeout(() => {
      logger.info(
        `[CircuitBreaker] OPEN → HALF_OPEN: Timeout expirado para "${this.config.serviceName}"`
      );
      this.transitionTo(CircuitState.HALF_OPEN);
      this.nextAttemptTime = null;
    }, this.config.resetTimeout);
  }

  /**
   * Check if circuit should transition from OPEN to HALF_OPEN
   */
  private checkForReset(): void {
    if (
      this.state === CircuitState.OPEN &&
      this.nextAttemptTime &&
      Date.now() >= this.nextAttemptTime.getTime()
    ) {
      logger.info(
        `[CircuitBreaker] OPEN → HALF_OPEN: Tempo de reset atingido para "${this.config.serviceName}"`
      );
      this.transitionTo(CircuitState.HALF_OPEN);
      this.nextAttemptTime = null;
    }
  }

  /**
   * Clear reset timer
   */
  private clearResetTimer(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  /**
   * Cleanup resources (call when circuit breaker is no longer needed)
   */
  destroy(): void {
    logger.info(
      `[CircuitBreaker] Destruindo circuit breaker para "${this.config.serviceName}"`
    );
    this.clearResetTimer();
  }
}
