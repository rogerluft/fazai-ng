/**
 * Agentic Loop - Loop Agêntico Nativo TypeScript COMPLETO
 * Implementação alternativa/complementar ao GenAIScript
 * Otimizado para DL380 com Xeon biprocessado
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { createEmbeddingService } from "../services/embeddings.js";

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";

// Collections do FazAI
const COLLECTIONS = {
  personality: "fazai_personality",
  memory: "fazai_memory",
  learning: "fazai_learning",
  kb: "fazai_kb",
  inference: "fazai_inference",
  semantic_cache: "fazai_semantic_cache",
  source: "fazai_source",
};

// Pesos para fusion scoring (Neural Flow style)
const FUSION_WEIGHTS = {
  memory: 0.20,
  learning: 0.40,
  kb: 0.30,
  inference: 0.10,
};

export interface AgenticState {
  query: string;
  context: ContextItem[];
  actions: AgenticAction[];
  reflections: Reflection[];
  insights: Insight[];
  iteration: number;
  maxIterations: number;
  startTime: number;
}

export interface ContextItem {
  source: string;
  content: string;
  score: number;
  fusedScore: number;
}

export interface AgenticAction {
  type: "search" | "reflect" | "upsert" | "respond";
  input: string;
  output: string;
  timestamp: Date;
  success: boolean;
  duration: number;
}

export interface Reflection {
  iteration: number;
  wasProductive: boolean;
  keyInsight: string;
  shouldContinue: boolean;
  confidence: number;
}

export interface Insight {
  content: string;
  category: "error_fix" | "pattern" | "optimization" | "insight" | "reflection";
  source: string;
  saved: boolean;
}

export interface AgenticConfig {
  maxIterations?: number;
  enableReflection?: boolean;
  enableLearning?: boolean;
  verbose?: boolean;
  minContextItems?: number;
  timeout?: number;
}

/**
 * Classe principal do Loop Agêntico
 */
export class AgenticLoop {
  private client: QdrantClient;
  private embeddingService: Awaited<ReturnType<typeof createEmbeddingService>> | null = null;
  protected config: Required<AgenticConfig>;
  private initialized = false;

  constructor(config: AgenticConfig = {}) {
    this.client = new QdrantClient({ url: QDRANT_URL });
    this.config = {
      maxIterations: config.maxIterations ?? 5,
      enableReflection: config.enableReflection ?? true,
      enableLearning: config.enableLearning ?? true,
      verbose: config.verbose ?? false,
      minContextItems: config.minContextItems ?? 3,
      timeout: config.timeout ?? 120000,
    };
  }

  /**
   * Inicializa o serviço de embeddings
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // createEmbeddingService é async - retorna Promise<EmbeddingService>
    this.embeddingService = await createEmbeddingService();
    this.initialized = true;

    if (this.config.verbose) {
      console.log("AgenticLoop inicializado");
    }
  }

  /**
   * Busca em múltiplas collections com fusion scoring
   */
  async multiSearch(query: string): Promise<ContextItem[]> {
    if (!this.embeddingService) {
      throw new Error("AgenticLoop não inicializado. Chame init() primeiro.");
    }

    const embedding = await this.embeddingService.generate(query);
    const results: ContextItem[] = [];

    // Busca em paralelo em todas as collections
    const searchPromises = Object.entries(FUSION_WEIGHTS).map(async ([collName, weight]) => {
      const fullName = COLLECTIONS[collName as keyof typeof COLLECTIONS];

      try {
        const searchResults = await this.client.search(fullName, {
          vector: embedding,
          limit: 5,
          with_payload: true,
        });

        return searchResults.map((r) => ({
          source: collName,
          content: (r.payload as Record<string, unknown>)?.content as string ||
            JSON.stringify(r.payload),
          score: r.score,
          fusedScore: r.score * weight,
        }));
      } catch (error) {
        if (this.config.verbose) {
          console.error(`Erro ao buscar em ${fullName}:`, error);
        }
        return [];
      }
    });

    const allResults = await Promise.all(searchPromises);

    // Flatten e ordena por fusedScore
    for (const collResults of allResults) {
      results.push(...collResults);
    }

    results.sort((a, b) => b.fusedScore - a.fusedScore);

    return results.slice(0, 10);
  }

  /**
   * Salva insight na collection learning
   */
  async saveInsight(
    content: string,
    category: Insight["category"],
    source: string = "agentic_loop"
  ): Promise<boolean> {
    if (!this.embeddingService || !this.config.enableLearning) {
      return false;
    }

    try {
      const embedding = await this.embeddingService.generate(content);

      await this.client.upsert(COLLECTIONS.learning, {
        wait: true,
        points: [
          {
            id: Date.now(),
            vector: embedding,
            payload: {
              content,
              category,
              source,
              type: "insight",
              timestamp: new Date().toISOString(),
            },
          },
        ],
      });

      if (this.config.verbose) {
        console.log(`Insight salvo: [${category}] ${content.substring(0, 50)}...`);
      }

      return true;
    } catch (error) {
      if (this.config.verbose) {
        console.error(`Erro ao salvar insight:`, error);
      }
      return false;
    }
  }

  /**
   * Gera reflexão sobre o estado atual
   */
  generateReflection(state: AgenticState): Reflection {
    const successfulActions = state.actions.filter((a) => a.success).length;
    const totalActions = state.actions.length;
    const successRate = totalActions > 0 ? successfulActions / totalActions : 0;

    const hasEnoughContext = state.context.length >= this.config.minContextItems;
    const shouldContinue =
      state.iteration < state.maxIterations && !hasEnoughContext;

    // Calcula confiança baseada no contexto
    const avgScore = state.context.length > 0
      ? state.context.reduce((sum, c) => sum + c.fusedScore, 0) / state.context.length
      : 0;

    const confidence = Math.min(1, avgScore + successRate * 0.3);

    // Gera insight chave
    let keyInsight = "Análise em andamento";
    if (state.context.length > 0) {
      const topContext = state.context[0];
      keyInsight = `Melhor match: ${topContext.source} (score: ${topContext.fusedScore.toFixed(3)})`;
    }

    return {
      iteration: state.iteration,
      wasProductive: state.context.length > 0 || state.insights.length > 0,
      keyInsight,
      shouldContinue,
      confidence,
    };
  }

  /**
   * Executa uma iteração do loop
   */
  async runIteration(state: AgenticState): Promise<AgenticState> {
    const newState = { ...state };
    newState.iteration++;

    const iterationStart = Date.now();

    // 1. Busca multi-collection
    if (this.config.verbose) {
      console.log(`\n[Iteração ${newState.iteration}] Buscando contexto...`);
    }

    const searchResults = await this.multiSearch(state.query);
    newState.context = [...newState.context, ...searchResults];

    // Remove duplicatas por content
    const seen = new Set<string>();
    newState.context = newState.context.filter((c) => {
      const key = c.content.substring(0, 100);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    newState.actions.push({
      type: "search",
      input: state.query,
      output: `Encontrados ${searchResults.length} novos resultados`,
      timestamp: new Date(),
      success: searchResults.length > 0,
      duration: Date.now() - iterationStart,
    });

    // 2. Reflexão
    if (this.config.enableReflection) {
      const reflection = this.generateReflection(newState);
      newState.reflections.push(reflection);

      if (this.config.verbose) {
        console.log(`[Reflexão] ${reflection.keyInsight}`);
        console.log(`           Continuar: ${reflection.shouldContinue}, Confiança: ${reflection.confidence.toFixed(2)}`);
      }

      newState.actions.push({
        type: "reflect",
        input: "Estado atual",
        output: reflection.keyInsight,
        timestamp: new Date(),
        success: true,
        duration: 0,
      });
    }

    return newState;
  }

  /**
   * Executa o loop agêntico completo
   */
  async run(query: string): Promise<AgenticState> {
    await this.init();

    let state: AgenticState = {
      query,
      context: [],
      actions: [],
      reflections: [],
      insights: [],
      iteration: 0,
      maxIterations: this.config.maxIterations,
      startTime: Date.now(),
    };

    const timeoutAt = Date.now() + this.config.timeout;

    while (state.iteration < state.maxIterations) {
      // Verifica timeout
      if (Date.now() > timeoutAt) {
        if (this.config.verbose) {
          console.log(`[Timeout] Limite de ${this.config.timeout}ms atingido`);
        }
        break;
      }

      state = await this.runIteration(state);

      // Verifica se tem contexto suficiente
      const lastReflection = state.reflections[state.reflections.length - 1];
      if (lastReflection && !lastReflection.shouldContinue) {
        break;
      }
    }

    // Salva insight final se configurado
    if (this.config.enableLearning && state.reflections.length > 0) {
      const summary = this.generateSummary(state);
      const saved = await this.saveInsight(summary, "reflection", "agentic_loop");

      if (saved) {
        state.insights.push({
          content: summary,
          category: "reflection",
          source: "agentic_loop",
          saved: true,
        });
      }
    }

    return state;
  }

  /**
   * Gera sumário do estado
   */
  generateSummary(state: AgenticState): string {
    const duration = Date.now() - state.startTime;
    const avgConfidence = state.reflections.length > 0
      ? state.reflections.reduce((sum, r) => sum + r.confidence, 0) / state.reflections.length
      : 0;

    return `Query: "${state.query.substring(0, 50)}..." | ` +
      `Iterações: ${state.iteration} | ` +
      `Contexto: ${state.context.length} | ` +
      `Confiança média: ${avgConfidence.toFixed(2)} | ` +
      `Duração: ${duration}ms`;
  }

  /**
   * Formata o estado para output legível
   */
  formatOutput(state: AgenticState): string {
    const duration = Date.now() - state.startTime;

    let output = `
╔════════════════════════════════════════════════════════════╗
║           LOOP AGÊNTICO COMPLETO                           ║
╚════════════════════════════════════════════════════════════╝

📝 Query: ${state.query}
⏱  Duração: ${duration}ms
🔄 Iterações: ${state.iteration}/${state.maxIterations}

📚 CONTEXTO RECUPERADO (${state.context.length} itens):
`;

    for (const ctx of state.context.slice(0, 5)) {
      output += `   [${ctx.source}] (${ctx.fusedScore.toFixed(3)}) ${ctx.content.substring(0, 80)}...\n`;
    }

    if (state.reflections.length > 0) {
      output += `\n🧠 REFLEXÕES:\n`;
      for (const ref of state.reflections) {
        output += `   #${ref.iteration}: ${ref.keyInsight} (confiança: ${ref.confidence.toFixed(2)})\n`;
      }
    }

    if (state.insights.length > 0) {
      output += `\n💡 INSIGHTS SALVOS: ${state.insights.length}\n`;
      for (const ins of state.insights) {
        output += `   [${ins.category}] ${ins.content.substring(0, 60)}...\n`;
      }
    }

    output += `\n📊 AÇÕES EXECUTADAS: ${state.actions.length}`;
    output += `\n✅ Sucesso: ${state.actions.filter(a => a.success).length}`;
    output += `\n❌ Falha: ${state.actions.filter(a => !a.success).length}`;

    return output.trim();
  }
}

/**
 * Função helper para execução rápida
 */
export async function runAgenticQuery(
  query: string,
  config?: AgenticConfig
): Promise<string> {
  const loop = new AgenticLoop(config);
  const state = await loop.run(query);
  return loop.formatOutput(state);
}

/**
 * Executa com GenAIScript como fallback
 */
export async function runWithFallback(
  query: string,
  config?: AgenticConfig
): Promise<{ source: "native" | "genaiscript"; output: string }> {
  try {
    // Tenta nativo primeiro (mais rápido)
    const output = await runAgenticQuery(query, config);
    return { source: "native", output };
  } catch (error) {
    // Fallback para GenAIScript
    const { runAgenticLoop } = await import("./genai-runner.js");
    const result = await runAgenticLoop(query, { verbose: config?.verbose });

    if (result.success) {
      return { source: "genaiscript", output: result.output };
    }

    throw new Error(`Ambos falharam: ${error} | ${result.error}`);
  }
}

export default AgenticLoop;

// ═══════════════════════════════════════════════════════════════════════
// Phase 1: Budget-Based Agentic Loop — Evolved from AgenticLoop
// ═══════════════════════════════════════════════════════════════════════

import { getConfigValue } from "../config.js";
import {
  SessionManager,
  getSessionManager,
  type AgenticSession,
  type SessionState,
} from "./session-manager.js";

/**
 * Budget configuration for the agentic loop
 */
export interface AgenticBudget {
  /** Maximum number of iterations (default: from config or 5) */
  maxIterations: number;
  /** Maximum tokens to consume (default: from config or 50000) */
  tokenBudget: number;
  /** Circuit breaker config */
  circuitBreaker: {
    /** Max consecutive failures before tripping (default: 3) */
    maxConsecutiveFailures: number;
    /** Cooldown in ms after circuit breaker trips (default: 30000) */
    cooldownMs: number;
  };
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatIntervalMs: number;
  /** Whether to persist session state to Qdrant (default: true) */
  persistSession: boolean;
}

/**
 * Budget-aware loop configuration
 */
export interface BudgetAgenticConfig extends AgenticConfig {
  budget?: Partial<AgenticBudget>;
  /** Callback for token estimation (provided by caller) */
  estimateTokens?: (text: string) => number;
  /** Callback invoked on each heartbeat */
  onHeartbeat?: (session: AgenticSession) => void;
  /** Callback invoked when circuit breaker trips */
  onCircuitBreaker?: (session: AgenticSession) => void;
}

/**
 * Result of a budget-aware agentic run
 */
export interface BudgetAgenticResult {
  state: AgenticState;
  session: AgenticSession;
  exitReason: "completed" | "budget_exhausted" | "circuit_breaker" | "timeout" | "killed" | "paused";
}

/**
 * Simple token estimator (4 chars ≈ 1 token)
 */
function defaultTokenEstimator(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Load budget defaults from fazai.conf
 */
function loadBudgetDefaults(): AgenticBudget {
  const parseNum = (key: string, fallback: number): number => {
    const val = getConfigValue(key);
    if (val) {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > 0) return num;
    }
    return fallback;
  };

  const parseBool = (key: string, fallback: boolean): boolean => {
    const val = getConfigValue(key);
    if (val) return ["true", "1", "yes"].includes(val.toLowerCase());
    return fallback;
  };

  return {
    maxIterations: parseNum("AGENTIC_MAX_ITERATIONS", 5),
    tokenBudget: parseNum("AGENTIC_TOKEN_BUDGET", 50000),
    circuitBreaker: {
      maxConsecutiveFailures: parseNum("AGENTIC_CIRCUIT_BREAKER_MAX_FAILURES", 3),
      cooldownMs: parseNum("AGENTIC_CIRCUIT_BREAKER_COOLDOWN", 30000),
    },
    heartbeatIntervalMs: parseNum("AGENTIC_HEARTBEAT_INTERVAL", 30000),
    persistSession: parseBool("AGENTIC_SESSION_PERSIST", true),
  };
}

/**
 * BudgetAgenticLoop — Evolved agentic loop with budget tracking
 *
 * Extends the existing AgenticLoop with:
 * - Configurable budget (max_iterations + token_budget)
 * - Circuit breaker (pause after N consecutive failures)
 * - Heartbeat (log + Qdrant status every 30s)
 * - Session persistence (pause/resume/kill)
 * - Maestro Cleaner hook (post-iteration on circuit breaker or final)
 *
 * Reads defaults from fazai.conf via AGENTIC_* keys.
 */
export class BudgetAgenticLoop extends AgenticLoop {
  private budget: AgenticBudget;
  private sessionManager: SessionManager;
  private currentSession: AgenticSession | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private estimateTokens: (text: string) => number;
  private onHeartbeat?: (session: AgenticSession) => void;
  private onCircuitBreaker?: (session: AgenticSession) => void;

  constructor(config: BudgetAgenticConfig = {}) {
    super(config);

    const defaults = loadBudgetDefaults();
    this.budget = {
      maxIterations: config.budget?.maxIterations ?? defaults.maxIterations,
      tokenBudget: config.budget?.tokenBudget ?? defaults.tokenBudget,
      circuitBreaker: {
        maxConsecutiveFailures:
          config.budget?.circuitBreaker?.maxConsecutiveFailures ??
          defaults.circuitBreaker.maxConsecutiveFailures,
        cooldownMs:
          config.budget?.circuitBreaker?.cooldownMs ??
          defaults.circuitBreaker.cooldownMs,
      },
      heartbeatIntervalMs: config.budget?.heartbeatIntervalMs ?? defaults.heartbeatIntervalMs,
      persistSession: config.budget?.persistSession ?? defaults.persistSession,
    };

    this.sessionManager = getSessionManager();
    this.estimateTokens = config.estimateTokens ?? defaultTokenEstimator;
    this.onHeartbeat = config.onHeartbeat;
    this.onCircuitBreaker = config.onCircuitBreaker;
  }

  /**
   * Run the budget-aware agentic loop
   */
  async runWithBudget(query: string): Promise<BudgetAgenticResult> {
    await this.init();

    // Create session
    const session = this.sessionManager.createSession(
      query,
      this.budget.maxIterations,
      this.budget.tokenBudget
    );
    this.currentSession = session;

    // Start heartbeat
    this.startHeartbeat(session.sessionId);

    let state: AgenticState = {
      query,
      context: [],
      actions: [],
      reflections: [],
      insights: [],
      iteration: 0,
      maxIterations: this.budget.maxIterations,
      startTime: Date.now(),
    };

    const timeoutAt = Date.now() + (this.config).timeout;
    let exitReason: BudgetAgenticResult["exitReason"] = "completed";

    try {
      while (true) {
        // Check session state (pause/kill support)
        const currentSession = this.sessionManager.getSession(session.sessionId);
        if (!currentSession || currentSession.state === "killed") {
          exitReason = "killed";
          break;
        }
        if (currentSession.state === "paused") {
          exitReason = "paused";
          break;
        }

        // Check timeout
        if (Date.now() > timeoutAt) {
          exitReason = "timeout";
          if ((this.config).verbose) {
            console.log(`[Budget] Timeout reached`);
          }
          break;
        }

        // Check budget
        const budgetCheck = this.sessionManager.isBudgetExhausted(session.sessionId);
        if (budgetCheck.exhausted) {
          exitReason = "budget_exhausted";
          if ((this.config).verbose) {
            console.log(`[Budget] ${budgetCheck.reason}`);
          }
          break;
        }

        // Check circuit breaker
        if (this.sessionManager.shouldTripCircuitBreaker(
          session.sessionId,
          this.budget.circuitBreaker.maxConsecutiveFailures
        )) {
          exitReason = "circuit_breaker";
          if ((this.config).verbose) {
            console.log(
              `[Budget] Circuit breaker tripped after ${this.budget.circuitBreaker.maxConsecutiveFailures} consecutive failures`
            );
          }

          // Invoke callback
          if (this.onCircuitBreaker && currentSession) {
            this.onCircuitBreaker(currentSession);
          }

          // Invoke Maestro Cleaner on circuit breaker
          await this.invokeMaestroCleaner("circuit_breaker");

          // Cooldown
          await new Promise((resolve) =>
            setTimeout(resolve, this.budget.circuitBreaker.cooldownMs)
          );
          break;
        }

        // Run iteration (uses parent class method)
        const iterStart = Date.now();
        state = await this.runIteration(state);

        // Estimate tokens used in this iteration
        const iterTokens = this.estimateIterationTokens(state);
        const iterSuccess = state.context.length > 0;

        // Record iteration in session
        this.sessionManager.recordIteration(
          session.sessionId,
          iterTokens,
          state.context.length,
          iterSuccess
        );

        // Check if we should stop (reflection says no more needed)
        const lastReflection = state.reflections[state.reflections.length - 1];
        if (lastReflection && !lastReflection.shouldContinue) {
          exitReason = "completed";
          break;
        }
      }

      // Final Maestro Cleaner invocation if not already done by circuit breaker
      if (exitReason !== "circuit_breaker") {
        await this.invokeMaestroCleaner("final");
      }

      // Save final insight
      if ((this.config).enableLearning && state.reflections.length > 0) {
        const summary = this.generateSummary(state);
        const saved = await this.saveInsight(summary, "reflection", "budget_agentic_loop");
        if (saved) {
          state.insights.push({
            content: summary,
            category: "reflection",
            source: "budget_agentic_loop",
            saved: true,
          });
        }
      }
    } finally {
      // Stop heartbeat
      this.stopHeartbeat();

      // Update session final state
      const finalState: SessionState =
        exitReason === "completed" ? "completed" :
        exitReason === "killed" ? "killed" :
        exitReason === "paused" ? "paused" :
        "failed";

      this.sessionManager.updateState(
        session.sessionId,
        finalState,
        exitReason !== "completed" ? `Exit: ${exitReason}` : undefined
      );

      // Persist session to Qdrant if configured
      if (this.budget.persistSession) {
        await this.sessionManager.persistSession(session.sessionId);
      }
    }

    // Get final session state
    const finalSession = this.sessionManager.getSession(session.sessionId)!;

    return { state, session: finalSession, exitReason };
  }

  /**
   * Pause the current session
   */
  pause(): boolean {
    if (!this.currentSession) return false;
    return this.sessionManager.pauseSession(this.currentSession.sessionId);
  }

  /**
   * Kill the current session
   */
  kill(): boolean {
    if (!this.currentSession) return false;
    return this.sessionManager.killSession(this.currentSession.sessionId);
  }

  /**
   * Get current session
   */
  getCurrentSession(): AgenticSession | null {
    if (!this.currentSession) return null;
    return this.sessionManager.getSession(this.currentSession.sessionId) ?? null;
  }

  /**
   * Start heartbeat timer
   */
  private startHeartbeat(sessionId: string): void {
    this.heartbeatTimer = setInterval(() => {
      const heartbeat = this.sessionManager.recordHeartbeat(sessionId);
      if (heartbeat && this.onHeartbeat) {
        const session = this.sessionManager.getSession(sessionId);
        if (session) this.onHeartbeat(session);
      }
    }, this.budget.heartbeatIntervalMs);

    // Don't keep process alive for heartbeat
    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }

  /**
   * Stop heartbeat timer
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Estimate tokens used in the last iteration
   */
  private estimateIterationTokens(state: AgenticState): number {
    let tokens = 0;

    // Query tokens
    tokens += this.estimateTokens(state.query);

    // Context tokens (latest context items)
    for (const ctx of state.context.slice(-5)) {
      tokens += this.estimateTokens(ctx.content);
    }

    // Action output tokens
    const lastAction = state.actions[state.actions.length - 1];
    if (lastAction) {
      tokens += this.estimateTokens(lastAction.output);
    }

    return tokens;
  }

  /**
   * Invoke Maestro Cleaner (GenAIScript) — invoke only, never modify
   *
   * Triggers cleaner.genai.mjs at loop boundaries:
   * - On circuit breaker trip
   * - On final iteration (completed/budget_exhausted/timeout)
   */
  private async invokeMaestroCleaner(trigger: "circuit_breaker" | "final"): Promise<void> {
    try {
      if ((this.config).verbose) {
        console.log(`[Maestro Cleaner] Invoking on ${trigger}...`);
      }

      // Dynamic import to avoid circular deps and keep Maestro untouched
      const { runAgenticLoop } = await import("./genai-runner.js");
      await runAgenticLoop(`fazai-cleaner-trigger:${trigger}`, {
        script: "cleaner",
        verbose: (this.config).verbose,
      });

      if ((this.config).verbose) {
        console.log(`[Maestro Cleaner] Completed (${trigger})`);
      }
    } catch (error: any) {
      // Non-fatal: cleaner failure shouldn't break the loop
      if ((this.config).verbose) {
        console.warn(`[Maestro Cleaner] Failed (${trigger}): ${error.message}`);
      }
    }
  }

  /**
   * Format budget-aware output
   */
  formatBudgetOutput(result: BudgetAgenticResult): string {
    const { state, session, exitReason } = result;
    const duration = Date.now() - state.startTime;

    const exitEmoji = {
      completed: "✅",
      budget_exhausted: "💰",
      circuit_breaker: "🔌",
      timeout: "⏱️",
      killed: "💀",
      paused: "⏸️",
    };

    return `
╔════════════════════════════════════════════════════════════╗
║           BUDGET AGENTIC LOOP — COMPLETE                   ║
╚════════════════════════════════════════════════════════════╝

📝 Query: ${state.query}
${exitEmoji[exitReason]} Exit: ${exitReason}
⏱  Duration: ${duration}ms
🔄 Iterations: ${session.iterationsCompleted}/${session.maxIterations}
💰 Tokens: ${session.tokensUsed}/${session.tokenBudget}
📚 Context: ${session.contextItemsFound} items
🔌 Consecutive Failures: ${session.consecutiveFailures}
🆔 Session: ${session.sessionId}

📊 Actions: ${state.actions.length} total
✅ Success: ${state.actions.filter(a => a.success).length}
❌ Failures: ${state.actions.filter(a => !a.success).length}
${session.error ? `\n⚠️ Error: ${session.error}` : ""}
`.trim();
  }
}

/**
 * Helper for quick budget-aware agentic query
 */
export async function runBudgetAgenticQuery(
  query: string,
  config?: BudgetAgenticConfig
): Promise<BudgetAgenticResult> {
  const loop = new BudgetAgenticLoop(config);
  return loop.runWithBudget(query);
}
