/**
 * Batch Processing Utility
 *
 * Provides utilities for processing large datasets in batches.
 * Used for:
 * - Large vector insertions to Qdrant
 * - Embedding generation in batches
 * - Parallel collection updates
 *
 * Features:
 * - Configurable batch size
 * - Progress tracking
 * - Error collection (continues on partial failures)
 * - Parallel batch execution support
 */

import { logger } from "../logger";

export interface BatchOptions {
  /**
   * Number of items per batch (default: 100)
   */
  batchSize?: number;

  /**
   * Log progress (default: true)
   */
  logProgress?: boolean;

  /**
   * Continue on errors (default: true)
   */
  continueOnError?: boolean;

  /**
   * Operation description for logging
   */
  operationName?: string;
}

export interface BatchResult<T> {
  /**
   * Successfully processed items
   */
  successful: T[];

  /**
   * Failed items with errors
   */
  failed: Array<{ item: T; error: Error }>;

  /**
   * Total batches processed
   */
  totalBatches: number;

  /**
   * Total items processed
   */
  totalItems: number;
}

/**
 * Process items in batches sequentially
 *
 * @param items Items to process
 * @param processBatch Function to process each batch
 * @param options Batch processing options
 * @returns BatchResult with successful and failed items
 *
 * @example
 * const result = await processBatches(
 *   points,
 *   async (batch) => await client.upsert('collection', { points: batch }),
 *   { batchSize: 100, operationName: 'Insert vectors' }
 * );
 */
export async function processBatches<T>(
  items: T[],
  processBatch: (batch: T[], batchIndex: number) => Promise<void>,
  options: BatchOptions = {}
): Promise<BatchResult<T>> {
  const {
    batchSize = 100,
    logProgress = true,
    continueOnError = true,
    operationName = "Processing",
  } = options;

  if (items.length === 0) {
    logger.debug(`No items to process for ${operationName}`);
    return {
      successful: [],
      failed: [],
      totalBatches: 0,
      totalItems: 0,
    };
  }

  const totalBatches = Math.ceil(items.length / batchSize);
  const successful: T[] = [];
  const failed: Array<{ item: T; error: Error }> = [];

  if (logProgress) {
    logger.info(
      `${operationName}: Processing ${items.length} items in ${totalBatches} batches (size: ${batchSize})`
    );
  }

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize);
    const batchNumber = batchIndex + 1;

    try {
      if (logProgress && totalBatches > 1) {
        logger.info(
          `📦 ${operationName}: Batch ${batchNumber}/${totalBatches} (${batch.length} items)`
        );
      }

      await processBatch(batch, batchIndex);

      successful.push(...batch);

      if (logProgress && totalBatches > 1) {
        const progress = Math.round((successful.length / items.length) * 100);
        logger.debug(`✓ Batch ${batchNumber}/${totalBatches} completed (${progress}% total)`);
      }
    } catch (error: any) {
      logger.error(
        `❌ ${operationName}: Batch ${batchNumber}/${totalBatches} failed: ${error.message}`
      );

      // Record all items in failed batch
      for (const item of batch) {
        failed.push({ item, error });
      }

      if (!continueOnError) {
        throw error;
      }
    }
  }

  if (logProgress) {
    logger.info(
      `✓ ${operationName}: Completed ${successful.length}/${items.length} items` +
        (failed.length > 0 ? ` (${failed.length} failed)` : "")
    );
  }

  return {
    successful,
    failed,
    totalBatches,
    totalItems: items.length,
  };
}

/**
 * Process batches in parallel
 *
 * WARNING: Use only when order doesn't matter and operations are idempotent.
 *
 * @param items Items to process
 * @param processBatch Function to process each batch
 * @param options Batch processing options
 * @param maxConcurrent Maximum concurrent batches (default: 3)
 * @returns BatchResult
 *
 * @example
 * const result = await processBatchesParallel(
 *   texts,
 *   async (batch) => await generateEmbeddings(batch),
 *   { batchSize: 50, operationName: 'Generate embeddings' },
 *   3 // max 3 concurrent batches
 * );
 */
export async function processBatchesParallel<T>(
  items: T[],
  processBatch: (batch: T[], batchIndex: number) => Promise<void>,
  options: BatchOptions = {},
  maxConcurrent: number = 3
): Promise<BatchResult<T>> {
  const { batchSize = 100, logProgress = true, operationName = "Processing" } = options;

  if (items.length === 0) {
    return {
      successful: [],
      failed: [],
      totalBatches: 0,
      totalItems: 0,
    };
  }

  // Split into batches
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  const totalBatches = batches.length;

  if (logProgress) {
    logger.info(
      `${operationName}: Processing ${items.length} items in ${totalBatches} batches (parallel, max ${maxConcurrent} concurrent)`
    );
  }

  const successful: T[] = [];
  const failed: Array<{ item: T; error: Error }> = [];

  // Process batches with concurrency limit
  const results = await Promise.allSettled(
    batches.map((batch, batchIndex) =>
      limitConcurrency(
        () => processBatch(batch, batchIndex),
        maxConcurrent,
        batchIndex
      ).then(() => batch)
    )
  );

  // Collect results
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const batch = batches[i];

    if (result.status === "fulfilled") {
      successful.push(...batch);
    } else {
      logger.error(`Batch ${i + 1} failed: ${result.reason?.message || result.reason}`);
      for (const item of batch) {
        failed.push({
          item,
          error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
        });
      }
    }
  }

  if (logProgress) {
    logger.info(
      `✓ ${operationName}: Completed ${successful.length}/${items.length} items` +
        (failed.length > 0 ? ` (${failed.length} failed)` : "")
    );
  }

  return {
    successful,
    failed,
    totalBatches,
    totalItems: items.length,
  };
}

/**
 * Concurrency limiter using a simple semaphore pattern
 */
let activePromises = 0;
const queue: Array<() => void> = [];

async function limitConcurrency<T>(
  fn: () => Promise<T>,
  maxConcurrent: number,
  _batchIndex: number
): Promise<T> {
  // Wait if at capacity
  if (activePromises >= maxConcurrent) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }

  activePromises++;

  try {
    return await fn();
  } finally {
    activePromises--;
    // Release next waiting promise
    const next = queue.shift();
    if (next) {
      next();
    }
  }
}

/**
 * Chunk an array into smaller arrays
 *
 * @param array Array to chunk
 * @param size Chunk size
 * @returns Array of chunks
 *
 * @example
 * const chunks = chunk([1, 2, 3, 4, 5], 2);
 * // [[1, 2], [3, 4], [5]]
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
