/**
 * API Status Checker Service
 *
 * Verifica status de APIs externas usando credenciais REAIS dos Managers.
 * Não usa HEAD requests sem autenticação (que retornam 401).
 *
 * @module api-status-checker
 */

import { CloudflareManager } from "../cloudflare-manager";
import { OPNsenseManager } from "../opnsense-manager";
import { loadConfig } from "../config";
import { logger } from "../logger";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Status possíveis de uma API
 */
export type APIStatus = "online" | "offline" | "degraded" | "not_configured" | "unauthorized";

/**
 * Resultado de verificação de status de uma API
 */
export interface APIStatusResult {
  /** Nome da API */
  name: string;
  /** Status atual */
  status: APIStatus;
  /** Tempo de resposta em ms (se aplicável) */
  responseTime?: number;
  /** Mensagem de erro (se houver) */
  error?: string;
}

/**
 * Thresholds para classificação de performance
 */
const THRESHOLDS = {
  /** <1000ms = online (boa performance) */
  ONLINE: 1000,
  /** 1000-3000ms = degraded (lento mas funcional) */
  DEGRADED: 3000,
} as const;

/**
 * Timeout para todas as verificações de API (5s)
 */
const API_TIMEOUT = 5000;

/**
 * Verifica status do Cloudflare usando CloudflareManager.listZones()
 */
async function checkCloudflareStatus(): Promise<APIStatusResult> {
  const start = Date.now();
  const config = loadConfig();

  try {
    // Verifica se credenciais estão configuradas
    const apiToken = config.cloudflareApiToken || process.env.CLOUDFLARE_API_TOKEN;
    if (!apiToken) {
      return {
        name: "Cloudflare",
        status: "not_configured",
        error: "CLOUDFLARE_API_TOKEN not configured",
      };
    }

    // Cria manager e tenta listar zonas (chamada real autenticada)
    const manager = new CloudflareManager();
    const zones = await Promise.race([
      manager.listZones(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), API_TIMEOUT)
      ),
    ]);

    const elapsed = Date.now() - start;

    // Classifica status baseado em tempo de resposta
    let status: APIStatus;
    if (elapsed < THRESHOLDS.ONLINE) {
      status = "online";
    } else if (elapsed < THRESHOLDS.DEGRADED) {
      status = "degraded";
    } else {
      status = "offline";
    }

    logger.debug(`Cloudflare: ${zones.length} zones, ${elapsed}ms, status=${status}`);

    return {
      name: "Cloudflare",
      status,
      responseTime: elapsed,
    };
  } catch (error: unknown) {
    const elapsed = Date.now() - start;
    const err = error instanceof Error ? error : new Error(String(error));

    // Detecta tipo de erro
    if (err.message.includes("Timeout")) {
      return {
        name: "Cloudflare",
        status: "offline",
        responseTime: elapsed,
        error: "Timeout após 5s",
      };
    }

    if (err.message.includes("401") || err.message.includes("Unauthorized")) {
      return {
        name: "Cloudflare",
        status: "unauthorized",
        error: "Credenciais inválidas",
      };
    }

    return {
      name: "Cloudflare",
      status: "offline",
      responseTime: elapsed,
      error: err.message.substring(0, 50),
    };
  }
}

/**
 * Verifica status do OpenAI usando SDK OpenAI com models.list()
 */
async function checkOpenAIStatus(): Promise<APIStatusResult> {
  const start = Date.now();
  const config = loadConfig();

  try {
    // Verifica se credenciais estão configuradas
    const apiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        name: "OpenAI",
        status: "not_configured",
        error: "OPENAI_API_KEY não configurada",
      };
    }

    // Cria client e tenta listar modelos (chamada real autenticada)
    const client = new OpenAI({ apiKey });
    const models = await Promise.race([
      client.models.list(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), API_TIMEOUT)
      ),
    ]);

    const elapsed = Date.now() - start;

    // Classifica status baseado em tempo de resposta
    let status: APIStatus;
    if (elapsed < THRESHOLDS.ONLINE) {
      status = "online";
    } else if (elapsed < THRESHOLDS.DEGRADED) {
      status = "degraded";
    } else {
      status = "offline";
    }

    logger.debug(`OpenAI: ${models.data.length} models, ${elapsed}ms, status=${status}`);

    return {
      name: "OpenAI",
      status,
      responseTime: elapsed,
    };
  } catch (error: unknown) {
    const elapsed = Date.now() - start;
    const err = error instanceof Error ? error : new Error(String(error));

    // Detecta tipo de erro
    if (err.message.includes("Timeout")) {
      return {
        name: "OpenAI",
        status: "offline",
        responseTime: elapsed,
        error: "Timeout após 5s",
      };
    }

    if (err.message.includes("401") || err.message.includes("Incorrect API key")) {
      return {
        name: "OpenAI",
        status: "unauthorized",
        error: "API key inválida",
      };
    }

    return {
      name: "OpenAI",
      status: "offline",
      responseTime: elapsed,
      error: err.message.substring(0, 50),
    };
  }
}

/**
 * Verifica status do Anthropic usando SDK Anthropic com chamada mínima
 */
async function checkAnthropicStatus(): Promise<APIStatusResult> {
  const start = Date.now();
  const config = loadConfig();

  try {
    // Verifica se credenciais estão configuradas
    const apiKey = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        name: "Anthropic",
        status: "not_configured",
        error: "ANTHROPIC_API_KEY não configurada",
      };
    }

    // Cria client e tenta chamada mínima (chamada real autenticada)
    const client = new Anthropic({ apiKey });
    const message = await Promise.race([
      client.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), API_TIMEOUT)
      ),
    ]);

    const elapsed = Date.now() - start;

    // Classifica status baseado em tempo de resposta
    let status: APIStatus;
    if (elapsed < THRESHOLDS.ONLINE) {
      status = "online";
    } else if (elapsed < THRESHOLDS.DEGRADED) {
      status = "degraded";
    } else {
      status = "offline";
    }

    logger.debug(`Anthropic: response received, ${elapsed}ms, status=${status}`);

    return {
      name: "Anthropic",
      status,
      responseTime: elapsed,
    };
  } catch (error: unknown) {
    const elapsed = Date.now() - start;
    const err = error instanceof Error ? error : new Error(String(error));

    // Detecta tipo de erro
    if (err.message.includes("Timeout")) {
      return {
        name: "Anthropic",
        status: "offline",
        responseTime: elapsed,
        error: "Timeout após 5s",
      };
    }

    if (err.message.includes("401") || err.message.includes("invalid_api_key")) {
      return {
        name: "Anthropic",
        status: "unauthorized",
        error: "API key inválida",
      };
    }

    return {
      name: "Anthropic",
      status: "offline",
      responseTime: elapsed,
      error: err.message.substring(0, 50),
    };
  }
}

/**
 * Verifica status do Google Gemini usando SDK Google com chamada mínima
 */
async function checkGoogleStatus(): Promise<APIStatusResult> {
  const start = Date.now();
  const config = loadConfig();

  try {
    // Verifica se credenciais estão configuradas
    const apiKey = config.geminiApiKey || config.googleApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return {
        name: "Google Gemini",
        status: "not_configured",
        error: "GEMINI_API_KEY não configurada",
      };
    }

    // Cria client e tenta chamada mínima (chamada real autenticada)
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await Promise.race([
      model.generateContent("ping"),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), API_TIMEOUT)
      ),
    ]);

    const elapsed = Date.now() - start;

    // Classifica status baseado em tempo de resposta
    let status: APIStatus;
    if (elapsed < THRESHOLDS.ONLINE) {
      status = "online";
    } else if (elapsed < THRESHOLDS.DEGRADED) {
      status = "degraded";
    } else {
      status = "offline";
    }

    logger.debug(`Google Gemini: response received, ${elapsed}ms, status=${status}`);

    return {
      name: "Google Gemini",
      status,
      responseTime: elapsed,
    };
  } catch (error: unknown) {
    const elapsed = Date.now() - start;
    const err = error instanceof Error ? error : new Error(String(error));

    // Detecta tipo de erro
    if (err.message.includes("Timeout")) {
      return {
        name: "Google Gemini",
        status: "offline",
        responseTime: elapsed,
        error: "Timeout após 5s",
      };
    }

    if (err.message.includes("401") || err.message.includes("API_KEY_INVALID")) {
      return {
        name: "Google Gemini",
        status: "unauthorized",
        error: "API key inválida",
      };
    }

    return {
      name: "Google Gemini",
      status: "offline",
      responseTime: elapsed,
      error: err.message.substring(0, 50),
    };
  }
}

/**
 * Verifica status do Ollama usando fetch simples
 */
async function checkOllamaStatus(): Promise<APIStatusResult> {
  const start = Date.now();
  const config = loadConfig();

  try {
    // Verifica se Ollama base URL está configurada
    const baseUrl = config.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";

    // Tenta acessar endpoint /api/tags (lista modelos disponíveis)
    const response = await Promise.race([
      fetch(`${baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(API_TIMEOUT),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), API_TIMEOUT)
      ),
    ]);

    const elapsed = Date.now() - start;

    if (!response.ok) {
      return {
        name: "Ollama",
        status: "offline",
        responseTime: elapsed,
        error: `HTTP ${response.status}`,
      };
    }

    // Classifica status baseado em tempo de resposta
    let status: APIStatus;
    if (elapsed < THRESHOLDS.ONLINE) {
      status = "online";
    } else if (elapsed < THRESHOLDS.DEGRADED) {
      status = "degraded";
    } else {
      status = "offline";
    }

    logger.debug(`Ollama: ${baseUrl}, ${elapsed}ms, status=${status}`);

    return {
      name: "Ollama",
      status,
      responseTime: elapsed,
    };
  } catch (error: unknown) {
    const elapsed = Date.now() - start;
    const err = error instanceof Error ? error : new Error(String(error));

    // Detecta tipo de erro
    if (err.message.includes("ECONNREFUSED")) {
      return {
        name: "Ollama",
        status: "offline",
        error: "Servidor Ollama não está rodando",
      };
    }

    if (err.message.includes("Timeout")) {
      return {
        name: "Ollama",
        status: "offline",
        responseTime: elapsed,
        error: "Timeout após 5s",
      };
    }

    return {
      name: "Ollama",
      status: "offline",
      responseTime: elapsed,
      error: err.message.substring(0, 50),
    };
  }
}

/**
 * Verifica status do Perplexity usando OpenAI SDK com base URL custom
 *
 * @returns Resultado da verificação de status
 */
async function checkPerplexityStatus(): Promise<APIStatusResult> {
  const start = Date.now();
  const config = loadConfig();

  try {
    const apiKey = config.perplexityApiKey || process.env.PERPLEXITY_API_KEY;

    if (!apiKey) {
      return {
        name: "Perplexity",
        status: "not_configured",
        error: "PERPLEXITY_API_KEY não configurada",
      };
    }

    // Perplexity uses OpenAI-compatible API
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({
      apiKey,
      baseURL: "https://api.perplexity.ai",
    });

    const models = await Promise.race([
      client.models.list(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), API_TIMEOUT)
      ),
    ]);

    const elapsed = Date.now() - start;

    // Classifica status baseado em tempo de resposta
    let status: APIStatus;
    if (elapsed < THRESHOLDS.ONLINE) {
      status = "online";
    } else if (elapsed < THRESHOLDS.DEGRADED) {
      status = "degraded";
    } else {
      status = "offline";
    }

    logger.debug(
      `Perplexity: ${models.data.length} models, ${elapsed}ms, status=${status}`
    );

    return {
      name: "Perplexity",
      status,
      responseTime: elapsed,
    };
  } catch (error: unknown) {
    const elapsed = Date.now() - start;
    const err = error instanceof Error ? error : new Error(String(error));

    // Detecta tipo de erro
    if (err.message.includes("Timeout")) {
      return {
        name: "Perplexity",
        status: "offline",
        responseTime: elapsed,
        error: "Timeout após 5s",
      };
    }

    if (err.message.includes("401") || err.message.includes("unauthorized")) {
      return {
        name: "Perplexity",
        status: "unauthorized",
        error: "API key inválida",
      };
    }

    return {
      name: "Perplexity",
      status: "offline",
      responseTime: elapsed,
      error: err.message.substring(0, 50),
    };
  }
}

/**
 * Verifica status do OPNsense usando OPNsenseManager
 */
async function checkOPNsenseStatus(): Promise<APIStatusResult> {
  const start = Date.now();
  const config = loadConfig();

  try {
    // Verifica se credenciais estão configuradas
    if (!config.opnsenseApiUrl || !config.opnsenseApiKey || !config.opnsenseApiSecret) {
      return {
        name: "OPNsense",
        status: "not_configured",
        error: "OPNSENSE_API_URL/KEY/SECRET não configuradas",
      };
    }

    const manager = new OPNsenseManager();
    // Tenta listar interfaces (chamada leve)
    await Promise.race([
      manager.listInterfaces(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), API_TIMEOUT)
      ),
    ]);

    const elapsed = Date.now() - start;

    // Classifica status baseado em tempo de resposta
    let status: APIStatus;
    if (elapsed < THRESHOLDS.ONLINE) {
      status = "online";
    } else if (elapsed < THRESHOLDS.DEGRADED) {
      status = "degraded";
    } else {
      status = "offline";
    }

    logger.debug(`OPNsense: response received, ${elapsed}ms, status=${status}`);

    return {
      name: "OPNsense",
      status,
      responseTime: elapsed,
    };
  } catch (error: unknown) {
    const elapsed = Date.now() - start;
    const err = error instanceof Error ? error : new Error(String(error));

    // Detecta tipo de erro
    if (err.message.includes("Timeout")) {
      return {
        name: "OPNsense",
        status: "offline",
        responseTime: elapsed,
        error: "Timeout após 5s",
      };
    }

    if (err.message.includes("401") || err.message.includes("403")) {
      return {
        name: "OPNsense",
        status: "unauthorized",
        error: "Credenciais inválidas",
      };
    }

    if (err.message.includes("ECONNREFUSED")) {
      return {
        name: "OPNsense",
        status: "offline",
        error: "Conexão recusada",
      };
    }

    return {
      name: "OPNsense",
      status: "offline",
      responseTime: elapsed,
      error: err.message.substring(0, 50),
    };
  }
}

/**
 * Verifica status de todas as APIs configuradas em paralelo
 *
 * @returns Array de resultados de status de API
 */
export async function checkAllAPIs(): Promise<APIStatusResult[]> {
  logger.debug("Iniciando verificação de status de APIs...");

  // Executa todas as verificações em paralelo
  const results = await Promise.all([
    checkCloudflareStatus(),
    checkOpenAIStatus(),
    checkAnthropicStatus(),
    checkGoogleStatus(),
    checkOllamaStatus(),
    checkPerplexityStatus(),
    checkOPNsenseStatus(),
  ]);

  // Log resumo
  const online = results.filter((r) => r.status === "online").length;
  const degraded = results.filter((r) => r.status === "degraded").length;
  const offline = results.filter((r) => r.status === "offline").length;
  const notConfigured = results.filter((r) => r.status === "not_configured").length;

  logger.debug(
    `Status APIs: ${online} online, ${degraded} degraded, ${offline} offline, ${notConfigured} not_configured`
  );

  return results;
}

/**
 * Retry logic com backoff exponencial
 *
 * @param fn Função a ser executada
 * @param maxRetries Número máximo de tentativas (padrão: 2)
 * @param delayMs Delay inicial em ms (padrão: 1000)
 * @returns Resultado da função
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Não retry em erros de autenticação
      if (
        lastError.message.includes("401") ||
        lastError.message.includes("unauthorized") ||
        lastError.message.includes("invalid_api_key")
      ) {
        throw lastError;
      }

      // Se não é a última tentativa, aguarda antes de retry
      if (attempt < maxRetries) {
        const backoffDelay = delayMs * Math.pow(2, attempt);
        logger.debug(`Retry ${attempt + 1}/${maxRetries} após ${backoffDelay}ms`);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      }
    }
  }

  throw lastError || new Error("withRetry failed without error");
}

/**
 * Formata status para exibição no dashboard
 *
 * @param status Status da API
 * @returns Emoji + texto formatado
 */
export function formatStatus(status: APIStatus): string {
  switch (status) {
    case "online":
      return "✅ Online";
    case "degraded":
      return "⚠️  Degraded";
    case "offline":
      return "❌ Offline";
    case "not_configured":
      return "⚙️  Not Configured";
    case "unauthorized":
      return "🔒 Unauthorized";
  }
}

/**
 * Formata tempo de resposta para exibição
 *
 * @param ms Tempo em milissegundos
 * @returns String formatada (ex: "356ms")
 */
export function formatResponseTime(ms: number | undefined): string {
  if (ms === undefined) {
    return "N/A";
  }
  return `${ms}ms`;
}
