/**
 * Claude Converter Skill Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as path from "path";

// ─── Hoisted mocks ─────────────────────────────────────────────────────
const { mockSkillRegistry } = vi.hoisted(() => {
  return {
    mockSkillRegistry: {
      discover: vi.fn().mockResolvedValue(1),
    },
  };
});

// ─── Mock fs ───────────────────────────────────────────────────────────
vi.mock("fs/promises", () => ({
  stat: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

// ─── Mock registry ─────────────────────────────────────────────────────
vi.mock("../../../src/skills/registry.js", () => {
  return {
    getSkillRegistry: vi.fn(() => mockSkillRegistry),
  };
});

// ─── Mock logger & config ─────────────────────────────────────────────
vi.mock("../../../src/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../../src/config.js", () => ({
  getConfigValue: vi.fn().mockReturnValue("genaisrc"),
}));

import { claudeConverterSkill } from "../../../src/skills/claude-converter";
import * as fs from "fs/promises";

describe("Claude Converter Skill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handler", () => {
    it("should return error if targetPath is missing", async () => {
      const result = await claudeConverterSkill.handler({});
      expect(result.success).toBe(false);
      expect(result.error).toContain("targetPath is required");
    });

    it("should return error if path does not exist", async () => {
      (fs.stat as any).mockRejectedValue(new Error("ENOENT"));
      
      const result = await claudeConverterSkill.handler({ targetPath: "/fake/path" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Path not found");
    });

    it("should successfully convert a valid SKILL.md", async () => {
      // Setup mocks
      const skillContent = `---
name: Test Skill
description: A test skill
model: ollama:llama3
---
Wait for a prompt.
Do a \`thing\`.
`;

      (fs.stat as any).mockImplementation((p: string) => {
        if (p.endsWith("SKILL.md")) {
          return Promise.resolve({ isDirectory: () => false }); // It's a file
        }
        if (p.includes(".genai.mjs")) {
          return Promise.reject(new Error("ENOENT")); // Target doesn't exist
        }
        return Promise.resolve({ isDirectory: () => true }); // Root is dir
      });

      (fs.readFile as any).mockResolvedValue(skillContent);
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);

      const result = await claudeConverterSkill.handler({ targetPath: "./test-skill" });

      expect(result.success).toBe(true);
      expect(result.output).toContain("Successfully converted");
      expect(result.output).toContain("test-skill");

      // Verify fs.writeFile was called with correct path and content
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      const callArgs = (fs.writeFile as any).mock.calls[0];
      const outPath = callArgs[0] as string;
      const outContent = callArgs[1] as string;

      expect(outPath.endsWith("test-skill.genai.mjs")).toBe(true);
      expect(outContent).toContain('title: "Test Skill"');
      expect(outContent).toContain('description: "A test skill"');
      expect(outContent).toContain('model: env.vars.model || "ollama:llama3"');
      expect(outContent).toContain("Wait for a prompt.");
      expect(outContent).toContain("Do a \\`thing\\`."); // Check escaped backticks
      
      // Verify registry was asked to rediscover
      expect(mockSkillRegistry.discover).toHaveBeenCalledTimes(1);
    });

    it("should handle missing frontmatter gracefully", async () => {
      const skillContent = `Just instructions without frontmatter.`;

      (fs.stat as any).mockImplementation((p: string) => {
        if (p.endsWith("SKILL.md")) return Promise.resolve({ isDirectory: () => false });
        return Promise.resolve({ isDirectory: () => true });
      });

      (fs.readFile as any).mockResolvedValue(skillContent);

      const result = await claudeConverterSkill.handler({ targetPath: "./bad-skill" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing name or description");
    });

    it("should skip if the .genai.mjs file already exists (idempotency)", async () => {
      const skillContent = `---
name: Existing Skill
description: Exists
---
Instructions`;

      (fs.stat as any).mockImplementation((p: string) => {
        if (p.endsWith("SKILL.md")) return Promise.resolve({ isDirectory: () => false });
        // Simulate existing .genai.mjs file
        if (p.includes("existing-skill.genai.mjs")) return Promise.resolve({});
        return Promise.resolve({ isDirectory: () => true });
      });

      (fs.readFile as any).mockResolvedValue(skillContent);
      (fs.mkdir as any).mockResolvedValue(undefined);

      const result = await claudeConverterSkill.handler({ targetPath: "./existing" });

      expect(result.success).toBe(true);
      expect(result.output).toContain("already exists");
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });
});
