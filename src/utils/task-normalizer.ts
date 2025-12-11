/**
 * Task Normalizer - Removes ambiguity from natural language tasks
 *
 * Problem: Commas can be interpreted as:
 * - List separator: "item1, item2, item3" → 3 separate tasks
 * - Sequence connector: "do X, then Y" → 1 task with 2 steps
 *
 * Solution: Convert implicit sequences into explicit temporal connectors
 *
 * @example
 * normalizeTask("instalar nginx, configurar porta 80")
 * // → "instalar nginx e depois configurar porta 80"
 */

import { logger } from '../logger';

/**
 * Regex patterns for different comma contexts
 */
const PATTERNS = {
  // Sequential tasks separated by comma: "verb phrase, verb phrase"
  // Captures: [anything ending with verb], [comma], [verb starting next phrase]
  SEQUENTIAL_TASKS: /(\b\w+(?:ar|er|ir|ando|endo|indo)\b[^,]*),\s+(\w+(?:ar|er|ir|ando|endo|indo)\b)/gi,

  // Already has temporal marker: "verb, em seguida verb"
  HAS_TEMPORAL: /,\s+(em seguida|depois|então|logo|por fim|por último)/gi,

  // List enumeration: "primeiro, segundo, terceiro"
  ENUMERATION: /\b(primeiro|segunda|terceiro|quarto|1º|2º|3º)\b/gi,
};

/**
 * Normalizes a natural language task to avoid comma ambiguity
 *
 * @param task - User's task in Portuguese
 * @returns Normalized task with explicit temporal connectors
 */
export function normalizeTask(task: string): string {
  if (!task || typeof task !== 'string') {
    return task;
  }

  // Don't normalize if already has temporal markers
  if (PATTERNS.HAS_TEMPORAL.test(task)) {
    logger.debug('[TaskNormalizer] Task already has temporal markers, skipping normalization');
    return task;
  }

  // Don't normalize if looks like enumeration
  if (PATTERNS.ENUMERATION.test(task)) {
    logger.debug('[TaskNormalizer] Task looks like enumeration, skipping normalization');
    return task;
  }

  // Convert sequential tasks (apply recursively for multiple commas)
  let normalized = task;
  let previousNormalized = '';
  let iterations = 0;
  const maxIterations = 10; // Prevent infinite loops

  // Keep replacing until no more matches found
  while (normalized !== previousNormalized && iterations < maxIterations) {
    previousNormalized = normalized;
    normalized = normalized.replace(
      PATTERNS.SEQUENTIAL_TASKS,
      '$1 e depois $2'
    );
    iterations++;
  }

  if (normalized !== task) {
    logger.debug('[TaskNormalizer] Normalized task:', { original: task, normalized, iterations });
  }

  return normalized;
}

/**
 * Validates if normalization improved semantic clarity
 * Used for testing and quality metrics
 */
export function validateNormalization(original: string, normalized: string): {
  improved: boolean;
  reason: string;
} {
  // If unchanged, no improvement
  if (original === normalized) {
    return { improved: false, reason: 'No changes needed' };
  }

  // Check if added temporal connectors
  const addedConnectors = normalized.includes('e depois') && !original.includes('e depois');

  if (addedConnectors) {
    return { improved: true, reason: 'Added explicit temporal connector' };
  }

  return { improved: false, reason: 'Unknown modification' };
}
