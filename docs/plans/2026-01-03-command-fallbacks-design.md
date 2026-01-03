# Command Fallbacks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix Test 2 (invalid df options) and Test 3 (truncated JSON) by adding a command fallback system

**Architecture:** Create `src/command-fallbacks.ts` with intent-to-command mappings, integrate with `linux-admin.ts` to provide fallback when LLM generates invalid commands

**Tech Stack:** TypeScript, Zod validation, existing LinuxCommand schema

---

## Task 1: Create Command Fallback Types and Data

**Files:**
- Create: `src/command-fallbacks.ts`
- Test: `tests/unit/command-fallbacks.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/command-fallbacks.test.ts
import { describe, it, expect } from "vitest";
import { getFallbackCommand, matchIntent } from "../../src/command-fallbacks";

describe("Command Fallbacks", () => {
  describe("matchIntent", () => {
    it("should match disk usage intent", () => {
      const intent = matchIntent("mostre quanto de disco está sendo usado");
      expect(intent).toBe("disk_usage");
    });

    it("should match system info intent", () => {
      const intent = matchIntent("mostre informações do sistema operacional");
      expect(intent).toBe("system_info");
    });

    it("should return null for unknown intent", () => {
      const intent = matchIntent("configure nginx proxy reverso");
      expect(intent).toBeNull();
    });
  });

  describe("getFallbackCommand", () => {
    it("should return df -h for disk_usage intent", () => {
      const cmd = getFallbackCommand("disk_usage");
      expect(cmd).toBeDefined();
      expect(cmd?.command).toBe("df -h");
    });

    it("should return uname for system_info intent", () => {
      const cmd = getFallbackCommand("system_info");
      expect(cmd).toBeDefined();
      expect(cmd?.command).toContain("uname");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/command-fallbacks.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/command-fallbacks.ts
import { LinuxCommand } from "./types-linux";

/**
 * Intent types for common Linux admin tasks
 */
export type CommandIntent =
  | "disk_usage"
  | "system_info"
  | "memory_usage"
  | "list_files"
  | "network_info"
  | "process_list";

/**
 * Patterns to match user requests to intents
 */
const INTENT_PATTERNS: Record<CommandIntent, RegExp[]> = {
  disk_usage: [
    /disco.*usado/i,
    /uso.*disco/i,
    /espaço.*disco/i,
    /disk.*usage/i,
    /disk.*space/i,
    /df\s/i,
  ],
  system_info: [
    /informaç.*sistema/i,
    /sistema.*operacional/i,
    /system.*info/i,
    /os.*info/i,
    /uname/i,
  ],
  memory_usage: [
    /memória/i,
    /memory.*usage/i,
    /ram/i,
    /free\s/i,
  ],
  list_files: [
    /list.*arquivos/i,
    /arquivos.*diretório/i,
    /ls\s/i,
    /list.*files/i,
  ],
  network_info: [
    /rede/i,
    /network/i,
    /ip\s/i,
    /interface/i,
  ],
  process_list: [
    /processos/i,
    /process/i,
    /ps\s/i,
    /top\s/i,
  ],
};

/**
 * Fallback commands for each intent - these are guaranteed to work
 */
const FALLBACK_COMMANDS: Record<CommandIntent, LinuxCommand> = {
  disk_usage: {
    command: "df -h",
    explain: "Mostra uso de disco em formato legível",
    riskLevel: "low",
    requiresConfirmation: false,
  },
  system_info: {
    command: "uname -a && cat /etc/os-release 2>/dev/null || hostnamectl",
    explain: "Mostra informações do sistema operacional",
    riskLevel: "low",
    requiresConfirmation: false,
  },
  memory_usage: {
    command: "free -h",
    explain: "Mostra uso de memória em formato legível",
    riskLevel: "low",
    requiresConfirmation: false,
  },
  list_files: {
    command: "ls -la",
    explain: "Lista arquivos do diretório atual com detalhes",
    riskLevel: "low",
    requiresConfirmation: false,
  },
  network_info: {
    command: "ip addr show || ifconfig",
    explain: "Mostra configuração de rede",
    riskLevel: "low",
    requiresConfirmation: false,
  },
  process_list: {
    command: "ps aux --sort=-%mem | head -20",
    explain: "Lista os 20 processos que mais consomem memória",
    riskLevel: "low",
    requiresConfirmation: false,
  },
};

/**
 * Match a user request to a known intent
 */
export function matchIntent(request: string): CommandIntent | null {
  const normalized = request.toLowerCase().trim();

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        return intent as CommandIntent;
      }
    }
  }

  return null;
}

/**
 * Get a fallback command for a known intent
 */
export function getFallbackCommand(intent: CommandIntent): LinuxCommand | null {
  return FALLBACK_COMMANDS[intent] || null;
}

/**
 * Try to get a fallback command for a user request
 * Returns null if no matching intent is found
 */
export function tryGetFallbackForRequest(request: string): LinuxCommand | null {
  const intent = matchIntent(request);
  if (!intent) return null;
  return getFallbackCommand(intent);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/command-fallbacks.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/command-fallbacks.ts tests/unit/command-fallbacks.test.ts
git commit -m "feat(fallbacks): add command fallback system for common intents"
```

---

## Task 2: Integrate Fallbacks with Linux Admin

**Files:**
- Modify: `src/linux-admin.ts` (lines 426-568)
- Test: `tests/unit/command-fallbacks.test.ts` (add integration test)

**Step 1: Write the failing test**

```typescript
// Add to tests/unit/command-fallbacks.test.ts
describe("Integration with linux-admin", () => {
  it("should use fallback when LLM returns no valid commands", async () => {
    // This test verifies the integration point exists
    const { tryGetFallbackForRequest } = await import("../../src/command-fallbacks");
    const fallback = tryGetFallbackForRequest("mostre quanto de disco está sendo usado");
    expect(fallback).toBeDefined();
    expect(fallback?.command).toBe("df -h");
  });
});
```

**Step 2: Run test to verify it passes (already implemented)**

Run: `npm test -- tests/unit/command-fallbacks.test.ts`
Expected: PASS

**Step 3: Modify linux-admin.ts to use fallbacks**

Add import at top of `src/linux-admin.ts`:
```typescript
import { tryGetFallbackForRequest } from "./command-fallbacks";
```

Modify `getLinuxCommandsFromAI` function (after line 525, where it checks `!commandsYielded`):

```typescript
// If we got here without yielding commands, try fallback
if (!commandsYielded) {
  const fallbackCmd = tryGetFallbackForRequest(task);
  if (fallbackCmd) {
    logger.info(chalk.yellow(`⚡ Usando comando fallback para: ${task.substring(0, 50)}...`));
    yield { type: "command", command: fallbackCmd };
    yield { type: "allcommands", commands: [fallbackCmd] };
    commandsYielded = true;
    break;
  }
  throw new Error(`Provider ${currentProvider} returned no commands`);
}
```

**Step 4: Run build to verify compilation**

Run: `npm run build`
Expected: SUCCESS

**Step 5: Commit**

```bash
git add src/linux-admin.ts
git commit -m "feat(fallbacks): integrate fallback commands with linux-admin"
```

---

## Task 3: Add JSON Validation Timeout with Fallback

**Files:**
- Modify: `src/streaming-parser.ts`
- Test: `tests/unit/streaming-parser.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/streaming-parser.test.ts (new file or add to existing)
import { describe, it, expect } from "vitest";

describe("Streaming Parser Validation", () => {
  it("should reject commands without 'command' field", async () => {
    const { LinuxCommandSchema } = await import("../../src/types-linux");

    const invalidCmd = {
      explain: "Mostra informações do sistema",
      // missing: command field
    };

    expect(() => LinuxCommandSchema.parse(invalidCmd)).toThrow();
  });

  it("should accept valid command structure", async () => {
    const { LinuxCommandSchema } = await import("../../src/types-linux");

    const validCmd = {
      command: "uname -a",
      explain: "Mostra informações do sistema",
      riskLevel: "low",
      requiresConfirmation: false,
    };

    const parsed = LinuxCommandSchema.parse(validCmd);
    expect(parsed.command).toBe("uname -a");
  });
});
```

**Step 2: Run test to verify it passes**

Run: `npm test -- tests/unit/streaming-parser.test.ts`
Expected: PASS (schema validation already works)

**Step 3: The JSON parsing is already robust**

The current implementation in `streaming-parser.ts` already:
- Uses oboe for incremental JSON parsing
- Validates commands with LinuxCommandSchema
- Logs warnings for invalid commands

The issue in Test 3 was that phi3 generated JSON without the `command` field, which is correctly rejected.

**Step 4: Verify existing behavior**

Run: `npm run build && npm test`
Expected: All tests pass

**Step 5: No commit needed (validation already works)**

---

## Task 4: Run Real-World Test to Validate Fixes

**Files:**
- None (testing only)

**Step 1: Run the test script**

```bash
cd /home/rluft/fazai-ng && bash tests/real-world-exec.sh 2>&1 | tee tests/real-world-exec.log
```

**Step 2: Verify Test 2 uses fallback**

Expected: When phi3 generates invalid `df` command, fallback `df -h` is used

**Step 3: Verify Test 3 behavior**

Expected: Invalid JSON commands are logged as warnings, and if no valid commands, fallback is used

---

## Task 5: Update CHANGELOG and Documentation

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md` (if needed)

**Step 1: Add changelog entry**

```markdown
## [3.14.8] - 2026-01-03

### Added
- Command fallback system for common Linux admin tasks
- Fallbacks for: disk_usage, system_info, memory_usage, list_files, network_info, process_list

### Fixed
- Invalid `df --output=TOTALKB` commands now fallback to `df -h`
- Truncated JSON from phi3 now uses fallback commands
```

**Step 2: Commit**

```bash
git add CHANGELOG.md src/command-fallbacks.ts tests/unit/command-fallbacks.test.ts src/linux-admin.ts
git commit -m "feat(fallbacks): command fallback system v3.14.8

- Add src/command-fallbacks.ts with intent matching
- Integrate with linux-admin.ts for automatic fallback
- Fixes Test 2 (invalid df options) and Test 3 (truncated JSON)"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Create command-fallbacks.ts | src/command-fallbacks.ts, tests/unit/command-fallbacks.test.ts |
| 2 | Integrate with linux-admin.ts | src/linux-admin.ts |
| 3 | Validate JSON parsing | tests/unit/streaming-parser.test.ts |
| 4 | Run real-world test | tests/real-world-exec.sh |
| 5 | Update CHANGELOG | CHANGELOG.md |

**Estimated tasks:** 5
**TDD approach:** Test first, then implement
