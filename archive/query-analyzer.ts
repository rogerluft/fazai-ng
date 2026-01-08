/**
 * Query Analyzer - Intelligent Query Classification and Search Strategy
 *
 * Analisa queries e determina a melhor estratégia de busca baseada no tipo.
 *
 * Features:
 * - Classificação automática de queries
 * - Estratégias customizadas por tipo
 * - Otimização de fontes e prioridades
 *
 * @module research/query-analyzer
 */

import { logger } from "../logger";

/**
 * Types of queries
 */
export type QueryType =
  | "tutorial"
  | "comparison"
  | "news"
  | "documentation"
  | "troubleshooting"
  | "general";

/**
 * Search strategy based on query type
 */
export interface SearchStrategy {
  sources: Array<"web" | "cache" | "forums" | "docs">;
  prioritize: string[];
  maxResults: number;
  sortBy?: "relevance" | "date";
  description: string;
}

/**
 * Query classification result
 */
export interface QueryClassification {
  type: QueryType;
  confidence: number;
  keywords: string[];
  strategy: SearchStrategy;
}

/**
 * Query Analyzer
 *
 * Classifica queries e gera estratégias de busca otimizadas
 */
export class QueryAnalyzer {
  /**
   * Pattern definitions for each query type
   */
  private patterns: Record<QueryType, RegExp[]> = {
    tutorial: [
      /^(como|how to|tutorial|guide|guia|passo a passo|step by step)/i,
      /(instalar|configurar|setup|install|configure)/i,
      /(aprender|learn|começar|start|getting started)/i,
    ],
    comparison: [
      /diferença|difference|versus|vs\.?|compare|comparar|melhor|better/i,
      /(qual|which|what).*(usar|use|escolher|choose)/i,
      /(entre|between|ou|or)/i,
    ],
    news: [
      /último|latest|novo|new|release|lançamento|versão|version/i,
      /atualização|update|novidade|news|anúncio|announcement/i,
      /recente|recent|2024|2025/i,
    ],
    documentation: [
      /docs?|documentation|documentação|reference|referência|api/i,
      /manual|handbook|especificação|specification|spec/i,
      /sintaxe|syntax|uso|usage|parâmetros|parameters/i,
    ],
    troubleshooting: [
      /erro|error|bug|problema|issue|falha|failure/i,
      /corrigir|fix|resolver|solve|solução|solution/i,
      /não (funciona|está)/i,
      /exception|warning|critical/i,
    ],
    general: [/.*/], // Catch-all
  };

  /**
   * Keyword extraction patterns
   */
  private stopWords = new Set([
    "o",
    "a",
    "os",
    "as",
    "um",
    "uma",
    "de",
    "do",
    "da",
    "em",
    "para",
    "com",
    "the",
    "a",
    "an",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "and",
    "or",
    "but",
  ]);

  /**
   * Classify a query
   */
  classifyQuery(query: string): QueryClassification {
    const queryLower = query.toLowerCase();
    let bestType: QueryType = "general";
    let bestConfidence = 0;

    // Try each pattern
    for (const [type, patterns] of Object.entries(this.patterns) as [QueryType, RegExp[]][]) {
      if (type === "general") continue; // Skip catch-all

      let matchCount = 0;
      for (const pattern of patterns) {
        if (pattern.test(queryLower)) {
          matchCount++;
        }
      }

      const confidence = matchCount / patterns.length;
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestType = type;
      }
    }

    // Extract keywords
    const keywords = this.extractKeywords(query);

    // Generate strategy
    const strategy = this.generateStrategy(bestType);

    logger.debug(
      `Query classified as "${bestType}" (confidence: ${(bestConfidence * 100).toFixed(0)}%)`
    );

    return {
      type: bestType,
      confidence: bestConfidence,
      keywords,
      strategy,
    };
  }

  /**
   * Extract meaningful keywords from query
   */
  private extractKeywords(query: string): string[] {
    const words = query
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !this.stopWords.has(word));

    return [...new Set(words)]; // Remove duplicates
  }

  /**
   * Generate search strategy based on query type
   */
  generateStrategy(queryType: QueryType): SearchStrategy {
    const strategies: Record<QueryType, SearchStrategy> = {
      tutorial: {
        sources: ["web", "docs"],
        prioritize: ["docs", "web"],
        maxResults: 10,
        sortBy: "relevance",
        description: "Tutoriais e guias passo-a-passo",
      },
      comparison: {
        sources: ["web", "forums", "docs"],
        prioritize: ["forums", "web"],
        maxResults: 15,
        sortBy: "relevance",
        description: "Comparações e opiniões da comunidade",
      },
      news: {
        sources: ["web"],
        prioritize: ["web"],
        maxResults: 20,
        sortBy: "date",
        description: "Notícias e atualizações recentes",
      },
      documentation: {
        sources: ["docs", "web"],
        prioritize: ["docs"],
        maxResults: 5,
        sortBy: "relevance",
        description: "Documentação oficial e referências",
      },
      troubleshooting: {
        sources: ["forums", "docs", "web"],
        prioritize: ["forums", "docs"],
        maxResults: 15,
        sortBy: "relevance",
        description: "Soluções de problemas e erros",
      },
      general: {
        sources: ["web", "forums", "docs"],
        prioritize: ["web"],
        maxResults: 10,
        sortBy: "relevance",
        description: "Busca geral em múltiplas fontes",
      },
    };

    return strategies[queryType];
  }

  /**
   * Suggest query refinements
   */
  suggestRefinements(query: string, classification: QueryClassification): string[] {
    const suggestions: string[] = [];

    switch (classification.type) {
      case "tutorial":
        suggestions.push(`${query} passo a passo`);
        suggestions.push(`como fazer ${query}`);
        suggestions.push(`${query} tutorial completo`);
        break;

      case "comparison":
        // Extract potential items to compare
        const items = query.match(/(\w+)\s+(vs|versus|ou)\s+(\w+)/i);
        if (items) {
          suggestions.push(`diferença entre ${items[1]} e ${items[3]}`);
          suggestions.push(`qual melhor ${items[1]} ou ${items[3]}`);
        }
        break;

      case "troubleshooting":
        suggestions.push(`${query} solução`);
        suggestions.push(`como corrigir ${query}`);
        suggestions.push(`${query} stack overflow`);
        break;

      case "documentation":
        suggestions.push(`${query} documentação oficial`);
        suggestions.push(`${query} API reference`);
        break;

      case "news":
        const currentYear = new Date().getFullYear();
        suggestions.push(`${query} ${currentYear}`);
        suggestions.push(`${query} latest news`);
        break;

      default:
        suggestions.push(`${query} complete guide`);
        break;
    }

    return suggestions.filter((s) => s !== query).slice(0, 3);
  }

  /**
   * Detect language of query
   */
  detectLanguage(query: string): "pt" | "en" | "unknown" {
    const ptWords = /como|para|sobre|entre|com|sem|mais|menos|melhor|pior/i;
    const enWords = /how|what|which|where|when|why|with|without|better|worse/i;

    const hasPt = ptWords.test(query);
    const hasEn = enWords.test(query);

    if (hasPt && !hasEn) return "pt";
    if (hasEn && !hasPt) return "en";
    return "unknown";
  }

  /**
   * Expand query with synonyms
   */
  expandQueryWithSynonyms(query: string): string[] {
    const synonyms: Record<string, string[]> = {
      erro: ["error", "falha", "problema", "bug", "issue"],
      configurar: ["setup", "configure", "install", "setup"],
      comparar: ["compare", "versus", "vs", "diferença"],
      melhor: ["better", "best", "superior"],
      tutorial: ["guide", "how-to", "walkthrough", "passo a passo"],
    };

    const expanded: string[] = [query];
    const words = query.toLowerCase().split(/\s+/);

    for (const word of words) {
      if (synonyms[word]) {
        for (const synonym of synonyms[word]) {
          const expandedQuery = query.replace(new RegExp(word, "gi"), synonym);
          if (expandedQuery !== query) {
            expanded.push(expandedQuery);
          }
        }
      }
    }

    return expanded.slice(0, 3); // Return original + top 2 expansions
  }
}
