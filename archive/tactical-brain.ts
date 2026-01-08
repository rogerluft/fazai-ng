/**
 * TacticalBrain Service Module
 *
 * Phi-3 Mini integration for fast, local, tactical thinking.
 * Optimized for quick decisions and execution tasks.
 *
 * Features:
 * - Primary: Ollama Phi-3 Mini (local, fast, 4K context)
 * - Fallback: OpenRouter cloud (3-Strike Rule)
 * - Streaming responses via AsyncGenerator
 * - Chain-of-Thought prompting optimized for small models
 * - Timeout handling with AbortController
 * - Retry logic with exponential backoff
 */

import { getConfigValue } from "../config";
import { logger } from "../logger";
import { withRetry } from "../utils/retry";
import { API_TIMEOUTS } from "../config/timeouts";

/**
 * Task execution result
 */
export interface TaskResult {
  /** Task completed successfully */
  success: boolean;

  /** Task output/result */
  output: string;

  /** Whether fallback provider was used */
  usedFallback: boolean;

  /** Provider that was actually used */
  provider: "ollama" | "openrouter";

  /** Execution time in milliseconds */
  executionTimeMs: number;

  /** Error message if failed */
  error?: string;
}

/**
 * TacticalBrain configuration options
 */
export interface TacticalBrainOptions {
  /** Ollama base URL (default: from config or 192.168.0.101:11434) */
  ollamaBaseUrl?: string;

  /** Ollama model name (default: phi3) */
  ollamaModel?: string;

  /** OpenRouter API key (default: from config) */
  openrouterApiKey?: string;

  /** OpenRouter model (default: microsoft/phi-3-mini-128k-instruct:free) */
  openrouterModel?: string;

  /** Timeout per attempt in milliseconds (default: 45000) */
  timeout?: number;

  /** Maximum retry attempts before fallback (default: 3) */
  maxRetries?: number;

  /** Enable verbose logging (default: false) */
  verbose?: boolean;
}

/**
 * TacticalBrain - Fast local inference with cloud fallback
 *
 * Phi-3 Mini is a small but capable model optimized for:
 * - Quick tactical decisions
 * - Code generation
 * - Command execution planning
 * - Short context reasoning
 *
 * @example
 * const brain = new TacticalBrain();
 *
 * // Streaming response
 * for await (const chunk of brain.think("Generate a bash command to find large files")) {
 *   process.stdout.write(chunk);
 * }
 *
 * // Execute task with result
 * const result = await brain.execute("Fix the syntax error in this TypeScript code");
 * console.log(result.output);
 */
export class TacticalBrain {
  private readonly ollamaBaseUrl: string;
  private readonly ollamaModel: string;
  private readonly openrouterApiKey: string | undefined;
  private readonly openrouterModel: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly verbose: boolean;

  // 3-Strike Rule tracking
  private strikeCount: number = 0;
  private readonly MAX_STRIKES = 3;

  constructor(options: TacticalBrainOptions = {}) {
    // Load configuration with fallbacks
    this.ollamaBaseUrl =
      options.ollamaBaseUrl ||
      getConfigValue("OLLAMA_BASE_URL") ||
      "http://192.168.0.101:11434";

    this.ollamaModel = options.ollamaModel || getConfigValue("PHI3_MODEL") || "phi3";

    this.openrouterApiKey =
      options.openrouterApiKey || getConfigValue("OPENROUTER_API_KEY");

    this.openrouterModel =
      options.openrouterModel ||
      getConfigValue("PHI3_OPENROUTER_MODEL") ||
      "microsoft/phi-3-mini-128k-instruct:free";

    this.timeout = options.timeout || 45000; // 45 seconds per attempt
    this.maxRetries = options.maxRetries || 3;
    this.verbose = options.verbose || false;

    if (this.verbose) {
      logger.debug("TacticalBrain initialized:");
      logger.debug(`  Primary: ${this.ollamaBaseUrl} (${this.ollamaModel})`);
      logger.debug(`  Fallback: OpenRouter (${this.openrouterModel})`);
      logger.debug(`  Timeout: ${this.timeout}ms`);
      logger.debug(`  Max Retries: ${this.maxRetries}`);
    }
  }

  /**
   * Think - Stream thinking process (Chain-of-Thought)
   *
   * Yields chunks of text as the model generates them.
   * Uses streaming for better UX on long responses.
   *
   * @param prompt User prompt/question
   * @param context Optional context to include
   * @returns AsyncGenerator yielding text chunks
   *
   * @example
   * for await (const chunk of brain.think("How to optimize this query?")) {
   *   process.stdout.write(chunk);
   * }
   */
  async *think(prompt: string, context?: string): AsyncGenerator<string> {
    const startTime = Date.now();

    // Build system prompt optimized for Phi-3
    const systemPrompt = this.buildSystemPrompt();

    // Build user prompt with optional context
    const userPrompt = context
      ? `Context:\n${context}\n\nTask:\n${prompt}`
      : prompt;

    // Try primary (Ollama) up to maxRetries times
    if (this.strikeCount < this.MAX_STRIKES) {
      try {
        yield* this.streamFromOllama(systemPrompt, userPrompt);
        this.strikeCount = 0; // Reset on success
        const elapsed = Date.now() - startTime;
        logger.info(`✓ TacticalBrain (Ollama): ${elapsed}ms`);
        return;
      } catch (error: any) {
        this.strikeCount++;
        logger.warn(
          `⚠️  Ollama failed (strike ${this.strikeCount}/${this.MAX_STRIKES}): ${error.message}`
        );

        if (this.strikeCount >= this.MAX_STRIKES) {
          logger.warn(
            `⚡ 3-Strike Rule triggered: Falling back to OpenRouter cloud`
          );
        }
      }
    }

    // Fallback to OpenRouter cloud
    if (!this.openrouterApiKey) {
      throw new Error(
        "OpenRouter API key required for fallback (set OPENROUTER_API_KEY)"
      );
    }

    try {
      yield* this.streamFromOpenRouter(systemPrompt, userPrompt);
      const elapsed = Date.now() - startTime;
      logger.info(`✓ TacticalBrain (OpenRouter fallback): ${elapsed}ms`);
    } catch (error: any) {
      logger.error(`❌ TacticalBrain failed (all providers): ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute - Run task and return complete result
   *
   * Non-streaming version for cases where you need the full result.
   * Uses compact Chain-of-Thought prompting for Phi-3.
   *
   * @param task Task description
   * @returns TaskResult with output and metadata
   *
   * @example
   * const result = await brain.execute("Generate a regex for email validation");
   * if (result.success) {
   *   console.log(result.output);
   * }
   */
  async execute(task: string): Promise<TaskResult> {
    const startTime = Date.now();
    let output = "";
    let usedFallback = false;
    let provider: "ollama" | "openrouter" = "ollama";

    try {
      // Build compact CoT prompt for Phi-3
      const prompt = this.buildCompactCoTPrompt(task);

      // Collect all chunks
      for await (const chunk of this.think(prompt)) {
        output += chunk;
      }

      // Check if we used fallback
      if (this.strikeCount >= this.MAX_STRIKES) {
        usedFallback = true;
        provider = "openrouter";
      }

      const executionTimeMs = Date.now() - startTime;

      return {
        success: true,
        output: output.trim(),
        usedFallback,
        provider,
        executionTimeMs,
      };
    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;

      return {
        success: false,
        output: "",
        usedFallback: this.strikeCount >= this.MAX_STRIKES,
        provider: this.strikeCount >= this.MAX_STRIKES ? "openrouter" : "ollama",
        executionTimeMs,
        error: error.message,
      };
    }
  }

  /**
   * Reset strike counter
   *
   * Useful for testing or manual recovery after network issues.
   */
  resetStrikes(): void {
    this.strikeCount = 0;
    logger.debug("TacticalBrain: Strike counter reset");
  }

  /**
   * Get current strike count
   */
  getStrikes(): number {
    return this.strikeCount;
  }

  /**
   * Stream from Ollama with retry logic
   */
  private async *streamFromOllama(
    systemPrompt: string,
    userPrompt: string
  ): AsyncGenerator<string> {
    const endpoint = `${this.ollamaBaseUrl}/api/generate`;

    const response = await withRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: this.ollamaModel,
              prompt: `${systemPrompt}\n\n${userPrompt}`,
              stream: true,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!res.ok) {
            const errorText = await res.text().catch(() => "");
            throw new Error(
              `Ollama API error ${res.status}: ${errorText || res.statusText}`
            );
          }

          return res;
        } catch (error: any) {
          clearTimeout(timeoutId);
          throw error;
        }
      },
      {
        provider: "ollama",
        maxRetries: this.maxRetries,
      }
    );

    // Stream response chunks
    if (!response.body) {
      throw new Error("Ollama response has no body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.response) {
              yield data.response;
            }

            if (data.done) {
              return;
            }
          } catch (parseError) {
            // Ignore malformed JSON lines
            logger.debug(`Skipping malformed Ollama chunk: ${line}`);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Stream from OpenRouter with retry logic
   */
  private async *streamFromOpenRouter(
    systemPrompt: string,
    userPrompt: string
  ): AsyncGenerator<string> {
    if (!this.openrouterApiKey) {
      throw new Error("OpenRouter API key not configured");
    }

    const endpoint = "https://openrouter.ai/api/v1/chat/completions";

    const response = await withRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.openrouterApiKey}`,
              "HTTP-Referer": "https://github.com/rluft/fazai-ng",
              "X-Title": "FazAI TacticalBrain",
            },
            body: JSON.stringify({
              model: this.openrouterModel,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              stream: true,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!res.ok) {
            const errorText = await res.text().catch(() => "");
            throw new Error(
              `OpenRouter API error ${res.status}: ${errorText || res.statusText}`
            );
          }

          return res;
        } catch (error: any) {
          clearTimeout(timeoutId);
          throw error;
        }
      },
      {
        provider: "openrouter",
        maxRetries: this.maxRetries,
      }
    );

    // Stream SSE response
    if (!response.body) {
      throw new Error("OpenRouter response has no body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            if (data === "[DONE]") {
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;

              if (content) {
                yield content;
              }
            } catch (parseError) {
              // Ignore malformed JSON
              logger.debug(`Skipping malformed OpenRouter chunk: ${line}`);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Build system prompt optimized for Phi-3 Mini
   *
   * Phi-3 performs best with clear, structured instructions.
   */
  private buildSystemPrompt(): string {
    return `You are a tactical AI assistant specialized in quick, accurate responses.

Rules:
- Be concise and direct
- Focus on practical solutions
- Use step-by-step reasoning when needed
- For code: provide working examples
- For commands: explain what they do
- Stay within your knowledge cutoff

Output format:
- Start with brief explanation (if complex)
- Provide solution
- Add notes if relevant`;
  }

  /**
   * Build compact Chain-of-Thought prompt for small models
   *
   * Phi-3 has limited context, so we use abbreviated CoT.
   */
  private buildCompactCoTPrompt(task: string): string {
    return `Task: ${task}

Think step-by-step (brief):
1. What is needed?
2. How to achieve it?
3. Best solution?

Solution:`;
  }
}

/**
 * Create TacticalBrain instance with automatic configuration
 *
 * @param options Optional configuration overrides
 * @returns TacticalBrain instance
 *
 * @example
 * const brain = createTacticalBrain({ verbose: true });
 * const result = await brain.execute("Generate regex for IPv4");
 */
export function createTacticalBrain(
  options: TacticalBrainOptions = {}
): TacticalBrain {
  return new TacticalBrain(options);
}
