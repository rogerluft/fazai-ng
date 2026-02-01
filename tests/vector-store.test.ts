/**
 * Vector Store Tests
 *
 * Testa funções de resolução e validação do sistema de vector store.
 *
 * @module tests/vector-store
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies
vi.mock("../src/config", () => ({
  getConfigValue: vi.fn(),
}));

vi.mock("../src/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("vector-store", () => {
  let getConfigValue: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Reset mocks
    vi.resetModules();
    const config = await import("../src/config");
    getConfigValue = config.getConfigValue as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.VECTOR_PROVIDER;
    delete process.env.VECTOR_DIMENSION;
    delete process.env.VECTOR_DISTANCE;
    delete process.env.QDRANT_URL;
    delete process.env.QDRANT_API_KEY;
  });

  describe("resolveProvider", () => {
    it("should return 'qdrant' as default when no config or env provided", async () => {
      getConfigValue.mockReturnValue(undefined);

      const { validateVectorCollections } = await import("../src/vector-store");

      // Mock fetch to prevent actual API calls
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: {} }),
      });

      const result = await validateVectorCollections({});

      expect(result.provider).toBe("qdrant");
    });

    it("should return 'qdrant' when explicitly provided", async () => {
      const { validateVectorCollections } = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: {} }),
      });

      const result = await validateVectorCollections({ provider: "qdrant" });

      expect(result.provider).toBe("qdrant");
    });

    it("should fallback to 'qdrant' for unsupported providers", async () => {
      getConfigValue.mockReturnValue("unsupported-provider");

      const { validateVectorCollections } = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: {} }),
      });

      const result = await validateVectorCollections({});

      expect(result.provider).toBe("qdrant");
    });
  });

  describe("resolveDimension", () => {
    it("should return 768 as default dimension", async () => {
      getConfigValue.mockReturnValue(undefined);

      const { validateVectorCollections } = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: {} }),
      });

      const result = await validateVectorCollections({});

      expect(result.dimension).toBe(768);
    });

    it("should use explicitly provided dimension", async () => {
      const { validateVectorCollections } = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: {} }),
      });

      const result = await validateVectorCollections({ dimension: 768 });

      expect(result.dimension).toBe(768);
    });

    it("should read dimension from config", async () => {
      getConfigValue.mockImplementation((key: string) => {
        if (key === "VECTOR_DIMENSION") return "1024";
        return undefined;
      });

      const { validateVectorCollections } = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: {} }),
      });

      const result = await validateVectorCollections({});

      expect(result.dimension).toBe(1024);
    });

    it("should read dimension from env variable", async () => {
      getConfigValue.mockReturnValue(undefined);
      process.env.VECTOR_DIMENSION = "512";

      const { validateVectorCollections } = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: {} }),
      });

      const result = await validateVectorCollections({});

      expect(result.dimension).toBe(512);
    });

    it("should fallback to default for invalid dimension", async () => {
      getConfigValue.mockImplementation((key: string) => {
        if (key === "VECTOR_DIMENSION") return "invalid";
        return undefined;
      });

      const { validateVectorCollections } = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: {} }),
      });

      const result = await validateVectorCollections({});

      expect(result.dimension).toBe(768);
    });
  });

  describe("resolveDistance", () => {
    it("should return 'Cosine' as default distance metric", async () => {
      getConfigValue.mockReturnValue(undefined);

      const { validateVectorCollections } = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: {} }),
      });

      const result = await validateVectorCollections({});

      expect(result.distance).toBe("Cosine");
    });

    it("should use explicitly provided distance", async () => {
      const { validateVectorCollections } = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: {} }),
      });

      const result = await validateVectorCollections({ distance: "Euclid" });

      expect(result.distance).toBe("Euclid");
    });

    it("should use explicitly provided Dot distance", async () => {
      const { validateVectorCollections } = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: {} }),
      });

      const result = await validateVectorCollections({ distance: "Dot" });

      expect(result.distance).toBe("Dot");
    });

    it("should read distance from config", async () => {
      getConfigValue.mockImplementation((key: string) => {
        if (key === "VECTOR_DISTANCE") return "Euclid";
        return undefined;
      });

      const { validateVectorCollections } = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: {} }),
      });

      const result = await validateVectorCollections({});

      expect(result.distance).toBe("Euclid");
    });
  });

  describe("normalizeDistance", () => {
    it("should normalize 'euclid' to 'Euclid'", async () => {
      getConfigValue.mockImplementation((key: string) => {
        if (key === "VECTOR_DISTANCE") return "euclid";
        return undefined;
      });

      const { validateVectorCollections } = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: {} }),
      });

      const result = await validateVectorCollections({});

      expect(result.distance).toBe("Euclid");
    });

    it("should normalize 'EUCLID' to 'Euclid'", async () => {
      getConfigValue.mockImplementation((key: string) => {
        if (key === "VECTOR_DISTANCE") return "EUCLID";
        return undefined;
      });

      const { validateVectorCollections } = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: {} }),
      });

      const result = await validateVectorCollections({});

      expect(result.distance).toBe("Euclid");
    });

    it("should normalize 'L2' to 'Euclid'", async () => {
      getConfigValue.mockImplementation((key: string) => {
        if (key === "VECTOR_DISTANCE") return "L2";
        return undefined;
      });

      const { validateVectorCollections } = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: {} }),
      });

      const result = await validateVectorCollections({});

      expect(result.distance).toBe("Euclid");
    });

    it("should normalize 'l2' to 'Euclid'", async () => {
      getConfigValue.mockImplementation((key: string) => {
        if (key === "VECTOR_DISTANCE") return "l2";
        return undefined;
      });

      const { validateVectorCollections } = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: {} }),
      });

      const result = await validateVectorCollections({});

      expect(result.distance).toBe("Euclid");
    });

    it("should normalize 'DOT' to 'Dot'", async () => {
      getConfigValue.mockImplementation((key: string) => {
        if (key === "VECTOR_DISTANCE") return "DOT";
        return undefined;
      });

      const { validateVectorCollections } = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: {} }),
      });

      const result = await validateVectorCollections({});

      expect(result.distance).toBe("Dot");
    });

    it("should normalize 'dot' to 'Dot'", async () => {
      getConfigValue.mockImplementation((key: string) => {
        if (key === "VECTOR_DISTANCE") return "dot";
        return undefined;
      });

      const { validateVectorCollections } = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: {} }),
      });

      const result = await validateVectorCollections({});

      expect(result.distance).toBe("Dot");
    });

    it("should normalize 'DOT_PRODUCT' to 'Dot'", async () => {
      getConfigValue.mockImplementation((key: string) => {
        if (key === "VECTOR_DISTANCE") return "DOT_PRODUCT";
        return undefined;
      });

      const { validateVectorCollections } = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: {} }),
      });

      const result = await validateVectorCollections({});

      expect(result.distance).toBe("Dot");
    });

    it("should normalize 'cosine' to 'Cosine'", async () => {
      getConfigValue.mockImplementation((key: string) => {
        if (key === "VECTOR_DISTANCE") return "cosine";
        return undefined;
      });

      const { validateVectorCollections } = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: {} }),
      });

      const result = await validateVectorCollections({});

      expect(result.distance).toBe("Cosine");
    });

    it("should normalize 'COSINE' to 'Cosine'", async () => {
      getConfigValue.mockImplementation((key: string) => {
        if (key === "VECTOR_DISTANCE") return "COSINE";
        return undefined;
      });

      const { validateVectorCollections } = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: {} }),
      });

      const result = await validateVectorCollections({});

      expect(result.distance).toBe("Cosine");
    });

    it("should default to 'Cosine' for invalid distance values", async () => {
      getConfigValue.mockImplementation((key: string) => {
        if (key === "VECTOR_DISTANCE") return "invalid_metric";
        return undefined;
      });

      const { validateVectorCollections } = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: {} }),
      });

      const result = await validateVectorCollections({});

      expect(result.distance).toBe("Cosine");
    });
  });

  describe("COLLECTION_SCHEMAS", () => {
    it("should have exactly 6 collections defined", async () => {
      // Import the module to access internal constants via validation
      const vectorStore = await import("../src/vector-store");

      // Mock fetch to simulate:
      // - GET requests return 404 (collection doesn't exist)
      // - PUT requests return success (collection created)
      global.fetch = vi.fn().mockImplementation((url: URL) => {
        const urlString = url.toString();
        if (urlString.includes("collections/") && !urlString.endsWith("collections")) {
          // Check if this is a GET (check existence) or PUT (create)
          // We need to look at the request init, but in this simplified mock
          // we'll just assume GET returns 404 for first call, PUT returns success
          const match = urlString.match(/collections\/([^?]+)/);
          if (match) {
            // First call is GET (check), return 404
            // Second call is PUT (create), return success
            return Promise.resolve({
              ok: false,
              status: 404,
              text: async () => JSON.stringify({ status: { error: "Not found" } }),
            });
          }
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ result: { status: "ok" } }),
        });
      });

      // Override with a better implementation that tracks calls
      const fetchMock = vi.fn();
      let callCount = 0;

      global.fetch = vi.fn().mockImplementation((url: URL, init?: RequestInit) => {
        const method = init?.method || "GET";

        if (method === "GET") {
          // Collection existence check - return 404
          return Promise.resolve({
            ok: false,
            status: 404,
            text: async () => JSON.stringify({ status: { error: "Not found" } }),
          });
        } else if (method === "PUT") {
          // Collection creation - return success
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ result: { status: "ok" } }),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({}),
        });
      });

      const result = await vectorStore.validateVectorCollections({});

      // If all collections are created (not found), we should have 6 created
      expect(result.created.length).toBe(6);
    });

    it("should include fazai_personality collection", async () => {
      const vectorStore = await import("../src/vector-store");

      global.fetch = vi.fn().mockImplementation((url: URL, init?: RequestInit) => {
        const method = init?.method || "GET";

        if (method === "GET") {
          return Promise.resolve({
            ok: false,
            status: 404,
            text: async () => JSON.stringify({ status: { error: "Not found" } }),
          });
        } else if (method === "PUT") {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ result: { status: "ok" } }),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({}),
        });
      });

      const result = await vectorStore.validateVectorCollections({});

      expect(result.created).toContain("fazai_personality");
    });

    it("should include fazai_memory collection", async () => {
      const vectorStore = await import("../src/vector-store");

      global.fetch = vi.fn().mockImplementation((url: URL, init?: RequestInit) => {
        const method = init?.method || "GET";

        if (method === "GET") {
          return Promise.resolve({
            ok: false,
            status: 404,
            text: async () => JSON.stringify({ status: { error: "Not found" } }),
          });
        } else if (method === "PUT") {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ result: { status: "ok" } }),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({}),
        });
      });

      const result = await vectorStore.validateVectorCollections({});

      expect(result.created).toContain("fazai_memory");
    });

    it("should include fazai_learning collection", async () => {
      const vectorStore = await import("../src/vector-store");

      global.fetch = vi.fn().mockImplementation((url: URL, init?: RequestInit) => {
        const method = init?.method || "GET";

        if (method === "GET") {
          return Promise.resolve({
            ok: false,
            status: 404,
            text: async () => JSON.stringify({ status: { error: "Not found" } }),
          });
        } else if (method === "PUT") {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ result: { status: "ok" } }),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({}),
        });
      });

      const result = await vectorStore.validateVectorCollections({});

      expect(result.created).toContain("fazai_learning");
    });

    it("should include fazai_kb collection", async () => {
      const vectorStore = await import("../src/vector-store");

      global.fetch = vi.fn().mockImplementation((url: URL, init?: RequestInit) => {
        const method = init?.method || "GET";

        if (method === "GET") {
          return Promise.resolve({
            ok: false,
            status: 404,
            text: async () => JSON.stringify({ status: { error: "Not found" } }),
          });
        } else if (method === "PUT") {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ result: { status: "ok" } }),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({}),
        });
      });

      const result = await vectorStore.validateVectorCollections({});

      expect(result.created).toContain("fazai_kb");
    });

    it("should include fazai_inference collection", async () => {
      const vectorStore = await import("../src/vector-store");

      global.fetch = vi.fn().mockImplementation((url: URL, init?: RequestInit) => {
        const method = init?.method || "GET";

        if (method === "GET") {
          return Promise.resolve({
            ok: false,
            status: 404,
            text: async () => JSON.stringify({ status: { error: "Not found" } }),
          });
        } else if (method === "PUT") {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ result: { status: "ok" } }),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({}),
        });
      });

      const result = await vectorStore.validateVectorCollections({});

      expect(result.created).toContain("fazai_inference");
    });

    it("should include fazai_source collection", async () => {
      const vectorStore = await import("../src/vector-store");

      global.fetch = vi.fn().mockImplementation((url: URL, init?: RequestInit) => {
        const method = init?.method || "GET";

        if (method === "GET") {
          return Promise.resolve({
            ok: false,
            status: 404,
            text: async () => JSON.stringify({ status: { error: "Not found" } }),
          });
        } else if (method === "PUT") {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ result: { status: "ok" } }),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({}),
        });
      });

      const result = await vectorStore.validateVectorCollections({});

      expect(result.created).toContain("fazai_source");
    });

    it("should verify all collections exist when Qdrant returns success", async () => {
      const vectorStore = await import("../src/vector-store");

      // Mock successful responses for all collection checks
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          result: {
            config: {
              params: {
                size: 768,
                distance: "Cosine",
              },
            },
          },
        }),
      });

      const result = await vectorStore.validateVectorCollections({});

      expect(result.verified.length).toBe(6);
      expect(result.created.length).toBe(0);
      expect(result.errors.length).toBe(0);
    });
  });

  describe("validateVectorCollections", () => {
    it("should return validation result with correct structure", async () => {
      const vectorStore = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          result: {
            config: {
              params: {
                size: 768,
                distance: "Cosine",
              },
            },
          },
        }),
      });

      const result = await vectorStore.validateVectorCollections({});

      expect(result).toHaveProperty("provider");
      expect(result).toHaveProperty("dimension");
      expect(result).toHaveProperty("distance");
      expect(result).toHaveProperty("created");
      expect(result).toHaveProperty("verified");
      expect(result).toHaveProperty("updated");
      expect(result).toHaveProperty("errors");
    });

    it("should handle dimension mismatch", async () => {
      const vectorStore = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          result: {
            config: {
              params: {
                size: 1536, // Different from expected 768 (Lei 768)
                distance: "Cosine",
              },
            },
          },
        }),
      });

      const result = await vectorStore.validateVectorCollections({});

      expect(result.updated.length).toBeGreaterThan(0);
    });

    it("should handle distance metric mismatch", async () => {
      const vectorStore = await import("../src/vector-store");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          result: {
            config: {
              params: {
                size: 768,
                distance: "Euclid", // Different from expected Cosine
              },
            },
          },
        }),
      });

      const result = await vectorStore.validateVectorCollections({ distance: "Cosine" });

      expect(result.updated.length).toBeGreaterThan(0);
    });
  });
});
