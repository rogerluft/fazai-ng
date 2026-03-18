/**
 * Configuration Schema Validation with Zod
 * 
 * Validates fazai.conf structure to catch configuration errors early.
 * Provides helpful error messages for common misconfigurations.
 * 
 * Features:
 * - URL validation (http/https format)
 * - API key format validation
 * - Timeout validation (positive numbers)
 * - Model list validation (max 3 per provider)
 * - Provider fallback order validation
 * 
 * @module config/schema
 */

import { z } from "zod";

/**
 * URL schema - must be valid HTTP/HTTPS URL
 */
const urlSchema = z
  .string()
  .url({ message: "Must be a valid HTTP or HTTPS URL" })
  .regex(/^https?:\/\//, { message: "URL must start with http:// or https://" });

/**
 * API Key schema - basic validation for common formats
 * 
 * Common patterns:
 * - OpenAI: sk-...
 * - Anthropic: sk-ant-...
 * - OpenRouter: sk-or-...
 * - Perplexity: pplx-...
 * - Google: AIzaSy...
 * - Generic: minimum 20 chars for security
 */
const apiKeySchema = z
  .string()
  .min(20, { message: "API key must be at least 20 characters" })
  .regex(/^[A-Za-z0-9\-_\.]+$/, { message: "API key contains invalid characters" });

/**
 * OAuth Token schema - for tokens like Anthropic OAuth from `claude setup-token`
 * 
 * OAuth tokens are typically longer and may have different format
 */
const oauthTokenSchema = z
  .string()
  .min(40, { message: "OAuth token must be at least 40 characters" });

/**
 * Timeout schema - must be positive integer in seconds
 */
const timeoutSchema = z
  .number()
  .int({ message: "Timeout must be an integer" })
  .positive({ message: "Timeout must be positive" })
  .max(600, { message: "Timeout should not exceed 600 seconds (10 minutes)" });

/**
 * Model list schema - comma-separated, max 3 models
 * 
 * Examples:
 * - "gpt-4o-mini,gpt-4o"
 * - "qwen2.5:7b,tinyllama:1b"
 * - "claude-sonnet-4-5,claude-haiku-4-5"
 */
const modelListSchema = z
  .string()
  .refine(
    (val) => {
      const models = val.split(",").map((m) => m.trim()).filter((m) => m.length > 0);
      return models.length > 0 && models.length <= 3;
    },
    { message: "Must contain 1-3 models (comma-separated)" }
  )
  .refine(
    (val) => {
      const models = val.split(",").map((m) => m.trim());
      return models.every((m) => m.length > 0);
    },
    { message: "Model names cannot be empty" }
  );

/**
 * Provider fallback order schema
 * 
 * Valid providers: google, ollama, openrouter, anthropic, openai, llama, perplexity
 * Example: "google,ollama,openrouter,anthropic"
 */
const validProviders = ["google", "ollama", "openrouter", "anthropic", "openai", "llama", "perplexity"] as const;

const providerFallbackOrderSchema = z
  .string()
  .refine(
    (val) => {
      const providers = val.split(",").map((p) => p.trim());
      return providers.every((p) => validProviders.includes(p as any));
    },
    { 
      message: `Provider list contains invalid provider. Valid: ${validProviders.join(", ")}` 
    }
  )
  .refine(
    (val) => {
      const providers = val.split(",").map((p) => p.trim());
      const unique = new Set(providers);
      return unique.size === providers.length;
    },
    { message: "Provider list contains duplicates" }
  )
  .refine(
    (val) => {
      // Check for common typos
      const lower = val.toLowerCase();
      if (lower.includes("googl,e") || lower.includes("eollama")) {
        return false;
      }
      return true;
    },
    { message: "Provider list contains typos (e.g., 'googl,eollama' should be 'google,ollama')" }
  );

/**
 * Boolean schema - accepts "true", "false", "1", "0"
 */
const booleanStringSchema = z
  .string()
  .refine(
    (val) => ["true", "false", "1", "0"].includes(val.toLowerCase()),
    { message: "Must be 'true', 'false', '1', or '0'" }
  );

/**
 * Full FazAI configuration schema
 * 
 * All fields are optional to allow partial configs,
 * but when present, they must be valid.
 */
export const configSchema = z.object({
  // Model Configuration
  MODELS_OLLAMA: modelListSchema.optional(),
  MODELS_OPENROUTER: modelListSchema.optional(),
  MODELS_PERPLEXITY: modelListSchema.optional(),
  MODELS_GOOGLE: modelListSchema.optional(),
  MODELS_OPENAI: modelListSchema.optional(),
  MODELS_ANTHROPIC: modelListSchema.optional(),
  MODELS_LLAMA: modelListSchema.optional(),

  // API Keys
  OPENROUTER_API_KEY: apiKeySchema.optional(),
  PERPLEXITY_API_KEY: apiKeySchema.optional(),
  GEMINI_API_KEY: apiKeySchema.optional(),
  GOOGLE_API_KEY: apiKeySchema.optional(),
  OPENAI_API_KEY: apiKeySchema.optional(),
  ANTHROPIC_API_KEY: z.union([apiKeySchema, oauthTokenSchema]).optional(),
  JULES_API_KEY: apiKeySchema.optional(),
  GITHUB_TOKEN: apiKeySchema.optional(),
  CLOUDFLARE_API_TOKEN: apiKeySchema.optional(),
  CLOUDFLARE_API_KEY: apiKeySchema.optional(),
  SPAMEXPERTS_API_KEY: apiKeySchema.optional(),
  OPNSENSE_API_KEY: apiKeySchema.optional(),

  // OAuth Tokens (longer format)
  ANTHROPIC_OAUTH_TOKEN: oauthTokenSchema.optional(),

  // URLs
  OLLAMA_BASE_URL: urlSchema.optional(), // LLM inference only (not embeddings)
  QDRANT_URL: urlSchema.optional(),
  LLAMA_SERVER_URL: urlSchema.optional(),
  GEMINI_WORKER_URL: urlSchema.optional(),
  MCP_CONTEXT7_URL: urlSchema.optional(),
  SPAMEXPERTS_API_URL: urlSchema.optional(),
  OPNSENSE_API_URL: urlSchema.optional(),

  // Email Configuration
  CLOUDFLARE_EMAIL: z.string().email({ message: "Must be a valid email" }).optional(),
  SPAMEXPERTS_USERNAME: z.string().min(1).optional(),

  // Passwords/Secrets
  SPAMEXPERTS_PASSWORD: z.string().min(8).optional(),
  OPNSENSE_API_SECRET: z.string().min(20).optional(),
  WEB_UI_PASSWORD: z.string().min(6, { message: "Password must be at least 6 characters" }).optional(),

  // Timeouts (parsed as numbers)
  FAZAI_MAX_RETRIES: z.number().int().positive().max(10).optional(),
  API_TIMEOUT: timeoutSchema.optional(),
  EMBEDDING_TIMEOUT: timeoutSchema.optional(),

  // Provider Configuration
  PROVIDER_FALLBACK_ORDER: providerFallbackOrderSchema.optional(),
  
  // Feature Flags
  ENABLE_PREVIEW_FEATURES: booleanStringSchema.optional(),
  FAZAI_DISABLE_RESEARCH: booleanStringSchema.optional(),
  OPNSENSE_SSL_VERIFY: booleanStringSchema.optional(),

  // Other Settings
  WEB_HOST: z.string().optional(),
  WEB_PORT: z.number().int().positive().max(65535).optional(),
  WEB_UI_USERNAME: z.string().min(1).optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  FAZAI_CONFIG_PATH: z.string().optional(),
  LOCAL_INFERENCE_MODEL: z.string().optional(),
  MCP_CONTEXT7_COMMAND: z.string().optional(),
  MCP_CONTEXT7_API_KEY: apiKeySchema.optional(),
  WEB_SEARCH_PROVIDER: z.string().optional(),
  VECTOR_PROVIDER: z.string().optional(),
  VECTOR_DIMENSION: z.number().int().positive().optional(),
  VECTOR_DISTANCE: z.enum(["cosine", "euclid", "dot"]).optional(),
  QDRANT_API_KEY: apiKeySchema.optional(),
}).passthrough(); // Allow other keys not in schema

export type FazAIConfig = z.infer<typeof configSchema>;

/**
 * Fields that should be converted to numbers
 */
const NUMERIC_FIELDS = new Set([
  "FAZAI_MAX_RETRIES",
  "WEB_PORT",
  "VECTOR_DIMENSION",
  "API_TIMEOUT",
  "EMBEDDING_TIMEOUT",
]);

/**
 * Validate configuration object
 * 
 * @param config Configuration object to validate
 * @returns Validation result with success flag and errors
 */
export function validateConfig(config: Record<string, string | number | boolean>): {
  success: boolean;
  errors: Array<{ field: string; message: string }>;
  data?: FazAIConfig;
} {
  try {
    // Convert string values to appropriate types
    const typedConfig: any = {};
    
    for (const [key, value] of Object.entries(config)) {
      // Skip empty values
      if (value === "" || value === undefined) {
        continue;
      }

      // Convert numeric fields explicitly
      if (NUMERIC_FIELDS.has(key)) {
        const num = typeof value === "number" ? value : parseInt(value as string, 10);
        if (!isNaN(num)) {
          typedConfig[key] = num;
        }
      } else {
        typedConfig[key] = value;
      }
    }

    const result = configSchema.safeParse(typedConfig);

    if (result.success) {
      return { success: true, errors: [], data: result.data };
    } else {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return { success: false, errors };
    }
  } catch (error) {
    return {
      success: false,
      errors: [{ field: "unknown", message: String(error) }],
    };
  }
}

/**
 * Validate specific field
 * 
 * @param field Field name
 * @param value Field value
 * @returns Validation error message, or null if valid
 */
export function validateField(field: string, value: string | number): string | null {
  const config = { [field]: value };
  const result = validateConfig(config);
  
  if (result.success) {
    return null;
  }

  const error = result.errors.find((e) => e.field === field);
  return error ? error.message : null;
}
