/**
 * Provider Interface - Contract for all AI providers
 *
 * This interface defines the contract that all AI provider implementations must follow.
 * It ensures consistency across different providers (Anthropic, OpenAI, Ollama, OpenRouter, Google, Perplexity).
 *
 * @see src/providers/perplexity-provider.ts for implementation example
 * @see src/models.ts for provider registration
 */

/**
 * Supported AI providers in FazAI
 */
export type ProviderType =
  | "anthropic"
  | "openai"
  | "openrouter"
  | "ollama"
  | "google"
  | "perplexity";

/**
 * Message format following OpenAI's chat completion standard
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Configuration options for provider query
 */
export interface ProviderQueryOptions {
  /** Array of chat messages (system prompt + conversation history) */
  messages: ChatMessage[];

  /** AI model to use (e.g., "gpt-4o", "claude-3-5-sonnet-latest") */
  model: string;

  /** Maximum tokens to generate (default: 2048) */
  maxTokens?: number;

  /** Temperature for response randomness (0.0-1.0, default: 0.7) */
  temperature?: number;

  /** Whether to stream response chunks (default: true) */
  stream?: boolean;
}

/**
 * Result of API key validation
 */
export interface ValidationResult {
  /** Whether API key is valid */
  valid: boolean;

  /** Error message if validation failed */
  error?: string;

  /** Provider name for logging */
  provider: ProviderType;
}

/**
 * Provider interface - All AI providers must implement this
 *
 * Each provider implementation should:
 * 1. Validate API keys on initialization
 * 2. Support streaming responses via AsyncGenerator
 * 3. Handle errors gracefully with informative messages
 * 4. Log operations for debugging
 */
export interface Provider {
  /** Provider type identifier */
  readonly type: ProviderType;

  /** Provider display name (e.g., "Perplexity Sonar") */
  readonly name: string;

  /**
   * Validate if the provider is properly configured
   * Checks API key presence and optionally tests connectivity
   *
   * @returns Validation result with error details if invalid
   */
  validate(): Promise<ValidationResult>;

  /**
   * Query the AI provider with streaming response
   *
   * @param options Query configuration
   * @returns AsyncGenerator yielding response chunks
   * @throws Error if API key is missing or request fails
   *
   * @example
   * ```typescript
   * const provider = new PerplexityProvider();
   * const stream = provider.query({
   *   messages: [{ role: 'user', content: 'Hello' }],
   *   model: 'llama-3-sonar-small-32k-online'
   * });
   *
   * for await (const chunk of stream) {
   *   process.stdout.write(chunk);
   * }
   * ```
   */
  query(options: ProviderQueryOptions): AsyncGenerator<string, void, undefined>;

  /**
   * Get list of available models for this provider
   * Models are loaded from fazai.conf (MODELS_PROVIDER=model1,model2,model3)
   *
   * @returns Array of model names
   */
  getAvailableModels(): string[];
}

/**
 * Base provider class with common functionality
 *
 * Provides shared utilities for all provider implementations:
 * - API key validation from environment variables
 * - Standard error messages
 * - Logging helpers
 */
export abstract class BaseProvider implements Provider {
  abstract readonly type: ProviderType;
  abstract readonly name: string;

  /**
   * Get API key from environment variable
   *
   * @param envVarName Environment variable name (e.g., "PERPLEXITY_API_KEY")
   * @returns API key or undefined if not set
   */
  protected getAPIKey(envVarName: string): string | undefined {
    return process.env[envVarName]?.trim();
  }

  /**
   * Validate API key presence and format
   *
   * @param apiKey API key to validate
   * @param providerName Provider name for error messages
   * @returns Validation result
   */
  protected validateAPIKey(apiKey: string | undefined, providerName: string): ValidationResult {
    if (!apiKey || apiKey.length === 0) {
      return {
        valid: false,
        error: `${providerName} API key not found. Set ${this.getEnvVarName()} in fazai.conf`,
        provider: this.type,
      };
    }

    // Basic format validation (non-empty, no whitespace)
    if (apiKey.includes(" ") || apiKey.includes("\t")) {
      return {
        valid: false,
        error: `${providerName} API key contains invalid whitespace`,
        provider: this.type,
      };
    }

    return {
      valid: true,
      provider: this.type,
    };
  }

  /**
   * Get environment variable name for this provider
   * Override if your provider uses non-standard naming
   */
  protected getEnvVarName(): string {
    return `${this.type.toUpperCase()}_API_KEY`;
  }

  abstract validate(): Promise<ValidationResult>;
  abstract query(options: ProviderQueryOptions): AsyncGenerator<string, void, undefined>;
  abstract getAvailableModels(): string[];
}

/**
 * Error thrown when provider validation fails
 */
export class ProviderValidationError extends Error {
  constructor(
    public readonly provider: ProviderType,
    public readonly validationResult: ValidationResult
  ) {
    super(validationResult.error || `Provider ${provider} validation failed`);
    this.name = "ProviderValidationError";
  }
}

/**
 * Error thrown when provider query fails
 */
export class ProviderQueryError extends Error {
  constructor(
    public readonly provider: ProviderType,
    message: string,
    public readonly cause?: Error
  ) {
    super(`${provider} query failed: ${message}`);
    this.name = "ProviderQueryError";
  }
}
