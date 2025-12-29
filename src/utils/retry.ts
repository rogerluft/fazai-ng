/**
 * Retry Utility Module
 *
 * Provides robust retry logic with exponential backoff for API calls.
 * Handles rate limiting, transient failures, and provider-specific errors.
 *
 * Features:
 * - Exponential backoff with jitter
 * - Retry-After header parsing for rate limits
 * - Configurable per provider
 * - Retryable vs non-retryable error detection
 */

import { logger } from "../logger";

export interface RetryOptions {
  /**
   * Maximum number of retry attempts (default: 3)
   */
  maxRetries?: number;

  /**
   * Initial delay in milliseconds (default: 1000)
   */
  initialDelay?: number;

  /**
   * Maximum delay in milliseconds (default: 30000)
   */
  maxDelay?: number;

  /**
   * Backoff multiplier (default: 2)
   */
  backoffMultiplier?: number;

  /**
   * Add random jitter to prevent thundering herd (default: true)
   */
  useJitter?: number;

  /**
   * Provider name for logging (default: "unknown")
   */
  provider?: string;

  /**
   * Callback for rate limit handling
   */
  onRateLimit?: (retryAfterMs: number, provider: string) => Promise<void> | void;

  /**
   * Callback for retry attempts
   */
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

export interface RetryableError extends Error {
  status?: number;
  code?: string | number;
  response?: {
    headers?: Record<string, string | string[] | undefined>;
    status?: number;
  };
}

/**
 * Default retry configuration per provider
 */
export const DEFAULT_RETRY_CONFIG: Record<string, RetryOptions> = {
  anthropic: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    useJitter: 1000,
  },
  openai: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    useJitter: 1000,
  },
  openrouter: {
    maxRetries: 3,
    initialDelay: 1500,
    maxDelay: 60000,
    backoffMultiplier: 2,
    useJitter: 1000,
  },
  ollama: {
    maxRetries: 1, // Fast fail for local server - let fallback chain handle it
    initialDelay: 1000,
    maxDelay: 5000,
    backoffMultiplier: 1.5,
    useJitter: 250,
  },
  llama: {
    maxRetries: 1, // Fast fail for local server - let fallback chain handle it
    initialDelay: 500,
    maxDelay: 2000,
    backoffMultiplier: 1.5,
    useJitter: 250,
  },
  google: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    useJitter: 1000,
  },
  qdrant: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 20000,
    backoffMultiplier: 2,
    useJitter: 500,
  },
};

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: RetryableError): boolean {
  // Network errors are retryable
  if (
    error.code === "ECONNREFUSED" ||
    error.code === "ETIMEDOUT" ||
    error.code === "ENOTFOUND" ||
    error.code === "ECONNRESET" ||
    error.code === "EPIPE" ||
    error.code === "EAI_AGAIN"
  ) {
    return true;
  }

  // Check for error message patterns
  const message = error.message?.toLowerCase() || "";
  const errorName = error.name?.toLowerCase() || "";
  const errorType = (error as any).error?.type?.toLowerCase() || "";
  if (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("timed out") || // OpenAI SDK: "Request timed out."
    message.includes("connection") ||
    message.includes("socket") ||
    message.includes("econnrefused") ||
    message.includes("abort") ||
    message.includes("exceeds the available context") ||
    errorName === "aborterror" || // AbortController timeout
    errorType === "exceed_context_size_error" // llama.cpp context limit
  ) {
    return true;
  }

  const status = error.status || error.response?.status;

  // Rate limits are always retryable
  if (status === 429) {
    return true;
  }

  // Server errors (5xx) are retryable
  if (status && status >= 500 && status < 600) {
    return true;
  }

  // 408 Request Timeout
  if (status === 408) {
    return true;
  }

  // 503 Service Unavailable, 504 Gateway Timeout
  if (status === 503 || status === 504) {
    return true;
  }

  // Client errors (4xx except 429) are NOT retryable
  if (status && status >= 400 && status < 500) {
    return false;
  }

  // Default to not retryable
  return false;
}

/**
 * Parse Retry-After header
 *
 * Can be:
 * - Number of seconds: "120"
 * - HTTP-date: "Wed, 21 Oct 2015 07:28:00 GMT"
 *
 * @returns Delay in milliseconds
 */
export function parseRetryAfter(
  retryAfter: string | string[] | undefined
): number | null {
  if (!retryAfter) {
    return null;
  }

  const value = Array.isArray(retryAfter) ? retryAfter[0] : retryAfter;
  if (!value) {
    return null;
  }

  // Try parsing as number (seconds)
  const seconds = parseInt(value, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000;
  }

  // Try parsing as HTTP-date
  try {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      const delayMs = Math.max(0, date.getTime() - Date.now());
      return delayMs;
    }
  } catch {
    // Ignore parsing errors
  }

  return null;
}

/**
 * Handle rate limit errors
 */
export async function handleRateLimit(
  error: RetryableError,
  provider: string
): Promise<number> {
  const status = error.status || error.response?.status;

  if (status !== 429) {
    throw error;
  }

  // Try to parse Retry-After header
  const retryAfter = error.response?.headers?.["retry-after"];
  const delayMs = parseRetryAfter(retryAfter);

  if (delayMs !== null && delayMs > 0) {
    logger.warn(
      `⏱️  Rate limited by ${provider}. Waiting ${Math.ceil(delayMs / 1000)}s (from Retry-After header)...`
    );
    return delayMs;
  }

  // Default backoff for rate limits (60s)
  const defaultDelay = 60000;
  logger.warn(
    `⏱️  Rate limited by ${provider}. Waiting ${defaultDelay / 1000}s (default)...`
  );

  return defaultDelay;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  options: Required<RetryOptions>
): number {
  const { initialDelay, maxDelay, backoffMultiplier, useJitter } = options;

  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  const exponentialDelay = initialDelay * Math.pow(backoffMultiplier, attempt);

  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  // Add jitter to prevent thundering herd
  // Random value between 0 and useJitter
  const jitter = Math.random() * useJitter;

  return cappedDelay + jitter;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn Function to retry
 * @param options Retry configuration
 * @returns Promise with function result
 *
 * @example
 * const result = await withRetry(
 *   () => anthropic.messages.create({...}),
 *   { provider: 'anthropic', maxRetries: 3 }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const provider = options.provider || "unknown";
  const defaultConfig = DEFAULT_RETRY_CONFIG[provider] || {};

  const config: Required<RetryOptions> = {
    maxRetries: options.maxRetries ?? defaultConfig.maxRetries ?? 3,
    initialDelay: options.initialDelay ?? defaultConfig.initialDelay ?? 1000,
    maxDelay: options.maxDelay ?? defaultConfig.maxDelay ?? 30000,
    backoffMultiplier:
      options.backoffMultiplier ?? defaultConfig.backoffMultiplier ?? 2,
    useJitter: options.useJitter ?? defaultConfig.useJitter ?? 1000,
    provider,
    onRateLimit: options.onRateLimit ?? handleRateLimit,
    onRetry: options.onRetry ?? (() => {}),
  };

  let lastError: RetryableError | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      // Attempt the operation
      const result = await fn();
      return result;
    } catch (error: any) {
      lastError = error as RetryableError;

      // Check if this is the last attempt
      if (attempt === config.maxRetries) {
        logger.error(
          `❌ Operation failed after ${config.maxRetries + 1} attempts (${provider})`
        );
        throw error;
      }

      // Handle rate limiting
      const status = lastError.status || lastError.response?.status;
      if (status === 429 && config.onRateLimit) {
        const rateLimitDelay = await config.onRateLimit(lastError, provider);
        logger.info(
          `🔄 Rate limit: Retrying attempt ${attempt + 2}/${config.maxRetries + 1} after ${Math.ceil(rateLimitDelay / 1000)}s...`
        );
        await sleep(rateLimitDelay);
        continue;
      }

      // Check if error is retryable
      if (!isRetryableError(lastError)) {
        logger.debug(`⚠️  Non-retryable error from ${provider}: ${lastError.message}`);
        throw error;
      }

      // Calculate delay with exponential backoff
      const delayMs = calculateDelay(attempt, config);

      // Log retry attempt
      logger.warn(
        `⚠️  Attempt ${attempt + 1}/${config.maxRetries + 1} failed (${provider}): ${lastError.message}`
      );
      logger.info(
        `🔄 Retrying in ${Math.ceil(delayMs / 1000)}s... (attempt ${attempt + 2}/${config.maxRetries + 1})`
      );

      // Call retry callback
      config.onRetry(attempt + 1, lastError, delayMs);

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  // This should never be reached, but TypeScript requires it
  throw lastError || new Error("Retry loop failed unexpectedly");
}

/**
 * Retry wrapper for fetch with AbortController support
 *
 * @example
 * const response = await retryFetch(
 *   'https://api.example.com/data',
 *   { method: 'GET' },
 *   { provider: 'api', maxRetries: 3 },
 *   30000 // 30s timeout
 * );
 */
export async function retryFetch(
  url: string,
  init?: RequestInit,
  retryOptions?: RetryOptions,
  timeoutMs?: number
): Promise<Response> {
  return withRetry(async () => {
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;

    if (timeoutMs) {
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    }

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Convert non-2xx responses to errors for retry logic
      if (!response.ok) {
        const error: RetryableError = new Error(
          `HTTP ${response.status}: ${response.statusText}`
        );
        error.status = response.status;
        error.response = {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
        };
        throw error;
      }

      return response;
    } catch (error: any) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Handle AbortError
      if (error.name === "AbortError") {
        const timeoutError: RetryableError = new Error(
          `Request timeout after ${timeoutMs}ms`
        );
        timeoutError.code = "ETIMEDOUT";
        throw timeoutError;
      }

      throw error;
    }
  }, retryOptions);
}
