/**
 * Timeout Configuration Module
 *
 * Centralized timeout configuration for all external API calls.
 * Provides consistent timeout behavior across providers.
 *
 * Features:
 * - Provider-specific timeouts
 * - AbortController wrapper for fetch
 * - Timeout tracking and monitoring
 */

import { logger } from "../logger";

/**
 * Timeout configuration in milliseconds per provider
 */
export const API_TIMEOUTS = {
  /**
   * Anthropic Claude API
   * Generous timeout for complex streaming responses
   */
  anthropic: 120000, // 2 minutes

  /**
   * OpenAI API
   * Standard timeout for GPT models
   */
  openai: 90000, // 90 seconds

  /**
   * OpenRouter (multi-model gateway)
   * Higher timeout as it routes to various providers
   */
  openrouter: 120000, // 2 minutes

  /**
   * Ollama (local models)
   * Higher timeout as local models can be slower
   * Especially on first load (model needs to be loaded into memory)
   */
  ollama: 180000, // 3 minutes

  /**
   * Google Gemini API
   * Standard timeout
   */
  google: 90000, // 90 seconds

  /**
   * Perplexity API
   */
  perplexity: 90000, // 90 seconds

  /**
   * Qdrant vector database
   * Lower timeout as it's local/fast network
   */
  qdrant: 30000, // 30 seconds

  /**
   * Context7 search
   * Medium timeout for external search
   */
  context7: 30000, // 30 seconds

  /**
   * DuckDuckGo web search
   * Lower timeout for simple API
   */
  duckduckgo: 15000, // 15 seconds

  /**
   * Cloudflare API
   * Standard timeout
   */
  cloudflare: 30000, // 30 seconds

  /**
   * GitHub API
   * Standard timeout
   */
  github: 30000, // 30 seconds

  /**
   * Default timeout for unspecified services
   */
  default: 60000, // 1 minute
} as const;

export type TimeoutProvider = keyof typeof API_TIMEOUTS;

/**
 * Get timeout for a provider
 *
 * @param provider Provider name
 * @returns Timeout in milliseconds
 *
 * @example
 * const timeout = getTimeout('anthropic'); // 120000
 */
export function getTimeout(provider: TimeoutProvider | string): number {
  if (provider in API_TIMEOUTS) {
    return API_TIMEOUTS[provider as TimeoutProvider];
  }
  logger.warn(`Unknown provider '${provider}', using default timeout`);
  return API_TIMEOUTS.default;
}

/**
 * Create an AbortSignal with timeout
 *
 * @param timeoutMs Timeout in milliseconds
 * @param provider Provider name for logging
 * @returns AbortController and cleanup function
 *
 * @example
 * const { signal, cleanup } = createTimeoutSignal(30000, 'qdrant');
 * try {
 *   const response = await fetch(url, { signal });
 * } finally {
 *   cleanup();
 * }
 */
export function createTimeoutSignal(
  timeoutMs: number,
  provider?: string
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    if (provider) {
      logger.warn(
        `⏱️  Request timeout for ${provider} after ${timeoutMs}ms`
      );
    }
    controller.abort();
  }, timeoutMs);

  const cleanup = () => {
    clearTimeout(timeoutId);
  };

  return { signal: controller.signal, cleanup };
}

/**
 * Wrapper for fetch with automatic timeout
 *
 * @param url URL to fetch
 * @param init Fetch init options
 * @param provider Provider name (for timeout lookup and logging)
 * @param customTimeoutMs Optional custom timeout (overrides provider default)
 * @returns Promise<Response>
 *
 * @example
 * const response = await fetchWithTimeout(
 *   'https://api.anthropic.com/v1/messages',
 *   { method: 'POST', body: JSON.stringify(data) },
 *   'anthropic'
 * );
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  provider: TimeoutProvider | string,
  customTimeoutMs?: number
): Promise<Response> {
  const timeoutMs = customTimeoutMs || getTimeout(provider);
  const { signal, cleanup } = createTimeoutSignal(timeoutMs, provider);

  try {
    // Merge abort signals if user provided one
    const combinedSignal = init.signal
      ? combineAbortSignals([init.signal, signal])
      : signal;

    const response = await fetch(url, {
      ...init,
      signal: combinedSignal,
    });

    cleanup();
    return response;
  } catch (error: any) {
    cleanup();

    // Enhance timeout errors with provider context
    if (error.name === "AbortError") {
      const timeoutError = new Error(
        `Request timeout for ${provider} after ${timeoutMs}ms`
      );
      timeoutError.name = "TimeoutError";
      (timeoutError as any).code = "ETIMEDOUT";
      (timeoutError as any).provider = provider;
      (timeoutError as any).timeoutMs = timeoutMs;
      throw timeoutError;
    }

    throw error;
  }
}

/**
 * Combine multiple abort signals into one
 *
 * @param signals Array of AbortSignals
 * @returns Combined AbortSignal
 */
function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }

    signal.addEventListener("abort", () => {
      controller.abort();
    });
  }

  return controller.signal;
}

/**
 * Execute a function with timeout
 *
 * Generic wrapper that adds timeout to any async function.
 *
 * @param fn Function to execute
 * @param timeoutMs Timeout in milliseconds
 * @param provider Provider name for logging
 * @returns Promise with function result
 *
 * @example
 * const result = await withTimeout(
 *   () => someSlowOperation(),
 *   30000,
 *   'myService'
 * );
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  provider?: string
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        const error = new Error(
          `Operation timeout${provider ? ` for ${provider}` : ""} after ${timeoutMs}ms`
        );
        error.name = "TimeoutError";
        (error as any).code = "ETIMEDOUT";
        (error as any).provider = provider;
        (error as any).timeoutMs = timeoutMs;
        reject(error);
      }, timeoutMs);
    }),
  ]);
}

/**
 * Timeout statistics tracker (optional monitoring)
 */
export class TimeoutTracker {
  private timeouts: Map<
    string,
    { count: number; totalMs: number; maxMs: number }
  > = new Map();

  /**
   * Record a timeout event
   */
  recordTimeout(provider: string, durationMs: number): void {
    const stats = this.timeouts.get(provider) || {
      count: 0,
      totalMs: 0,
      maxMs: 0,
    };

    stats.count++;
    stats.totalMs += durationMs;
    stats.maxMs = Math.max(stats.maxMs, durationMs);

    this.timeouts.set(provider, stats);
  }

  /**
   * Get timeout statistics for a provider
   */
  getStats(provider: string) {
    const stats = this.timeouts.get(provider);
    if (!stats) {
      return null;
    }

    return {
      count: stats.count,
      averageMs: stats.totalMs / stats.count,
      maxMs: stats.maxMs,
    };
  }

  /**
   * Get all statistics
   */
  getAllStats() {
    const result: Record<string, any> = {};
    for (const [provider, stats] of this.timeouts) {
      result[provider] = {
        count: stats.count,
        averageMs: stats.totalMs / stats.count,
        maxMs: stats.maxMs,
      };
    }
    return result;
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.timeouts.clear();
  }
}

// Global timeout tracker instance
export const timeoutTracker = new TimeoutTracker();
