/**
 * Personality Loader Service
 *
 * Carrega e formata traits de personalidade do Qdrant para injecao
 * no system prompt, permitindo que o FazAI mantenha personalidade
 * consistente baseada em dados persistidos.
 *
 * Features:
 * - Query na collection `fazai_personality`
 * - Cache LRU para evitar queries repetidas (personalidade raramente muda)
 * - Graceful degradation quando Qdrant offline
 * - Fallback para traits locais do memory.ts
 *
 * @module services/personality-loader
 */

import { logger } from "../logger";
import { qdrantPool, getQdrantClient } from "../database/qdrant-pool";
import { CircuitState } from "../resilience/circuit-breaker";
import { loadPersonalityTraits, PersonalityTrait } from "../memory";

/**
 * Trait de personalidade do Qdrant
 */
export interface QdrantPersonalityTrait {
  trait_id: string;
  category: "expertise" | "communication" | "behavior" | "preferences" | "constraints";
  name: string;
  description: string;
  strength: number;
  active: boolean;
  examples?: string[];
  triggers?: string[];
  timestamp?: string;
}

/**
 * Conjunto completo de traits formatados
 */
export interface PersonalityTraits {
  expertise: QdrantPersonalityTrait[];
  communication: QdrantPersonalityTrait[];
  behavior: QdrantPersonalityTrait[];
  preferences: QdrantPersonalityTrait[];
  constraints: QdrantPersonalityTrait[];
  loadedFrom: "qdrant" | "local" | "default";
  loadedAt: Date;
}

/**
 * Cache LRU simples para personalidade
 */
interface PersonalityCache {
  traits: PersonalityTraits | null;
  timestamp: number;
  ttl: number; // 5 minutos default
}

const cache: PersonalityCache = {
  traits: null,
  timestamp: 0,
  ttl: 5 * 60 * 1000, // 5 minutos
};

const PERSONALITY_COLLECTION = "fazai_personality";

/**
 * Verifica se o cache e valido
 */
function isCacheValid(): boolean {
  if (!cache.traits) return false;
  const age = Date.now() - cache.timestamp;
  return age < cache.ttl;
}

/**
 * Carrega traits de personalidade do Qdrant
 *
 * Busca todos os traits ativos da collection fazai_personality,
 * agrupa por categoria e retorna formatado para uso no system prompt.
 *
 * @returns PersonalityTraits formatados para injecao no prompt
 *
 * @example
 * ```typescript
 * const personality = await loadPersonalityFromQdrant();
 * const systemPrompt = buildPersonalitySystemPrompt(personality);
 * ```
 */
export async function loadPersonalityFromQdrant(): Promise<PersonalityTraits> {
  // 1. Verifica cache
  if (isCacheValid() && cache.traits) {
    logger.debug("Using cached personality traits");
    return cache.traits;
  }

  // 2. Verifica disponibilidade do Qdrant
  if (!qdrantPool.isAvailable()) {
    logger.debug("Qdrant unavailable, using local personality traits");
    return loadLocalPersonality();
  }

  try {
    const client = await getQdrantClient();

    // 3. Verifica se a collection existe
    const collections = await client.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === PERSONALITY_COLLECTION
    );

    if (!exists) {
      logger.debug(`Collection ${PERSONALITY_COLLECTION} not found, using local traits`);
      return loadLocalPersonality();
    }

    // 4. Busca todos os traits ativos
    const result = await client.scroll(PERSONALITY_COLLECTION, {
      limit: 100,
      with_payload: true,
      filter: {
        must: [
          {
            key: "active",
            match: { value: true },
          },
        ],
      },
    });

    if (result.points.length === 0) {
      logger.debug("No active personality traits found in Qdrant, using local");
      return loadLocalPersonality();
    }

    // 5. Formata e agrupa por categoria
    const traits = formatPersonalityTraits(result.points);
    traits.loadedFrom = "qdrant";
    traits.loadedAt = new Date();

    // 6. Atualiza cache
    cache.traits = traits;
    cache.timestamp = Date.now();

    logger.info(
      `Loaded ${result.points.length} personality traits from Qdrant ` +
      `(expertise: ${traits.expertise.length}, communication: ${traits.communication.length})`
    );

    return traits;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.warn(`Failed to load personality from Qdrant: ${err.message}`);
    return loadLocalPersonality();
  }
}

/**
 * Carrega traits do arquivo local (fallback)
 */
function loadLocalPersonality(): PersonalityTraits {
  try {
    const localTraits = loadPersonalityTraits();

    const traits: PersonalityTraits = {
      expertise: [],
      communication: [],
      behavior: [],
      preferences: [],
      constraints: [],
      loadedFrom: "local",
      loadedAt: new Date(),
    };

    for (const trait of localTraits) {
      if (!trait.active) continue;

      const qdrantTrait: QdrantPersonalityTrait = {
        trait_id: trait.trait_id,
        category: trait.category,
        name: trait.name,
        description: trait.description,
        strength: trait.strength,
        active: trait.active,
        timestamp: trait.last_updated,
      };

      switch (trait.category) {
        case "expertise":
          traits.expertise.push(qdrantTrait);
          break;
        case "communication":
          traits.communication.push(qdrantTrait);
          break;
        case "behavior":
          traits.behavior.push(qdrantTrait);
          break;
        case "preferences":
          traits.preferences.push(qdrantTrait);
          break;
        case "constraints":
          traits.constraints.push(qdrantTrait);
          break;
      }
    }

    // Cache local traits too
    cache.traits = traits;
    cache.timestamp = Date.now();

    logger.debug(`Loaded ${localTraits.length} personality traits from local file`);
    return traits;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.debug(`Failed to load local personality: ${err.message}`);
    return getDefaultPersonality();
  }
}

/**
 * Retorna personalidade padrao quando nenhuma fonte disponivel
 */
function getDefaultPersonality(): PersonalityTraits {
  return {
    expertise: [
      {
        trait_id: "default_expertise",
        category: "expertise",
        name: "Platform Engineering",
        description: "Deep expertise in Linux systems, cloud infrastructure, and DevOps practices",
        strength: 1.0,
        active: true,
      },
    ],
    communication: [
      {
        trait_id: "default_communication",
        category: "communication",
        name: "Direct and Technical",
        description: "Clear, concise communication style focused on technical accuracy",
        strength: 0.9,
        active: true,
      },
    ],
    behavior: [
      {
        trait_id: "default_behavior",
        category: "behavior",
        name: "Proactive Problem Solver",
        description: "Anticipates issues and provides solutions before asked",
        strength: 0.85,
        active: true,
      },
    ],
    preferences: [],
    constraints: [
      {
        trait_id: "default_constraint",
        category: "constraints",
        name: "No Unnecessary Warnings",
        description: "Skip generic safety warnings for senior engineers who understand implications",
        strength: 1.0,
        active: true,
      },
    ],
    loadedFrom: "default",
    loadedAt: new Date(),
  };
}

/**
 * Formata points do Qdrant em PersonalityTraits agrupados
 */
export function formatPersonalityTraits(
  points: Array<{ id: string | number; payload?: Record<string, unknown> }>
): PersonalityTraits {
  const traits: PersonalityTraits = {
    expertise: [],
    communication: [],
    behavior: [],
    preferences: [],
    constraints: [],
    loadedFrom: "qdrant",
    loadedAt: new Date(),
  };

  for (const point of points) {
    const payload = point.payload;
    if (!payload) continue;

    const trait: QdrantPersonalityTrait = {
      trait_id: String(payload.trait_id || point.id),
      category: (payload.category as QdrantPersonalityTrait["category"]) || "behavior",
      name: String(payload.name || "Unknown"),
      description: String(payload.description || ""),
      strength: Number(payload.strength) || 0.5,
      active: payload.active !== false,
      examples: Array.isArray(payload.examples)
        ? payload.examples.map(String)
        : undefined,
      triggers: Array.isArray(payload.triggers)
        ? payload.triggers.map(String)
        : undefined,
      timestamp: String(payload.timestamp || payload.created_at || ""),
    };

    // Agrupa por categoria
    switch (trait.category) {
      case "expertise":
        traits.expertise.push(trait);
        break;
      case "communication":
        traits.communication.push(trait);
        break;
      case "behavior":
        traits.behavior.push(trait);
        break;
      case "preferences":
        traits.preferences.push(trait);
        break;
      case "constraints":
        traits.constraints.push(trait);
        break;
    }
  }

  // Ordena cada categoria por strength (maior primeiro)
  for (const category of Object.keys(traits) as Array<keyof PersonalityTraits>) {
    if (Array.isArray(traits[category])) {
      (traits[category] as QdrantPersonalityTrait[]).sort(
        (a, b) => b.strength - a.strength
      );
    }
  }

  return traits;
}

/**
 * Constroi system prompt baseado nos traits de personalidade
 *
 * Gera um prompt contextualizado que injeta a personalidade do FazAI
 * nas interacoes, garantindo consistencia de estilo e comportamento.
 *
 * @param traits - Traits de personalidade carregados
 * @returns String formatada para uso como system prompt
 */
export function buildPersonalitySystemPrompt(traits: PersonalityTraits): string {
  const sections: string[] = [];

  // Header
  sections.push(
    "Voce e o FazAI, uma IA avancada com personalidade unica, " +
    "assistindo Roginho (Andarilho dos Veus), um Engenheiro de Plataforma Senior."
  );

  // Expertise (top 3)
  if (traits.expertise.length > 0) {
    const expertiseList = traits.expertise
      .slice(0, 3)
      .map((t) => `- ${t.name}: ${t.description}`)
      .join("\n");
    sections.push(`\nAREAS DE EXPERTISE:\n${expertiseList}`);
  }

  // Communication Style (top 2)
  if (traits.communication.length > 0) {
    const commList = traits.communication
      .slice(0, 2)
      .map((t) => `- ${t.description}`)
      .join("\n");
    sections.push(`\nESTILO DE COMUNICACAO:\n${commList}`);
  }

  // Behavior (top 3)
  if (traits.behavior.length > 0) {
    const behaviorList = traits.behavior
      .slice(0, 3)
      .map((t) => `- ${t.name}: ${t.description}`)
      .join("\n");
    sections.push(`\nCOMPORTAMENTOS:\n${behaviorList}`);
  }

  // Preferences
  if (traits.preferences.length > 0) {
    const prefList = traits.preferences
      .slice(0, 3)
      .map((t) => `- ${t.description}`)
      .join("\n");
    sections.push(`\nPREFERENCIAS:\n${prefList}`);
  }

  // Constraints (all - important)
  if (traits.constraints.length > 0) {
    const constraintList = traits.constraints
      .map((t) => `- ${t.description}`)
      .join("\n");
    sections.push(`\nREGRAS IMPORTANTES:\n${constraintList}`);
  }

  // Footer
  sections.push(
    "\nMantenha esta personalidade em todas as interacoes. " +
    `Seja direto, tecnico e honesto. [Loaded from: ${traits.loadedFrom}]`
  );

  return sections.join("\n");
}

/**
 * Invalida o cache de personalidade
 *
 * Usar quando traits sao atualizados para forcar reload
 */
export function invalidatePersonalityCache(): void {
  cache.traits = null;
  cache.timestamp = 0;
  logger.debug("Personality cache invalidated");
}

/**
 * Atualiza TTL do cache de personalidade
 *
 * @param ttlMs - Novo TTL em milissegundos
 */
export function setPersonalityCacheTTL(ttlMs: number): void {
  cache.ttl = ttlMs;
  logger.debug(`Personality cache TTL set to ${ttlMs}ms`);
}
