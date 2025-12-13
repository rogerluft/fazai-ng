import { createHash } from "crypto";
import { promises as fs } from "fs";
import { logger } from "../logger";
import { FAZAI_PATHS, ensureFazaiDirectories } from "../utils/paths";

interface CacheEntry {
  response: string;
  timestamp: number;
}

export class ApiCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly maxSize: number;
  private readonly persistPath?: string;

  constructor(
    maxSize: number = 500,
    persistPath?: string,
    autoLoad: boolean = true
  ) {
    this.maxSize = maxSize;

    if (persistPath === undefined) {
      ensureFazaiDirectories();
      this.persistPath = FAZAI_PATHS.API_CACHE_FILE;
    } else {
      this.persistPath = persistPath;
    }

    if (autoLoad && this.persistPath) {
      this.load().catch((error) => {
        logger.debug(`Could not load API cache: ${error.message}`);
      });
    }
  }

  private generateKey(
    provider: string,
    model: string,
    prompt: string
  ): string {
    const input = `${provider}:${model}:${prompt}`;
    return createHash("sha256").update(input).digest("hex");
  }

  get(
    provider: string,
    model: string,
    prompt: string
  ): string | null {
    const key = this.generateKey(provider, model, prompt);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    this.cache.delete(key);
    this.cache.set(key, entry);
    logger.debug(`Cache HIT for ${provider}:${model}`);
    return entry.response;
  }

  set(
    provider: string,
    model: string,
    prompt: string,
    response: string
  ): void {
    const key = this.generateKey(provider, model, prompt);

    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      response,
      timestamp: Date.now(),
    });
    logger.debug(`Cached response for ${provider}:${model}`);
  }

  async save(): Promise<void> {
    if (!this.persistPath) {
      return;
    }

    try {
      const dir = path.dirname(this.persistPath);
      await fs.mkdir(dir, { recursive: true });

      const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        ...entry,
      }));

      const data = {
        version: 1,
        savedAt: new Date().toISOString(),
        maxSize: this.maxSize,
        entries,
      };

      await fs.writeFile(this.persistPath, JSON.stringify(data, null, 2), "utf-8");
    } catch (error: any) {
      logger.error(`Failed to save API cache: ${error.message}`);
    }
  }

  async load(): Promise<void> {
    if (!this.persistPath) {
      return;
    }

    try {
      const content = await fs.readFile(this.persistPath, "utf-8");
      const data = JSON.parse(content);

      if (!data.entries || !Array.isArray(data.entries)) {
        throw new Error("Invalid cache file format");
      }

      for (const entry of data.entries) {
        if (entry.key && entry.response) {
          this.cache.set(entry.key, {
            response: entry.response,
            timestamp: entry.timestamp || Date.now(),
          });
          if (this.cache.size >= this.maxSize) {
            break;
          }
        }
      }
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        logger.warn(`Failed to load API cache: ${error.message}`);
      }
    }
  }
}

export const apiCache = new ApiCache();
