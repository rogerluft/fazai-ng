/**
 * @module resilience/service-registry
 * @description Singleton Registry for managing and sharing Circuit Breakers across modules.
 */

import { CircuitBreaker, CircuitState } from './circuit-breaker';
import { logger } from '../logger';

/**
 * Health status interface for a registered service.
 */
export interface ServiceHealthStatus {
  state: CircuitState;
  healthy: boolean;
}

/**
 * Singleton Registry for managing Circuit Breakers across the application.
 * Provides centralized access to circuit breaker instances and health monitoring.
 */
export class ServiceRegistry {
  private static instance: ServiceRegistry | null = null;
  private readonly registry: Map<string, CircuitBreaker>;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    this.registry = new Map<string, CircuitBreaker>();
    logger.debug('ServiceRegistry singleton initialized.');
  }

  /**
   * Gets the singleton instance of ServiceRegistry.
   * @returns The ServiceRegistry instance.
   */
  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  /**
   * Registers a Circuit Breaker with a given service name.
   * @param name Unique service identifier.
   * @param circuitBreaker CircuitBreaker instance to register.
   * @throws Error if a circuit breaker with the same name already exists.
   */
  public register(name: string, circuitBreaker: CircuitBreaker): void {
    if (this.registry.has(name)) {
      const error = `Circuit Breaker with name "${name}" is already registered.`;
      logger.error(error);
      throw new Error(error);
    }

    this.registry.set(name, circuitBreaker);
    logger.info(`Circuit Breaker "${name}" registered in ServiceRegistry.`);
  }

  /**
   * Retrieves a Circuit Breaker by service name.
   * @param name Service identifier.
   * @returns CircuitBreaker instance or undefined if not found.
   */
  public get(name: string): CircuitBreaker | undefined {
    const circuitBreaker = this.registry.get(name);

    if (!circuitBreaker) {
      logger.warn(`Circuit Breaker "${name}" not found in ServiceRegistry.`);
    }

    return circuitBreaker;
  }

  /**
   * Gets health status for all registered services.
   * @returns Record mapping service names to their health status.
   */
  public getHealthStatus(): Record<string, ServiceHealthStatus> {
    const healthStatus: Record<string, ServiceHealthStatus> = {};

    Array.from(this.registry.entries()).forEach(([name, circuitBreaker]) => {
      const metrics = circuitBreaker.getMetrics();
      const state = metrics.state;
      const healthy = state === CircuitState.CLOSED || state === CircuitState.HALF_OPEN;

      healthStatus[name] = {
        state,
        healthy,
      };
    });

    return healthStatus;
  }

  /**
   * Checks if a specific service is healthy.
   * @param name Service identifier.
   * @returns true if service is healthy (CLOSED or HALF_OPEN), false otherwise.
   */
  public isServiceHealthy(name: string): boolean {
    const circuitBreaker = this.registry.get(name);

    if (!circuitBreaker) {
      logger.warn(`Cannot check health: Circuit Breaker "${name}" not found.`);
      return false;
    }

    const metrics = circuitBreaker.getMetrics();
    const state = metrics.state;
    return state === CircuitState.CLOSED || state === CircuitState.HALF_OPEN;
  }

  /**
   * Gets the total number of registered services.
   * @returns Number of registered circuit breakers.
   */
  public getServiceCount(): number {
    return this.registry.size;
  }

  /**
   * Lists all registered service names.
   * @returns Array of service names.
   */
  public listServices(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * Unregisters a Circuit Breaker by service name.
   * @param name Service identifier.
   * @returns true if unregistered successfully, false if not found.
   */
  public unregister(name: string): boolean {
    const deleted = this.registry.delete(name);

    if (deleted) {
      logger.info(`Circuit Breaker "${name}" unregistered from ServiceRegistry.`);
    } else {
      logger.warn(`Cannot unregister: Circuit Breaker "${name}" not found.`);
    }

    return deleted;
  }

  /**
   * Clears all registered circuit breakers.
   * WARNING: Use with caution, typically only for testing.
   */
  public clear(): void {
    const count = this.registry.size;
    this.registry.clear();
    logger.warn(`ServiceRegistry cleared. Removed ${count} circuit breaker(s).`);
  }

  /**
   * Resets the singleton instance.
   * WARNING: Use only for testing purposes.
   */
  public static resetInstance(): void {
    if (ServiceRegistry.instance) {
      ServiceRegistry.instance.clear();
      ServiceRegistry.instance = null;
      logger.warn('ServiceRegistry singleton instance reset.');
    }
  }
}
