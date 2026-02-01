/**
 * LlamaProvider - Provider para llama.cpp local server
 *
 * Conecta ao llama-server rodando localmente (porta 11430 por padrão).
 * O llama-server expõe API compatível com OpenAI (/v1/chat/completions).
 *
 * Configuração em /etc/fazai/fazai.conf:
 *   LLAMA_SERVER_URL=http://localhost:11430
 *   LLAMA_TIMEOUT=10000
 *   LLAMA_RETRIES=3
 *   LLAMA_TEMPERATURE=0.7
 *   LLAMA_MAX_TOKENS=2048
 *   MODELS_LLAMA=phi3-mini
 *
 * @see https://github.com/ggerganov/llama.cpp
 */

import { getConfigValue } from "../config.js";
import { logger } from "../logger.js";
import {
  BaseProvider,
  type ChatMessage,
  type ProviderQueryOptions,
  type ValidationResult,
  ProviderQueryError,
} from "../types/provider.js";

/**
 * Provider para llama.cpp local server
 *
 * Características:
 * - Zero hardcode: todas configurações vêm do fazai.conf
 * - Retry com backoff exponencial
 * - Timeout configurável
 * - API compatível OpenAI
 */
export class LlamaProvider extends BaseProvider {
  readonly type = "llama" as const;
  readonly name = "LLaMA.cpp Local";

  private baseUrl: string;
  private timeout: number;
  private retries: number;
  private temperature: number;
  private maxTokens: number;

  constructor() {
    super();
    // Carrega configurações do fazai.conf (runtime, não build time)
    this.baseUrl = getConfigValue("LLAMA_SERVER_URL") || "http://localhost:11430";
    this.timeout = parseInt(getConfigValue("LLAMA_TIMEOUT") || "10000", 10);
    this.retries = parseInt(getConfigValue("LLAMA_RETRIES") || "3", 10);
    this.temperature = parseFloat(getConfigValue("LLAMA_TEMPERATURE") || "0.7");
    this.maxTokens = parseInt(getConfigValue("LLAMA_MAX_TOKENS") || "2048", 10);

    logger.debug(`LlamaProvider initialized: ${this.baseUrl}, timeout=${this.timeout}ms`);
  }

  /**
   * Verifica se llama-server está disponível
   */
  async validate(): Promise<ValidationResult> {
    const available = await this.isAvailable();

    if (!available) {
      return {
        valid: false,
        error: `llama-server não disponível em ${this.baseUrl}. Verifique: systemctl status fazai-llama`,
        provider: this.type,
      };
    }

    return {
      valid: true,
      provider: this.type,
    };
  }

  /**
   * Verifica se servidor está respondendo com retry
   */
  async isAvailable(): Promise<boolean> {
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(`${this.baseUrl}/health`, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          logger.debug(`llama-server disponível em ${this.baseUrl}`);
          return true;
        }
      } catch (error) {
        logger.debug(`llama-server tentativa ${attempt}/${this.retries} falhou: ${(error as Error).message}`);
        if (attempt < this.retries) {
          await this.sleep(1000 * attempt); // Backoff: 1s, 2s, 3s
        }
      }
    }

    logger.warn(`llama-server não disponível após ${this.retries} tentativas`);
    return false;
  }

  /**
   * Query com streaming response
   */
  async *query(options: ProviderQueryOptions): AsyncGenerator<string, void, undefined> {
    const { messages, maxTokens, temperature, stream = true } = options;

    // Usar valores do options se fornecidos, senão usar do conf
    const finalMaxTokens = maxTokens ?? this.maxTokens;
    const finalTemperature = temperature ?? this.temperature;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout * 10); // Timeout maior para geração

        // Obter modelo do config (MODELS_LLAMA) ou usar default
        const modelName = this.getAvailableModels()[0] || "phi3:latest";

        const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            model: modelName, // REQUIRED pelo Ollama OpenAI-compatible API
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            temperature: finalTemperature,
            max_tokens: finalMaxTokens,
            stream,
          }),
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Capturar body do erro para diagnóstico
          const errorBody = await response.text().catch(() => "");
          throw new Error(`HTTP ${response.status}: ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`);
        }

        if (stream && response.body) {
          // Streaming response
          yield* this.processStream(response.body);
        } else {
          // Non-streaming response
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            yield content;
          }
        }

        return; // Sucesso, sai do loop

      } catch (error) {
        lastError = error as Error;
        logger.warn(`llama chat tentativa ${attempt}/${this.retries}: ${lastError.message}`);

        if (attempt < this.retries) {
          await this.sleep(1000 * attempt);
        }
      }
    }

    throw new ProviderQueryError(
      this.type,
      `Falhou após ${this.retries} tentativas: ${lastError?.message}`,
      lastError ?? undefined
    );
  }

  /**
   * Processa stream SSE do llama-server
   */
  private async *processStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string, void, undefined> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Processa linhas completas
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Última linha incompleta volta pro buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();

            if (data === "[DONE]") {
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch {
              // Ignora linhas malformadas
            }
          }
        }
      }

      // Processa resto do buffer
      if (buffer.trim() && buffer.startsWith("data: ")) {
        const data = buffer.slice(6).trim();
        if (data !== "[DONE]") {
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch {
            // Ignora
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Query simples (não-streaming) para uso interno
   */
  async chat(messages: ChatMessage[]): Promise<string> {
    let result = "";

    for await (const chunk of this.query({ messages, model: "phi3", stream: false })) {
      result += chunk;
    }

    return result;
  }

  /**
   * Retorna modelos disponíveis do conf
   */
  getAvailableModels(): string[] {
    const modelsStr = getConfigValue("MODELS_LLAMA");
    if (modelsStr) {
      return modelsStr.split(",").map((m) => m.trim()).filter((m) => m.length > 0);
    }
    return ["phi3-mini"]; // Default
  }

  /**
   * Utility: sleep com Promise
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Override: não usa API key tradicional
   */
  protected getEnvVarName(): string {
    return "LLAMA_SERVER_URL";
  }
}

/**
 * Singleton factory para LlamaProvider
 */
let llamaProviderInstance: LlamaProvider | null = null;

export function getLlamaProvider(): LlamaProvider {
  if (!llamaProviderInstance) {
    llamaProviderInstance = new LlamaProvider();
  }
  return llamaProviderInstance;
}

/**
 * Verifica se llama-server está disponível (utility)
 */
export async function isLlamaServerAvailable(): Promise<boolean> {
  const provider = getLlamaProvider();
  return provider.isAvailable();
}
