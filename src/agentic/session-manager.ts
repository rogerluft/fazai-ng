/**
 * Session Manager — Agentic Loop Session Persistence
 *
 * CRUD for agentic sessions in Qdrant fazai_memory collection.
 * Enables /pause, /resume, /status, /kill commands.
 *
 * Each session is stored as a vector point with metadata payload.
 * Session lookup uses both ID-based retrieval and semantic search.
 *
 * @module agentic/session-manager
 */

import { randomUUID } from "crypto";
import { logger } from "../logger.js";
import { getQdrantClient } from "../database/qdrant-pool.js";
import { createEmbeddingService } from "../services/embeddings.js";

const SESSION_COLLECTION = "fazai_memory";

/**
 * Session state lifecycle:
 *   running → paused → running (resume)
 *   running → completed (success)
 *   running → failed (error/circuit breaker)
 *   running → killed (manual /kill)
 *   paused  → killed (manual /kill)
 */
export type SessionState = "running" | "paused" | "completed" | "failed" | "killed";

/**
 * Agentic session record — persisted to Qdrant
 */
export interface AgenticSession {
  sessionId: string;
  state: SessionState;
  query: string;
  startedAt: string;
  lastHeartbeat: string;
  updatedAt: string;
  tokensUsed: number;
  iterationsCompleted: number;
  maxIterations: number;
  tokenBudget: number;
  consecutiveFailures: number;
  contextItemsFound: number;
  error?: string;
}

/**
 * Heartbeat data logged periodically
 */
export interface HeartbeatData {
  sessionId: string;
  state: SessionState;
  iteration: number;
  tokensUsed: number;
  contextItems: number;
  elapsedMs: number;
  timestamp: string;
}

/**
 * SessionManager — CRUD for agentic sessions
 */
export class SessionManager {
  private sessions: Map<string, AgenticSession> = new Map();

  /**
   * Create a new session
   */
  createSession(
    query: string,
    maxIterations: number,
    tokenBudget: number
  ): AgenticSession {
    const now = new Date().toISOString();
    const session: AgenticSession = {
      sessionId: randomUUID(),
      state: "running",
      query,
      startedAt: now,
      lastHeartbeat: now,
      updatedAt: now,
      tokensUsed: 0,
      iterationsCompleted: 0,
      maxIterations,
      tokenBudget,
      consecutiveFailures: 0,
      contextItemsFound: 0,
    };

    this.sessions.set(session.sessionId, session);
    logger.info(`[Session] Created: ${session.sessionId} for "${query.substring(0, 50)}..."`);
    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): AgenticSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * List all sessions (optionally filter by state)
   */
  listSessions(stateFilter?: SessionState): AgenticSession[] {
    const all = Array.from(this.sessions.values());
    if (stateFilter) {
      return all.filter((s) => s.state === stateFilter);
    }
    return all;
  }

  /**
   * Update session state
   */
  updateState(sessionId: string, state: SessionState, error?: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`[Session] Not found: ${sessionId}`);
      return false;
    }

    const previousState = session.state;

    // Validate state transitions
    if (previousState === "completed" || previousState === "failed" || previousState === "killed") {
      logger.warn(`[Session] Cannot transition from terminal state '${previousState}' to '${state}'`);
      return false;
    }

    if (state === "running" && previousState !== "paused") {
      logger.warn(`[Session] Can only resume from 'paused', current: '${previousState}'`);
      return false;
    }

    session.state = state;
    session.updatedAt = new Date().toISOString();
    if (error) session.error = error;

    logger.info(`[Session] ${sessionId}: ${previousState} → ${state}`);
    return true;
  }

  /**
   * Pause a running session
   */
  pauseSession(sessionId: string): boolean {
    return this.updateState(sessionId, "paused");
  }

  /**
   * Resume a paused session
   */
  resumeSession(sessionId: string): boolean {
    return this.updateState(sessionId, "running");
  }

  /**
   * Kill a session (from any non-terminal state)
   */
  killSession(sessionId: string): boolean {
    return this.updateState(sessionId, "killed");
  }

  /**
   * Record iteration progress
   */
  recordIteration(
    sessionId: string,
    tokensUsed: number,
    contextItemsFound: number,
    success: boolean
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.iterationsCompleted++;
    session.tokensUsed += tokensUsed;
    session.contextItemsFound += contextItemsFound;
    session.updatedAt = new Date().toISOString();

    if (success) {
      session.consecutiveFailures = 0;
    } else {
      session.consecutiveFailures++;
    }
  }

  /**
   * Record heartbeat
   */
  recordHeartbeat(sessionId: string): HeartbeatData | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const now = new Date().toISOString();
    session.lastHeartbeat = now;

    const heartbeat: HeartbeatData = {
      sessionId: session.sessionId,
      state: session.state,
      iteration: session.iterationsCompleted,
      tokensUsed: session.tokensUsed,
      contextItems: session.contextItemsFound,
      elapsedMs: Date.now() - new Date(session.startedAt).getTime(),
      timestamp: now,
    };

    logger.debug(
      `[Heartbeat] ${sessionId}: iter=${heartbeat.iteration} tokens=${heartbeat.tokensUsed} ` +
      `ctx=${heartbeat.contextItems} elapsed=${heartbeat.elapsedMs}ms`
    );

    return heartbeat;
  }

  /**
   * Persist session to Qdrant fazai_memory
   *
   * Called on session completion, pause, or kill.
   */
  async persistSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    try {
      const client = await getQdrantClient();
      const embeddingService = await createEmbeddingService();

      // Generate embedding from session query for semantic retrieval
      const embedding = await embeddingService.generate(
        `agentic_session: ${session.query}`
      );

      await client.upsert(SESSION_COLLECTION, {
        points: [
          {
            id: session.sessionId,
            vector: embedding,
            payload: {
              type: "agentic_session",
              ...session,
              persistedAt: new Date().toISOString(),
            },
          },
        ],
      });

      logger.info(`[Session] Persisted to Qdrant: ${sessionId} (state: ${session.state})`);
      return true;
    } catch (error: any) {
      logger.warn(`[Session] Failed to persist: ${error.message}`);
      return false;
    }
  }

  /**
   * Load session from Qdrant (for resume after restart)
   */
  async loadSession(sessionId: string): Promise<AgenticSession | null> {
    // Check in-memory first
    const cached = this.sessions.get(sessionId);
    if (cached) return cached;

    try {
      const client = await getQdrantClient();
      const results = await client.retrieve(SESSION_COLLECTION, {
        ids: [sessionId],
        with_payload: true,
      });

      if (results.length === 0) return null;

      const payload = results[0].payload as Record<string, unknown>;
      if (payload.type !== "agentic_session") return null;

      const session: AgenticSession = {
        sessionId: String(payload.sessionId),
        state: payload.state as SessionState,
        query: String(payload.query),
        startedAt: String(payload.startedAt),
        lastHeartbeat: String(payload.lastHeartbeat),
        updatedAt: String(payload.updatedAt),
        tokensUsed: Number(payload.tokensUsed),
        iterationsCompleted: Number(payload.iterationsCompleted),
        maxIterations: Number(payload.maxIterations),
        tokenBudget: Number(payload.tokenBudget),
        consecutiveFailures: Number(payload.consecutiveFailures),
        contextItemsFound: Number(payload.contextItemsFound),
        error: payload.error ? String(payload.error) : undefined,
      };

      this.sessions.set(sessionId, session);
      logger.info(`[Session] Loaded from Qdrant: ${sessionId} (state: ${session.state})`);
      return session;
    } catch (error: any) {
      logger.debug(`[Session] Failed to load: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if budget is exhausted
   */
  isBudgetExhausted(sessionId: string): { exhausted: boolean; reason?: string } {
    const session = this.sessions.get(sessionId);
    if (!session) return { exhausted: true, reason: "Session not found" };

    if (session.iterationsCompleted >= session.maxIterations) {
      return { exhausted: true, reason: `Max iterations reached (${session.maxIterations})` };
    }

    if (session.tokensUsed >= session.tokenBudget) {
      return { exhausted: true, reason: `Token budget exhausted (${session.tokensUsed}/${session.tokenBudget})` };
    }

    return { exhausted: false };
  }

  /**
   * Check if circuit breaker should trip
   */
  shouldTripCircuitBreaker(sessionId: string, maxConsecutiveFailures: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return true;

    return session.consecutiveFailures >= maxConsecutiveFailures;
  }

  /**
   * Format session for display
   */
  formatSession(session: AgenticSession): string {
    const elapsed = Date.now() - new Date(session.startedAt).getTime();
    const elapsedStr = elapsed < 60000
      ? `${Math.round(elapsed / 1000)}s`
      : `${Math.round(elapsed / 60000)}m`;

    return [
      `Session: ${session.sessionId}`,
      `  State: ${session.state}`,
      `  Query: "${session.query.substring(0, 60)}..."`,
      `  Iterations: ${session.iterationsCompleted}/${session.maxIterations}`,
      `  Tokens: ${session.tokensUsed}/${session.tokenBudget}`,
      `  Context Items: ${session.contextItemsFound}`,
      `  Failures: ${session.consecutiveFailures}`,
      `  Elapsed: ${elapsedStr}`,
      `  Started: ${session.startedAt}`,
      `  Last Heartbeat: ${session.lastHeartbeat}`,
      session.error ? `  Error: ${session.error}` : "",
    ].filter(Boolean).join("\n");
  }
}

/**
 * Singleton instance
 */
let sessionManagerInstance: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
}
