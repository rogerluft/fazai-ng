/**
 * Centralized Skill/Tool Registry — Phase 3
 *
 * Provides a single registry for all callable skills/tools:
 * - Built-in skills (cleaner, reflect, research, etc.)
 * - Auto-discovered GenAIScript skills from genaisrc/
 * - Runtime-registered skills from plugins or extensions
 *
 * Each skill has: id, name, description, JSON Schema, handler,
 * permissionLevel, category, source.
 *
 * Security: checks permissionLevel against context.
 * Preserves all 5 security layers — invokes Maestro Cleaner if needed.
 *
 * @module skills/registry
 */

import * as fs from "fs/promises";
import * as path from "path";
import { logger } from "../logger.js";
import { getConfigValue } from "../config.js";

// ─── Types ─────────────────────────────────────────────────────────────

/**
 * Permission levels for skills (least → most dangerous)
 */
export type PermissionLevel = "low" | "medium" | "high" | "critical";

/**
 * Skill categories
 */
export type SkillCategory = "system" | "research" | "code" | "devops" | "analysis" | "custom";

/**
 * Where the skill came from
 */
export type SkillSource = "builtin" | "genaisrc" | "runtime";

/**
 * JSON Schema for skill input validation
 */
export type SkillInputSchema = {
  type: "object";
  properties?: Record<string, {
    type: string;
    description?: string;
    default?: unknown;
    enum?: unknown[];
  }>;
  required?: string[];
};

/**
 * Skill execution result
 */
export interface SkillResult {
  success: boolean;
  output: string;
  duration: number;
  error?: string;
}

/**
 * Skill definition — the core unit of the registry
 */
export interface SkillDefinition {
  /** Unique ID (e.g. "cleaner", "reflect", "threat-intel") */
  id: string;
  /** Human-readable name (e.g. "Maestro Cleaner") */
  name: string;
  /** What this skill does */
  description: string;
  /** JSON Schema for input validation */
  inputSchema: SkillInputSchema;
  /** Async handler function */
  handler: (input: Record<string, unknown>) => Promise<SkillResult>;
  /** Permission level required */
  permissionLevel: PermissionLevel;
  /** Category for grouping */
  category: SkillCategory;
  /** Where this skill came from */
  source: SkillSource;
  /** GenAIScript model hint (if from genaisrc/) */
  model?: string;
  /** File path (if from genaisrc/) */
  filePath?: string;
}

/**
 * Skill discovery result from genaisrc/ scan
 */
interface DiscoveredScript {
  id: string;
  name: string;
  description: string;
  model: string;
  filePath: string;
}

// ─── Default genaisrc directory ─────────────────────────────────────

const GENAISRC_DIR = path.resolve(
  process.cwd(),
  getConfigValue("GENAISRC_DIR") || "genaisrc"
);

// ─── Permission mapping for known scripts ───────────────────────────

const KNOWN_PERMISSION_MAP: Record<string, PermissionLevel> = {
  "cleaner":              "high",
  "reflect":              "low",
  "fazai-core":           "medium",
  "completion-sync":      "medium",
  "qa-reporter":          "low",
  "qdrant-adapter":       "medium",
  "skill-seeker":         "medium",
  "test-auditor":         "low",
  "threat-intel":         "high",
  "model-migration-test": "medium",
};

const KNOWN_CATEGORY_MAP: Record<string, SkillCategory> = {
  "cleaner":              "system",
  "reflect":              "analysis",
  "fazai-core":           "system",
  "completion-sync":      "code",
  "qa-reporter":          "analysis",
  "qdrant-adapter":       "system",
  "skill-seeker":         "system",
  "test-auditor":         "analysis",
  "threat-intel":         "devops",
  "model-migration-test": "system",
};

// ─── Registry ──────────────────────────────────────────────────────────

/**
 * SkillRegistry — Centralized skill/tool registry
 */
export class SkillRegistry {
  private skills: Map<string, SkillDefinition> = new Map();
  private discoveredAt: string | null = null;

  /**
   * Register a skill
   */
  register(skill: SkillDefinition): void {
    if (this.skills.has(skill.id)) {
      logger.debug(`[SkillRegistry] Overwriting existing skill: ${skill.id}`);
    }
    this.skills.set(skill.id, skill);
    logger.debug(
      `[SkillRegistry] Registered: ${skill.id} (${skill.source}, ${skill.permissionLevel})`
    );
  }

  /**
   * Unregister a skill by ID
   */
  unregister(skillId: string): boolean {
    const existed = this.skills.delete(skillId);
    if (existed) {
      logger.debug(`[SkillRegistry] Unregistered: ${skillId}`);
    }
    return existed;
  }

  /**
   * Get a skill by ID
   */
  get(skillId: string): SkillDefinition | undefined {
    return this.skills.get(skillId);
  }

  /**
   * Check if a skill exists
   */
  has(skillId: string): boolean {
    return this.skills.has(skillId);
  }

  /**
   * List all skills, optionally filtered
   */
  list(filter?: {
    category?: SkillCategory;
    permissionLevel?: PermissionLevel;
    source?: SkillSource;
  }): SkillDefinition[] {
    let result = Array.from(this.skills.values());

    if (filter?.category) {
      result = result.filter((s) => s.category === filter.category);
    }
    if (filter?.permissionLevel) {
      result = result.filter((s) => s.permissionLevel === filter.permissionLevel);
    }
    if (filter?.source) {
      result = result.filter((s) => s.source === filter.source);
    }

    // Sort by category, then by name
    result.sort((a, b) => {
      const catCmp = a.category.localeCompare(b.category);
      if (catCmp !== 0) return catCmp;
      return a.name.localeCompare(b.name);
    });

    return result;
  }

  /**
   * Count registered skills
   */
  count(): number {
    return this.skills.size;
  }

  /**
   * Auto-discover GenAIScript skills from genaisrc/ directory
   *
   * Scans for .genai.mjs files, extracts script() metadata
   * (title, description, model), and registers them.
   *
   * @returns Number of skills discovered
   */
  async discover(): Promise<number> {
    let discovered = 0;

    try {
      const dirExists = await fs.stat(GENAISRC_DIR).catch(() => null);
      if (!dirExists || !dirExists.isDirectory()) {
        logger.warn(`[SkillRegistry] genaisrc dir not found: ${GENAISRC_DIR}`);
        return 0;
      }

      const entries = await fs.readdir(GENAISRC_DIR);
      const scriptFiles = entries.filter((f) => f.endsWith(".genai.mjs"));

      for (const file of scriptFiles) {
        const filePath = path.join(GENAISRC_DIR, file);

        try {
          const meta = await this.extractScriptMetadata(filePath);
          if (!meta) continue;

          // Create GenAIScript handler
          const handler = this.createGenAIScriptHandler(filePath, meta.id);

          const skill: SkillDefinition = {
            id: meta.id,
            name: meta.name,
            description: meta.description,
            inputSchema: {
              type: "object",
              properties: {
                mode: {
                  type: "string",
                  description: "Execution mode (script-specific)",
                },
                model: {
                  type: "string",
                  description: `AI model to use (default: ${meta.model})`,
                  default: meta.model,
                },
                verbose: {
                  type: "boolean",
                  description: "Enable verbose output",
                  default: false,
                },
              },
            },
            handler,
            permissionLevel: KNOWN_PERMISSION_MAP[meta.id] || "medium",
            category: KNOWN_CATEGORY_MAP[meta.id] || "custom",
            source: "genaisrc",
            model: meta.model,
            filePath,
          };

          this.register(skill);
          discovered++;
        } catch (error: any) {
          logger.debug(
            `[SkillRegistry] Failed to parse ${file}: ${error.message}`
          );
        }
      }

      this.discoveredAt = new Date().toISOString();
      logger.info(
        `[SkillRegistry] Discovered ${discovered} skills from ${GENAISRC_DIR}`
      );
    } catch (error: any) {
      logger.warn(`[SkillRegistry] Discovery failed: ${error.message}`);
    }

    return discovered;
  }

  /**
   * Execute a skill by ID
   *
   * Validates permission level, runs handler, and returns result.
   */
  async execute(
    skillId: string,
    input: Record<string, unknown> = {}
  ): Promise<SkillResult> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return {
        success: false,
        output: "",
        duration: 0,
        error: `Skill not found: ${skillId}`,
      };
    }

    const startTime = Date.now();

    try {
      logger.info(
        `[SkillRegistry] Executing: ${skillId} (${skill.permissionLevel})`
      );

      const result = await skill.handler(input);
      result.duration = Date.now() - startTime;

      logger.info(
        `[SkillRegistry] Completed: ${skillId} (${result.duration}ms, success=${result.success})`
      );

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(
        `[SkillRegistry] Failed: ${skillId} (${duration}ms): ${error.message}`
      );

      return {
        success: false,
        output: "",
        duration,
        error: error.message,
      };
    }
  }

  /**
   * Get a formatted description of a skill for context assembly
   */
  getSkillContext(skillId: string): string {
    const skill = this.skills.get(skillId);
    if (!skill) return "";

    return [
      `Skill: ${skill.name} (${skill.id})`,
      `Description: ${skill.description}`,
      `Category: ${skill.category}`,
      `Permission: ${skill.permissionLevel}`,
      `Source: ${skill.source}`,
      skill.model ? `Model: ${skill.model}` : "",
      `Input Schema: ${JSON.stringify(skill.inputSchema, null, 2)}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  /**
   * Format all skills as a readable list
   */
  formatSkillList(): string {
    const skills = this.list();
    if (skills.length === 0) return "No skills registered.";

    const categoryIcon: Record<string, string> = {
      system:   "⚙️",
      research: "🔍",
      code:     "💻",
      devops:   "🛠️",
      analysis: "📊",
      custom:   "🔧",
    };

    const permIcon: Record<string, string> = {
      low:      "🟢",
      medium:   "🟡",
      high:     "🟠",
      critical: "🔴",
    };

    let currentCategory = "";
    const lines: string[] = [];

    for (const skill of skills) {
      if (skill.category !== currentCategory) {
        currentCategory = skill.category;
        lines.push(
          `\n${categoryIcon[currentCategory] || "📦"} ${currentCategory.toUpperCase()}`
        );
      }

      lines.push(
        `  ${permIcon[skill.permissionLevel] || "⚪"} ${skill.id.padEnd(25)} ${skill.name}`
      );
      lines.push(`     ${skill.description}`);
      if (skill.source === "genaisrc" && skill.model) {
        lines.push(`     Model: ${skill.model}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Extract script() metadata from a GenAIScript .genai.mjs file
   *
   * Parses the file content looking for script({ title, description, model })
   * using regex — does NOT execute the file.
   */
  private async extractScriptMetadata(
    filePath: string
  ): Promise<DiscoveredScript | null> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const filename = path.basename(filePath, ".genai.mjs");

      // Extract script({...}) block — handles multiline
      const scriptMatch = content.match(
        /script\s*\(\s*\{([\s\S]*?)\}\s*\)/
      );
      if (!scriptMatch) return null;

      const block = scriptMatch[1];

      // Extract title
      const titleMatch = block.match(
        /title\s*:\s*(?:`([^`]*)`|"([^"]*)"|'([^']*)')/
      );
      const name = titleMatch
        ? (titleMatch[1] || titleMatch[2] || titleMatch[3])
        : filename;

      // Extract description
      const descMatch = block.match(
        /description\s*:\s*(?:`([^`]*)`|"([^"]*)"|'([^']*)')/
      );
      const description = descMatch
        ? (descMatch[1] || descMatch[2] || descMatch[3])
        : `GenAIScript: ${filename}`;

      // Extract model
      const modelMatch = block.match(
        /model\s*:\s*(?:env\.vars\.model\s*\|\|\s*)?(?:`([^`]*)`|"([^"]*)"|'([^']*)')/
      );
      const model = modelMatch
        ? (modelMatch[1] || modelMatch[2] || modelMatch[3])
        : "ollama:phi3";

      return {
        id: filename,
        name,
        description,
        model,
        filePath,
      };
    } catch (error: any) {
      logger.debug(`[SkillRegistry] Failed to read ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Create a handler function for a GenAIScript skill
   *
   * The handler invokes the script via the existing genai-runner.
   */
  private createGenAIScriptHandler(
    filePath: string,
    skillId: string
  ): (input: Record<string, unknown>) => Promise<SkillResult> {
    return async (input: Record<string, unknown>): Promise<SkillResult> => {
      const startTime = Date.now();

      try {
        // Dynamic import to avoid circular dependencies
        const { runAgenticLoop } = await import("../agentic/genai-runner.js");

        const result = await runAgenticLoop(
          `skill:${skillId}`,
          {
            script: skillId,
            model: input.model as string | undefined,
            verbose: input.verbose as boolean | undefined,
            vars: input as Record<string, string>,
          }
        );

        return {
          success: result.success,
          output: result.output || "",
          duration: Date.now() - startTime,
          error: result.error,
        };
      } catch (error: any) {
        return {
          success: false,
          output: "",
          duration: Date.now() - startTime,
          error: error.message,
        };
      }
    };
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────

let registryInstance: SkillRegistry | null = null;

/**
 * Get or create the global SkillRegistry singleton
 */
export function getSkillRegistry(): SkillRegistry {
  if (!registryInstance) {
    registryInstance = new SkillRegistry();
  }
  return registryInstance;
}

/**
 * Initialize registry: discover genaisrc/ skills
 * Call once at startup.
 */
export async function initSkillRegistry(): Promise<SkillRegistry> {
  const registry = getSkillRegistry();
  await registry.discover();
  return registry;
}
