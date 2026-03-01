/**
 * Tests for Query Normalization Utilities
 *
 * Validates MEDIUM level normalization for semantic cache.
 */

import { describe, it, expect } from "vitest";
import {
  normalizeQuery,
  generateCacheKey,
  areQueriesSimilar,
  jaccardSimilarity,
} from "../../src/utils/normalize";

describe("normalizeQuery", () => {
  describe("basic transformations", () => {
    it("should lowercase input", () => {
      expect(normalizeQuery("INSTALL NGINX")).toBe("install nginx");
    });

    it("should trim whitespace", () => {
      expect(normalizeQuery("  nginx config  ")).toBe("nginx config");
    });

    it("should normalize multiple spaces", () => {
      expect(normalizeQuery("install   nginx    server")).toBe("install nginx server");
    });

    it("should handle empty string", () => {
      expect(normalizeQuery("")).toBe("");
    });

    it("should handle null/undefined gracefully", () => {
      expect(normalizeQuery(null as any)).toBe("");
      expect(normalizeQuery(undefined as any)).toBe("");
    });
  });

  describe("punctuation normalization", () => {
    it("should reduce multiple exclamation marks", () => {
      expect(normalizeQuery("help!!!")).toBe("help");
    });

    it("should reduce multiple question marks", () => {
      expect(normalizeQuery("what???")).toBe("what");
    });

    it("should reduce multiple periods", () => {
      expect(normalizeQuery("wait...")).toBe("wait");
    });

    it("should handle mixed punctuation", () => {
      expect(normalizeQuery("why?!?!")).toBe("why");
    });
  });

  describe("stopword removal", () => {
    it("should remove Portuguese articles", () => {
      expect(normalizeQuery("instalar o nginx")).toBe("instalar nginx");
      expect(normalizeQuery("configurar a rede")).toBe("configurar rede");
      expect(normalizeQuery("listar os arquivos")).toBe("listar arquivos");
    });

    it("should remove Portuguese prepositions", () => {
      expect(normalizeQuery("backup do servidor")).toBe("backup servidor");
      expect(normalizeQuery("conectar na rede")).toBe("conectar rede");
      expect(normalizeQuery("script para automação")).toBe("script automacao");
    });

    it("should remove common verbs/auxiliaries", () => {
      expect(normalizeQuery("como eu faço")).toBe("");
      expect(normalizeQuery("preciso instalar")).toBe("instalar");
      expect(normalizeQuery("quero configurar firewall")).toBe("configurar firewall");
    });

    it("should remove conjunctions", () => {
      expect(normalizeQuery("nginx e apache")).toBe("nginx apache");
      expect(normalizeQuery("docker ou podman")).toBe("docker podman");
    });
  });

  describe("real-world examples", () => {
    it("should normalize complex query 1", () => {
      const input = "Como eu faço pra instalar o NGINX???";
      const expected = "instalar nginx";
      expect(normalizeQuery(input)).toBe(expected);
    });

    it("should normalize complex query 2", () => {
      const input = "  Qual é a melhor forma de configurar firewall?  ";
      const expected = "melhor forma configurar firewall";
      expect(normalizeQuery(input)).toBe(expected);
    });

    it("should normalize complex query 3", () => {
      const input = "Preciso de ajuda para fazer backup do meu servidor!!!";
      const expected = "ajuda backup servidor";
      expect(normalizeQuery(input)).toBe(expected);
    });

    it("should normalize complex query 4", () => {
      const input = "Me explica como que eu crio um script para automação?";
      const expected = "explica crio script automacao";
      expect(normalizeQuery(input)).toBe(expected);
    });

    it("should preserve technical terms", () => {
      const input = "configurar nginx reverse proxy ssl";
      expect(normalizeQuery(input)).toBe("configurar nginx reverse proxy ssl");
    });

    it("should handle English queries", () => {
      const input = "How to install docker on ubuntu";
      // Only Portuguese stopwords are removed
      expect(normalizeQuery(input)).toBe("how to install docker on ubuntu");
    });
  });

  describe("edge cases", () => {
    it("should handle query with only stopwords", () => {
      expect(normalizeQuery("o que é isso")).toBe("");
    });

    it("should handle query with special characters", () => {
      expect(normalizeQuery("nginx@server.com")).toBe("nginxservercom");
    });

    it("should handle query with numbers", () => {
      expect(normalizeQuery("porta 8080")).toBe("porta 8080");
    });

    it("should handle query with hyphens", () => {
      expect(normalizeQuery("apt-get install")).toBe("apt-get install");
    });

    it("should handle accented characters", () => {
      expect(normalizeQuery("configuração do serviço")).toBe("configuracao servico");
    });
  });
});

describe("generateCacheKey", () => {
  it("should generate consistent keys", () => {
    const key1 = generateCacheKey("install nginx", "gpt-4", "openai");
    const key2 = generateCacheKey("install nginx", "gpt-4", "openai");
    expect(key1).toBe(key2);
  });

  it("should differentiate by model", () => {
    const key1 = generateCacheKey("install nginx", "gpt-4", "openai");
    const key2 = generateCacheKey("install nginx", "gpt-3.5", "openai");
    expect(key1).not.toBe(key2);
  });

  it("should differentiate by provider", () => {
    const key1 = generateCacheKey("install nginx", "gpt-4", "openai");
    const key2 = generateCacheKey("install nginx", "gpt-4", "azure");
    expect(key1).not.toBe(key2);
  });

  it("should normalize query in key", () => {
    const key1 = generateCacheKey("INSTALL NGINX", "gpt-4", "openai");
    const key2 = generateCacheKey("install nginx", "gpt-4", "openai");
    expect(key1).toBe(key2);
  });

  it("should include provider:model:query format", () => {
    const key = generateCacheKey("install nginx", "gpt-4", "openai");
    expect(key).toBe("openai:gpt-4:install nginx");
  });
});

describe("areQueriesSimilar", () => {
  it("should return true for identical queries", () => {
    expect(areQueriesSimilar("install nginx", "install nginx")).toBe(true);
  });

  it("should return true for case-different queries", () => {
    expect(areQueriesSimilar("INSTALL NGINX", "install nginx")).toBe(true);
  });

  it("should return true for queries differing only in stopwords", () => {
    expect(areQueriesSimilar("instalar o nginx", "instalar nginx")).toBe(true);
  });

  it("should return false for semantically different queries", () => {
    expect(areQueriesSimilar("install nginx", "install apache")).toBe(false);
  });
});

describe("jaccardSimilarity", () => {
  it("should return 1.0 for identical queries", () => {
    expect(jaccardSimilarity("install nginx", "install nginx")).toBe(1.0);
  });

  it("should return 0.0 for completely different queries", () => {
    expect(jaccardSimilarity("install nginx", "configure apache")).toBe(0.0);
  });

  it("should return partial similarity for overlapping queries", () => {
    const similarity = jaccardSimilarity("install nginx server", "configure nginx proxy");
    expect(similarity).toBeGreaterThan(0);
    expect(similarity).toBeLessThan(1);
  });

  it("should return 1.0 for both empty queries", () => {
    expect(jaccardSimilarity("", "")).toBe(1.0);
  });

  it("should ignore stopword differences", () => {
    const sim1 = jaccardSimilarity("instalar o nginx", "instalar nginx");
    expect(sim1).toBe(1.0);
  });
});
