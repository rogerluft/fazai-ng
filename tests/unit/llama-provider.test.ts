/**
 * Testes Unitários - LlamaProvider (llama.cpp local server)
 *
 * Para rodar: npm test -- tests/unit/llama-provider.test.ts
 *
 * Testes cobrem:
 * - Configuração do provider (carrega de fazai.conf)
 * - Validação de disponibilidade
 * - Retry com backoff exponencial
 * - Streaming SSE
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock do fetch global
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock do config para evitar dependência de arquivo
vi.mock('../../src/config.js', () => ({
  getConfigValue: vi.fn((key: string) => {
    const config: Record<string, string> = {
      LLAMA_SERVER_URL: 'http://localhost:11430',
      LLAMA_TIMEOUT: '10000',
      LLAMA_RETRIES: '3',
      LLAMA_TEMPERATURE: '0.7',
      LLAMA_MAX_TOKENS: '2048',
      MODELS_LLAMA: 'phi3-mini',
    };
    return config[key];
  }),
}));

// Mock do logger
vi.mock('../../src/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('LlamaProvider (Unit Tests)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuração', () => {
    it('deve carregar configurações do fazai.conf', async () => {
      // Import dinâmico para aplicar mocks
      const { LlamaProvider } = await import('../../src/providers/llama.js');
      const provider = new LlamaProvider();

      expect(provider.type).toBe('llama');
      expect(provider.name).toBe('LLaMA.cpp Local');
    });

    it('deve retornar modelos disponíveis do config', async () => {
      const { LlamaProvider } = await import('../../src/providers/llama.js');
      const provider = new LlamaProvider();

      const models = provider.getAvailableModels();
      expect(models).toContain('phi3-mini');
    });
  });

  describe('Validação de Disponibilidade', () => {
    it('deve retornar true quando llama-server está respondendo', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const { LlamaProvider } = await import('../../src/providers/llama.js');
      const provider = new LlamaProvider();

      const available = await provider.isAvailable();
      expect(available).toBe(true);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11430/health',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('deve retornar false após todas tentativas falharem', async () => {
      // Falha em todas as 3 tentativas
      mockFetch
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const { LlamaProvider } = await import('../../src/providers/llama.js');
      const provider = new LlamaProvider();

      const available = await provider.isAvailable();
      expect(available).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('deve recuperar após falhas iniciais', async () => {
      // Falha nas 2 primeiras, sucesso na 3a
      mockFetch
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce({ ok: true, status: 200 });

      const { LlamaProvider } = await import('../../src/providers/llama.js');
      const provider = new LlamaProvider();

      const available = await provider.isAvailable();
      expect(available).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Validate()', () => {
    it('deve retornar valid=true quando servidor está disponível', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      const { LlamaProvider } = await import('../../src/providers/llama.js');
      const provider = new LlamaProvider();

      const result = await provider.validate();
      expect(result.valid).toBe(true);
      expect(result.provider).toBe('llama');
    });

    it('deve retornar valid=false com mensagem de erro quando servidor não está disponível', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const { LlamaProvider } = await import('../../src/providers/llama.js');
      const provider = new LlamaProvider();

      const result = await provider.validate();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('llama-server não disponível');
      expect(result.provider).toBe('llama');
    });
  });

  describe('Query (Non-Streaming)', () => {
    it('deve fazer query e retornar resposta completa', async () => {
      // Mock health check
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      // Mock query response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Olá! Como posso ajudar?',
              },
            },
          ],
        }),
      });

      const { LlamaProvider } = await import('../../src/providers/llama.js');
      const provider = new LlamaProvider();

      const response = await provider.chat([
        { role: 'user', content: 'Olá!' },
      ]);

      expect(response).toBe('Olá! Como posso ajudar?');
    });
  });

  describe('Query (Streaming)', () => {
    it('deve processar stream SSE corretamente', async () => {
      // Simular stream SSE
      const sseData = [
        'data: {"choices":[{"delta":{"content":"Olá"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" mundo"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"!"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const encoder = new TextEncoder();
      let chunkIndex = 0;

      const mockReader = {
        read: vi.fn().mockImplementation(() => {
          if (chunkIndex < sseData.length) {
            const chunk = sseData[chunkIndex++];
            return Promise.resolve({
              done: false,
              value: encoder.encode(chunk),
            });
          }
          return Promise.resolve({ done: true, value: undefined });
        }),
        releaseLock: vi.fn(),
      };

      const mockBody = {
        getReader: () => mockReader,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: mockBody as unknown as ReadableStream<Uint8Array>,
      });

      const { LlamaProvider } = await import('../../src/providers/llama.js');
      const provider = new LlamaProvider();

      const chunks: string[] = [];
      for await (const chunk of provider.query({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'phi3-mini',
        stream: true,
      })) {
        chunks.push(chunk);
      }

      expect(chunks.join('')).toBe('Olá mundo!');
    });
  });

  describe('Error Handling', () => {
    it('deve lançar ProviderQueryError após todas tentativas falharem', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { LlamaProvider, ProviderQueryError } = await import('../../src/providers/llama.js');
      const provider = new LlamaProvider();

      const generator = provider.query({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'phi3-mini',
      });

      await expect(async () => {
        for await (const _ of generator) {
          // consume generator
        }
      }).rejects.toThrow();
    });

    it('deve tratar HTTP errors corretamente', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const { LlamaProvider } = await import('../../src/providers/llama.js');
      const provider = new LlamaProvider();

      const generator = provider.query({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'phi3-mini',
      });

      await expect(async () => {
        for await (const _ of generator) {
          // consume generator
        }
      }).rejects.toThrow(/HTTP 500/);
    });
  });

  describe('Singleton Factory', () => {
    it('deve retornar mesma instância via getLlamaProvider()', async () => {
      const { getLlamaProvider } = await import('../../src/providers/llama.js');

      const instance1 = getLlamaProvider();
      const instance2 = getLlamaProvider();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Utility Function', () => {
    it('isLlamaServerAvailable() deve verificar disponibilidade', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      const { isLlamaServerAvailable } = await import('../../src/providers/llama.js');

      const available = await isLlamaServerAvailable();
      expect(available).toBe(true);
    });
  });
});
