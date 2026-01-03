/**
 * Streaming Parser Validation Tests
 * Ensures LinuxCommandSchema correctly rejects invalid commands
 */

import { describe, it, expect } from "vitest";
import { LinuxCommandSchema } from "../../src/types-linux";

describe("Streaming Parser Validation", () => {
  describe("LinuxCommandSchema", () => {
    it("should reject commands without 'command' field", () => {
      const invalidCmd = {
        explain: "Mostra informações do sistema",
        riskLevel: "low",
        requiresConfirmation: false,
        // missing: command field
      };

      expect(() => LinuxCommandSchema.parse(invalidCmd)).toThrow();
    });

    it("should accept commands with empty 'command' field (schema allows it)", () => {
      // Note: The current schema doesn't have min(1) validation on command
      // This test documents the current behavior
      const emptyCmd = {
        command: "",
        explain: "Comando vazio",
        riskLevel: "low",
        requiresConfirmation: false,
      };

      // Current schema accepts empty strings - this is intentional
      const parsed = LinuxCommandSchema.parse(emptyCmd);
      expect(parsed.command).toBe("");
    });

    it("should accept valid command structure", () => {
      const validCmd = {
        command: "uname -a",
        explain: "Mostra informações do sistema",
        riskLevel: "low",
        requiresConfirmation: false,
      };

      const parsed = LinuxCommandSchema.parse(validCmd);
      expect(parsed.command).toBe("uname -a");
      expect(parsed.explain).toBe("Mostra informações do sistema");
      expect(parsed.riskLevel).toBe("low");
    });

    it("should require riskLevel and requiresConfirmation fields", () => {
      // Schema requires all fields - minimal won't work
      const minimalCmd = {
        command: "ls -la",
        explain: "Lista arquivos",
      };

      // Should throw because riskLevel and requiresConfirmation are required
      expect(() => LinuxCommandSchema.parse(minimalCmd)).toThrow();
    });

    it("should accept command with all required fields", () => {
      const completeCmd = {
        command: "ls -la",
        explain: "Lista arquivos",
        riskLevel: "low",
        requiresConfirmation: false,
      };

      const parsed = LinuxCommandSchema.parse(completeCmd);
      expect(parsed.command).toBe("ls -la");
    });

    it("should reject commands with invalid riskLevel", () => {
      const invalidCmd = {
        command: "rm -rf /",
        explain: "Perigoso",
        riskLevel: "ultra-high", // invalid
        requiresConfirmation: true,
      };

      expect(() => LinuxCommandSchema.parse(invalidCmd)).toThrow();
    });

    it("should handle Test 3 failure case: truncated JSON from phi3", () => {
      // This is what phi3 generated in debub.log Test 3
      // The JSON was truncated and missing the command field
      const truncatedCmd = {
        explain: "Mostra informações do sistema operacional...",
        // missing: command field (truncated JSON)
      };

      // Should throw because 'command' is required
      expect(() => LinuxCommandSchema.parse(truncatedCmd)).toThrow();
    });
  });
});
