/**
 * Personality Loader Service
 *
 * Loads and caches personality traits from Qdrant fazai_personality collection.
 * Builds system prompts that inject personality context into LLM calls.
 */

import { getQdrantClient } from "../database/qdrant-pool";
import { logger } from "../logger";
import { withRetry } from "../utils/retry";
import { getConfigValue } from "../config";

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

    // Query fazai_personality collection
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
      logger.warn("⚠️ No personality traits found in Qdrant");
      return getDefaultPersonality();
    }

    // Format traits
    const traits: PersonalityTrait[] = points.map((point: any) => ({
      trait_name: point.payload?.trait_name || "Unknown",
      category: point.payload?.category || "general",
      value: point.payload?.value || "",
      intensity: point.payload?.intensity || 0.5,
      context: point.payload?.context,
      tags: point.payload?.tags || [],
    }));

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
 * Get allowed expertise tags from config or environment.
 * If not configured, returns null (meaning: accept ALL tags).
 */
function getAllowedExpertiseTags(): Set<string> | null {
  // Try config first, then environment variable
  const configTags = getConfigValue<string[]>('personality.expertiseTags');
  const envTagsStr = process.env.FAZAI_EXPERTISE_TAGS;

  let tags: string[] | undefined;

  if (configTags && Array.isArray(configTags)) {
      tags = configTags;
  } else if (envTagsStr) {
      tags = envTagsStr.split(',').map(t => t.trim());
  }

  if (!tags || tags.length === 0) {
    // No filter configured = accept ALL tags
    logger.debug("No expertise tag filter configured, accepting all tags.");
    return null;
  }

  const tagSet = new Set(tags.map(t => t.toLowerCase()));
  logger.debug(`Filtering expertise with ${tagSet.size} allowed tags.`);
  return tagSet;
}


/**
 * Extract expertise areas from traits
 */
function extractExpertise(traits: PersonalityTrait[]): string[] {
  const expertise = new Set<string>();
  const allowedTags = getAllowedExpertiseTags(); // null = accept all

  for (const trait of traits) {
    if (trait.category === "expertise" || trait.category === "domain") {
      expertise.add(trait.value.toLowerCase());
    }

    if (trait.tags) {
      for (const tag of trait.tags) {
        const lowerTag = tag.toLowerCase();
        // If allowedTags is null, accept ALL tags.
        // If allowedTags is defined, only accept matching tags.
        if (!allowedTags || allowedTags.has(lowerTag)) {
          expertise.add(lowerTag);
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
      style.add(trait.value.toLowerCase());
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
    ? `Your key traits:\n${topTraits.map(t => `- ${t.trait_name}: ${t.value} (${t.context || ""})`).join("\n")}`
    : "";

  return `
You are a highly specialized AI assistant. You MUST adopt the following persona for all responses.

${expertiseStr}
${styleStr}

${traitsStr}

CRITICAL: Embody this persona completely. Your responses must originate from these traits. Never break character.
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
