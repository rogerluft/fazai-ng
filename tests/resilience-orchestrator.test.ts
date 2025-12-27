
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResilienceOrchestrator } from '../src/orchestrator/resilience-orchestrator';
import { AgenticWebCrawler } from '../src/research/web-crawler';
import * as askAIModule from '../src/askAI';
import * as configModule from '../src/config';
import * as modelsModule from '../src/models';

// Mock das dependências externas
vi.mock('../src/askAI');
vi.mock('../src/config');
vi.mock('../src/research/web-crawler');
vi.mock('../src/models', () => ({
  models: [
    { name: 'claude-opus-4', provider: 'anthropic', enabled: true },
    { name: 'gpt-4', provider: 'openai', enabled: true },
  ],
}));

describe('ResilienceOrchestrator', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('deve ter sucesso no nível 1 (IA primária)', async () => {
    const mockAskAI = vi.mocked(askAIModule.askAI).mockResolvedValue(async function* () {
      yield 'Resposta da IA Primária';
    }());

    const orchestrator = new ResilienceOrchestrator();
    const result = await orchestrator.executeTaskWithResilience('teste');

    expect(result.success).toBe(true);
    expect(result.level).toBe('primary_ai');
    expect(result.finalAnswer).toBe('Resposta da IA Primária');
    expect(mockAskAI).toHaveBeenCalledTimes(1);
  });

  it('deve fazer fallback para o nível 2 (IA secundária) se a primária falhar', async () => {
    const mockAskAI = vi.mocked(askAIModule.askAI)
      .mockRejectedValueOnce(new Error('Falha na IA Primária'))
      .mockResolvedValue(async function* () {
        yield 'Resposta da IA Secundária';
      }());

    const orchestrator = new ResilienceOrchestrator();
    const result = await orchestrator.executeTaskWithResilience('teste');

    expect(result.success).toBe(true);
    expect(result.level).toBe('fallback_ai');
    expect(result.finalAnswer).toBe('Resposta da IA Secundária');
    expect(mockAskAI).toHaveBeenCalledTimes(2);
  });

  it('deve fazer fallback para o nível 3 (Context7) se as IAs falharem', async () => {
    vi.mocked(askAIModule.askAI).mockRejectedValue(new Error('Falha na IA'));
    vi.mocked(configModule.getConfigValue).mockReturnValue('http://fake-context7.com');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [{ title: 'Título Context7', content: 'Conteúdo', url: 'http://docs.com' }] }),
    });

    const orchestrator = new ResilienceOrchestrator();
    const result = await orchestrator.executeTaskWithResilience('teste');

    expect(result.success).toBe(true);
    expect(result.level).toBe('context7');
    expect(result.finalAnswer).toContain('Título Context7');
  });

  it('deve fazer fallback para o nível 4 (Web Search) se os níveis anteriores falharem', async () => {
    vi.mocked(askAIModule.askAI).mockRejectedValue(new Error('Falha na IA'));
    vi.mocked(configModule.getConfigValue).mockReturnValue(null); // Desativa Context7
    const mockSearch = vi.mocked(AgenticWebCrawler.prototype.searchMultiSource).mockResolvedValue([
      { title: 'Resultado da Web', link: 'http://web.com', snippet: 'Snippet', source: 'DuckDuckGo', category: 'web' }
    ]);
     vi.mocked(AgenticWebCrawler.prototype.crossReference).mockResolvedValue({
        consensus: [],
        contradictions: [],
        sources: ["DuckDuckGo"],
        summary: "Resumo da Web.",
        totalResults: 1,
    });


    const orchestrator = new ResilienceOrchestrator();
    const result = await orchestrator.executeTaskWithResilience('teste');

    expect(result.success).toBe(true);
    expect(result.level).toBe('web_search');
    expect(result.finalAnswer).toContain('Resultado da Web');
    expect(mockSearch).toHaveBeenCalledTimes(1);
  });

  it('deve retornar falha crítica se todos os níveis falharem', async () => {
    vi.mocked(askAIModule.askAI).mockRejectedValue(new Error('Falha na IA'));
    vi.mocked(configModule.getConfigValue).mockReturnValue(null);
    vi.mocked(AgenticWebCrawler.prototype.searchMultiSource).mockResolvedValue([]);

    const orchestrator = new ResilienceOrchestrator();
    const result = await orchestrator.executeTaskWithResilience('teste');

    expect(result.success).toBe(false);
    expect(result.level).toBe('critical_failure');
    expect(result.error).toContain('All fallback mechanisms were exhausted');
  });
});
