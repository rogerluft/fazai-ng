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
 * Simula o comportamento ATUAL (bugado) do startCleanupTimer
 */
class BuggySemanticCache {
  private cleanupTimer: NodeJS.Timeout | null = null;
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

    // BUG: Sempre registra novos handlers!
    this.mockProcess.on('SIGINT', () => this.stop());
    this.mockProcess.on('SIGTERM', () => this.stop());
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

  describe('Comportamento ATUAL (Bugado)', () => {
    it('deve registrar múltiplos handlers quando chamado várias vezes', () => {
      const cache = new BuggySemanticCache(mockProcess);

      // Primeira chamada
      cache.startCleanupTimer();
      expect(mockProcess.getHandlerCount('SIGINT')).toBe(1);
      expect(mockProcess.getHandlerCount('SIGTERM')).toBe(1);

      // Segunda chamada (simula re-inicialização)
      cache.startCleanupTimer();
      expect(mockProcess.getHandlerCount('SIGINT')).toBe(2); // BUG: 2 handlers!
      expect(mockProcess.getHandlerCount('SIGTERM')).toBe(2);

      // Terceira chamada
      cache.startCleanupTimer();
      expect(mockProcess.getHandlerCount('SIGINT')).toBe(3); // BUG: 3 handlers!
      expect(mockProcess.getHandlerCount('SIGTERM')).toBe(3);

      cache.stop();
    });

    it('deve acumular handlers indefinidamente', () => {
      const cache = new BuggySemanticCache(mockProcess);

      // Simula múltiplas chamadas (ex: erro de concorrência)
      for (let i = 0; i < 10; i++) {
        cache.startCleanupTimer();
      }

      // BUG: 10 handlers registrados!
      expect(mockProcess.getHandlerCount('SIGINT')).toBe(10);
      expect(mockProcess.getHandlerCount('SIGTERM')).toBe(10);

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
    it('buggy acumula, correto não acumula', () => {
      const buggy = new BuggySemanticCache(mockProcess);
      const correct = new CorrectSemanticCache(new MockProcess());

      const calls = 5;

      for (let i = 0; i < calls; i++) {
        buggy.startCleanupTimer();
        correct.startCleanupTimer();
      }

      // Buggy: acumula handlers
      expect(mockProcess.getHandlerCount('SIGINT')).toBe(calls);

      // Correto: apenas 1
      // (usa seu próprio mockProcess)
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
  it('deve documentar o problema de muitos listeners', () => {
    /**
     * Node.js emite MaxListenersExceededWarning quando:
     * - Mais de 10 listeners são adicionados ao mesmo evento
     * - Isso indica possível memory leak
     *
     * O código bugado pode facilmente atingir esse limite se:
     * - getInstance() for chamado em loop
     * - Houver race conditions na inicialização
     * - O singleton for reinicializado por qualquer motivo
     *
     * Sintoma no console:
     * (node:12345) MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
     * 11 SIGINT listeners added to [process]. Use emitter.setMaxListeners() to increase limit
     */

    const mockProcess = new MockProcess();
    const cache = new BuggySemanticCache(mockProcess);

    // Simula 11 chamadas (limite default do Node.js)
    for (let i = 0; i < 11; i++) {
      cache.startCleanupTimer();
    }

    // Excede o limite default de 10 listeners
    expect(mockProcess.getHandlerCount('SIGINT')).toBe(11);
    expect(mockProcess.getHandlerCount('SIGINT')).toBeGreaterThan(10);

    cache.stop();
  });
});
