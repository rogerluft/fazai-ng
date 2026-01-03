/**
 * Command Fallbacks Unit Tests
 * TDD: Tests written first, implementation follows
 */

import { describe, it, expect } from "vitest";
import {
  getFallbackCommand,
  matchIntent,
  tryGetFallbackForRequest,
  type CommandIntent,
} from "../../src/command-fallbacks";

describe("Command Fallbacks", () => {
  describe("matchIntent", () => {
    it("should match disk usage intent in Portuguese", () => {
      const intent = matchIntent("mostre quanto de disco está sendo usado");
      expect(intent).toBe("disk_usage");
    });

    it("should match disk usage intent with 'espaço em disco'", () => {
      const intent = matchIntent("quanto espaço em disco tenho");
      expect(intent).toBe("disk_usage");
    });

    it("should match system info intent", () => {
      const intent = matchIntent("mostre informações do sistema operacional");
      expect(intent).toBe("system_info");
    });

    it("should match memory usage intent", () => {
      const intent = matchIntent("mostre uso de memória");
      expect(intent).toBe("memory_usage");
    });

    it("should match list files intent", () => {
      const intent = matchIntent("liste os arquivos do diretório");
      expect(intent).toBe("list_files");
    });

    it("should match network info intent", () => {
      const intent = matchIntent("mostre configuração de rede");
      expect(intent).toBe("network_info");
    });

    it("should match process list intent", () => {
      const intent = matchIntent("liste os processos em execução");
      expect(intent).toBe("process_list");
    });

    it("should return null for unknown intent", () => {
      const intent = matchIntent("configure nginx proxy reverso");
      expect(intent).toBeNull();
    });

    it("should return null for complex tasks", () => {
      const intent = matchIntent("crie um script de backup do postgres");
      expect(intent).toBeNull();
    });
  });

  describe("getFallbackCommand", () => {
    it("should return df -h for disk_usage intent", () => {
      const cmd = getFallbackCommand("disk_usage");
      expect(cmd).toBeDefined();
      expect(cmd?.command).toBe("df -h");
      expect(cmd?.riskLevel).toBe("low");
    });

    it("should return uname command for system_info intent", () => {
      const cmd = getFallbackCommand("system_info");
      expect(cmd).toBeDefined();
      expect(cmd?.command).toContain("uname");
      expect(cmd?.riskLevel).toBe("low");
    });

    it("should return free -h for memory_usage intent", () => {
      const cmd = getFallbackCommand("memory_usage");
      expect(cmd).toBeDefined();
      expect(cmd?.command).toBe("free -h");
    });

    it("should return ls -la for list_files intent", () => {
      const cmd = getFallbackCommand("list_files");
      expect(cmd).toBeDefined();
      expect(cmd?.command).toBe("ls -la");
    });

    it("should return ip addr for network_info intent", () => {
      const cmd = getFallbackCommand("network_info");
      expect(cmd).toBeDefined();
      expect(cmd?.command).toContain("ip addr");
    });

    it("should return ps aux for process_list intent", () => {
      const cmd = getFallbackCommand("process_list");
      expect(cmd).toBeDefined();
      expect(cmd?.command).toContain("ps aux");
    });
  });

  describe("tryGetFallbackForRequest", () => {
    it("should return fallback for known request", () => {
      const cmd = tryGetFallbackForRequest("mostre quanto de disco está sendo usado");
      expect(cmd).toBeDefined();
      expect(cmd?.command).toBe("df -h");
    });

    it("should return null for unknown request", () => {
      const cmd = tryGetFallbackForRequest("configure o firewall para bloquear porta 22");
      expect(cmd).toBeNull();
    });
  });

  describe("Integration scenarios", () => {
    it("should handle Test 2 failure case: disk usage with invalid df options", () => {
      // This is the exact request from debub.log Test 2
      const request = "mostre quanto de disco está sendo usado";
      const fallback = tryGetFallbackForRequest(request);

      expect(fallback).toBeDefined();
      expect(fallback?.command).toBe("df -h");
      // NOT "df -h --output=TOTALKB" which phi3 generated
    });

    it("should handle Test 3 failure case: system info", () => {
      // This is the exact request from debub.log Test 3
      const request = "mostre informações do sistema operacional";
      const fallback = tryGetFallbackForRequest(request);

      expect(fallback).toBeDefined();
      expect(fallback?.command).toContain("uname");
    });
  });
});
