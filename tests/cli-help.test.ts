/**
 * CLI --help Routing Tests
 *
 * Verifica que --help é roteado corretamente para subcomandos
 * em vez de sempre mostrar o help geral.
 *
 * @module tests/cli-help
 */

import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

describe("CLI --help routing", () => {
  const runCli = (args: string): string => {
    try {
      return execSync(`node dist/app.js ${args} 2>&1`, {
        encoding: "utf-8",
        timeout: 10000,
      });
    } catch (error: any) {
      // Retorna stdout mesmo em caso de exit code não-zero
      return error.stdout || error.message;
    }
  };

  it("fazai --help should show general help", () => {
    const output = runCli("--help");
    expect(output).toContain("fazai [options]");
    expect(output.toLowerCase()).toContain("usage");
  });

  it("fazai -h should show general help", () => {
    const output = runCli("-h");
    expect(output).toContain("fazai [options]");
  });

  it("fazai qdrant --help should show qdrant-specific help", () => {
    const output = runCli("qdrant --help");
    // Deve mostrar help específico do qdrant, não o geral
    expect(output.toLowerCase()).toContain("qdrant");
    // O help específico NÃO deve conter o cabeçalho do help geral
    expect(output).not.toContain("fazai [options]");
  });

  it("fazai vector --help should show vector-specific help", () => {
    const output = runCli("vector --help");
    expect(output.toLowerCase()).toContain("vector");
    expect(output).not.toContain("fazai [options]");
  });

  it("fazai ask --help should show ask-specific help", () => {
    const output = runCli("ask --help");
    expect(output.toLowerCase()).toMatch(/ask|ai|query|prompt/i);
    expect(output).not.toContain("fazai [options]");
  });

  it("fazai index --help should show index-specific help", () => {
    const output = runCli("index --help");
    expect(output.toLowerCase()).toContain("index");
    expect(output).not.toContain("fazai [options]");
  });

  it("fazai sync --help should show sync-specific help", () => {
    const output = runCli("sync --help");
    expect(output.toLowerCase()).toContain("sync");
    expect(output).not.toContain("fazai [options]");
  });

  it("fazai cf --help should show cloudflare-specific help", () => {
    const output = runCli("cf --help");
    expect(output.toLowerCase()).toMatch(/cloudflare|cf|workers|d1/i);
    expect(output).not.toContain("fazai [options]");
  });

  it("fazai without args should show general help", () => {
    const output = runCli("");
    expect(output).toContain("fazai [options]");
  });
});
