/**
 * Type definitions for Terminal Jarvis Qdrant collections
 */

export type Trait = {
  trait_name: string;
  category: "comunicação" | "decisão" | "ética";
  value: string;
  intensity: number; // 0.0-1.0
  context?: string;
  tags?: string[];
};

export type Personality = {
  id: string;
  traits: Trait[];
  updated_at: string;
};

export type Memory = {
  conversation_id: string;
  message_id: number;
  role: "user" | "assistant" | "system" | "autonomous";
  timestamp: string;
  content: string;
  summary?: string;
  emotional_context?: string;
  importance?: number; // 0.0-1.0
  tags?: string[];
};

export type Learning = {
  learning_id: string;
  type: "erro" | "acerto" | "padrão" | "otimização";
  title: string;
  description: string;
  context: string;
  action_taken?: string;
  outcome: "sucesso" | "falha" | "parcial";
  confidence: number; // 0.0-1.0
  category: "linux" | "network" | "security" | "social";
  timestamp: string;
  applied_count?: number;
  tags?: string[];
};

export type KnowledgeBase = {
  slug: string;
  title: string;
  summary: string;
  category: "networking" | "storage" | "security";
  scope?: "cluster" | "host" | "container";
  linux_distribution?: string;
  component?: string;
  commands?: string;
  source?: string;
  confidence?: number; // 0.0-1.0
  validated?: boolean;
  tags?: string[];
};

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
  last_applied?: string;
  apply_count?: number;
  tags?: string[];
};

export type AgentStatus = {
  status: "online" | "offline" | "paused";
  uptime_seconds: number;
  actions_per_minute: number;
  success_rate: number; // 0.0-1.0
  last_action?: string;
  total_actions: number;
  errors_count: number;
  memory_usage_mb: number;
  cpu_usage_percent: number;
};

export type Action = {
  action_id: string;
  timestamp: string;
  type: string;
  description: string;
  status: "pending" | "executing" | "completed" | "failed";
  result?: string;
  error?: string;
  duration_ms?: number;
};

export const COLLECTIONS = [
  "jarvis_personality",
  "jarvis_memory",
  "jarvis_learning",
  "jarvis_kb",
  "jarvis_inference",
] as const;

export type CollectionName = (typeof COLLECTIONS)[number];
