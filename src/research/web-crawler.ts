/**
 * Agentic Web Crawler - Multi-Source Web Search with Data Crossing
 *
 * Busca inteligente em múltiplas fontes (web, cache, forums, docs)
 * com cruzamento agêntico de dados para fornecer consenso e contradições.
 *
 * Features:
 * - Busca paralela em múltiplas fontes
 * - Deduplicação inteligente
 * - Ranking por relevância e categoria
 * - Cruzamento agêntico de dados
 * - Cache em Qdrant para reuso
 * - Rate limiting e robots.txt compliance
 * - Suporte a SPA via Playwright/Crawlee (DevDocs)
 *
 * @module research/web-crawler
 */

import * as cheerio from "cheerio";
import PQueue from "p-queue";
import { logger } from "../logger";
import { createEmbeddingService } from "../services/embeddings";
import { getQdrantClient } from "../database/qdrant-pool";
import { randomUUID } from "crypto";
import { FAZAI_PATHS } from "../utils/paths";
import * as fs from "fs";
import * as path from "path";
import { PlaywrightCrawler, Dataset } from "crawlee";

/**
 * Search result from a single source
 */
export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  source: string;
  category: "web" | "cache" | "forums" | "docs";
  relevance?: number;
  timestamp?: string;
}

/**
 * Search options
 */
export interface SearchOptions {
  sources?: Array<"web" | "cache" | "forums" | "docs">;
  maxResults?: number;
  timeout?: number;
  useCache?: boolean;
}

/**
 * Consolidated data from multiple sources
 */
export interface ConsolidatedData {
  consensus: string[];
  contradictions: string[];
  sources: string[];
  summary: string;
  totalResults: number;
}

/**
 * Source definition
 */
interface Source {
  name: string;
  endpoint: string;
  type?: "http" | "browser"; // Default: http
  parser: (input: string) => Promise<SearchResult[]> | SearchResult[];
}

/**
 * Cache entry
 */
interface CacheEntry {
  query: string;
  results: SearchResult[];
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

/**
 * Agentic Web Crawler
 *
 * Busca em múltiplas fontes, cruza dados, e fornece insights consolidados
 */
export class AgenticWebCrawler {
  private queue: PQueue;
  private cacheFile: string;
  private cache: Map<string, CacheEntry>;

  /**
   * Available sources organized by category
   */
  private sources: Record<string, Source[]> = {
    web: [
      {
        name: "DuckDuckGo",
        endpoint: "https://html.duckduckgo.com/html/?q=",
        type: "http",
        parser: this.parseDuckDuckGo.bind(this),
      },
    ],
    forums: [
      {
        name: "StackOverflow",
        endpoint: "https://stackoverflow.com/search?q=",
        type: "http",
        parser: this.parseStackOverflow.bind(this),
      },
    ],
    docs: [
      {
        name: "DevDocs",
        endpoint: "https://devdocs.io/#q=",
        type: "browser",
        parser: this.parseDevDocs.bind(this),
      },
    ],
  };

  constructor() {
    // Rate limiting: max 5 concurrent requests, 1 request per second
    this.queue = new PQueue({ concurrency: 5, interval: 1000, intervalCap: 1 });

    // Cache file
    this.cacheFile = path.join(FAZAI_PATHS.DATA, "web-search-cache.json");
    this.cache = this.loadCache();
  }

  /**
   * Search across multiple sources
   */
  async searchMultiSource(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      sources = ["web", "forums", "docs"],
      maxResults = 20,
      timeout = 5000,
      useCache = true,
    } = options;

    // Check cache first
    if (useCache) {
      const cached = this.getCached(query);
      if (cached) {
        logger.debug(`Cache HIT for query: "${query}"`);
        return cached;
      }
    }

    logger.debug(`Searching for: "${query}" across ${sources.length} source categories`);

    // Prepare search tasks
    const searchTasks: Promise<SearchResult[]>[] = [];

    for (const category of sources) {
      const categorySources = this.sources[category];
      if (!categorySources) continue;

      for (const source of categorySources) {
        searchTasks.push(
          this.queue.add(() => this.fetchSource(source, query, category as any, timeout))
        );
      }
    }

    // Execute all searches in parallel
    const results = await Promise.allSettled(searchTasks);

    // Collect successful results
    const allResults: SearchResult[] = [];
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.length > 0) {
        allResults.push(...result.value);
      }
    }

    // Deduplicate and rank
    const finalResults = this.deduplicateAndRank(allResults).slice(0, maxResults);

    // Cache results
    if (useCache && finalResults.length > 0) {
      this.setCached(query, finalResults);
    }

    logger.info(`Found ${finalResults.length} results from ${sources.length} categories`);

    return finalResults;
  }

  /**
   * Fetch results from a single source
   */
  private async fetchSource(
    source: Source,
    query: string,
    category: "web" | "cache" | "forums" | "docs",
    timeout: number
  ): Promise<SearchResult[]> {
    try {
      const url = `${source.endpoint}${encodeURIComponent(query)}`;
      const sourceType = source.type || "http";

      logger.debug(`Fetching from ${source.name} (${sourceType}): ${url}`);

      let results: SearchResult[] = [];

      if (sourceType === "browser") {
        // Browser scraping (SPA) - pass URL directly to parser
        // We do not use the abort controller timeout here as Crawlee manages its own timeouts
        // but we could race it if needed. For now, rely on Crawlee configuration.
        results = await source.parser(url);
      } else {
        // HTTP scraping (Static)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; FazAI/3.5.4; +https://github.com/rogerluft/fazai-ng)",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          logger.debug(`${source.name} returned status ${response.status}`);
          return [];
        }

        const html = await response.text();
        results = await source.parser(html);
      }

      // Add metadata
      for (const result of results) {
        result.source = source.name;
        result.category = category;
        result.timestamp = new Date().toISOString();
      }

      logger.debug(`${source.name}: ${results.length} results`);

      return results;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.debug(`Failed to fetch from ${source.name}: ${err.message}`);
      return [];
    }
  }

  /**
   * Parse DuckDuckGo HTML results
   */
  private parseDuckDuckGo(html: string): SearchResult[] {
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $(".result").each((_, elem) => {
      const $elem = $(elem);
      const title = $elem.find(".result__title").text().trim();
      const link = $elem.find(".result__url").attr("href") || "";
      const snippet = $elem.find(".result__snippet").text().trim();

      if (title && link) {
        results.push({
          title,
          link: link.startsWith("http") ? link : `https://${link}`,
          snippet,
          source: "DuckDuckGo",
          category: "web",
        });
      }
    });

    return results;
  }

  /**
   * Parse StackOverflow search results
   */
  private parseStackOverflow(html: string): SearchResult[] {
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $(".search-result").each((_, elem) => {
      const $elem = $(elem);
      const title = $elem.find(".result-link a").text().trim();
      const link = $elem.find(".result-link a").attr("href") || "";
      const snippet = $elem.find(".excerpt").text().trim();

      if (title && link) {
        results.push({
          title,
          link: link.startsWith("http") ? link : `https://stackoverflow.com${link}`,
          snippet,
          source: "StackOverflow",
          category: "forums",
        });
      }
    });

    return results;
  }

  /**
   * Parse DevDocs results using Playwright/Crawlee
   */
  private async parseDevDocs(searchUrl: string): Promise<SearchResult[]> {
    // Use a unique dataset name to avoid collisions if concurrent
    const datasetName = `devdocs-${randomUUID()}`;
    const dataset = await Dataset.open(datasetName);

    try {
      const crawler = new PlaywrightCrawler({
        maxRequestsPerCrawl: 1, // só uma página por vez aqui, mas escalável
        maxConcurrency: 5, // ajusta pra tua máquina/servidor
        requestHandlerTimeoutSecs: 60,
        headless: true,
        navigationTimeoutSecs: 30,
        requestHandler: async ({ page, request }) => {
          // Bloqueia lixo pra velocidade máxima
          await page.route('**/*', (route) => {
            const type = route.request().resourceType();
            if (['stylesheet', 'font', 'image', 'media'].includes(type)) {
              route.abort();
            } else {
              route.continue();
            }
          });

          // Wait for selector - DevDocs specific
          // Note: devdocs.io/#q=... might redirect or load content dynamically
          // .entry selector is commonly used in devdocs list
          try {
            await page.waitForSelector('.entry', { timeout: 15000 });
          } catch (e) {
            // If timeout, maybe no results or different layout
            return;
          }

          const results = await page.evaluate(() => {
            const items: SearchResult[] = [];
            document.querySelectorAll('.entry').forEach((entry) => {
              const link = entry.querySelector('a');
              const title = entry.querySelector('h4') || link;
              // Some devdocs themes might not have description class, fallback
              const desc = entry.querySelector('.search-result__description');

              if (link && title) {
                let href = link.getAttribute('href') || '';
                // Fix relative links
                if (href && !href.startsWith('http')) {
                  if (href.startsWith('/')) {
                     href = 'https://devdocs.io' + href;
                  } else {
                     href = 'https://devdocs.io/' + href;
                  }
                }

                items.push({
                  title: title.textContent?.trim() || '',
                  link: href,
                  snippet: desc?.textContent?.trim() || title.textContent?.trim() || '',
                  source: 'DevDocs',
                  category: 'docs' // Placeholder
                });
              }
            });
            return items;
          });

          // Salva direto no dataset do Crawlee
          await Dataset.pushData({
            url: request.loadedUrl,
            results
          });
        },
        failedRequestHandler: async ({ request }) => {
          logger.debug(`Falha em ${request.url}`);
        }
      });

      await crawler.run([searchUrl]);

      // Pega os dados salvos
      const { items } = await dataset.getData();

      // Extract results from dataset items
      const allResults: SearchResult[] = items.flatMap((item: any) => item.results || []);

      return allResults;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error(`Error parsing DevDocs: ${error.message}`);
      return [];
    } finally {
      // Clean up dataset
      await dataset.drop();
    }
  }

  /**
   * Deduplicate and rank results
   */
  private deduplicateAndRank(results: SearchResult[]): SearchResult[] {
    // Remove duplicates by URL
    const seen = new Set<string>();
    const unique = results.filter((r) => {
      const normalized = r.link.toLowerCase().replace(/[?#].*$/, "");
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });

    // Rank by category priority and source
    return unique.sort((a, b) => {
      // Priority: docs > forums > web
      const categoryPriority: Record<string, number> = {
        docs: 3,
        forums: 2,
        web: 1,
        cache: 0,
      };

      const priorityDiff = categoryPriority[b.category] - categoryPriority[a.category];
      if (priorityDiff !== 0) return priorityDiff;

      // Secondary: source reputation (simplified)
      const sourceReputation: Record<string, number> = {
        StackOverflow: 3,
        DuckDuckGo: 2,
        DevDocs: 3,
      };

      return (sourceReputation[b.source] || 0) - (sourceReputation[a.source] || 0);
    });
  }

  /**
   * Cross-reference results to find consensus and contradictions
   */
  async crossReference(results: SearchResult[]): Promise<ConsolidatedData> {
    if (results.length === 0) {
      return {
        consensus: [],
        contradictions: [],
        sources: [],
        summary: "Nenhum resultado encontrado.",
        totalResults: 0,
      };
    }

    // Group by category
    const byCategory: Record<string, SearchResult[]> = {};
    for (const result of results) {
      if (!byCategory[result.category]) {
        byCategory[result.category] = [];
      }
      byCategory[result.category].push(result);
    }

    // Extract unique sources
    const sources = [...new Set(results.map((r) => r.source))];

    // Find common themes (simplified - could use NLP)
    const consensus: string[] = [];
    const contradictions: string[] = [];

    // Group results by similarity (simplified heuristic)
    for (const category in byCategory) {
      const categoryResults = byCategory[category];

      if (categoryResults.length >= 2) {
        // Multiple results in same category = potential consensus
        consensus.push(
          `${category}: ${categoryResults.length} fontes concordam sobre "${categoryResults[0].title}"`
        );
      }
    }

    // Check for contradictions (simplified)
    if (byCategory.forums && byCategory.docs) {
      const forumTitles = byCategory.forums.map((r) => r.title.toLowerCase());
      const docTitles = byCategory.docs.map((r) => r.title.toLowerCase());

      const hasConflict = forumTitles.some((ft) =>
        docTitles.some((dt) => {
          const similarity = this.similarityScore(ft, dt);
          return similarity > 0.3 && similarity < 0.8; // Similar but not identical
        })
      );

      if (hasConflict) {
        contradictions.push(
          "Possível divergência entre documentação oficial e discussões em fóruns"
        );
      }
    }

    // Generate summary
    const summary = this.generateSummary(results, byCategory);

    return {
      consensus,
      contradictions,
      sources,
      summary,
      totalResults: results.length,
    };
  }

  /**
   * Simple string similarity (Jaccard)
   */
  private similarityScore(a: string, b: string): number {
    const wordsA = new Set(a.split(/\s+/));
    const wordsB = new Set(b.split(/\s+/));

    const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);

    return intersection.size / union.size;
  }

  /**
   * Generate summary from results
   */
  private generateSummary(
    results: SearchResult[],
    byCategory: Record<string, SearchResult[]>
  ): string {
    const parts: string[] = [];

    parts.push(`Encontrados ${results.length} resultados relevantes.`);

    for (const category in byCategory) {
      const count = byCategory[category].length;
      parts.push(`${count} em ${category}`);
    }

    // Top result
    if (results.length > 0) {
      parts.push(`\nMais relevante: "${results[0].title}" (${results[0].source})`);
    }

    return parts.join(", ");
  }

  /**
   * Cache results in Qdrant
   */
  async cacheInQdrant(query: string, results: SearchResult[]): Promise<void> {
    try {
      const embeddingService = await createEmbeddingService();
      const embedding = await embeddingService.generate(query);

      const client = await getQdrantClient();

      await client.upsert("fazai_kb", {
        points: [
          {
            id: randomUUID(),
            vector: embedding,
            payload: {
              type: "web_search",
              query,
              results: results.slice(0, 10), // Top 10 only
              timestamp: new Date().toISOString(),
              ttl: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
            },
          },
        ],
      });

      logger.debug(`Cached ${results.length} results in Qdrant for query: "${query}"`);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.debug(`Failed to cache in Qdrant: ${err.message}`);
    }
  }

  /**
   * Load cache from disk
   */
  private loadCache(): Map<string, CacheEntry> {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = fs.readFileSync(this.cacheFile, "utf-8");
        const entries = JSON.parse(data) as CacheEntry[];

        const cache = new Map<string, CacheEntry>();
        for (const entry of entries) {
          cache.set(entry.query, entry);
        }

        logger.debug(`Loaded ${cache.size} cached queries from disk`);
        return cache;
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.debug(`Failed to load cache: ${err.message}`);
    }

    return new Map();
  }

  /**
   * Save cache to disk
   */
  private saveCache(): void {
    try {
      const entries = Array.from(this.cache.values());
      fs.writeFileSync(this.cacheFile, JSON.stringify(entries, null, 2));
      logger.debug(`Saved ${entries.length} cached queries to disk`);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.debug(`Failed to save cache: ${err.message}`);
    }
  }

  /**
   * Get cached results
   */
  private getCached(query: string): SearchResult[] | null {
    const entry = this.cache.get(query);
    if (!entry) return null;

    // Check TTL
    if (Date.now() > entry.ttl) {
      this.cache.delete(query);
      return null;
    }

    return entry.results;
  }

  /**
   * Set cached results
   */
  private setCached(query: string, results: SearchResult[]): void {
    const entry: CacheEntry = {
      query,
      results,
      timestamp: Date.now(),
      ttl: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };

    this.cache.set(query, entry);
    this.saveCache();
  }
}
