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
  private embeddingService: ReturnType<typeof createEmbeddingService> | null = null;
  private config: Required<AgenticConfig>;
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

    this.embeddingService = createEmbeddingService();
    await this.embeddingService.init();
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

    const embedding = await this.embeddingService.embed(query);
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
      const embedding = await this.embeddingService.embed(content);

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
