/**
 * Vector Store Payload Schemas
 *
 * Zod schemas for validating payloads inserted into Qdrant collections.
 * Ensures data consistency and catches schema violations early.
 *
 * Collections:
 * - fazai_memory: Conversation history and message context
 * - fazai_kb: Knowledge base (Linux/network documentation)
 * - fazai_learning: Learned patterns and error solutions
 * - fazai_personality: AI personality traits and behaviors
 * - fazai_inference: Security policies and operational rules
 */

import { z } from "zod";

/**
 * Common field validators
 */

// Max string lengths to prevent abuse
const MAX_TITLE_LENGTH = 256;
const MAX_SUMMARY_LENGTH = 2000;
const MAX_CONTENT_LENGTH = 50000;
const MAX_TAG_LENGTH = 32;
const MAX_TAGS = 20;
const MAX_COMMAND_LENGTH = 5000;
const MAX_COMMANDS = 50;

// Timestamp validator (ISO 8601)
const timestampSchema = z.string().datetime();

// URL validator (only http/https)
const urlSchema = z
  .string()
  .url()
  .max(2000)
  .refine((url) => {
    try {
      const parsed = new URL(url);
      return ["http:", "https:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  }, "Only HTTP/HTTPS URLs are allowed");

// Tag array validator
const tagsSchema = z
  .array(z.string().max(MAX_TAG_LENGTH).trim())
  .max(MAX_TAGS)
  .optional();

/**
 * fazai_memory: Conversation history
 *
 * Stores message-level context from conversations
 */
export const FazaiMemorySchema = z.object({
  /**
   * Unique conversation identifier
   */
  conversation_id: z.string().max(64).trim(),

  /**
   * Message index within conversation
   */
  message_id: z.number().int().nonnegative(),

  /**
   * Message role
   */
  role: z.enum(["user", "assistant", "system", "autonomous"]),

  /**
   * Timestamp of message (ISO 8601)
   */
  timestamp: timestampSchema,

  /**
   * Full message content
   */
  content: z.string().min(1).max(MAX_CONTENT_LENGTH),

  /**
   * Brief summary of message
   */
  summary: z.string().max(MAX_SUMMARY_LENGTH).optional(),

  /**
   * Emotional context (e.g., "frustrated", "curious", "urgent")
   */
  emotional_context: z.string().max(64).optional(),

  /**
   * Importance score (0-1)
   */
  importance: z.number().min(0).max(1).optional(),

  /**
   * Tags for categorization
   */
  tags: tagsSchema,
});

export type FazaiMemoryPayload = z.infer<typeof FazaiMemorySchema>;

/**
 * fazai_kb: Knowledge Base (V2)
 *
 * Linux/network documentation and technical knowledge.
 * Schema V2 introduces stricter validation and new fields for ECOA compatibility.
 */
export const FazaiKBSchemaV2 = z.object({
  /**
   * Unique slug (URL-friendly ID), must be lowercase with dashes
   */
  slug: z
    .string()
    .max(96)
    .trim()
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),

  /**
   * Knowledge title
   */
  title: z.string().min(5).max(MAX_TITLE_LENGTH).trim(),

  /**
   * Brief summary
   */
  summary: z.string().min(20).max(MAX_SUMMARY_LENGTH),

  /**
   * Full content in Markdown format
   */
  content_markdown: z.string().min(50).max(MAX_CONTENT_LENGTH),

  /**
   * Category (e.g., "networking", "security", "troubleshooting")
   */
  category: z.string().min(3).max(64).trim(),

  /**
   * Scope (e.g., "linux", "debian", "redhat", "general")
   */
  scope: z.string().max(64).optional(),

  /**
   * Linux distribution (if specific)
   */
  linux_distribution: z.string().max(48).optional(),

  /**
   * Component (e.g., "systemd", "nginx", "iptables")
   */
  component: z.string().max(64).optional(),

  /**
   * Related commands with explanations
   */
  commands: z
    .array(
      z.object({
        command: z.string().max(MAX_COMMAND_LENGTH),
        description: z.string().max(500),
      })
    )
    .max(MAX_COMMANDS)
    .optional(),

  /**
   * Source URL (if from external docs)
   */
  source: urlSchema.optional(),

  /**
   * Confidence score (0-1), indicating reliability
   */
  confidence: z.number().min(0).max(1).default(0.8),

  /**
   * Whether this knowledge has been validated by an expert
   */
  validated: z.boolean().default(false),

  /**
   * Version of the knowledge entry
   */
  version: z.number().int().positive().default(1),

  /**
   * Timestamp of creation
   */
  created_at: timestampSchema.default(() => new Date().toISOString()),

  /**
   * Timestamp of last update
   */
  updated_at: timestampSchema.default(() => new Date().toISOString()),

  /**
   * Tags for discoverability
   */
  tags: tagsSchema,
});

export type FazaiKBPayload = z.infer<typeof FazaiKBSchemaV2>;

/**
 * fazai_learning: Learned patterns and solutions
 *
 * Error patterns, validated solutions, and lessons learned
 */
export const FazaiLearningSchema = z.object({
  /**
   * Pattern identifier
   */
  pattern_id: z.string().max(64).trim(),

  /**
   * Pattern title
   */
  title: z.string().min(1).max(MAX_TITLE_LENGTH).trim(),

  /**
   * Problem description
   */
  problem: z.string().min(10).max(MAX_CONTENT_LENGTH),

  /**
   * Solution description
   */
  solution: z.string().min(10).max(MAX_CONTENT_LENGTH),

  /**
   * Error message or pattern
   */
  error_pattern: z.string().max(2000).optional(),

  /**
   * Commands used in solution
   */
  solution_commands: z.array(z.string().max(MAX_COMMAND_LENGTH)).max(MAX_COMMANDS).optional(),

  /**
   * Confidence in solution (0-1)
   */
  confidence: z.number().min(0).max(1),

  /**
   * Number of times this solution was successful
   */
  success_count: z.number().int().nonnegative().optional(),

  /**
   * Timestamp when learned
   */
  learned_at: timestampSchema,

  /**
   * Last time solution was used
   */
  last_used_at: timestampSchema.optional(),

  /**
   * Whether solution has been validated by user
   */
  validated: z.boolean().default(false),

  /**
   * Tags
   */
  tags: tagsSchema,
});

export type FazaiLearningPayload = z.infer<typeof FazaiLearningSchema>;

/**
 * fazai_personality: AI personality traits
 *
 * Behavioral traits, expertise areas, and communication style
 */
export const FazaiPersonalitySchema = z.object({
  /**
   * Trait identifier
   */
  trait_id: z.string().max(64).trim(),

  /**
   * Trait category (e.g., "expertise", "communication", "behavior")
   */
  category: z.enum(["expertise", "communication", "behavior", "preferences", "constraints"]),

  /**
   * Trait name
   */
  name: z.string().min(1).max(128).trim(),

  /**
   * Trait description
   */
  description: z.string().min(10).max(MAX_CONTENT_LENGTH),

  /**
   * Strength of trait (0-1)
   */
  strength: z.number().min(0).max(1),

  /**
   * Whether this trait is active
   */
  active: z.boolean().default(true),

  /**
   * Examples demonstrating this trait
   */
  examples: z.array(z.string().max(1000)).max(10).optional(),

  /**
   * Timestamp when trait was added
   */
  created_at: timestampSchema,

  /**
   * Tags
   */
  tags: tagsSchema,
});

export type FazaiPersonalityPayload = z.infer<typeof FazaiPersonalitySchema>;

/**
 * fazai_inference: Security policies and operational rules
 *
 * Decision-making rules, security constraints, and operational policies
 */
export const FazaiInferenceSchema = z.object({
  /**
   * Rule identifier
   */
  rule_id: z.string().max(64).trim(),

  /**
   * Rule type
   */
  type: z.enum(["security", "operational", "safety", "optimization", "compliance"]),

  /**
   * Rule name
   */
  name: z.string().min(1).max(128).trim(),

  /**
   * Rule description
   */
  description: z.string().min(10).max(MAX_CONTENT_LENGTH),

  /**
   * Rule condition (when to apply)
   */
  condition: z.string().max(2000),

  /**
   * Rule action (what to do)
   */
  action: z.string().max(2000),

  /**
   * Priority (higher = more important)
   */
  priority: z.number().int().min(1).max(100),

  /**
   * Whether rule is enforced (vs advisory)
   */
  enforced: z.boolean().default(true),

  /**
   * Severity level if violated
   */
  severity: z.enum(["low", "medium", "high", "critical"]),

  /**
   * Examples of rule application
   */
  examples: z.array(z.string().max(1000)).max(10).optional(),

  /**
   * Timestamp when rule was created
   */
  created_at: timestampSchema,

  /**
   * Tags
   */
  tags: tagsSchema,
});

export type FazaiInferencePayload = z.infer<typeof FazaiInferenceSchema>;

/**
 * Collection name to schema mapping
 */
export const COLLECTION_SCHEMAS = {
  fazai_memory: FazaiMemorySchema,
  fazai_kb: FazaiKBSchemaV2,
  fazai_learning: FazaiLearningSchema,
  fazai_personality: FazaiPersonalitySchema,
  fazai_inference: FazaiInferenceSchema,
} as const;

export type CollectionName = keyof typeof COLLECTION_SCHEMAS;

/**
 * Validate a payload against its collection schema
 *
 * @param collectionName Collection name
 * @param payload Payload to validate
 * @returns Validated and typed payload
 * @throws ZodError if validation fails
 *
 * @example
 * const validated = validatePayload('fazai_memory', {
 *   conversation_id: 'conv-123',
 *   message_id: 0,
 *   role: 'user',
 *   timestamp: new Date().toISOString(),
 *   content: 'Hello!',
 * });
 */
export function validatePayload<T extends CollectionName>(
  collectionName: T,
  payload: unknown
): z.infer<typeof COLLECTION_SCHEMAS[T]> {
  const schema = COLLECTION_SCHEMAS[collectionName];
  return schema.parse(payload);
}

/**
 * Safe validation (returns result object instead of throwing)
 *
 * @param collectionName Collection name
 * @param payload Payload to validate
 * @returns SafeParseReturnType with success flag and data/error
 *
 * @example
 * const result = safeValidatePayload('fazai_memory', payload);
 * if (result.success) {
 *   console.log('Valid:', result.data);
 * } else {
 *   console.error('Invalid:', result.error.issues);
 * }
 */
export function safeValidatePayload<T extends CollectionName>(
  collectionName: T,
  payload: unknown
): z.SafeParseReturnType<unknown, z.infer<typeof COLLECTION_SCHEMAS[T]>> {
  const schema = COLLECTION_SCHEMAS[collectionName];
  return schema.safeParse(payload);
}

/**
 * Validate multiple payloads
 *
 * @param collectionName Collection name
 * @param payloads Array of payloads to validate
 * @returns Object with valid payloads and errors
 *
 * @example
 * const { valid, errors } = validatePayloads('fazai_memory', [payload1, payload2]);
 * console.log(`Valid: ${valid.length}, Errors: ${errors.length}`);
 */
export function validatePayloads<T extends CollectionName>(
  collectionName: T,
  payloads: unknown[]
): {
  valid: Array<z.infer<typeof COLLECTION_SCHEMAS[T]>>;
  errors: Array<{ index: number; payload: unknown; error: z.ZodError }>;
} {
  const valid: Array<z.infer<typeof COLLECTION_SCHEMAS[T]>> = [];
  const errors: Array<{ index: number; payload: unknown; error: z.ZodError }> = [];

  const schema = COLLECTION_SCHEMAS[collectionName];

  for (let i = 0; i < payloads.length; i++) {
    const result = schema.safeParse(payloads[i]);
    if (result.success) {
      valid.push(result.data);
    } else {
      errors.push({
        index: i,
        payload: payloads[i],
        error: result.error,
      });
    }
  }

  return { valid, errors };
}
