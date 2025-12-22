/**
 * Qdrant Import/Export System
 *
 * Provides robust import/export functionality for Qdrant collections with:
 * - JSON, JSONL, CSV format support
 * - Batch processing for large datasets
 * - Progress tracking with live updates
 * - Automatic schema validation
 * - Resume capability for interrupted operations
 * - Memory-efficient streaming for large files
 *
 * Usage:
 *   import { importFromJson, exportToJson } from './orchestrator/qdrant-import-export';
 *
 *   // Export collection to JSON
 *   await exportToJson('fazai_kb', '/backup/kb-export.json');
 *
 *   // Import from JSON with progress
 *   const result = await importFromJson('/backup/kb-export.json', 'fazai_kb');
 *   console.log(`Imported ${result.successCount} points`);
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { getQdrantClient, qdrantPool } from "../database/qdrant-pool";
import { logger } from "../logger";
import { createReadStream, createWriteStream, promises as fs } from "fs";
import { createInterface } from "readline";
import { z } from "zod";

/**
 * Supported file formats
 */
export type ExportFormat = "json" | "jsonl" | "csv";

/**
 * Point data structure (Qdrant format)
 */
const QdrantPointSchema = z.object({
  id: z.union([z.string(), z.number()]),
  vector: z.union([z.array(z.number()), z.record(z.string(), z.array(z.number()))]),
  payload: z.record(z.string(), z.any()).optional(),
});

export type QdrantPoint = z.infer<typeof QdrantPointSchema>;

/**
 * Import result statistics
 */
export interface ImportResult {
  successCount: number;
  errorCount: number;
  totalProcessed: number;
  duration: number;
  errors: Array<{ line: number; error: string; data?: any }>;
}

/**
 * Export options
 */
export interface ExportOptions {
  format?: ExportFormat;
  batchSize?: number;
  filter?: Record<string, any>;
  includeVectors?: boolean;
  progressCallback?: (progress: number, total: number) => void;
}

/**
 * Import options
 */
export interface ImportOptions {
  batchSize?: number;
  validate?: boolean;
  skipErrors?: boolean;
  progressCallback?: (progress: number, total: number) => void;
  startFrom?: number; // Resume from specific line
}

/**
 * Default batch size for operations
 */
const DEFAULT_BATCH_SIZE = 100;

/**
 * Export collection to JSON file
 *
 * @param collection - Collection name
 * @param outputPath - Output file path
 * @param options - Export options
 */
export async function exportToJson(
  collection: string,
  outputPath: string,
  options: ExportOptions = {}
): Promise<void> {
  const startTime = Date.now();
  const {
    format = "json",
    batchSize = DEFAULT_BATCH_SIZE,
    filter,
    includeVectors = true,
    progressCallback,
  } = options;

  logger.info(`[Qdrant Export] Starting export of collection '${collection}' to ${outputPath}`);

  if (!qdrantPool.isAvailable()) {
    throw new Error("Qdrant is not available (circuit breaker is OPEN)");
  }

  try {
    const client = await getQdrantClient();

    // Get collection info
    const collectionInfo = await client.getCollection(collection);
    const totalPoints = collectionInfo.points_count || 0;

    logger.info(`[Qdrant Export] Collection has ${totalPoints} points`);

    // Create write stream
    const writeStream = createWriteStream(outputPath, { encoding: "utf8" });
    let exportedCount = 0;
    let offset: string | number | undefined = undefined;

    // JSON format: open array
    if (format === "json") {
      writeStream.write("[\n");
    }

    // CSV format: write header
    if (format === "csv") {
      writeStream.write("id,vector,payload\n");
    }

    // Scroll through all points
    while (true) {
      const scrollResult = await client.scroll(collection, {
        limit: batchSize,
        offset,
        with_vector: includeVectors,
        filter,
      });

      const points = scrollResult.points;
      if (points.length === 0) break;

      // Write points in selected format
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        exportedCount++;

        if (format === "json") {
          const separator = exportedCount > 1 ? ",\n" : "";
          writeStream.write(separator + JSON.stringify(point, null, 2));
        } else if (format === "jsonl") {
          writeStream.write(JSON.stringify(point) + "\n");
        } else if (format === "csv") {
          const vector = Array.isArray(point.vector)
            ? point.vector.join("|")
            : JSON.stringify(point.vector);
          const payload = JSON.stringify(point.payload || {}).replace(/"/g, '""');
          writeStream.write(`"${point.id}","${vector}","${payload}"\n`);
        }

        // Progress callback
        if (progressCallback && exportedCount % 10 === 0) {
          progressCallback(exportedCount, totalPoints);
        }
      }

      offset = scrollResult.next_page_offset;
      if (!offset) break; // No more points
    }

    // JSON format: close array
    if (format === "json") {
      writeStream.write("\n]\n");
    }

    writeStream.end();

    // Wait for stream to finish
    await new Promise<void>((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    const duration = Date.now() - startTime;
    logger.info(
      `[Qdrant Export] ✓ Exported ${exportedCount} points in ${duration}ms to ${outputPath}`
    );
  } catch (error: any) {
    logger.error(`[Qdrant Export] Failed: ${error.message}`);
    throw error;
  }
}

/**
 * Import points from JSON file to collection
 *
 * @param filePath - Input file path
 * @param collection - Target collection name
 * @param options - Import options
 * @returns Import result with statistics
 */
export async function importFromJson(
  filePath: string,
  collection: string,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const startTime = Date.now();
  const {
    batchSize = DEFAULT_BATCH_SIZE,
    validate = true,
    skipErrors = true,
    progressCallback,
    startFrom = 0,
  } = options;

  logger.info(`[Qdrant Import] Starting import to collection '${collection}' from ${filePath}`);

  if (!qdrantPool.isAvailable()) {
    throw new Error("Qdrant is not available (circuit breaker is OPEN)");
  }

  const result: ImportResult = {
    successCount: 0,
    errorCount: 0,
    totalProcessed: 0,
    duration: 0,
    errors: [],
  };

  try {
    const client = await getQdrantClient();

    // Check if collection exists
    try {
      await client.getCollection(collection);
    } catch (error: any) {
      throw new Error(`Collection '${collection}' does not exist. Create it first.`);
    }

    // Detect format from file extension
    const format = detectFormat(filePath);
    logger.info(`[Qdrant Import] Detected format: ${format}`);

    if (format === "json") {
      await importFromJsonArray(client, filePath, collection, options, result);
    } else if (format === "jsonl") {
      await importFromJsonLines(client, filePath, collection, options, result);
    } else if (format === "csv") {
      await importFromCsv(client, filePath, collection, options, result);
    } else {
      throw new Error(`Unsupported file format: ${format}`);
    }

    result.duration = Date.now() - startTime;
    logger.info(
      `[Qdrant Import] ✓ Completed: ${result.successCount} success, ${result.errorCount} errors, ${result.duration}ms`
    );

    return result;
  } catch (error: any) {
    logger.error(`[Qdrant Import] Failed: ${error.message}`);
    throw error;
  }
}

/**
 * Detect file format from extension
 */
function detectFormat(filePath: string): ExportFormat {
  const ext = filePath.toLowerCase().split(".").pop();
  if (ext === "jsonl" || ext === "ndjson") return "jsonl";
  if (ext === "csv") return "csv";
  return "json"; // Default
}

/**
 * Import from JSON array file
 */
async function importFromJsonArray(
  client: QdrantClient,
  filePath: string,
  collection: string,
  options: ImportOptions,
  result: ImportResult
): Promise<void> {
  const { batchSize = DEFAULT_BATCH_SIZE, validate = true, skipErrors = true } = options;

  // Read entire file
  const fileContent = await fs.readFile(filePath, "utf8");
  const data = JSON.parse(fileContent);

  if (!Array.isArray(data)) {
    throw new Error("JSON file must contain an array of points");
  }

  logger.info(`[Qdrant Import] Loaded ${data.length} points from JSON array`);

  // Process in batches
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const validPoints: QdrantPoint[] = [];

    for (const point of batch) {
      result.totalProcessed++;

      if (validate) {
        const validation = QdrantPointSchema.safeParse(point);
        if (!validation.success) {
          result.errorCount++;
          result.errors.push({
            line: i + validPoints.length,
            error: validation.error.message,
            data: point,
          });
          if (!skipErrors) {
            throw new Error(`Validation error at index ${i + validPoints.length}`);
          }
          continue;
        }
      }

      validPoints.push(point);
    }

    // Upsert batch
    if (validPoints.length > 0) {
      try {
        await client.upsert(collection, {
          points: validPoints,
        });
        result.successCount += validPoints.length;

        if (options.progressCallback) {
          options.progressCallback(result.totalProcessed, data.length);
        }
      } catch (error: any) {
        logger.error(`[Qdrant Import] Batch upsert failed: ${error.message}`);
        result.errorCount += validPoints.length;
        if (!skipErrors) throw error;
      }
    }
  }
}

/**
 * Import from JSONL (JSON Lines) file
 */
async function importFromJsonLines(
  client: QdrantClient,
  filePath: string,
  collection: string,
  options: ImportOptions,
  result: ImportResult
): Promise<void> {
  const {
    batchSize = DEFAULT_BATCH_SIZE,
    validate = true,
    skipErrors = true,
    startFrom = 0,
    progressCallback,
  } = options;

  const fileStream = createReadStream(filePath, { encoding: "utf8" });
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

  let batch: QdrantPoint[] = [];
  let lineNumber = 0;

  for await (const line of rl) {
    lineNumber++;
    if (lineNumber < startFrom) continue; // Resume support

    result.totalProcessed++;

    if (!line.trim()) continue; // Skip empty lines

    try {
      const point = JSON.parse(line);

      if (validate) {
        const validation = QdrantPointSchema.safeParse(point);
        if (!validation.success) {
          result.errorCount++;
          result.errors.push({
            line: lineNumber,
            error: validation.error.message,
            data: point,
          });
          if (!skipErrors) throw new Error(`Validation error at line ${lineNumber}`);
          continue;
        }
      }

      batch.push(point);

      // Upsert when batch is full
      if (batch.length >= batchSize) {
        await client.upsert(collection, { points: batch });
        result.successCount += batch.length;

        if (progressCallback) {
          progressCallback(result.totalProcessed, -1); // Unknown total for streaming
        }

        batch = [];
      }
    } catch (error: any) {
      result.errorCount++;
      result.errors.push({
        line: lineNumber,
        error: error.message,
        data: line,
      });
      if (!skipErrors) throw error;
    }
  }

  // Upsert remaining points
  if (batch.length > 0) {
    await client.upsert(collection, { points: batch });
    result.successCount += batch.length;
  }
}

/**
 * Import from CSV file
 */
async function importFromCsv(
  client: QdrantClient,
  filePath: string,
  collection: string,
  options: ImportOptions,
  result: ImportResult
): Promise<void> {
  const {
    batchSize = DEFAULT_BATCH_SIZE,
    validate = true,
    skipErrors = true,
    progressCallback,
  } = options;

  const fileStream = createReadStream(filePath, { encoding: "utf8" });
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

  let batch: QdrantPoint[] = [];
  let lineNumber = 0;
  let headerSkipped = false;

  for await (const line of rl) {
    lineNumber++;

    if (!headerSkipped) {
      headerSkipped = true;
      continue; // Skip CSV header
    }

    if (!line.trim()) continue;

    try {
      // Parse CSV line (simple implementation, handles quoted values)
      const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      if (!matches || matches.length < 2) {
        throw new Error("Invalid CSV format");
      }

      const id = matches[0].replace(/^"|"$/g, "");
      const vectorStr = matches[1].replace(/^"|"$/g, "");
      const payloadStr = matches[2]?.replace(/^"|"$/g, "") || "{}";

      // Parse vector (pipe-separated or JSON)
      let vector: number[];
      if (vectorStr.includes("|")) {
        vector = vectorStr.split("|").map((v) => parseFloat(v));
      } else {
        vector = JSON.parse(vectorStr);
      }

      // Parse payload
      const payload = JSON.parse(payloadStr.replace(/""/g, '"'));

      const point: QdrantPoint = {
        id: isNaN(Number(id)) ? id : Number(id),
        vector,
        payload,
      };

      if (validate) {
        const validation = QdrantPointSchema.safeParse(point);
        if (!validation.success) {
          result.errorCount++;
          result.errors.push({
            line: lineNumber,
            error: validation.error.message,
            data: line,
          });
          if (!skipErrors) throw new Error(`Validation error at line ${lineNumber}`);
          continue;
        }
      }

      batch.push(point);

      // Upsert when batch is full
      if (batch.length >= batchSize) {
        await client.upsert(collection, { points: batch });
        result.successCount += batch.length;

        if (progressCallback) {
          progressCallback(result.totalProcessed, -1);
        }

        batch = [];
      }
    } catch (error: any) {
      result.errorCount++;
      result.errors.push({
        line: lineNumber,
        error: error.message,
        data: line,
      });
      if (!skipErrors) throw error;
    }

    result.totalProcessed++;
  }

  // Upsert remaining points
  if (batch.length > 0) {
    await client.upsert(collection, { points: batch });
    result.successCount += batch.length;
  }
}

/**
 * Export collection to JSONL format (streaming-friendly)
 */
export async function exportToJsonLines(
  collection: string,
  outputPath: string,
  options: ExportOptions = {}
): Promise<void> {
  return exportToJson(collection, outputPath, { ...options, format: "jsonl" });
}

/**
 * Export collection to CSV format
 */
export async function exportToCsv(
  collection: string,
  outputPath: string,
  options: ExportOptions = {}
): Promise<void> {
  return exportToJson(collection, outputPath, { ...options, format: "csv" });
}
