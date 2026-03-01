
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CircuitBreaker,
  CircuitState,
  type CircuitBreakerConfig,
  CircuitBreakerOpenError,
  CircuitBreakerTimeoutError,
} from "../../src/resilience/circuit-breaker";
import { logger } from "../../src/logger";

// Mock do logger para evitar logs durante os testes
vi.mock("../../src/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("CircuitBreaker", () => {
  const defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 2,
    resetTimeout: 1000, // 1 segundo
    operationTimeout: 500, // 0.5 segundos
    serviceName: "TestService",
  };

  let breaker: CircuitBreaker;

  // Mock de uma operação que pode ter sucesso ou falhar
  const mockOperation = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    breaker = new CircuitBreaker(defaultConfig);
    // Limpar todos os mocks antes de cada teste
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("1. O estado inicial deve ser CLOSED", () => {
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it("2. Deve abrir (OPEN) após N falhas consecutivas", async () => {
    const failureError = new Error("Operation failed");
    mockOperation.mockRejectedValue(failureError);

    // Primeira falha
    await expect(breaker.execute(mockOperation)).rejects.toThrow(failureError);
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.getMetrics().consecutiveFailures).toBe(1);

    // Segunda falha (atinge o threshold)
    await expect(breaker.execute(mockOperation)).rejects.toThrow(failureError);
    expect(breaker.getState()).toBe(CircuitState.OPEN);
    expect(breaker.getMetrics().consecutiveFailures).toBe(2);
  });

  it("3. Em estado OPEN, deve rejeitar chamadas imediatamente (FAIL FAST)", async () => {
    const failureError = new Error("Operation failed");
    mockOperation.mockRejectedValue(failureError);

    // Atingir o estado OPEN
    await expect(breaker.execute(mockOperation)).rejects.toThrow(failureError);
    await expect(breaker.execute(mockOperation)).rejects.toThrow(failureError);
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Tentativa de execução em estado OPEN
    await expect(breaker.execute(mockOperation)).rejects.toThrow(
      CircuitBreakerOpenError
    );

    // A operação mock não deve ter sido chamada nesta terceira tentativa
    expect(mockOperation).toHaveBeenCalledTimes(2);
    expect(breaker.getMetrics().totalRejections).toBe(1);
  });

  it("4. Após o timeout, deve transitar para HALF_OPEN", async () => {
    const failureError = new Error("Operation failed");
    mockOperation.mockRejectedValue(failureError);

    // Atingir o estado OPEN
    await expect(breaker.execute(mockOperation)).rejects.toThrow(failureError);
    await expect(breaker.execute(mockOperation)).rejects.toThrow(failureError);
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Avançar o tempo para o resetTimeout
    vi.advanceTimersByTime(defaultConfig.resetTimeout);

    // O estado deve mudar para HALF_OPEN na próxima verificação (que ocorre no início do execute)
    // O teste aqui é um pouco implícito. O CB transita para HALF_OPEN ao verificar o tempo
    // no início do próximo 'execute'. Se a chamada seguinte falhar com um erro que não seja
    // CircuitBreakerOpenError, significa que ele tentou executar, o que só acontece
    // em HALF_OPEN ou CLOSED.
    const testError = new Error("Half-open test failed");
    mockOperation.mockRejectedValue(testError);
    await expect(breaker.execute(mockOperation)).rejects.toThrow(testError);
    expect(breaker.getState()).toBe(CircuitState.OPEN); // Falha em HALF_OPEN reabre
  });

  it("5a. Em HALF_OPEN, uma chamada bem-sucedida deve fechar o circuito", async () => {
    const failureError = new Error("Operation failed");
    mockOperation.mockRejectedValue(failureError);

    // Atingir o estado OPEN
    await expect(breaker.execute(mockOperation)).rejects.toThrow(failureError);
    await expect(breaker.execute(mockOperation)).rejects.toThrow(failureError);

    // Transitar para HALF_OPEN
    vi.advanceTimersByTime(defaultConfig.resetTimeout);

    // Simular uma chamada bem-sucedida
    mockOperation.mockResolvedValue("Success");
    await expect(breaker.execute(mockOperation)).resolves.toBe("Success");

    // O circuito deve fechar
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.getMetrics().consecutiveFailures).toBe(0);
  });

  it("5b. Em HALF_OPEN, uma falha deve reabrir o circuito", async () => {
    const failureError = new Error("Operation failed");
    mockOperation.mockRejectedValue(failureError);

     // Atingir o estado OPEN
    await expect(breaker.execute(mockOperation)).rejects.toThrow(failureError);
    await expect(breaker.execute(mockOperation)).rejects.toThrow(failureError);

    // Transitar para HALF_OPEN
    vi.advanceTimersByTime(defaultConfig.resetTimeout);

    // Simular uma falha
    await expect(breaker.execute(mockOperation)).rejects.toThrow(failureError);

    // O circuito deve voltar para OPEN
    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it("6. Deve falhar com CircuitBreakerTimeoutError após o operationTimeout", async () => {
    // A test operation that takes longer than operationTimeout
    const slowOperation = () => new Promise<string>((resolve) => {
      setTimeout(() => resolve("Too late"), defaultConfig.operationTimeout + 100);
    });

    const promise = breaker.execute(slowOperation);

    // Advance timers so the timeout is triggered
    vi.advanceTimersByTime(defaultConfig.operationTimeout + 10);

    // allow microtasks to flush
    await Promise.resolve();

    await expect(promise).rejects.toThrow(CircuitBreakerTimeoutError);

    // Ensure metrics account for the timeout as a failure
    expect(breaker.getMetrics().consecutiveFailures).toBe(1);
    expect(breaker.getMetrics().totalFailures).toBe(1);
  });

  it("7. O reset manual deve funcionar e fechar o circuito", async () => {
    const failureError = new Error("Operation failed");
    mockOperation.mockRejectedValue(failureError);

    // Atingir o estado OPEN
    await expect(breaker.execute(mockOperation)).rejects.toThrow(failureError);
    await expect(breaker.execute(mockOperation)).rejects.toThrow(failureError);
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Resetar manualmente
    breaker.reset();

    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.getMetrics().consecutiveFailures).toBe(0);

    // Deve ser capaz de executar novamente
    mockOperation.mockResolvedValue("Success after reset");
    await expect(breaker.execute(mockOperation)).resolves.toBe("Success after reset");
  });
});
