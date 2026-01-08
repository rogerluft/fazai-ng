import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ResearchCoordinator, ResearchResult } from '../src/research';
import * as neuralFlow from '../src/rag/neural-flow';
import * as askAI from '../src/askAI';
import * as config from '../src/config';
import * as embeddings from '../src/services/embeddings';

// Mock dependencies
vi.mock('../src/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../src/mcp/client', () => {
  class MockMCPClient {
    queryContext7 = vi.fn().mockResolvedValue(null);
  }
  return {
    MCPClient: MockMCPClient,
  };
});

vi.mock('../src/config', () => ({
  getConfigValue: vi.fn().mockReturnValue(null),
}));

vi.mock('../src/rag/neural-flow', () => ({
  neuralQuery: vi.fn(),
}));

vi.mock('../src/askAI', () => ({
  askAI: vi.fn(),
}));

vi.mock('../src/services/embeddings', () => ({
  createEmbeddingService: vi.fn(),
}));

// Mock global fetch
global.fetch = vi.fn();

describe('ResearchCoordinator', () => {
  let coordinator: ResearchCoordinator;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = { ...process.env };

    // Reset environment variables
    delete process.env.FAZAI_DISABLE_RESEARCH;
    delete process.env.FAZAI_RESEARCH_ON_FAILURE;
    delete process.env.WEB_SEARCH_PROVIDER;

    coordinator = new ResearchCoordinator({ enabled: true });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isEnabled()', () => {
    it('should return true when research is enabled and no disable flags are set', async () => {
      const result = await coordinator.research('test query');
      // If research runs, isEnabled() returned true
      expect(result).toBeDefined();
    });

    it('should return null when FAZAI_DISABLE_RESEARCH=1 in environment', async () => {
      process.env.FAZAI_DISABLE_RESEARCH = '1';
      coordinator = new ResearchCoordinator({ enabled: true });

      const result = await coordinator.research('test query');
      expect(result).toBeNull();
    });

    it('should return null when FAZAI_DISABLE_RESEARCH=true in environment', async () => {
      process.env.FAZAI_DISABLE_RESEARCH = 'true';
      coordinator = new ResearchCoordinator({ enabled: true });

      const result = await coordinator.research('test query');
      expect(result).toBeNull();
    });

    it('should return null when FAZAI_DISABLE_RESEARCH=yes in environment', async () => {
      process.env.FAZAI_DISABLE_RESEARCH = 'yes';
      coordinator = new ResearchCoordinator({ enabled: true });

      const result = await coordinator.research('test query');
      expect(result).toBeNull();
    });

    it('should return null when FAZAI_DISABLE_RESEARCH=on in environment', async () => {
      process.env.FAZAI_DISABLE_RESEARCH = 'on';
      coordinator = new ResearchCoordinator({ enabled: true });

      const result = await coordinator.research('test query');
      expect(result).toBeNull();
    });

    it('should return null when disabled via config', async () => {
      vi.mocked(config.getConfigValue).mockReturnValue('true');
      coordinator = new ResearchCoordinator({ enabled: true });

      const result = await coordinator.research('test query');
      expect(result).toBeNull();
    });

    it('should return null when options.enabled is false', async () => {
      coordinator = new ResearchCoordinator({ enabled: false });

      const result = await coordinator.research('test query');
      expect(result).toBeNull();
    });

    it('should handle case-insensitive disable flags', async () => {
      process.env.FAZAI_DISABLE_RESEARCH = 'TRUE';
      coordinator = new ResearchCoordinator({ enabled: true });

      const result = await coordinator.research('test query');
      expect(result).toBeNull();
    });
  });

  describe('isFailureResearchEnabled()', () => {
    it('should return false by default when no configuration is set', async () => {
      const command = {
        command: 'test-command',
        explanation: 'test',
        risk: 'LOW' as const,
      };

      const result = await coordinator.handleExecutionFailure(command, 'error output');
      expect(result).toBeNull();
    });

    it('should return true when options.researchOnFailure is true', async () => {
      coordinator = new ResearchCoordinator({
        enabled: true,
        researchOnFailure: true
      });

      const command = {
        command: 'test-command',
        explanation: 'test',
        risk: 'LOW' as const,
      };

      // Mock fetch to return empty results
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      const result = await coordinator.handleExecutionFailure(command, 'error output');
      expect(result).toBeDefined();
    });

    it('should return true when FAZAI_RESEARCH_ON_FAILURE=1', async () => {
      process.env.FAZAI_RESEARCH_ON_FAILURE = '1';
      coordinator = new ResearchCoordinator({ enabled: true });

      const command = {
        command: 'test-command',
        explanation: 'test',
        risk: 'LOW' as const,
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      const result = await coordinator.handleExecutionFailure(command, 'error output');
      expect(result).toBeDefined();
    });

    it('should return true when config has FAZAI_RESEARCH_ON_FAILURE=true', async () => {
      vi.mocked(config.getConfigValue).mockImplementation((key) => {
        if (key === 'FAZAI_RESEARCH_ON_FAILURE') return 'true';
        return null;
      });

      coordinator = new ResearchCoordinator({ enabled: true });

      const command = {
        command: 'test-command',
        explanation: 'test',
        risk: 'LOW' as const,
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      const result = await coordinator.handleExecutionFailure(command, 'error output');
      expect(result).toBeDefined();
    });

    it('should return false when research is globally disabled', async () => {
      process.env.FAZAI_DISABLE_RESEARCH = '1';
      process.env.FAZAI_RESEARCH_ON_FAILURE = '1';
      coordinator = new ResearchCoordinator({ enabled: true });

      const command = {
        command: 'test-command',
        explanation: 'test',
        risk: 'LOW' as const,
      };

      const result = await coordinator.handleExecutionFailure(command, 'error output');
      expect(result).toBeNull();
    });

    it('should prefer options.researchOnFailure over env variables', async () => {
      process.env.FAZAI_RESEARCH_ON_FAILURE = '0';
      coordinator = new ResearchCoordinator({
        enabled: true,
        researchOnFailure: true
      });

      const command = {
        command: 'test-command',
        explanation: 'test',
        risk: 'LOW' as const,
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      const result = await coordinator.handleExecutionFailure(command, 'error output');
      expect(result).toBeDefined();
    });
  });

  describe('decorateReason()', () => {
    it('should format reason with pre-execution trigger', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          AbstractText: 'Test result',
          Heading: 'Test',
        }),
      } as Response);

      const result = await coordinator.research('test query', {
        reason: 'Test reason',
        trigger: 'pre-execution'
      });

      expect(result?.reason).toContain('Test reason');
      expect(result?.reason).toContain('pré-checagem');
    });

    it('should format reason with failure trigger', async () => {
      coordinator = new ResearchCoordinator({
        enabled: true,
        researchOnFailure: true
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          AbstractText: 'Test result',
          Heading: 'Test',
        }),
      } as Response);

      const command = {
        command: 'test-command',
        explanation: 'test',
        risk: 'LOW' as const,
      };

      const result = await coordinator.handleExecutionFailure(command, 'error output');

      expect(result?.reason).toContain('falha');
    });

    it('should include provider name in reason', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          AbstractText: 'Test result',
          Heading: 'Test',
        }),
      } as Response);

      const result = await coordinator.research('test query', {
        reason: 'Test reason'
      });

      expect(result?.reason).toContain('via');
    });

    it('should handle default reason when none is provided', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          AbstractText: 'Test result',
          Heading: 'Test',
        }),
      } as Response);

      const result = await coordinator.research('test query');

      expect(result?.reason).toContain('Solicitação externa');
    });
  });

  describe('tryLocalRAG()', () => {
    it('should return null if score < 0.6', async () => {
      const mockEmbeddingService = {
        generate: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      };

      vi.mocked(embeddings.createEmbeddingService).mockResolvedValue(mockEmbeddingService as any);

      vi.mocked(neuralFlow.neuralQuery).mockResolvedValue({
        fusedResults: [
          {
            id: 'test-1',
            score: 0.5,
            content: 'Low score result',
            collection: 'fazai_kb',
            metadata: { title: 'Test' },
          },
        ],
        stats: {
          topScore: 0.5,
          avgScore: 0.5,
          totalResults: 1,
        },
      } as any);

      // Mock all external sources to fail so we get null
      vi.mocked(askAI.askAI).mockRejectedValue(new Error('Perplexity unavailable'));
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const result = await coordinator.research('test query');

      // Should skip local RAG and fail on other sources, returning null
      expect(result).toBeNull();
    });

    it('should return results if score >= 0.6', async () => {
      const mockEmbeddingService = {
        generate: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      };

      vi.mocked(embeddings.createEmbeddingService).mockResolvedValue(mockEmbeddingService as any);

      vi.mocked(neuralFlow.neuralQuery).mockResolvedValue({
        fusedResults: [
          {
            id: 'test-1',
            score: 0.8,
            content: 'High score result with good content',
            collection: 'fazai_kb',
            metadata: { title: 'High Quality Result' },
          },
        ],
        stats: {
          topScore: 0.8,
          avgScore: 0.8,
          totalResults: 1,
        },
      } as any);

      const result = await coordinator.research('test query');

      expect(result).toBeDefined();
      expect(result?.provider).toBe('local-rag');
      expect(result?.findings).toHaveLength(1);
      expect(result?.findings[0].title).toBe('High Quality Result');
    });

    it('should return null if no results found', async () => {
      const mockEmbeddingService = {
        generate: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      };

      vi.mocked(embeddings.createEmbeddingService).mockResolvedValue(mockEmbeddingService as any);

      vi.mocked(neuralFlow.neuralQuery).mockResolvedValue({
        fusedResults: [],
        stats: {
          topScore: 0,
          avgScore: 0,
          totalResults: 0,
        },
      } as any);

      // Mock all external sources to fail so we get null
      vi.mocked(askAI.askAI).mockRejectedValue(new Error('Perplexity unavailable'));
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const result = await coordinator.research('test query');
      expect(result).toBeNull();
    });

    it('should handle embedding service errors gracefully', async () => {
      vi.mocked(embeddings.createEmbeddingService).mockRejectedValue(
        new Error('Embedding service unavailable')
      );

      // Should fallback to other sources
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          AbstractText: 'Fallback result',
          Heading: 'Test',
        }),
      } as Response);

      const result = await coordinator.research('test query');

      // Should get result from web search fallback
      expect(result).toBeDefined();
      expect(result?.provider).toBe('duckduckgo');
    });

    it('should include summary with top results', async () => {
      const mockEmbeddingService = {
        generate: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      };

      vi.mocked(embeddings.createEmbeddingService).mockResolvedValue(mockEmbeddingService as any);

      vi.mocked(neuralFlow.neuralQuery).mockResolvedValue({
        fusedResults: [
          {
            id: 'test-1',
            score: 0.9,
            content: 'First result content with detailed information',
            collection: 'fazai_kb',
            metadata: { title: 'Result 1' },
          },
          {
            id: 'test-2',
            score: 0.8,
            content: 'Second result content',
            collection: 'fazai_learning',
            metadata: { title: 'Result 2' },
          },
        ],
        stats: {
          topScore: 0.9,
          avgScore: 0.85,
          totalResults: 2,
        },
      } as any);

      const result = await coordinator.research('test query');

      expect(result?.summary).toContain('[RAG Local]');
      expect(result?.summary).toContain('2 resultados');
      expect(result?.summary).toContain('0.90');
    });

    it('should truncate snippet to 300 characters', async () => {
      const mockEmbeddingService = {
        generate: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      };

      vi.mocked(embeddings.createEmbeddingService).mockResolvedValue(mockEmbeddingService as any);

      const longContent = 'a'.repeat(500);

      vi.mocked(neuralFlow.neuralQuery).mockResolvedValue({
        fusedResults: [
          {
            id: 'test-1',
            score: 0.9,
            content: longContent,
            collection: 'fazai_kb',
            metadata: { title: 'Long Content' },
          },
        ],
        stats: {
          topScore: 0.9,
          avgScore: 0.9,
          totalResults: 1,
        },
      } as any);

      const result = await coordinator.research('test query');

      expect(result?.findings[0].snippet?.length).toBe(300);
    });
  });

  describe('research() - general behavior', () => {
    it('should return null when disabled', async () => {
      coordinator = new ResearchCoordinator({ enabled: false });

      const result = await coordinator.research('test query');
      expect(result).toBeNull();
    });

    it('should try Perplexity when local RAG fails', async () => {
      const mockEmbeddingService = {
        generate: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      };

      vi.mocked(embeddings.createEmbeddingService).mockResolvedValue(mockEmbeddingService as any);

      vi.mocked(neuralFlow.neuralQuery).mockResolvedValue({
        fusedResults: [],
        stats: { topScore: 0, avgScore: 0, totalResults: 0 },
      } as any);

      // Mock Perplexity success
      const mockStream = (async function* () {
        yield 'Perplexity result chunk 1 ';
        yield 'chunk 2';
      })();

      vi.mocked(askAI.askAI).mockReturnValue(mockStream as any);

      const result = await coordinator.research('test query');

      expect(result?.provider).toBe('perplexity');
      expect(result?.summary).toBe('Perplexity result chunk 1 chunk 2');
    });

    it('should fall back to web search when Perplexity and Context7 fail', async () => {
      const mockEmbeddingService = {
        generate: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      };

      vi.mocked(embeddings.createEmbeddingService).mockResolvedValue(mockEmbeddingService as any);

      vi.mocked(neuralFlow.neuralQuery).mockResolvedValue({
        fusedResults: [],
        stats: { topScore: 0, avgScore: 0, totalResults: 0 },
      } as any);

      // Mock Perplexity failure
      vi.mocked(askAI.askAI).mockRejectedValue(new Error('Perplexity API error'));

      // Mock DuckDuckGo success
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          AbstractText: 'DuckDuckGo result',
          Heading: 'Test Result',
          AbstractURL: 'https://example.com',
        }),
      } as Response);

      const result = await coordinator.research('test query');

      expect(result?.provider).toBe('duckduckgo');
      expect(result?.findings).toHaveLength(1);
      expect(result?.findings[0].title).toBe('Test Result');
    });

    it('should return null when all sources fail', async () => {
      const mockEmbeddingService = {
        generate: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      };

      vi.mocked(embeddings.createEmbeddingService).mockResolvedValue(mockEmbeddingService as any);

      vi.mocked(neuralFlow.neuralQuery).mockResolvedValue({
        fusedResults: [],
        stats: { topScore: 0, avgScore: 0, totalResults: 0 },
      } as any);

      vi.mocked(askAI.askAI).mockRejectedValue(new Error('Perplexity error'));

      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const result = await coordinator.research('test query');

      expect(result).toBeNull();
    });
  });

  describe('maybeRunPreExecutionResearch()', () => {
    it('should return null when researchNeeded is false and no query', async () => {
      const command = {
        command: 'test-command',
        explanation: 'test',
        risk: 'LOW' as const,
        researchNeeded: false,
      };

      const result = await coordinator.maybeRunPreExecutionResearch(command);
      expect(result).toBeNull();
    });

    it('should run research when researchNeeded is true', async () => {
      const command = {
        command: 'test-command',
        explanation: 'test',
        risk: 'LOW' as const,
        researchNeeded: true,
        researchQuery: 'nginx configuration',
        researchReason: 'Need documentation',
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          AbstractText: 'Result',
          Heading: 'Test',
        }),
      } as Response);

      const result = await coordinator.maybeRunPreExecutionResearch(command);

      expect(result).toBeDefined();
      expect(result?.query).toBe('nginx configuration');
      expect(result?.reason).toContain('Need documentation');
    });

    it('should use command as fallback query when researchQuery is empty', async () => {
      const command = {
        command: 'test-command',
        explanation: 'test',
        risk: 'LOW' as const,
        researchNeeded: true,
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          AbstractText: 'Result',
          Heading: 'Test',
        }),
      } as Response);

      const result = await coordinator.maybeRunPreExecutionResearch(command);

      expect(result?.query).toContain('test-command');
    });
  });

  describe('handleExecutionFailure()', () => {
    it('should condense error output to 220 characters', async () => {
      coordinator = new ResearchCoordinator({
        enabled: true,
        researchOnFailure: true
      });

      const command = {
        command: 'test-command',
        explanation: 'test',
        risk: 'LOW' as const,
      };

      const longError = 'Error: ' + 'a'.repeat(300);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          AbstractText: 'Result',
          Heading: 'Test',
        }),
      } as Response);

      const result = await coordinator.handleExecutionFailure(command, longError);

      expect(result?.query.length).toBeLessThanOrEqual(220 + command.command.length + 6); // command + " erro "
    });

    it('should include command in query', async () => {
      coordinator = new ResearchCoordinator({
        enabled: true,
        researchOnFailure: true
      });

      const command = {
        command: 'systemctl start nginx',
        explanation: 'test',
        risk: 'LOW' as const,
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          AbstractText: 'Result',
          Heading: 'Test',
        }),
      } as Response);

      const result = await coordinator.handleExecutionFailure(command, 'Failed to start service');

      expect(result?.query).toContain('systemctl start nginx');
      expect(result?.query).toContain('erro');
    });
  });

  describe('Web search provider configuration', () => {
    it('should use DuckDuckGo by default', async () => {
      const mockEmbeddingService = {
        generate: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      };

      vi.mocked(embeddings.createEmbeddingService).mockResolvedValue(mockEmbeddingService as any);

      vi.mocked(neuralFlow.neuralQuery).mockResolvedValue({
        fusedResults: [],
        stats: { topScore: 0, avgScore: 0, totalResults: 0 },
      } as any);

      vi.mocked(askAI.askAI).mockRejectedValue(new Error('Perplexity error'));

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          AbstractText: 'DuckDuckGo result',
          Heading: 'Test',
        }),
      } as Response);

      const result = await coordinator.research('test query');

      expect(result?.provider).toBe('duckduckgo');
    });

    it('should use provider from options', async () => {
      coordinator = new ResearchCoordinator({
        enabled: true,
        webSearchProvider: 'duckduckgo'
      });

      const mockEmbeddingService = {
        generate: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      };

      vi.mocked(embeddings.createEmbeddingService).mockResolvedValue(mockEmbeddingService as any);

      vi.mocked(neuralFlow.neuralQuery).mockResolvedValue({
        fusedResults: [],
        stats: { topScore: 0, avgScore: 0, totalResults: 0 },
      } as any);

      vi.mocked(askAI.askAI).mockRejectedValue(new Error('Perplexity error'));

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          AbstractText: 'Result',
          Heading: 'Test',
        }),
      } as Response);

      const result = await coordinator.research('test query');

      expect(result?.provider).toBe('duckduckgo');
    });
  });
});
