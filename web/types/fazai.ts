/**
 * Type definitions for FazAI Qdrant collections
 * Centralized type definitions for all FazAI collections
 */

// ============================================================================
// Agent Status & Actions
// ============================================================================

export type AgentStatus = {
  status: "online" | "offline" | "paused";
  uptime_seconds: number;
  actions_per_minute: number;
  success_rate: number;
  total_actions: number;
  errors_count: number;
  memory_usage_mb: number;
  cpu_usage_percent: number;
  last_action?: string;
};

export type Action = {
  action_id: string;
  timestamp: string;
  type: string;
  description: string;
  status: "completed" | "failed" | "executing" | "pending";
  result?: string;
  duration_ms?: number;
};

// ============================================================================
// Memory
// ============================================================================

export type Memory = {
  conversation_id: string;
  message_id: string;
  role: "user" | "assistant" | "system" | "autonomous";
  content: string;
  importance?: number;
  summary?: string;
  timestamp: string;
};

// ============================================================================
// Learning
// ============================================================================

export type Learning = {
  learning_id: string;
  title: string;
  description: string;
  category: "linux" | "network" | "security" | "social";
  type: "erro" | "acerto" | "padrão" | "otimização";
  outcome: "sucesso" | "falha" | "parcial";
  confidence: number;
};

// ============================================================================
// Knowledge Base
// ============================================================================

export type KnowledgeBase = {
  slug: string;
  title: string;
  summary: string;
  category: "networking" | "storage" | "security";
  scope?: string;
  confidence?: number;
  validated?: boolean;
};

// ============================================================================
// Inference Rules
// ============================================================================

export type InferenceRule = {
  rule_id: string;
  title: string;
  description: string;
  condition: string;
  action: string;
  priority: number;
  enabled: boolean;
  created_by: "user" | "autonomous";
  created_at: string;
  apply_count?: number;
  last_applied?: string;
};

// ============================================================================
// Personality & Traits
// ============================================================================

export type Trait = {
  trait_name: string;
  value: string;
  category: "comunicação" | "decisão" | "ética";
  intensity: number;
};

export type Personality = {
  traits: Trait[];
};

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
