/**
 * @file Testes para Jules API Client
 * @description Testes unitários para o cliente REST da Jules API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JulesAPIClient, createJulesAPIClient, getJulesAPIClient } from '../src/orchestrator/jules-api-client';

// Mock do config
vi.mock('../src/config', () => ({
  getConfigValue: vi.fn((key: string) => {
    if (key === 'JULES_API_KEY') return 'test-api-key-123';
    return undefined;
  }),
}));

// Mock do logger
vi.mock('../src/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock global fetch
global.fetch = vi.fn();

describe('JulesAPIClient', () => {
  let client: JulesAPIClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new JulesAPIClient('test-api-key');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Constructor', () => {
    it('deve criar instância com API key fornecida', () => {
      const customClient = new JulesAPIClient('custom-key');
      expect(customClient).toBeInstanceOf(JulesAPIClient);
    });

    it('deve criar instância com API key do config', () => {
      const configClient = new JulesAPIClient();
      expect(configClient).toBeInstanceOf(JulesAPIClient);
    });

    it('deve lançar erro se API key não for encontrada', async () => {
      const config = await import('../src/config');
      vi.mocked(config.getConfigValue).mockReturnValueOnce(undefined);

      expect(() => new JulesAPIClient()).toThrow('JULES_API_KEY não encontrada');
    });
  });

  describe('listSources', () => {
    it('deve listar fontes disponíveis', async () => {
      const mockResponse = {
        sources: [
          {
            name: 'sources/github/owner/repo1',
            displayName: 'Repo 1',
            description: 'Test repository 1',
          },
          {
            name: 'sources/github/owner/repo2',
            displayName: 'Repo 2',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await client.listSources();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://jules.googleapis.com/v1alpha/sources?pageSize=50',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Goog-Api-Key': 'test-api-key',
          }),
        })
      );

      expect(result.sources).toHaveLength(2);
      expect(result.sources[0].name).toBe('sources/github/owner/repo1');
    });

    it('deve incluir pageToken na requisição', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ sources: [] }),
      });

      await client.listSources(10, 'next-page-token');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('pageSize=10'),
        expect.any(Object)
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('pageToken=next-page-token'),
        expect.any(Object)
      );
    });
  });

  describe('createSession', () => {
    it('deve criar nova sessão simples com sucesso', async () => {
      const mockSession = {
        name: 'sessions/abc123',
        state: 'ACTIVE',
        createTime: '2025-12-22T10:00:00Z',
        plan: 'Will fix the bug in auth.ts',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockSession),
      });

      const result = await client.createSession('Fix auth bug', {
        source: 'sources/github/owner/repo',
        githubRepoContext: { startingBranch: 'main' },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://jules.googleapis.com/v1alpha/sessions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            prompt: 'Fix auth bug',
            sourceContext: {
              source: 'sources/github/owner/repo',
              githubRepoContext: { startingBranch: 'main' },
            },
          }),
        })
      );

      expect(result.name).toBe('sessions/abc123');
      expect(result.state).toBe('ACTIVE');
    });

    it('deve criar sessão com auto PR ativado', async () => {
      const mockSessionWithPR = {
        name: 'sessions/def456',
        state: 'COMPLETED',
        createTime: '2025-12-22T11:00:00Z',
        title: 'feat: Add new feature',
        outputs: [
          {
            pullRequest: {
              url: 'https://github.com/owner/repo/pull/101',
              title: 'feat: Add new feature',
              description: 'PR description',
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockSessionWithPR),
      });

      const result = await client.createSession(
        'Implement the new feature',
        {
          source: 'sources/github/owner/repo',
          githubRepoContext: { startingBranch: 'feature-branch', targetBranch: 'main' },
        },
        'feat: Add new feature',
        true
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://jules.googleapis.com/v1alpha/sessions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            prompt: 'Implement the new feature',
            sourceContext: {
              source: 'sources/github/owner/repo',
              githubRepoContext: { startingBranch: 'feature-branch', targetBranch: 'main' },
            },
            title: 'feat: Add new feature',
            automationMode: 'AUTO_CREATE_PR',
          }),
        })
      );

      expect(result.name).toBe('sessions/def456');
      expect(result.outputs).toBeDefined();
      expect(result.outputs?.[0].pullRequest.url).toBe('https://github.com/owner/repo/pull/101');
    });
  });

  describe('sendMessage', () => {
    it('deve enviar mensagem para sessão', async () => {
      const mockResponse = {
        messageId: 'msg-123',
        response: 'Working on it...',
        state: 'ACTIVE',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await client.sendMessage('abc123', 'Add tests');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://jules.googleapis.com/v1alpha/sessions/abc123:sendMessage',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ content: 'Add tests' }),
        })
      );

      expect(result.messageId).toBe('msg-123');
      expect(result.state).toBe('ACTIVE');
    });

    it('deve normalizar sessionId com prefixo', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ messageId: 'msg', state: 'ACTIVE' }),
      });

      await client.sendMessage('sessions/abc123', 'Test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('sessions/abc123:sendMessage'),
        expect.any(Object)
      );
    });
  });

  describe('getSession', () => {
    it('deve obter detalhes da sessão', async () => {
      const mockSession = {
        name: 'sessions/abc123',
        state: 'COMPLETED',
        createTime: '2025-12-22T10:00:00Z',
        updateTime: '2025-12-22T10:30:00Z',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockSession),
      });

      const result = await client.getSession('abc123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://jules.googleapis.com/v1alpha/sessions/abc123',
        expect.any(Object)
      );

      expect(result.name).toBe('sessions/abc123');
      expect(result.state).toBe('COMPLETED');
    });
  });

  describe('listSessions', () => {
    it('deve listar todas as sessões', async () => {
      const mockResponse = {
        sessions: [
          { name: 'sessions/1', state: 'ACTIVE', createTime: '2025-12-22T10:00:00Z' },
          { name: 'sessions/2', state: 'COMPLETED', createTime: '2025-12-22T09:00:00Z' },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await client.listSessions();

      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0].state).toBe('ACTIVE');
    });
  });

  describe('deleteSession', () => {
    it('deve deletar sessão', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: async () => '',
      });

      await client.deleteSession('abc123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://jules.googleapis.com/v1alpha/sessions/abc123',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('deve tratar erro HTTP da API', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () =>
          JSON.stringify({
            error: {
              code: 403,
              message: 'API key invalid',
              status: 'PERMISSION_DENIED',
            },
          }),
      });

      await expect(client.listSources()).rejects.toThrow('Jules API error [403]: API key invalid');
    });

    it('deve tratar erro de rede', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(client.listSources()).rejects.toThrow('Erro de rede ao acessar Jules API: Network error');
    });

    it('deve tratar resposta não-JSON', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => 'Invalid JSON response',
      });

      const result = await client.listSources();
      expect(result).toHaveProperty('raw', 'Invalid JSON response');
    });
  });

  describe('Helper Methods', () => {
    it('extractSessionId deve remover prefixo', () => {
      expect(JulesAPIClient.extractSessionId('sessions/abc123')).toBe('abc123');
      expect(JulesAPIClient.extractSessionId('abc123')).toBe('abc123');
    });

    it('formatSessionName deve adicionar prefixo', () => {
      expect(JulesAPIClient.formatSessionName('abc123')).toBe('sessions/abc123');
      expect(JulesAPIClient.formatSessionName('sessions/abc123')).toBe('sessions/abc123');
    });
  });

  describe('Factory Functions', () => {
    it('createJulesAPIClient deve criar nova instância', () => {
      const newClient = createJulesAPIClient('factory-key');
      expect(newClient).toBeInstanceOf(JulesAPIClient);
    });

    it('getJulesAPIClient deve retornar singleton', () => {
      const client1 = getJulesAPIClient();
      const client2 = getJulesAPIClient();
      expect(client1).toBe(client2);
    });
  });
});
