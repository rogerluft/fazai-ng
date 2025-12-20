/**
 * Type definitions for FazAI Qdrant collections
 */

// ... (existing types)

export type SourceCode = {
  semantic_id: string;
  path: string;
  filename: string;
  fazai_version: string;
  content: string;
  is_jsdoc: boolean;
  chunk_index: number;
  category: string;
  importance_weight: number;
  legitimate_contexts: string[];
  functions?: string[];
  classes?: string[];
  imports?: string[];
  hash: string;
  indexed_at: number;
};

export const COLLECTIONS = [
  "fazai_personality",
  "fazai_memory",
  "fazai_learning",
  "fazai_kb",
  "fazai_inference",
  "fazai_source",
] as const;

export type CollectionName = (typeof COLLECTIONS)[number];
