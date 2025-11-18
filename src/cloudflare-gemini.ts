import OpenAI from "openai";
import chalk from "chalk";
import { logger } from "./logger";
import { getConfigValue } from "./config";

/**
 * Cloudflare Gemini Integration
 *
 * Uses Gemini CLI OpenAI (https://github.com/GewoonJaap/gemini-cli-openai)
 * which exposes Google's Gemini models as OpenAI-compatible endpoints
 * via Cloudflare Workers for global edge deployment.
 *
 * Configuration:
 * - GEMINI_WORKER_URL: Cloudflare Worker endpoint (e.g., https://your-worker.your-subdomain.workers.dev)
 * - GCP_SERVICE_ACCOUNT: OAuth2 credentials for Gemini (optional for public access)
 * - OPENAI_API_KEY: Optional API key for authentication
 *
 * Supported Models:
 * - gemini-2.5-pro (1M context, 65K max tokens)
 * - gemini-2.5-flash (1M context, 65K max tokens)
 * - gemini-2.5-flash-lite (1M context, 65K max tokens)
 */

export interface CloudflareGeminiConfig {
  workerUrl: string;
  apiKey?: string;
  serviceAccount?: string;
  isConfigured: boolean;
}

export class CloudflareGeminiClient {
  private workerUrl: string | null = null;
  private apiKey: string | null = null;
  private client: OpenAI | null = null;

  constructor() {
    this.loadConfiguration();
  }

  /**
   * Load Gemini configuration from environment and config file
   */
  private loadConfiguration(): void {
    // Priority 1: Environment variable
    this.workerUrl = process.env.GEMINI_WORKER_URL || getConfigValue("GEMINI_WORKER_URL");
    this.apiKey = process.env.OPENAI_API_KEY || getConfigValue("GEMINI_API_KEY");

    if (this.workerUrl) {
      logger.debug(`Gemini Worker URL: ${this.workerUrl}`);
    }
  }

  /**
   * Check if Gemini is configured
   */
  isConfigured(): boolean {
    return !!this.workerUrl;
  }

  /**
   * Get or create OpenAI client pointing to Cloudflare Worker
   */
  private getClient(): OpenAI {
    if (this.client) {
      return this.client;
    }

    if (!this.workerUrl) {
      throw new Error(
        "Gemini Worker URL not configured. Set GEMINI_WORKER_URL in config or environment."
      );
    }

    this.client = new OpenAI({
      baseURL: this.workerUrl,
      apiKey: this.apiKey || "dummy-key", // Public access if no key provided
      timeout: 120000,
      maxRetries: 3,
    });

    return this.client;
  }

  /**
   * Create a chat completion using Gemini
   */
  async createChatCompletion(options: {
    model: "gemini-2.5-pro" | "gemini-2.5-flash" | "gemini-2.5-flash-lite";
    messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }>;
    temperature?: number;
    maxTokens?: number;
    thinking?: {
      type: "enabled" | "disabled";
      budget_tokens?: number;
    };
  }): Promise<any> {
    const client = this.getClient();

    try {
      const response = await client.chat.completions.create({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096,
        ...(options.thinking && { thinking: options.thinking }),
      });

      return response;
    } catch (error: any) {
      logger.error(chalk.red(`❌ Gemini API error: ${error.message}`));
      throw error;
    }
  }

  /**
   * Stream chat completion from Gemini
   */
  async *streamChatCompletion(options: {
    model: "gemini-2.5-pro" | "gemini-2.5-flash" | "gemini-2.5-flash-lite";
    messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }>;
    temperature?: number;
    maxTokens?: number;
  }): AsyncGenerator<string> {
    const client = this.getClient();

    try {
      const stream = await client.chat.completions.create({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096,
        stream: true,
      });

      for await (const chunk of stream) {
        if (chunk.choices[0]?.delta?.content) {
          yield chunk.choices[0].delta.content;
        }
      }
    } catch (error: any) {
      logger.error(chalk.red(`❌ Gemini stream error: ${error.message}`));
      throw error;
    }
  }

  /**
   * Get available models from Gemini Worker
   */
  async listModels(): Promise<any[]> {
    const client = this.getClient();
    try {
      const response = await client.models.list();
      return response.data;
    } catch (error: any) {
      logger.warn(chalk.yellow(`⚠️  Could not list models: ${error.message}`));
      // Return default models if API fails
      return [
        { id: "gemini-2.5-pro", owned_by: "google" },
        { id: "gemini-2.5-flash", owned_by: "google" },
        { id: "gemini-2.5-flash-lite", owned_by: "google" },
      ];
    }
  }

  /**
   * Get configuration details
   */
  getConfig(): CloudflareGeminiConfig {
    return {
      workerUrl: this.workerUrl || "",
      apiKey: this.apiKey ? "***" : undefined,
      isConfigured: this.isConfigured(),
    };
  }
}

// Singleton instance
let geminiInstance: CloudflareGeminiClient | null = null;

/**
 * Get or create Cloudflare Gemini client
 */
export function getCloudflareGemini(): CloudflareGeminiClient {
  if (!geminiInstance) {
    geminiInstance = new CloudflareGeminiClient();
  }
  return geminiInstance;
}
