/**
 * API Status Checker
 *
 * Verifica status de APIs externas usando credenciais reais dos Managers.
 */

import { getConfigValue } from "../config.js";
import { logger } from "../logger.js";

export interface APICheckResult {
  name: string;
  status: "online" | "offline" | "degraded" | "not_configured" | "unauthorized";
  responseTime?: number;
  error?: string;
}

/**
 * Formata tempo de resposta em string legível
 */
export function formatResponseTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Verifica uma API individual
 */
async function checkAPI(
  name: string,
  url: string,
  headers?: Record<string, string>,
  timeout = 5000
): Promise<APICheckResult> {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - start;

    if (response.status === 401 || response.status === 403) {
      return { name, status: "unauthorized", responseTime };
    }

    if (response.ok) {
      return { name, status: "online", responseTime };
    }

    return { name, status: "degraded", responseTime };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return {
      name,
      status: "offline",
      error: err.message,
      responseTime: Date.now() - start,
    };
  }
}

/**
 * Verifica todas as APIs configuradas
 */
export async function checkAllAPIs(): Promise<APICheckResult[]> {
  const results: APICheckResult[] = [];

  // Qdrant
  const qdrantUrl = getConfigValue("QDRANT_URL") || "http://localhost:6333";
  results.push(await checkAPI("Qdrant", `${qdrantUrl}/health`));

  // Ollama
  const ollamaUrl = getConfigValue("OLLAMA_BASE_URL") || "http://localhost:11434";
  results.push(await checkAPI("Ollama", `${ollamaUrl}/api/tags`));

  // LLaMA Server
  const llamaUrl = getConfigValue("LLAMA_SERVER_URL") || "http://localhost:11430";
  results.push(await checkAPI("LLaMA", `${llamaUrl}/health`));

  // OpenAI
  const openaiKey = getConfigValue("OPENAI_API_KEY");
  if (openaiKey) {
    results.push(
      await checkAPI("OpenAI", "https://api.openai.com/v1/models", {
        Authorization: `Bearer ${openaiKey}`,
      })
    );
  } else {
    results.push({ name: "OpenAI", status: "not_configured" });
  }

  // Anthropic
  const anthropicKey = getConfigValue("ANTHROPIC_API_KEY");
  if (anthropicKey) {
    results.push(
      await checkAPI("Anthropic", "https://api.anthropic.com/v1/messages", {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      })
    );
  } else {
    results.push({ name: "Anthropic", status: "not_configured" });
  }

  // Cloudflare
  const cfToken = getConfigValue("CLOUDFLARE_API_TOKEN");
  if (cfToken) {
    results.push(
      await checkAPI("Cloudflare", "https://api.cloudflare.com/client/v4/user/tokens/verify", {
        Authorization: `Bearer ${cfToken}`,
      })
    );
  } else {
    results.push({ name: "Cloudflare", status: "not_configured" });
  }

  // Perplexity
  const perplexityKey = getConfigValue("PERPLEXITY_API_KEY");
  if (perplexityKey) {
    results.push(
      await checkAPI("Perplexity", "https://api.perplexity.ai/chat/completions", {
        Authorization: `Bearer ${perplexityKey}`,
      })
    );
  } else {
    results.push({ name: "Perplexity", status: "not_configured" });
  }

  logger.debug(`API status check completed: ${results.length} APIs checked`);
  return results;
}
