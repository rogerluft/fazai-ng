/**
 * Error Tracker Unit Tests
 *
 * Tests for error tracking system
 */

import { describe, it, expect, beforeEach } from "vitest";
import { errorTracker, FormattedError } from "../../src/error-tracker";

describe("Error Tracker", () => {
  beforeEach(() => {
    // Limpa tracker antes de cada teste
    errorTracker.clear();
  });

  it("should capture errors", () => {
    errorTracker.captureError("api", "Test API error");
    const errors = errorTracker.getRecentErrors(10);

    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe("api");
    expect(errors[0].message).toBe("Test API error");
    expect(errors[0].status).toBe("error");
  });

  it("should classify error types correctly", () => {
    errorTracker.captureError("cache", "Cache miss");
    errorTracker.captureError("provider", "Ollama connection failed");
    errorTracker.captureError("network", "ECONNREFUSED");
    errorTracker.captureError("validation", "Invalid input");

    const stats = errorTracker.getStats();

    expect(stats.total).toBe(4);
    expect(stats.cache).toBe(1);
    expect(stats.provider).toBe(1);
    expect(stats.network).toBe(1);
    expect(stats.validation).toBe(1);
  });

  it("should limit to 50 errors max", () => {
    // Adiciona 60 erros
    for (let i = 0; i < 60; i++) {
      errorTracker.captureError("system", `Error ${i}`);
    }

    const stats = errorTracker.getStats();
    expect(stats.total).toBe(50); // Máximo de 50
  });

  it("should return most recent errors first", () => {
    errorTracker.captureError("system", "First error");
    errorTracker.captureError("system", "Second error");
    errorTracker.captureError("system", "Third error");

    const errors = errorTracker.getRecentErrors(3);

    expect(errors[0].message).toBe("Third error"); // Mais recente
    expect(errors[1].message).toBe("Second error");
    expect(errors[2].message).toBe("First error");
  });

  it("should format timestamp correctly", () => {
    errorTracker.captureError("system", "Test error");
    const errors = errorTracker.getRecentErrors(1);

    expect(errors[0].timestamp).toMatch(/^\d{2}:\d{2}$/); // HH:MM
  });

  it("should truncate long messages", () => {
    const longMessage = "A".repeat(100);
    errorTracker.captureError("system", longMessage);

    const errors = errorTracker.getRecentErrors(1);
    expect(errors[0].message.length).toBeLessThanOrEqual(60);
  });

  it("should detect recent errors (last 5 minutes)", () => {
    errorTracker.captureError("system", "Recent error");
    expect(errorTracker.hasRecentErrors()).toBe(true);
  });

  it("should return null when no errors exist", () => {
    const lastError = errorTracker.getLastError();
    expect(lastError).toBeNull();
  });

  it("should clear all errors", () => {
    errorTracker.captureError("system", "Error 1");
    errorTracker.captureError("system", "Error 2");

    expect(errorTracker.getStats().total).toBe(2);

    errorTracker.clear();

    expect(errorTracker.getStats().total).toBe(0);
  });

  it("should handle error context", () => {
    const context = { userId: 123, action: "test" };
    errorTracker.captureError("api", "API error with context", undefined, context);

    const lastError = errorTracker.getLastError();
    expect(lastError).not.toBeNull();
    expect(lastError?.context).toEqual(context);
  });
});
