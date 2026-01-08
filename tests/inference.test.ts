/**
 * Inference Command Tests
 *
 * Testa o comando de gerenciamento de conhecimento injetado pelo usuário.
 *
 * @module tests/inference
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { execSync } from "child_process";

// Mock do Qdrant client
vi.mock("../src/database/qdrant-pool", () => ({
  getQdrantClient: vi.fn().mockResolvedValue({
    upsert: vi.fn().mockResolvedValue({}),
    scroll: vi.fn().mockResolvedValue({ points: [] }),
    delete: vi.fn().mockResolvedValue({}),
    search: vi.fn().mockResolvedValue([]),
  }),
  qdrantPool: { isAvailable: () => true },
}));

describe("Inference Command", () => {
  const runCli = (args: string): string => {
    try {
      return execSync(`node dist/app.js ${args} 2>&1`, {
        encoding: "utf-8",
        timeout: 10000,
      });
    } catch (error: any) {
      return error.stdout || error.message;
    }
  };

  it("fazai inference --help should show inference-specific help", () => {
    const output = runCli("inference --help");
    expect(output.toLowerCase()).toContain("inference");
    expect(output).toContain("add");
    expect(output).toContain("import");
    expect(output).toContain("list");
    expect(output).toContain("search");
    expect(output).not.toContain("fazai [options]");
  });

  it("fazai inference without args should show help", () => {
    const output = runCli("inference");
    expect(output.toLowerCase()).toContain("inference");
    expect(output).toContain("add");
  });

  it("handleInferenceCommand should be importable", async () => {
    const { handleInferenceCommand } = await import("../src/commands/inference");
    expect(handleInferenceCommand).toBeDefined();
    expect(typeof handleInferenceCommand).toBe("function");
  });

  it("should have valid category types", async () => {
    const output = runCli("inference --help");
    expect(output).toContain("doc");
    expect(output).toContain("rule");
    expect(output).toContain("example");
    expect(output).toContain("fact");
  });

  it("should show error for invalid subcommand", () => {
    const output = runCli("inference invalidcmd");
    expect(output.toLowerCase()).toContain("desconhecido");
  });
});
