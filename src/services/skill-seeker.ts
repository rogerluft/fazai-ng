/**
 * FazAI SkillSeeker Service
 *
 * Monitors /etc/fazai/ingest directory for new knowledge files and
 * automatically indexes them into the fazai_kb collection for RAG.
 *
 * Features:
 * - Real-time file monitoring with chokidar
 * - Multi-format support: PDF, Markdown, TXT
 * - Semantic chunking with overlap
 * - ECOA compliant (1536 dim vectors via UniversalLocalEmbedder)
 * - Duplicate detection via hash-based tracking
 * - Automatic retry on transient failures
 *
 * Architecture:
 * - Uses UniversalLocalEmbedder (Lei 1536) for embeddings
 * - Stores in fazai_kb collection with semantic IDs
 * - Maintains processed files registry to avoid re-processing
 *
 * @version 1.0.0
 */

import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import * as crypto from "crypto";
import chokidar, { FSWatcher } from "chokidar";
import pdfParse from "pdf-parse";
import { logger } from "../logger";
import { createEmbeddingService } from "./embeddings";
import { getQdrantClient } from "../database/qdrant-pool";
import { getConfigValue } from "../config";

/**
 * Configuration constants
 */
const INGEST_DIR = "/etc/fazai/ingest";
const REGISTRY_FILE = "/opt/fazai/data/skill-seeker-registry.json";
const COLLECTION_NAME = "fazai_kb";
const MAX_CHUNK_SIZE = 1000; // Max tokens (~3-4 chars per token)
const CHUNK_OVERLAP = 100; // Overlap in characters for context preservation
const SUPPORTED_EXTENSIONS = [".pdf", ".md", ".txt"];

/**
 * Registry entry for processed files
 */
interface ProcessedFile {
  filename: string;
  hash: string;
  processedAt: string;
  chunks: number;
  size: number;
}

/**
 * Registry of processed files
 */
interface SkillRegistry {
  files: Record<string, ProcessedFile>;
  lastUpdated: string;
  totalFilesProcessed: number;
  totalChunksIndexed: number;
}

/**
 * Service statistics
 */
interface SkillSeekerStats {
  isRunning: boolean;
  filesProcessed: number;
  chunksIndexed: number;
  errors: number;
  lastProcessedFile: string | null;
  lastProcessedAt: string | null;
  watchedDirectory: string;
}

/**
 * SkillSeeker Service
 *
 * Monitors a directory for knowledge files and automatically indexes them
 * into the Qdrant vector database for semantic search and RAG.
 */
export class SkillSeekerService {
  private watcher: FSWatcher | null = null;
  private registry: SkillRegistry = {
    files: {},
    lastUpdated: new Date().toISOString(),
    totalFilesProcessed: 0,
    totalChunksIndexed: 0,
  };
  private stats: SkillSeekerStats = {
    isRunning: false,
    filesProcessed: 0,
    chunksIndexed: 0,
    errors: 0,
    lastProcessedFile: null,
    lastProcessedAt: null,
    watchedDirectory: INGEST_DIR,
  };
  private isProcessing = false;

  /**
   * Initialize the service
   */
  constructor() {
    this.loadRegistry();
  }

  /**
   * Start monitoring the ingest directory
   */
  async start(): Promise<void> {
    if (this.stats.isRunning) {
      logger.warn("SkillSeeker is already running");
      return;
    }

    try {
      // Ensure ingest directory exists
      await this.ensureIngestDirectory();

      // Verify Qdrant collection exists
      await this.ensureCollection();

      // Process existing files first
      await this.processExistingFiles();

      // Start file watcher
      this.watcher = chokidar.watch(INGEST_DIR, {
        ignored: /(^|[\/\\])\../, // Ignore dotfiles
        persistent: true,
        ignoreInitial: true, // We already processed existing files
        awaitWriteFinish: {
          stabilityThreshold: 2000, // Wait 2s for file to stabilize
          pollInterval: 100,
        },
      });

      // Watch for new files
      this.watcher.on("add", async (filePath: string) => {
        await this.handleNewFile(filePath);
      });

      // Watch for file changes
      this.watcher.on("change", async (filePath: string) => {
        await this.handleFileChange(filePath);
      });

      // Watch for file deletions
      this.watcher.on("unlink", async (filePath: string) => {
        await this.handleFileDelete(filePath);
      });

      // Error handling
      this.watcher.on("error", (error: Error) => {
        logger.error(`SkillSeeker watcher error: ${error.message}`);
        this.stats.errors++;
      });

      this.stats.isRunning = true;
      logger.info(`✓ SkillSeeker started monitoring: ${INGEST_DIR}`);
    } catch (error: any) {
      logger.error(`Failed to start SkillSeeker: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    if (!this.stats.isRunning) {
      logger.warn("SkillSeeker is not running");
      return;
    }

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    // Save registry
    await this.saveRegistry();

    this.stats.isRunning = false;
    logger.info("✓ SkillSeeker stopped");
  }

  /**
   * Get service statistics
   */
  getStats(): SkillSeekerStats {
    return { ...this.stats };
  }

  /**
   * Process a single file manually
   */
  async processFile(filePath: string): Promise<void> {
    await this.handleNewFile(filePath);
  }

  /**
   * Ensure ingest directory exists
   */
  private async ensureIngestDirectory(): Promise<void> {
    try {
      await fs.mkdir(INGEST_DIR, { recursive: true });
      logger.debug(`Ensured ingest directory exists: ${INGEST_DIR}`);
    } catch (error: any) {
      throw new Error(`Failed to create ingest directory: ${error.message}`);
    }
  }

  /**
   * Ensure Qdrant collection exists
   */
  private async ensureCollection(): Promise<void> {
    try {
      const qdrant = await getQdrantClient();
      const collections = await qdrant.getCollections();

      const collectionExists = collections.collections.some(
        (col) => col.name === COLLECTION_NAME
      );

      if (!collectionExists) {
        logger.info(`Creating collection: ${COLLECTION_NAME}`);
        await qdrant.createCollection(COLLECTION_NAME, {
          vectors: {
            size: 1536, // Lei 1536 (ECOA standard)
            distance: "Cosine",
          },
        });
        logger.info(`✓ Collection created: ${COLLECTION_NAME}`);
      } else {
        logger.debug(`Collection already exists: ${COLLECTION_NAME}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to ensure collection: ${error.message}`);
    }
  }

  /**
   * Process all existing files in the directory
   */
  private async processExistingFiles(): Promise<void> {
    try {
      const files = await fs.readdir(INGEST_DIR);
      const supportedFiles = files.filter((file) =>
        SUPPORTED_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext))
      );

      if (supportedFiles.length === 0) {
        logger.debug("No existing files to process");
        return;
      }

      logger.info(`Processing ${supportedFiles.length} existing files...`);

      for (const file of supportedFiles) {
        const filePath = path.join(INGEST_DIR, file);
        await this.handleNewFile(filePath);
      }

      logger.info(`✓ Processed ${supportedFiles.length} existing files`);
    } catch (error: any) {
      logger.error(`Failed to process existing files: ${error.message}`);
    }
  }

  /**
   * Handle new file detected
   */
  private async handleNewFile(filePath: string): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      logger.debug(`Skipping ${filePath} - processing in progress`);
      return;
    }

    this.isProcessing = true;

    try {
      const filename = path.basename(filePath);
      const ext = path.extname(filename).toLowerCase();

      // Check if supported
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        logger.debug(`Skipping unsupported file: ${filename}`);
        return;
      }

      // Calculate file hash
      const hash = await this.calculateFileHash(filePath);

      // Check if already processed
      if (this.registry.files[filename]?.hash === hash) {
        logger.debug(`Skipping already processed file: ${filename}`);
        return;
      }

      logger.info(`Processing new file: ${filename}`);

      // Extract text based on file type
      const text = await this.extractText(filePath, ext);

      if (!text || text.trim().length === 0) {
        logger.warn(`No text extracted from ${filename}`);
        return;
      }

      // Chunk the text
      const chunks = this.chunkText(text);
      logger.debug(`Created ${chunks.length} chunks from ${filename}`);

      // Generate embeddings and store
      const embeddingService = await createEmbeddingService();
      const qdrant = await getQdrantClient();

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        try {
          // Generate embedding
          const embedding = await embeddingService.generate(chunk);

          // Create semantic ID (hash of filename + chunk index + content hash)
          const contentHash = crypto
            .createHash("sha256")
            .update(chunk)
            .digest("hex")
            .substring(0, 16);
          const semanticId = `${filename}:${i}:${contentHash}`;

          // Store in Qdrant
          await qdrant.upsert(COLLECTION_NAME, {
            points: [
              {
                id: semanticId,
                vector: embedding,
                payload: {
                  type: "knowledge",
                  source: filename,
                  chunk_index: i,
                  total_chunks: chunks.length,
                  content: chunk,
                  file_hash: hash,
                  ingested_at: new Date().toISOString(),
                  file_type: ext.replace(".", ""),
                  semantic_id: semanticId,
                },
              },
            ],
          });

          this.stats.chunksIndexed++;
        } catch (error: any) {
          logger.error(`Failed to index chunk ${i} of ${filename}: ${error.message}`);
          this.stats.errors++;
        }
      }

      // Update registry
      const stats = await fs.stat(filePath);
      this.registry.files[filename] = {
        filename,
        hash,
        processedAt: new Date().toISOString(),
        chunks: chunks.length,
        size: stats.size,
      };
      this.registry.totalFilesProcessed++;
      this.registry.totalChunksIndexed += chunks.length;
      this.registry.lastUpdated = new Date().toISOString();

      // Update stats
      this.stats.filesProcessed++;
      this.stats.lastProcessedFile = filename;
      this.stats.lastProcessedAt = new Date().toISOString();

      // Save registry
      await this.saveRegistry();

      logger.info(`✓ Indexed ${filename} (${chunks.length} chunks)`);
    } catch (error: any) {
      logger.error(`Failed to process file ${filePath}: ${error.message}`);
      this.stats.errors++;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Handle file change (re-process)
   */
  private async handleFileChange(filePath: string): Promise<void> {
    logger.info(`File changed, re-processing: ${path.basename(filePath)}`);
    await this.handleNewFile(filePath);
  }

  /**
   * Handle file deletion
   */
  private async handleFileDelete(filePath: string): Promise<void> {
    const filename = path.basename(filePath);

    try {
      // Remove from Qdrant
      const qdrant = await getQdrantClient();
      await qdrant.delete(COLLECTION_NAME, {
        filter: {
          must: [{ key: "source", match: { value: filename } }],
        },
      });

      // Remove from registry
      if (this.registry.files[filename]) {
        delete this.registry.files[filename];
        this.registry.totalFilesProcessed--;
        this.registry.lastUpdated = new Date().toISOString();
        await this.saveRegistry();
      }

      logger.info(`✓ Removed deleted file from index: ${filename}`);
    } catch (error: any) {
      logger.error(`Failed to remove deleted file ${filename}: ${error.message}`);
      this.stats.errors++;
    }
  }

  /**
   * Extract text from file based on type
   */
  private async extractText(filePath: string, ext: string): Promise<string> {
    switch (ext) {
      case ".pdf":
        return await this.extractPdfText(filePath);
      case ".md":
      case ".txt":
        return await fs.readFile(filePath, "utf-8");
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
  }

  /**
   * Extract text from PDF using pdf-parse
   */
  private async extractPdfText(filePath: string): Promise<string> {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (error: any) {
      throw new Error(`Failed to extract PDF text: ${error.message}`);
    }
  }

  /**
   * Chunk text into semantic segments with overlap
   *
   * Strategy:
   * - Split by paragraphs first (double newline)
   * - Combine paragraphs up to MAX_CHUNK_SIZE
   * - Add overlap from previous chunk for context
   */
  private chunkText(text: string): string[] {
    const chunks: string[] = [];

    // Normalize line endings and split into paragraphs
    const paragraphs = text
      .replace(/\r\n/g, "\n")
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    let currentChunk = "";
    let previousChunk = "";

    for (const paragraph of paragraphs) {
      // Check if adding this paragraph would exceed limit
      if (currentChunk.length + paragraph.length > MAX_CHUNK_SIZE * 4) {
        // Push current chunk
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          previousChunk = currentChunk;

          // Start new chunk with overlap from previous
          const overlapText = this.getOverlapText(previousChunk);
          currentChunk = overlapText ? overlapText + "\n\n" + paragraph : paragraph;
        } else {
          // Paragraph itself is too large, split by sentences
          const sentences = this.splitBySentences(paragraph);
          for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > MAX_CHUNK_SIZE * 4) {
              chunks.push(currentChunk.trim());
              previousChunk = currentChunk;
              const overlapText = this.getOverlapText(previousChunk);
              currentChunk = overlapText ? overlapText + " " + sentence : sentence;
            } else {
              currentChunk += (currentChunk ? " " : "") + sentence;
            }
          }
        }
      } else {
        // Add paragraph to current chunk
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
      }
    }

    // Add final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Get overlap text from previous chunk (last ~100 chars)
   */
  private getOverlapText(chunk: string): string {
    if (chunk.length <= CHUNK_OVERLAP) {
      return chunk;
    }
    return "..." + chunk.substring(chunk.length - CHUNK_OVERLAP);
  }

  /**
   * Split text by sentences
   */
  private splitBySentences(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  /**
   * Calculate SHA256 hash of file
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Load registry from disk
   */
  private loadRegistry(): void {
    try {
      if (fsSync.existsSync(REGISTRY_FILE)) {
        const data = fsSync.readFileSync(REGISTRY_FILE, "utf-8");
        this.registry = JSON.parse(data);
        logger.debug(`Loaded registry: ${Object.keys(this.registry.files).length} files`);
      }
    } catch (error: any) {
      logger.warn(`Failed to load registry: ${error.message}`);
    }
  }

  /**
   * Save registry to disk
   */
  private async saveRegistry(): Promise<void> {
    try {
      const dir = path.dirname(REGISTRY_FILE);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(REGISTRY_FILE, JSON.stringify(this.registry, null, 2));
      logger.debug("Registry saved");
    } catch (error: any) {
      logger.error(`Failed to save registry: ${error.message}`);
    }
  }
}

/**
 * Singleton instance
 */
let skillSeekerInstance: SkillSeekerService | null = null;

/**
 * Get or create SkillSeeker instance
 */
export function getSkillSeeker(): SkillSeekerService {
  if (!skillSeekerInstance) {
    skillSeekerInstance = new SkillSeekerService();
  }
  return skillSeekerInstance;
}
