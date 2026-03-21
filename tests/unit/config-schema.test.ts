import { describe, it, expect } from "vitest";
import { validateConfig, validateField } from "../../src/config/schema";

describe("Config Schema Validation", () => {
  describe("URL Validation", () => {
    it("should accept valid HTTP URLs", () => {
      const config = { OLLAMA_BASE_URL: "http://localhost:11434" };
      const result = validateConfig(config);
      expect(result.success).toBe(true);
    });

    it("should accept valid HTTPS URLs", () => {
      const config = { QDRANT_URL: "https://qdrant.example.com:6333" };
      const result = validateConfig(config);
      expect(result.success).toBe(true);
    });

    it("should reject invalid URLs", () => {
      const config = { OLLAMA_BASE_URL: "not-a-url" };
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors[0].field).toBe("OLLAMA_BASE_URL");
    });

    it("should reject URLs without protocol", () => {
      const config = { QDRANT_URL: "localhost:6333" };
      const result = validateConfig(config);
      expect(result.success).toBe(false);
    });
  });

  describe("API Key Validation", () => {
    it("should accept valid API keys", () => {
      const config = { 
        OPENAI_API_KEY: "sk-1234567890abcdefghij",
        ANTHROPIC_API_KEY: "sk-ant-1234567890abcdefghij"
      };
      const result = validateConfig(config);
      expect(result.success).toBe(true);
    });

    it("should reject short API keys", () => {
      const config = { OPENAI_API_KEY: "short" };
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain("at least 20 characters");
    });

    it("should reject API keys with invalid characters", () => {
      const config = { OPENAI_API_KEY: "sk-invalid-key-with-$pecial-chars!" };
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain("invalid characters");
    });

    it("should accept OAuth tokens", () => {
      const config = { 
        ANTHROPIC_OAUTH_TOKEN: "a".repeat(50) // 50 char token
      };
      const result = validateConfig(config);
      expect(result.success).toBe(true);
    });
  });

  describe("Model List Validation", () => {
    it("should accept 1-3 models", () => {
      const configs = [
        { MODELS_OLLAMA: "qwen2.5:7b" },
        { MODELS_OLLAMA: "qwen2.5:7b,tinyllama:1b" },
        { MODELS_ANTHROPIC: "claude-opus-4-5,claude-sonnet-4-5,claude-haiku-4" },
      ];

      for (const config of configs) {
        const result = validateConfig(config);
        expect(result.success).toBe(true);
      }
    });

    it("should reject more than 3 models", () => {
      const config = { 
        MODELS_OLLAMA: "model1,model2,model3,model4" 
      };
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain("1-3 models");
    });

    it("should reject empty model names", () => {
      const config = { MODELS_OLLAMA: "model1,,model3" };
      const result = validateConfig(config);
      expect(result.success).toBe(false);
    });
  });

  describe("Provider Fallback Order Validation", () => {
    it("should accept valid provider lists", () => {
      const config = { 
        PROVIDER_FALLBACK_ORDER: "google,ollama,openrouter,anthropic" 
      };
      const result = validateConfig(config);
      expect(result.success).toBe(true);
    });

    it("should detect typo 'googl,eollama'", () => {
      const config = {
        PROVIDER_FALLBACK_ORDER: "googl,eollama,openrouter"
      };
      const result = validateConfig(config);
      expect(result.success).toBe(false);
    });

    it("should reject invalid providers", () => {
      const config = { 
        PROVIDER_FALLBACK_ORDER: "google,invalid_provider,ollama" 
      };
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain("invalid provider");
    });

    it("should reject duplicate providers", () => {
      const config = { 
        PROVIDER_FALLBACK_ORDER: "google,ollama,google" 
      };
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain("duplicates");
    });

    it("should accept all valid providers", () => {
      const config = { 
        PROVIDER_FALLBACK_ORDER: "google,ollama,openrouter,anthropic,openai,llama,perplexity" 
      };
      const result = validateConfig(config);
      expect(result.success).toBe(true);
    });
  });

  describe("Timeout Validation", () => {
    it("should accept positive timeouts", () => {
      const config = { 
        FAZAI_MAX_RETRIES: 3,
        API_TIMEOUT: 30 
      };
      const result = validateConfig(config);
      expect(result.success).toBe(true);
    });

    it("should reject negative timeouts", () => {
      const config = { API_TIMEOUT: -10 };
      const result = validateConfig(config);
      expect(result.success).toBe(false);
    });

    it("should reject excessively long timeouts", () => {
      const config = { API_TIMEOUT: 1000 };
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain("should not exceed 600");
    });
  });

  describe("Boolean String Validation", () => {
    it("should accept valid boolean strings", () => {
      const configs = [
        { ENABLE_PREVIEW_FEATURES: "true" },
        { ENABLE_PREVIEW_FEATURES: "false" },
        { ENABLE_PREVIEW_FEATURES: "1" },
        { ENABLE_PREVIEW_FEATURES: "0" },
      ];

      for (const config of configs) {
        const result = validateConfig(config);
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid boolean strings", () => {
      const config = { ENABLE_PREVIEW_FEATURES: "yes" };
      const result = validateConfig(config);
      expect(result.success).toBe(false);
    });
  });

  describe("Email Validation", () => {
    it("should accept valid emails", () => {
      const config = { CLOUDFLARE_EMAIL: "user@example.com" };
      const result = validateConfig(config);
      expect(result.success).toBe(true);
    });

    it("should reject invalid emails", () => {
      const config = { CLOUDFLARE_EMAIL: "not-an-email" };
      const result = validateConfig(config);
      expect(result.success).toBe(false);
    });
  });

  describe("Field-Level Validation", () => {
    it("should validate individual fields", () => {
      expect(validateField("OLLAMA_BASE_URL", "http://localhost:11434")).toBeNull();
      expect(validateField("OLLAMA_BASE_URL", "invalid-url")).not.toBeNull();
    });

    it("should return error message for invalid fields", () => {
      const error = validateField("OPENAI_API_KEY", "short");
      expect(error).toContain("at least 20 characters");
    });
  });

  describe("Complete Configuration", () => {
    it("should validate a complete valid configuration", () => {
      const config = {
        MODELS_OLLAMA: "qwen2.5:7b,tinyllama:1b",
        MODELS_GOOGLE: "gemini-3-pro,gemini-3-flash,gemini-2.5-pro",
        MODELS_ANTHROPIC: "claude-opus-4-5,claude-sonnet-4-5,claude-haiku-4",
        PROVIDER_FALLBACK_ORDER: "google,ollama,openrouter,anthropic",
        OLLAMA_BASE_URL: "http://localhost:11434",
        QDRANT_URL: "http://127.0.0.1:6333",
        GEMINI_API_KEY: "AIzaSyXXXXXXXXXXXXXXX",
        ANTHROPIC_API_KEY: "sk-ant-XXXXXXXXXXXXXXXXXXXX",
        ENABLE_PREVIEW_FEATURES: "false",
        WEB_PORT: 3000,
        FAZAI_MAX_RETRIES: 3,
      };

      const result = validateConfig(config);
      expect(result.success).toBe(true);
    });

    it("should collect multiple errors", () => {
      const config = {
        OLLAMA_BASE_URL: "invalid-url",
        OPENAI_API_KEY: "short",
        PROVIDER_FALLBACK_ORDER: "invalid,provider",
        MODELS_OLLAMA: "m1,m2,m3,m4", // Too many
      };

      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});
