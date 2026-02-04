/**
 * Semantic Cache Handler Registration Tests
 *
 * Testa o problema de múltiplos handlers registrados
 *
 * PROBLEMA IDENTIFICADO (commit 34d82f4):
 * - process.on('SIGINT', ...) é chamado cada vez que startCleanupTimer() executa
 * - Se initialize() for chamado múltiplas vezes, acumula handlers
 * - Pode causar MaxListenersExceededWarning do Node.js
 *
 * FLUXO ATUAL (BUGADO):
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ getInstance() → initialize() → startCleanupTimer()              │
 * │         ↓                                                        │
 * │ process.on('SIGINT', handler)  ← Registra handler               │
 * │         ↓                                                        │
 * │ [Segunda chamada - erro de concorrência]                        │
 * │         ↓                                                        │
 * │ process.on('SIGINT', handler)  ← Registra OUTRO handler (BUG!)  │
 * │         ↓                                                        │
 * │ MaxListenersExceededWarning                                     │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * FLUXO ESPERADO (CORRETO):
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ getInstance() → initialize() → startCleanupTimer()              │
 * │         ↓                                                        │
 * │ if (!handlersRegistered) {                                      │
 * │   process.on('SIGINT', handler)                                 │
 * │   handlersRegistered = true                                     │
 * │ }                                                                │
 * │         ↓                                                        │
 * │ [Segunda chamada]                                               │
 * │         ↓                                                        │
 * │ handlersRegistered = true → SKIP registration                   │
 * └─────────────────────────────────────────────────────────────────┘
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { SemanticCache } from '../../src/services/semantic-cache';

/**
 * Mock do process para isolar testes
 */
class MockProcess extends EventEmitter {
  private handlers: Map<string, Function[]> = new Map();

  on(event: string, handler: Function): this {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
    return this;
  }

  getHandlerCount(event: string): number {
    return this.handlers.get(event)?.length ?? 0;
  }

  clearHandlers(): void {
    this.handlers.clear();
  }
}

/**
 * Simula o comportamento CORRIGIDO do startCleanupTimer
 */
class BuggySemanticCache {
  private cleanupTimer: NodeJS.Timeout | null = null;
  private mockProcess: MockProcess;
  private handlersRegistered = false;

  constructor(mockProcess: MockProcess) {
    this.mockProcess = mockProcess;
  }

  // Named handlers to follow best practices and allow removal if needed
  private handleSigInt = () => this.stop();
  private handleSigTerm = () => this.stop();

  startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      // cleanup
    }, 10000);

    // FIX: Registra handlers apenas UMA VEZ
    if (!this.handlersRegistered) {
      this.mockProcess.on('SIGINT', this.handleSigInt);
      this.mockProcess.on('SIGTERM', this.handleSigTerm);
      this.handlersRegistered = true;
    }
  }

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

/**
 * Simula o comportamento CORRETO do startCleanupTimer
 */
class CorrectSemanticCache {
  private cleanupTimer: NodeJS.Timeout | null = null;
  private handlersRegistered = false;
  private mockProcess: MockProcess;

  constructor(mockProcess: MockProcess) {
    this.mockProcess = mockProcess;
  }

  startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      // cleanup
    }, 10000);

    // CORRETO: Registra handlers apenas UMA VEZ
    if (!this.handlersRegistered) {
      this.mockProcess.on('SIGINT', () => this.stop());
      this.mockProcess.on('SIGTERM', () => this.stop());
      this.handlersRegistered = true;
    }
  }

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

describe('Semantic Cache - Handler Registration Bug', () => {
  let mockProcess: MockProcess;

  beforeEach(() => {
    mockProcess = new MockProcess();
  });

  afterEach(() => {
    mockProcess.clearHandlers();
  });

  describe('Comportamento ATUAL (Corrigido)', () => {
    it('deve registrar handlers apenas UMA VEZ mesmo quando chamado várias vezes', () => {
      const cache = new BuggySemanticCache(mockProcess);

      // Primeira chamada
      cache.startCleanupTimer();
      expect(mockProcess.getHandlerCount('SIGINT')).toBe(1);
      expect(mockProcess.getHandlerCount('SIGTERM')).toBe(1);

      // Segunda chamada (re-inicialização)
      cache.startCleanupTimer();
      expect(mockProcess.getHandlerCount('SIGINT')).toBe(1); // FIX: Mantém 1
      expect(mockProcess.getHandlerCount('SIGTERM')).toBe(1);

      // Terceira chamada
      cache.startCleanupTimer();
      expect(mockProcess.getHandlerCount('SIGINT')).toBe(1);
      expect(mockProcess.getHandlerCount('SIGTERM')).toBe(1);

      cache.stop();
    });

    it('não deve acumular handlers indefinidamente', () => {
      const cache = new BuggySemanticCache(mockProcess);

      // Simula múltiplas chamadas
      for (let i = 0; i < 10; i++) {
        cache.startCleanupTimer();
      }

      // FIX: Apenas 1 handler registrado
      expect(mockProcess.getHandlerCount('SIGINT')).toBe(1);
      expect(mockProcess.getHandlerCount('SIGTERM')).toBe(1);

      cache.stop();
    });
  });

  describe('Comportamento CORRETO (Esperado)', () => {
    it('deve registrar handlers apenas UMA VEZ', () => {
      const cache = new CorrectSemanticCache(mockProcess);

      // Primeira chamada
      cache.startCleanupTimer();
      expect(mockProcess.getHandlerCount('SIGINT')).toBe(1);
      expect(mockProcess.getHandlerCount('SIGTERM')).toBe(1);

      // Segunda chamada (não deve registrar novamente)
      cache.startCleanupTimer();
      expect(mockProcess.getHandlerCount('SIGINT')).toBe(1); // Mantém 1
      expect(mockProcess.getHandlerCount('SIGTERM')).toBe(1);

      // Terceira chamada (ainda 1)
      cache.startCleanupTimer();
      expect(mockProcess.getHandlerCount('SIGINT')).toBe(1);
      expect(mockProcess.getHandlerCount('SIGTERM')).toBe(1);

      cache.stop();
    });

    it('deve manter apenas 1 handler mesmo com múltiplas chamadas', () => {
      const cache = new CorrectSemanticCache(mockProcess);

      // Simula múltiplas chamadas
      for (let i = 0; i < 10; i++) {
        cache.startCleanupTimer();
      }

      // CORRETO: Apenas 1 handler
      expect(mockProcess.getHandlerCount('SIGINT')).toBe(1);
      expect(mockProcess.getHandlerCount('SIGTERM')).toBe(1);

      cache.stop();
    });
  });

  describe('Comparação de Comportamento', () => {
    it('tanto Buggy (fix) quanto Correct não devem acumular', () => {
      const buggy = new BuggySemanticCache(mockProcess);
      const correct = new CorrectSemanticCache(new MockProcess());

      const calls = 5;

      for (let i = 0; i < calls; i++) {
        buggy.startCleanupTimer();
        correct.startCleanupTimer();
      }

      // Ambos devem ter apenas 1
      expect(mockProcess.getHandlerCount('SIGINT')).toBe(1);

      buggy.stop();
      correct.stop();
    });
  });
});

describe('Semantic Cache - Cleanup Timer', () => {
  let mockProcess: MockProcess;

  beforeEach(() => {
    mockProcess = new MockProcess();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    mockProcess.clearHandlers();
  });

  it('deve limpar timer anterior ao chamar startCleanupTimer novamente', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const cache = new CorrectSemanticCache(mockProcess);

    cache.startCleanupTimer();
    cache.startCleanupTimer();

    // Deve ter chamado clearInterval para o timer anterior
    expect(clearIntervalSpy).toHaveBeenCalled();

    cache.stop();
    clearIntervalSpy.mockRestore();
  });

  it('deve parar timer ao chamar stop()', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const cache = new CorrectSemanticCache(mockProcess);

    cache.startCleanupTimer();
    cache.stop();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});

describe('Node.js MaxListenersExceededWarning Prevention', () => {
  it('deve prevenir o problema de muitos listeners', () => {
    /**
     * Node.js emite MaxListenersExceededWarning quando mais de 10 listeners são adicionados.
     * O código corrigido evita isso.
     */

    const mockProcess = new MockProcess();
    const cache = new BuggySemanticCache(mockProcess);

    // Simula 11 chamadas (limite default do Node.js)
    for (let i = 0; i < 11; i++) {
      cache.startCleanupTimer();
    }

    // FIX: Não excede o limite, mantém apenas 1
    expect(mockProcess.getHandlerCount('SIGINT')).toBe(1);
    expect(mockProcess.getHandlerCount('SIGINT')).toBeLessThan(10);

    cache.stop();
  });
});

describe('Semantic Cache - Real Implementation Verification', () => {
  beforeEach(() => {
    // Reset singleton instance and static flag
    (SemanticCache as any).instance = null;
    (SemanticCache as any).handlersRegistered = false;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve registrar handlers no process real apenas uma vez', async () => {
    const processOnSpy = vi.spyOn(process, 'on');

    // Primeira inicialização
    const cache = await SemanticCache.getInstance();

    const sigintCalls = processOnSpy.mock.calls.filter(call => call[0] === 'SIGINT').length;
    expect(sigintCalls).toBe(1);

    // Força nova chamada ao startCleanupTimer
    (cache as any).startCleanupTimer();

    // Deve continuar sendo 1
    const sigintCallsAfter = processOnSpy.mock.calls.filter(call => call[0] === 'SIGINT').length;
    expect(sigintCallsAfter).toBe(1);

    cache.stop();
  });

  it('deve chamar stop() quando o processo recebe SIGINT', async () => {
    const processOnSpy = vi.spyOn(process, 'on');
    const cache = await SemanticCache.getInstance();
    const stopSpy = vi.spyOn(cache, 'stop');

    // Encontra o handler registrado
    const sigintCall = processOnSpy.mock.calls.find(call => call[0] === 'SIGINT');
    expect(sigintCall).toBeDefined();
    const handler = sigintCall![1];

    // Executa o handler
    handler();

    expect(stopSpy).toHaveBeenCalled();

    cache.stop();
  });
});
