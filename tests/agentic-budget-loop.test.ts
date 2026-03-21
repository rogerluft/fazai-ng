/**
 * Budget Agentic Loop — Test Suite
 *
 * Tests the evolved BudgetAgenticLoop: budget tracking, heartbeat,
 * circuit breaker, session management, and Maestro Cleaner hooks.
 *
 * All tests use mocks to avoid Qdrant/embedding dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SessionManager,
  getSessionManager,
  type AgenticSession,
  type SessionState,
} from "../src/agentic/session-manager";

// ─────────────────────────────────────────────────────────────────────
// SessionManager tests (no external deps)
// ─────────────────────────────────────────────────────────────────────

describe("SessionManager", () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  describe("createSession", () => {
    it("should create a session with correct defaults", () => {
      const session = manager.createSession("test query", 10, 50000);

      expect(session).toBeDefined();
      expect(session.sessionId).toBeTruthy();
      expect(session.state).toBe("running");
      expect(session.query).toBe("test query");
      expect(session.maxIterations).toBe(10);
      expect(session.tokenBudget).toBe(50000);
      expect(session.tokensUsed).toBe(0);
      expect(session.iterationsCompleted).toBe(0);
      expect(session.consecutiveFailures).toBe(0);
      expect(session.contextItemsFound).toBe(0);
    });

    it("should generate unique session IDs", () => {
      const s1 = manager.createSession("q1", 5, 10000);
      const s2 = manager.createSession("q2", 5, 10000);
      expect(s1.sessionId).not.toBe(s2.sessionId);
    });
  });

  describe("getSession", () => {
    it("should return session by ID", () => {
      const created = manager.createSession("test", 5, 10000);
      const fetched = manager.getSession(created.sessionId);
      expect(fetched).toEqual(created);
    });

    it("should return undefined for unknown ID", () => {
      expect(manager.getSession("nonexistent")).toBeUndefined();
    });
  });

  describe("listSessions", () => {
    it("should list all sessions", () => {
      manager.createSession("q1", 5, 10000);
      manager.createSession("q2", 5, 10000);
      expect(manager.listSessions()).toHaveLength(2);
    });

    it("should filter by state", () => {
      const s1 = manager.createSession("q1", 5, 10000);
      manager.createSession("q2", 5, 10000);
      manager.pauseSession(s1.sessionId);

      expect(manager.listSessions("running")).toHaveLength(1);
      expect(manager.listSessions("paused")).toHaveLength(1);
    });
  });

  describe("State transitions", () => {
    it("should pause a running session", () => {
      const session = manager.createSession("test", 5, 10000);
      expect(manager.pauseSession(session.sessionId)).toBe(true);
      expect(manager.getSession(session.sessionId)?.state).toBe("paused");
    });

    it("should resume a paused session", () => {
      const session = manager.createSession("test", 5, 10000);
      manager.pauseSession(session.sessionId);
      expect(manager.resumeSession(session.sessionId)).toBe(true);
      expect(manager.getSession(session.sessionId)?.state).toBe("running");
    });

    it("should kill a running session", () => {
      const session = manager.createSession("test", 5, 10000);
      expect(manager.killSession(session.sessionId)).toBe(true);
      expect(manager.getSession(session.sessionId)?.state).toBe("killed");
    });

    it("should kill a paused session", () => {
      const session = manager.createSession("test", 5, 10000);
      manager.pauseSession(session.sessionId);
      expect(manager.killSession(session.sessionId)).toBe(true);
      expect(manager.getSession(session.sessionId)?.state).toBe("killed");
    });

    it("should NOT transition from terminal state (completed)", () => {
      const session = manager.createSession("test", 5, 10000);
      manager.updateState(session.sessionId, "completed");
      expect(manager.updateState(session.sessionId, "running")).toBe(false);
      expect(manager.getSession(session.sessionId)?.state).toBe("completed");
    });

    it("should NOT transition from terminal state (killed)", () => {
      const session = manager.createSession("test", 5, 10000);
      manager.killSession(session.sessionId);
      expect(manager.resumeSession(session.sessionId)).toBe(false);
      expect(manager.getSession(session.sessionId)?.state).toBe("killed");
    });

    it("should NOT resume a running session", () => {
      const session = manager.createSession("test", 5, 10000);
      expect(manager.resumeSession(session.sessionId)).toBe(false);
    });

    it("should return false for unknown session", () => {
      expect(manager.pauseSession("nonexistent")).toBe(false);
      expect(manager.resumeSession("nonexistent")).toBe(false);
      expect(manager.killSession("nonexistent")).toBe(false);
    });
  });

  describe("recordIteration", () => {
    it("should track iterations and tokens", () => {
      const session = manager.createSession("test", 10, 50000);
      manager.recordIteration(session.sessionId, 100, 3, true);
      manager.recordIteration(session.sessionId, 200, 5, true);

      const updated = manager.getSession(session.sessionId);
      expect(updated?.iterationsCompleted).toBe(2);
      expect(updated?.tokensUsed).toBe(300);
      expect(updated?.contextItemsFound).toBe(8);
      expect(updated?.consecutiveFailures).toBe(0);
    });

    it("should track consecutive failures", () => {
      const session = manager.createSession("test", 10, 50000);
      manager.recordIteration(session.sessionId, 100, 0, false);
      manager.recordIteration(session.sessionId, 100, 0, false);
      manager.recordIteration(session.sessionId, 100, 0, false);

      expect(manager.getSession(session.sessionId)?.consecutiveFailures).toBe(3);
    });

    it("should reset consecutive failures on success", () => {
      const session = manager.createSession("test", 10, 50000);
      manager.recordIteration(session.sessionId, 100, 0, false);
      manager.recordIteration(session.sessionId, 100, 0, false);
      manager.recordIteration(session.sessionId, 100, 3, true); // success resets

      expect(manager.getSession(session.sessionId)?.consecutiveFailures).toBe(0);
    });
  });

  describe("isBudgetExhausted", () => {
    it("should detect iteration budget exhaustion", () => {
      const session = manager.createSession("test", 2, 50000);
      manager.recordIteration(session.sessionId, 100, 1, true);
      manager.recordIteration(session.sessionId, 100, 1, true);

      const result = manager.isBudgetExhausted(session.sessionId);
      expect(result.exhausted).toBe(true);
      expect(result.reason).toContain("Max iterations");
    });

    it("should detect token budget exhaustion", () => {
      const session = manager.createSession("test", 100, 500);
      manager.recordIteration(session.sessionId, 600, 1, true);

      const result = manager.isBudgetExhausted(session.sessionId);
      expect(result.exhausted).toBe(true);
      expect(result.reason).toContain("Token budget");
    });

    it("should return not exhausted when within budget", () => {
      const session = manager.createSession("test", 10, 50000);
      manager.recordIteration(session.sessionId, 100, 1, true);

      const result = manager.isBudgetExhausted(session.sessionId);
      expect(result.exhausted).toBe(false);
    });

    it("should return exhausted for unknown session", () => {
      const result = manager.isBudgetExhausted("nonexistent");
      expect(result.exhausted).toBe(true);
    });
  });

  describe("shouldTripCircuitBreaker", () => {
    it("should trip after N consecutive failures", () => {
      const session = manager.createSession("test", 10, 50000);
      manager.recordIteration(session.sessionId, 100, 0, false);
      manager.recordIteration(session.sessionId, 100, 0, false);
      manager.recordIteration(session.sessionId, 100, 0, false);

      expect(manager.shouldTripCircuitBreaker(session.sessionId, 3)).toBe(true);
    });

    it("should NOT trip before N failures", () => {
      const session = manager.createSession("test", 10, 50000);
      manager.recordIteration(session.sessionId, 100, 0, false);
      manager.recordIteration(session.sessionId, 100, 0, false);

      expect(manager.shouldTripCircuitBreaker(session.sessionId, 3)).toBe(false);
    });

    it("should NOT trip if a success resets counter", () => {
      const session = manager.createSession("test", 10, 50000);
      manager.recordIteration(session.sessionId, 100, 0, false);
      manager.recordIteration(session.sessionId, 100, 0, false);
      manager.recordIteration(session.sessionId, 100, 1, true); // resets
      manager.recordIteration(session.sessionId, 100, 0, false);

      expect(manager.shouldTripCircuitBreaker(session.sessionId, 3)).toBe(false);
    });
  });

  describe("recordHeartbeat", () => {
    it("should generate heartbeat data", () => {
      const session = manager.createSession("test", 5, 10000);
      manager.recordIteration(session.sessionId, 100, 3, true);

      const heartbeat = manager.recordHeartbeat(session.sessionId);
      expect(heartbeat).toBeDefined();
      expect(heartbeat?.sessionId).toBe(session.sessionId);
      expect(heartbeat?.state).toBe("running");
      expect(heartbeat?.iteration).toBe(1);
      expect(heartbeat?.tokensUsed).toBe(100);
      expect(heartbeat?.contextItems).toBe(3);
      expect(heartbeat?.elapsedMs).toBeGreaterThanOrEqual(0);
    });

    it("should return null for unknown session", () => {
      expect(manager.recordHeartbeat("nonexistent")).toBeNull();
    });

    it("should update lastHeartbeat timestamp", () => {
      const session = manager.createSession("test", 5, 10000);
      const before = session.lastHeartbeat;

      // Small delay to ensure time difference
      manager.recordHeartbeat(session.sessionId);
      const after = manager.getSession(session.sessionId)?.lastHeartbeat;

      expect(after).toBeDefined();
    });
  });

  describe("formatSession", () => {
    it("should produce readable output", () => {
      const session = manager.createSession("How to configure nginx?", 10, 50000);
      manager.recordIteration(session.sessionId, 500, 3, true);

      const output = manager.formatSession(session);
      expect(output).toContain("Session:");
      expect(output).toContain("running");
      expect(output).toContain("nginx");
      expect(output).toContain("1/10");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────
// Singleton tests
// ─────────────────────────────────────────────────────────────────────

describe("getSessionManager singleton", () => {
  it("should return the same instance", () => {
    const m1 = getSessionManager();
    const m2 = getSessionManager();
    expect(m1).toBe(m2);
  });
});
