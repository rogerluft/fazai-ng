import chalk from "chalk";
import { MCPClient } from "./mcp/client";
import { Context7Result } from "./mcp/context7";
import { getConfigValue } from "./config";
import { LinuxCommand } from "./types-linux";
import { logger } from "./logger";
import { askAI } from "./askAI";
import { neuralQuery, NeuralQueryResult } from "./rag/neural-flow";
import { createEmbeddingService } from "./services/embeddings";

export interface ResearchFinding {
  title: string;
  url?: string;
  snippet?: string;
}

export interface ResearchResult {
  provider: string;
  query: string;
  reason: string;
  findings: ResearchFinding[];
  summary?: string;
}

type ResearchTrigger = "pre-execution" | "failure";

const truthy = new Set(["1", "true", "yes", "on"]);

function resolveFlag(value?: string | null): boolean {
  if (!value) {
    return false;
  }
  return truthy.has(value.toLowerCase());
}

export interface ResearchCoordinatorOptions {
  enabled: boolean;
  context7Url?: string;
  context7Command?: string;
  context7ApiKey?: string;
  webSearchProvider?: string;
  researchOnFailure?: boolean;
}

export class ResearchCoordinator {
  private client: MCPClient;
  private options: ResearchCoordinatorOptions;

  constructor(options: Partial<ResearchCoordinatorOptions> = {}) {
    this.options = {
      enabled: true,
      ...options,
    };
    this.client = this.buildClient();
  }

  async maybeRunPreExecutionResearch(command: LinuxCommand): Promise<ResearchResult | null> {
    const researchNeeded = command.researchNeeded ?? false;
    const researchQuery = command.researchQuery?.trim();

    if (!researchNeeded && !researchQuery) {
      return null;
    }

    const query = researchQuery && researchQuery.length > 0
      ? researchQuery
      : `${command.command} contexto`;

    const reason = command.researchReason?.trim() || "Modelo solicitou pesquisa complementar antes da execução";
    return this.research(query, { reason, trigger: "pre-execution" });
  }

  async handleExecutionFailure(command: LinuxCommand, errorOutput: string): Promise<ResearchResult | null> {
    if (!this.isFailureResearchEnabled()) {
      return null;
    }

    const condensedError = errorOutput.replace(/\s+/g, " ").trim().slice(0, 220);
    const query = `${command.command} erro ${condensedError}`.trim();
    const reason = "Fallback automático após falha na execução do comando";

    return this.research(query, { reason, trigger: "failure" });
  }

  async research(query: string, options: { reason?: string; trigger?: ResearchTrigger } = {}): Promise<ResearchResult | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const reason = options.reason ?? "Solicitação externa";
    const trigger = options.trigger ?? "pre-execution";
    return this.performResearch(query, reason, trigger);
  }

  private async performResearch(query: string, reason: string, trigger: ResearchTrigger): Promise<ResearchResult | null> {
    this.refreshClient();

    // P0-2: ECOA RAG-First Strategy - Consulta local antes de external
    // Prioridade: RAG Local → Perplexity → Context7 → Web
    const localRAGResult = await this.tryLocalRAG(query, reason, trigger);
    if (localRAGResult) {
      this.logResearch(localRAGResult);
      return localRAGResult;
    }

    // Fallback: External sources em paralelo
    const [perplexityResult, context7Result, webResult] = await Promise.allSettled([
      this.tryPerplexity(query, reason, trigger),
      this.tryContext7(query, reason, trigger),
      this.tryWebSearch(query, reason, trigger),
    ]);

    const perplexity = perplexityResult.status === "fulfilled" ? perplexityResult.value : null;
    const context7 = context7Result.status === "fulfilled" ? context7Result.value : null;
    const web = webResult.status === "fulfilled" ? webResult.value : null;

    if (perplexityResult.status === "rejected") {
      logger.debug(`Perplexity search error: ${perplexityResult.reason}`);
    }
    if (context7Result.status === "rejected") {
      logger.debug(`Context7 search error: ${context7Result.reason}`);
    }
    if (webResult.status === "rejected") {
      logger.debug(`Web search error: ${webResult.reason}`);
    }

    if (perplexity) {
      this.logResearch(perplexity);
      return perplexity;
    }

    if (context7) {
      this.logResearch(context7);
      return context7;
    }

    if (web) {
      this.logResearch(web);
      return web;
    }

    logger.info(chalk.gray(`\n🤷  Nenhum resultado de pesquisa encontrado para "${query}" (${reason}).`));
    return null;
  }

  /**
   * P0-2: ECOA RAG-First - Busca local via neuralQuery() antes de external
   *
   * Consulta as 5 collections ECOA (personality, memory, learning, kb, inference)
   * usando fusion scoring. Retorna resultado se score >= 0.6 (alta confiança).
   */
  private async tryLocalRAG(query: string, reason: string, trigger: ResearchTrigger): Promise<ResearchResult | null> {
    const provider = "local-rag";
    const minConfidenceScore = 0.6; // Só retorna se alta confiança

    try {
      logger.debug(`🧠 Tentando RAG local para: "${query.substring(0, 60)}..."`);

      // Gerar embedding da query
      const embeddingService = await createEmbeddingService();
      const queryEmbedding = await embeddingService.generate(query);

      // Busca neural multi-collection
      const result: NeuralQueryResult = await neuralQuery(query, queryEmbedding, {
        topK: 5,
        minScore: 0.3, // Filtra resultados ruins
        collections: [
          "fazai_learning",
          "fazai_kb",
          "fazai_memory",
          "fazai_inference",
        ],
      });

      // Verificar se temos resultados relevantes
      if (result.fusedResults.length === 0) {
        logger.debug("RAG local: Nenhum resultado encontrado");
        return null;
      }

      const topScore = result.stats.topScore;

      // Se score < 0.6, prefere external sources
      if (topScore < minConfidenceScore) {
        logger.debug(`RAG local: Score ${topScore.toFixed(3)} < ${minConfidenceScore} - preferindo external`);
        return null;
      }

      // Converter resultados para ResearchFindings
      const findings: ResearchFinding[] = result.fusedResults.map((r) => ({
        title: r.metadata.title || r.metadata.learning_id || r.metadata.slug || `[${r.collection}]`,
        snippet: r.content.substring(0, 300),
        url: undefined, // Local results don't have URLs
      }));

      // Gerar summary a partir dos conteúdos
      const contentParts = result.fusedResults
        .slice(0, 3)
        .map((r) => r.content.substring(0, 200))
        .join("\n\n");

      const summary = `[RAG Local] ${result.fusedResults.length} resultados encontrados (score: ${topScore.toFixed(2)}):\n${contentParts}`;

      logger.info(chalk.green(`✅ RAG local encontrou ${result.fusedResults.length} resultados (score: ${topScore.toFixed(3)})`));

      return {
        provider,
        query,
        reason: this.decorateReason(reason, trigger, provider),
        findings,
        summary,
      };
    } catch (error: any) {
      logger.debug(`RAG local error: ${error.message}`);
      return null;
    }
  }

  private async tryPerplexity(query: string, reason: string, trigger: ResearchTrigger): Promise<ResearchResult | null> {
    const provider = "perplexity";
    const perplexityModels = getConfigValue("MODELS_PERPLEXITY");
    const model = perplexityModels ? perplexityModels.split(",")[0].trim() : "llama-3-sonar-large-32k-online";

    try {
      const stream = askAI("", query, model, provider, true);
      let summary = "";
      for await (const chunk of stream) {
        summary += chunk;
      }

      if (!summary.trim()) {
        return null;
      }

      return {
        provider,
        query,
        reason: this.decorateReason(reason, trigger, provider),
        findings: [],
        summary: summary.trim(),
      };
    } catch (error) {
      logger.debug(`Perplexity API error: ${error}`);
      return null;
    }
  }

  private async tryContext7(query: string, reason: string, trigger: ResearchTrigger): Promise<ResearchResult | null> {
    const context7Result: Context7Result | null = await this.client.queryContext7(query);
    if (!context7Result) {
      return null;
    }

    return {
      provider: "context7",
      query,
      reason: this.decorateReason(reason, trigger, "context7"),
      findings: context7Result.findings,
      summary: context7Result.summary,
    };
  }

  private async tryWebSearch(query: string, reason: string, trigger: ResearchTrigger): Promise<ResearchResult | null> {
    const provider = (this.options.webSearchProvider
      ?? getConfigValue("WEB_SEARCH_PROVIDER")
      ?? process.env.WEB_SEARCH_PROVIDER
      ?? "brave").toLowerCase();

    const searchers: Record<string, () => Promise<ResearchFinding[] | null>> = {
      brave: () => this.searchBrave(query),
      duckduckgo: () => this.searchDuckDuckGo(query),
    };

    // Try configured provider, fallback to duckduckgo if brave has no key
    const tryOrder = provider === "brave"
      ? ["brave", "duckduckgo"]
      : [provider];

    for (const p of tryOrder) {
      const searcher = searchers[p];
      if (!searcher) continue;

      const result = await searcher();
      if (result) {
        return {
          provider: p,
          query,
          reason: this.decorateReason(reason, trigger, p),
          findings: result,
        };
      }
    }

    return null;
  }

  private async searchBrave(query: string): Promise<ResearchFinding[] | null> {
    const apiKey = getConfigValue("BRAVE_SEARCH_API_KEY") || process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey) {
      logger.debug("Brave Search: BRAVE_SEARCH_API_KEY not configured, skipping");
      return null;
    }

    const endpoint = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;
    try {
      const response = await fetch(endpoint, {
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": apiKey,
        },
      });

      if (!response.ok) {
        logger.warn(chalk.yellow(`⚠️  Brave Search retornou status ${response.status}`));
        return null;
      }

      const payload = await response.json() as any;
      const findings: ResearchFinding[] = [];

      if (Array.isArray(payload?.web?.results)) {
        for (const result of payload.web.results.slice(0, 5)) {
          findings.push({
            title: result.title || query,
            snippet: result.description || result.extra_snippets?.[0] || "",
            url: result.url || undefined,
          });
        }
      }

      return findings.length ? findings : null;
    } catch (error) {
      logger.warn(chalk.yellow(`⚠️  Falha ao consultar Brave Search: ${String(error)}`));
      return null;
    }
  }

  private async searchDuckDuckGo(query: string): Promise<ResearchFinding[] | null> {
    const endpoint = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    try {
      const response = await fetch(endpoint, {
        headers: { "Accept": "application/json" },
      });

      if (!response.ok) {
        logger.warn(chalk.yellow(`⚠️  DuckDuckGo retornou status ${response.status}`));
        return null;
      }

      const payload = await response.json();
      const findings: ResearchFinding[] = [];

      if (payload?.AbstractText) {
        findings.push({
          title: payload.Heading || query,
          snippet: payload.AbstractText,
          url: payload.AbstractURL || undefined,
        });
      }

      if (Array.isArray(payload?.RelatedTopics)) {
        for (const topic of payload.RelatedTopics) {
          if (Array.isArray(topic?.Topics)) {
            for (const nested of topic.Topics) {
              const entry = this.mapDuckDuckGoTopic(nested);
              if (entry) {
                findings.push(entry);
              }
            }
          } else {
            const entry = this.mapDuckDuckGoTopic(topic);
            if (entry) {
              findings.push(entry);
            }
          }
          if (findings.length >= 5) {
            break;
          }
        }
      }

      if (!findings.length && payload?.AbstractURL && payload?.AbstractText) {
        findings.push({
          title: payload.Heading || query,
          snippet: payload.AbstractText,
          url: payload.AbstractURL,
        });
      }

      return findings.length ? findings : null;
    } catch (error) {
      logger.warn(chalk.yellow(`⚠️  Falha ao consultar DuckDuckGo: ${String(error)}`));
      return null;
    }
  }

  private mapDuckDuckGoTopic(topic: any): ResearchFinding | null {
    if (!topic) {
      return null;
    }
    const text = topic.Text ?? topic.title ?? topic.Heading;
    const url = topic.FirstURL ?? topic.URL ?? topic.Link;
    if (!text) {
      return null;
    }
    return {
      title: String(text),
      snippet: topic.Result ? String(topic.Result).replace(/<[^>]+>/g, "") : undefined,
      url: url ? String(url) : undefined,
    };
  }

  private decorateReason(base: string, trigger: ResearchTrigger, provider: string): string {
    const cause = trigger === "failure" ? "falha" : "pré-checagem";
    return `${base} (via ${provider}, ${cause})`;
  }

  private logResearch(result: ResearchResult): void {
    logger.info(chalk.magentaBright(`\n🧠 Pesquisa (${result.provider})`));
    logger.info(chalk.gray(`Motivo: ${result.reason}`));
    if (result.summary) {
      logger.info(chalk.magenta(`Resumo: ${result.summary}`));
    }

    if (!result.findings.length) {
      logger.info(chalk.gray("Nenhuma referência retornada."));
      return;
    }

    result.findings.slice(0, 5).forEach((finding, index) => {
      logger.info(chalk.magenta(` ${index + 1}. ${finding.title}`));
      if (finding.snippet) {
        logger.info(chalk.gray(`    ${finding.snippet}`));
      }
      if (finding.url) {
        logger.info(chalk.blue(`    ${finding.url}`));
      }
    });
  }

  private isEnabled(): boolean {
    const disabledEnv = resolveFlag(process.env.FAZAI_DISABLE_RESEARCH ?? null);
    const disabledConfig = resolveFlag(getConfigValue("FAZAI_DISABLE_RESEARCH"));
    return this.options.enabled && !disabledEnv && !disabledConfig;
  }

  private isFailureResearchEnabled(): boolean {
    if (!this.isEnabled()) {
      return false;
    }

    if (typeof this.options.researchOnFailure === "boolean") {
      return this.options.researchOnFailure;
    }

    const envRaw = process.env.FAZAI_RESEARCH_ON_FAILURE;
    if (envRaw !== undefined) {
      return resolveFlag(envRaw);
    }

    const configRaw = getConfigValue("FAZAI_RESEARCH_ON_FAILURE");
    if (configRaw !== undefined) {
      return resolveFlag(configRaw);
    }

    return false;
  }

  private buildClient(): MCPClient {
    const context7Url = this.options.context7Url
      ?? process.env.MCP_CONTEXT7_URL
      ?? getConfigValue("MCP_CONTEXT7_URL");
    const context7Command = this.options.context7Command
      ?? process.env.MCP_CONTEXT7_COMMAND
      ?? getConfigValue("MCP_CONTEXT7_COMMAND");
    const context7ApiKey = this.options.context7ApiKey
      ?? process.env.MCP_CONTEXT7_API_KEY
      ?? getConfigValue("MCP_CONTEXT7_API_KEY");

    return new MCPClient({
      context7: (context7Url || context7Command)
        ? { url: context7Url || undefined, command: context7Command || undefined, apiKey: context7ApiKey || undefined }
        : undefined,
    });
  }

  private refreshClient(): void {
    this.client = this.buildClient();
  }
}
