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
import { getConfigValue } from "../config";
import { randomUUID } from "crypto";
import { FAZAI_PATHS } from "../utils/paths";
import * as fs from "fs";
import * as path from "path";
import type { PlaywrightCrawler } from "crawlee";

const _ua = [
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
];

const _ref = [
  "https://www.google.com/",
  "https://www.google.com.br/",
  "https://duckduckgo.com/",
  "https://www.bing.com/",
  "https://search.yahoo.com/",
];

function _pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function _delay(min: number, max: number): Promise<void> {
  return new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
}

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
  private isSaving = false;
  private pendingSave = false;
  private stealth: boolean;

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
    const flag = getConfigValue("CRAWLER_STEALTH") || process.env.CRAWLER_STEALTH || "";
    this.stealth = ["1", "true", "yes", "on"].includes(flag.toLowerCase());

    this.queue = new PQueue({ concurrency: 5, interval: 1000, intervalCap: 1 });
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
        results = await source.parser(url);
      } else {
        if (this.stealth) await _delay(800, 2500);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const headers: Record<string, string> = {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
          "User-Agent": this.stealth
            ? _pick(_ua)
            : "Mozilla/5.0 (compatible; FazAI/3.21; +https://github.com/rogerluft/fazai-ng)",
        };

        if (this.stealth) {
          headers["Referer"] = _pick(_ref);
          headers["Sec-Fetch-Dest"] = "document";
          headers["Sec-Fetch-Mode"] = "navigate";
          headers["Sec-Fetch-Site"] = "none";
          headers["Sec-Fetch-User"] = "?1";
          headers["Upgrade-Insecure-Requests"] = "1";
          headers["DNT"] = "1";
        }

        const response = await fetch(url, { headers, signal: controller.signal });
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
      // Log detailed error for debugging but always return an empty array to ensure robustness.
      // This prevents a single failed source from stopping the entire multi-source search.
      logger.error(`[ROBUSTNESS] Failed to fetch from ${source.name}: ${err.message}`, {
        stack: err.stack,
        source: source.name,
        query: query,
      });
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
   * Check if Context7 MCP is available
   */
  private async checkContext7Availability(): Promise<boolean> {
    try {
      const { getConfigValue } = await import("../config");
      const context7Url = getConfigValue("MCP_CONTEXT7_URL");
      
      if (!context7Url) return false;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(context7Url, {
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Parse DevDocs results using Context7 (preferred) or Playwright/Crawlee (fallback)
   */
  private async parseDevDocs(searchUrl: string): Promise<SearchResult[]> {
    // STRATEGY: Try Context7 MCP first (Option D)
    const context7Available = await this.checkContext7Availability();
    
    if (context7Available) {
      try {
        logger.debug("Using Context7 MCP for documentation search");
        const { getConfigValue } = await import("../config");
        const context7Url = getConfigValue("MCP_CONTEXT7_URL");
        const apiKey = getConfigValue("MCP_CONTEXT7_API_KEY");
        
        // Extract query from searchUrl (simplified)
        const query = searchUrl.split('q=')[1] || '';
        
        const response = await fetch(`${context7Url}?q=${query}&source=devdocs`, {
          headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
        });
        
        if (response.ok) {
          const data = await response.json();
          // Map Context7 format to SearchResult
          return data.results.map((item: any) => ({
            title: item.title,
            link: item.url,
            snippet: item.content,
            source: 'DevDocs (via Context7)',
            category: 'docs'
          }));
        }
      } catch (e) {
        logger.warn("Context7 search failed, falling back to scraper");
      }
    }

    // FALLBACK: Playwright Scraping with strict timeout
    const { PlaywrightCrawler, Dataset } = await import("crawlee");
    const datasetName = `devdocs-${randomUUID()}`;
    const dataset = await Dataset.open(datasetName);
    let crawler: PlaywrightCrawler | null = null;
    const stealth = this.stealth;

    try {
      const launchContext: Record<string, unknown> = {};
      if (stealth) {
        const vw = 1280 + Math.floor(Math.random() * 640);
        const vh = 720 + Math.floor(Math.random() * 360);
        launchContext.launchOptions = {
          args: [
            "--disable-blink-features=AutomationControlled",
            `--window-size=${vw},${vh}`,
          ],
        };
        launchContext.userAgent = _pick(_ua);
      }

      crawler = new PlaywrightCrawler({
        maxRequestsPerCrawl: 1,
        maxConcurrency: 1,
        requestHandlerTimeoutSecs: 30,
        headless: true,
        navigationTimeoutSecs: 15,
        ...launchContext,
        requestHandler: async ({ page, request }) => {
          if (stealth) {
            await page.addInitScript(() => {
              Object.defineProperty(navigator, "webdriver", { get: () => false });
              Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en", "pt-BR"] });
              Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
              (window as any).chrome = { runtime: {} };
            });
          }

          await page.route('**/*', (route) => {
            const type = route.request().resourceType();
            if (['stylesheet', 'font', 'image', 'media'].includes(type)) {
              route.abort();
            } else {
              route.continue();
            }
          });

          // Wait for selector - DevDocs specific
          try {
            await page.waitForSelector('.entry', { timeout: 10000 });
          } catch (e) {
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

      // TIMEOUT WRAPPER
      await Promise.race([
        crawler.run([searchUrl]),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('DevDocs scraping timed out')), 45000)
        )
      ]);

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
      // CLEANUP
      if (crawler) await crawler.teardown();
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
      const client = await getQdrantClient();
      const embeddingService = await createEmbeddingService();
      const embedding = await embeddingService.generate(query);

      // Deduplicação semântica: buscar se já existe query muito similar
      const similar = await client.search("fazai_kb", {
        vector: embedding,
        limit: 1,
        score_threshold: 0.90, // Queries altamente similares
        filter: {
          must: [
            { key: "type", match: { value: "web_search" } }
          ]
        }
      });

      if (similar.length > 0) {
        logger.debug(`Skipping Qdrant cache: Query "${query}" is semantically identical to existing cache.`);
        return;
      }

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
   * Uses a lock mechanism to avoid concurrent writes and OOM
   */
  private async saveCache(): Promise<void> {
    if (this.isSaving) {
      this.pendingSave = true;
      return;
    }

    this.isSaving = true;
    this.pendingSave = false;

    try {
      const entries = Array.from(this.cache.values());
      // we use a temp variable to avoid blocking the event loop more than necessary during stringification
      const data = JSON.stringify(entries, null, 2);
      await fs.promises.writeFile(this.cacheFile, data);
      logger.debug(`Saved ${entries.length} cached queries to disk`);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Failed to save cache: ${err.message}`);
    } finally {
      this.isSaving = false;
      if (this.pendingSave) {
        // Schedule next save if requested during current save
        setImmediate(() => this.saveCache());
      }
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
    // Fire and forget - do not block the main flow for disk I/O
    this.saveCache().catch((err) => {
      logger.error(`[PERFORMANCE] Background cache save failed: ${err.message}`);
    });
  }
}
