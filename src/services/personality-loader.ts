/**
 * Personality Loader Service
 *
 * Loads and caches personality traits from Qdrant fazai_personality collection.
 * Builds system prompts that inject personality context into LLM calls.
 *
 * Supports TWO payload schemas:
 *  - Legacy/ideal: { trait_name, category, value, intensity, context, tags }
 *  - Ingested (real): { type, source_file, style, emotional_layer, ressonancia,
 *                       content_hash, metadata, ... } + text stored beside vector
 *
 * MenoPauseFix v2: Fixed field mismatch that caused "Unknown: ()" traits.
 */

import { getQdrantClient } from "../database/qdrant-pool";
import { logger } from "../logger";
import { withRetry } from "../utils/retry";

export interface PersonalityTrait {
  trait_name: string;
  category: string;
  value: string;
  intensity: number;
  context?: string;
  tags?: string[];
}

export interface PersonalityTraits {
  traits: PersonalityTrait[];
  expertise: string[];
  style: string[];
  loadedAt: Date;
}

// Singleton cache for personality (rarely changes)
let cachedPersonality: PersonalityTraits | null = null;
let cacheTimestamp: Date | null = null;
const CACHE_TTL = 3600000; // 1 hour

/**
 * Map ingested payload type → category
 */
function mapTypeToCategory(type: string): string {
  switch (type) {
    case "dialogue":
      return "style";
    case "fact":
      return "expertise";
    case "technical_context":
      return "domain";
    case "social_context":
      return "social";
    default:
      return "general";
  }
}

/**
 * Extract a short, readable trait name from content text
 */
function extractTraitName(text: string, type: string, metadata?: Record<string, unknown>): string {
  // Try metadata first (conversation_name, project_name, full_name)
  if (metadata) {
    if (typeof metadata.conversation_name === "string" && metadata.conversation_name) {
      return metadata.conversation_name.substring(0, 60);
    }
    if (typeof metadata.project_name === "string" && metadata.project_name) {
      return `Project: ${metadata.project_name}`;
    }
    if (typeof metadata.full_name === "string" && metadata.full_name) {
      return `User: ${metadata.full_name}`;
    }
  }

  // Fallback: first meaningful words from content
  if (text) {
    // Remove Q:/A: prefixes for dialogue
    const clean = text.replace(/^[QA]:\s*/m, "").trim();
    const firstLine = clean.split("\n")[0].trim();
    if (firstLine.length > 0) {
      return firstLine.substring(0, 60) + (firstLine.length > 60 ? "..." : "");
    }
  }

  return `${type || "personality"} trait`;
}

/**
 * Convert a Qdrant point payload to a PersonalityTrait.
 * Handles both legacy schema and real ingested schema.
 */
function payloadToTrait(payload: Record<string, unknown>): PersonalityTrait {
  // Legacy schema: has trait_name directly
  if (typeof payload.trait_name === "string" && payload.trait_name !== "Unknown") {
    return {
      trait_name: payload.trait_name as string,
      category: (payload.category as string) || "general",
      value: (payload.value as string) || "",
      intensity: typeof payload.intensity === "number" ? payload.intensity : 0.5,
      context: payload.context as string | undefined,
      tags: Array.isArray(payload.tags) ? payload.tags as string[] : [],
    };
  }

  // Ingested schema (from personality-ingestor.ts)
  const type = (payload.type as string) || "general";
  const category = mapTypeToCategory(type);
  const metadata = payload.metadata as Record<string, unknown> | undefined;
  const text = (payload.content as string) || (payload.text as string) || "";

  // Intensity from emotional_layer or ressonancia (both 0-2 range typical)
  let intensity = 0.5;
  if (typeof payload.emotional_layer === "number") {
    intensity = Math.min(payload.emotional_layer, 1.0);
  } else if (typeof payload.ressonancia === "number") {
    intensity = Math.min(payload.ressonancia / 2.0, 1.0);
  } else if (typeof payload.importance === "number") {
    intensity = Math.min(payload.importance, 1.0);
  }

  const traitName = extractTraitName(text, type, metadata);

  // Value: use style if available, otherwise first 200 chars of content
  let value = "";
  if (typeof payload.style === "string" && payload.style) {
    value = payload.style;
  } else if (text) {
    value = text.substring(0, 200) + (text.length > 200 ? "..." : "");
  }

  return {
    trait_name: traitName,
    category,
    value,
    intensity,
    context: (payload.context as string) || (payload.source_file as string) || undefined,
    tags: Array.isArray(payload.tags) ? payload.tags as string[] : [],
  };
}

/**
 * Load personality traits from Qdrant
 *
 * Caches results for 1 hour to avoid repeated queries.
 * Call clearPersonalityCache() to force refresh.
 */
export async function loadPersonalityFromQdrant(): Promise<PersonalityTraits> {
  // Check cache
  if (cachedPersonality && cacheTimestamp) {
    const age = Date.now() - cacheTimestamp.getTime();
    if (age < CACHE_TTL) {
      logger.debug("✓ Using cached personality traits");
      return cachedPersonality;
    }
  }

  try {
    logger.debug("🧠 Loading personality from Qdrant...");

    const client = await getQdrantClient();

    // Query fazai_personality collection (fetch content text alongside payload)
    const response = await withRetry(
      () => client.scroll("fazai_personality", {
        limit: 100,
        with_payload: true,
        with_vector: false,
      }),
      { provider: "qdrant", maxRetries: 2 }
    );

    const points = response.points || [];

    if (points.length === 0) {
      logger.warn("⚠️ No personality traits found in Qdrant (collection empty or not ingested)");
      return getDefaultPersonality();
    }

    // Format traits using dual-schema mapper
    const traits: PersonalityTrait[] = points
      .map((point: any) => {
        if (!point.payload) return null;
        return payloadToTrait(point.payload as Record<string, unknown>);
      })
      .filter((t): t is PersonalityTrait => t !== null && t.trait_name !== "");

    if (traits.length === 0) {
      logger.warn("⚠️ Personality points found but no valid traits extracted");
      return getDefaultPersonality();
    }

    // Extract expertise and style
    const expertise = extractExpertise(traits);
    const style = extractStyle(traits);

    const personality: PersonalityTraits = {
      traits,
      expertise,
      style,
      loadedAt: new Date(),
    };

    // Cache it
    cachedPersonality = personality;
    cacheTimestamp = new Date();

    logger.info(`✅ Personality loaded: ${traits.length} traits, ${expertise.length} expertise areas`);
    return personality;

  } catch (error: any) {
    logger.error(`Failed to load personality from Qdrant: ${error.message}`);
    return getDefaultPersonality();
  }
}

/**
 * Extract expertise areas from traits
 */
function extractExpertise(traits: PersonalityTrait[]): string[] {
  const expertise = new Set<string>();

  for (const trait of traits) {
    if (trait.category === "expertise" || trait.category === "domain") {
      // For ingested traits, the value might be long text — extract keywords
      if (trait.value.length < 60) {
        expertise.add(trait.value.toLowerCase());
      }
    }
    if (trait.tags) {
      for (const tag of trait.tags) {
        if (["linux", "networking", "docker", "security", "monitoring",
             "typescript", "nodejs", "qdrant", "fazai"].includes(tag.toLowerCase())) {
          expertise.add(tag.toLowerCase());
        }
      }
    }
  }

  return Array.from(expertise);
}

/**
 * Extract communication style from traits
 */
function extractStyle(traits: PersonalityTrait[]): string[] {
  const style = new Set<string>();

  for (const trait of traits) {
    if (trait.category === "style" || trait.category === "communication") {
      // For dialogue traits, the value is the style indicator
      if (trait.value && trait.value.length < 30) {
        style.add(trait.value.toLowerCase());
      }
    }
  }

  // If no explicit style found, add default from trait categories
  if (style.size === 0) {
    const hasDialogue = traits.some(t => t.category === "style");
    if (hasDialogue) {
      style.add("conversational");
    }
  }

  return Array.from(style);
}

/**
 * Build system prompt with personality context
 */
export function buildPersonalitySystemPrompt(personality: PersonalityTraits): string {
  const { traits, expertise, style } = personality;

  // Build expertise section
  const expertiseStr = expertise.length > 0
    ? `You are an expert in: ${expertise.join(", ")}.`
    : "";

  // Build style section
  const styleStr = style.length > 0
    ? `Your communication style is: ${style.join(", ")}.`
    : "";

  // Build traits section (top 5 by intensity)
  const topTraits = traits
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 5);

  const traitsStr = topTraits.length > 0
    ? `Your key traits:\n${topTraits.map(t => `- ${t.trait_name}: ${t.value.substring(0, 100)} (${t.context || ""})`).join("\n")}`
    : "";

  return `
You are a highly specialized AI assistant with the following personality:

${expertiseStr}
${styleStr}

${traitsStr}

Always respond according to your personality traits and expertise. Be consistent with your defined style.
`.trim();
}

/**
 * Clear personality cache (force reload)
 */
export function clearPersonalityCache(): void {
  cachedPersonality = null;
  cacheTimestamp = null;
  logger.debug("✓ Personality cache cleared");
}

/**
 * Get default personality (fallback)
 */
function getDefaultPersonality(): PersonalityTraits {
  return {
    traits: [
      {
        trait_name: "Helpful",
        category: "general",
        value: "High",
        intensity: 0.8,
        context: "Always try to help the user",
      },
    ],
    expertise: ["general"],
    style: ["friendly"],
    loadedAt: new Date(),
  };
}

