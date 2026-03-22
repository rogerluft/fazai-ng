/**
 * SkillRegistry Test Suite — Phase 3
 *
 * Tests cover:
 * - Skill registration and CRUD operations
 * - Auto-discovery from genaisrc/ directory
 * - Permission and category filtering
 * - Execution with handlers
 * - Context generation for assembly
 * - Singleton pattern
 * - Formatted output
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SkillRegistry,
  getSkillRegistry,
  type SkillDefinition,
  type SkillResult,
} from "../src/skills/registry.js";

// ─── Helpers ───────────────────────────────────────────────────────────

function createMockSkill(overrides: Partial<SkillDefinition> = {}): SkillDefinition {
  return {
    id: overrides.id || "test-skill",
    name: overrides.name || "Test Skill",
    description: overrides.description || "A test skill",
    inputSchema: overrides.inputSchema || { type: "object", properties: {} },
    handler: overrides.handler || (async () => ({
      success: true,
      output: "ok",
      duration: 10,
    })),
    permissionLevel: overrides.permissionLevel || "low",
    category: overrides.category || "system",
    source: overrides.source || "builtin",
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────

describe("SkillRegistry", () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry();
  });

  describe("register", () => {
    it("should register a skill", () => {
      const skill = createMockSkill({ id: "my-skill" });
      registry.register(skill);
      expect(registry.has("my-skill")).toBe(true);
      expect(registry.count()).toBe(1);
    });

    it("should overwrite existing skill with same ID", () => {
      registry.register(createMockSkill({ id: "x", name: "Old" }));
      registry.register(createMockSkill({ id: "x", name: "New" }));
      expect(registry.count()).toBe(1);
      expect(registry.get("x")?.name).toBe("New");
    });
  });

  describe("unregister", () => {
    it("should remove a registered skill", () => {
      registry.register(createMockSkill({ id: "rm-me" }));
      expect(registry.unregister("rm-me")).toBe(true);
      expect(registry.has("rm-me")).toBe(false);
      expect(registry.count()).toBe(0);
    });

    it("should return false for unknown skill", () => {
      expect(registry.unregister("nonexistent")).toBe(false);
    });
  });

  describe("get", () => {
    it("should return the skill by ID", () => {
      registry.register(createMockSkill({ id: "find-me" }));
      expect(registry.get("find-me")?.id).toBe("find-me");
    });

    it("should return undefined for unknown ID", () => {
      expect(registry.get("missing")).toBeUndefined();
    });
  });

  describe("list", () => {
    beforeEach(() => {
      registry.register(createMockSkill({
        id: "s1", category: "system", permissionLevel: "low", source: "builtin",
      }));
      registry.register(createMockSkill({
        id: "s2", category: "analysis", permissionLevel: "medium", source: "genaisrc",
      }));
      registry.register(createMockSkill({
        id: "s3", category: "system", permissionLevel: "high", source: "runtime",
      }));
    });

    it("should list all skills", () => {
      expect(registry.list()).toHaveLength(3);
    });

    it("should filter by category", () => {
      const result = registry.list({ category: "system" });
      expect(result).toHaveLength(2);
      expect(result.every((s) => s.category === "system")).toBe(true);
    });

    it("should filter by permissionLevel", () => {
      const result = registry.list({ permissionLevel: "medium" });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("s2");
    });

    it("should filter by source", () => {
      const result = registry.list({ source: "genaisrc" });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("s2");
    });

    it("should sort by category then name", () => {
      const result = registry.list();
      // analysis comes before system alphabetically
      expect(result[0].category).toBe("analysis");
    });
  });

  describe("execute", () => {
    it("should execute a skill handler", async () => {
      const handler = vi.fn(async (): Promise<SkillResult> => ({
        success: true,
        output: "done",
        duration: 0,
      }));

      registry.register(createMockSkill({ id: "exec-test", handler }));
      const result = await registry.execute("exec-test", { mode: "fast" });

      expect(result.success).toBe(true);
      expect(result.output).toBe("done");
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(handler).toHaveBeenCalledWith({ mode: "fast" });
    });

    it("should return error for unknown skill", async () => {
      const result = await registry.execute("unknown");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should catch handler errors", async () => {
      registry.register(createMockSkill({
        id: "fail-test",
        handler: async () => { throw new Error("Boom"); },
      }));

      const result = await registry.execute("fail-test");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Boom");
    });
  });

  describe("getSkillContext", () => {
    it("should generate context string for a skill", () => {
      registry.register(createMockSkill({
        id: "ctx-skill",
        name: "Context Skill",
        description: "For testing context gen",
        category: "analysis",
        permissionLevel: "medium",
        source: "genaisrc",
        model: "ollama:phi3",
      }));

      const ctx = registry.getSkillContext("ctx-skill");
      expect(ctx).toContain("Context Skill");
      expect(ctx).toContain("ctx-skill");
      expect(ctx).toContain("For testing context gen");
      expect(ctx).toContain("analysis");
      expect(ctx).toContain("medium");
      expect(ctx).toContain("genaisrc");
      expect(ctx).toContain("ollama:phi3");
    });

    it("should return empty string for unknown skill", () => {
      expect(registry.getSkillContext("none")).toBe("");
    });
  });

  describe("formatSkillList", () => {
    it("should format empty registry", () => {
      expect(registry.formatSkillList()).toContain("No skills registered");
    });

    it("should format skills with categories and icons", () => {
      registry.register(createMockSkill({
        id: "cleaner",
        name: "Maestro Cleaner",
        description: "Cleanup tool",
        category: "system",
        permissionLevel: "high",
      }));
      registry.register(createMockSkill({
        id: "reflect",
        name: "Reflect",
        description: "Self-reflection",
        category: "analysis",
        permissionLevel: "low",
      }));

      const output = registry.formatSkillList();
      expect(output).toContain("SYSTEM");
      expect(output).toContain("ANALYSIS");
      expect(output).toContain("cleaner");
      expect(output).toContain("reflect");
    });
  });
});

describe("getSkillRegistry singleton", () => {
  it("should return the same instance", () => {
    const r1 = getSkillRegistry();
    const r2 = getSkillRegistry();
    expect(r1).toBe(r2);
  });
});
