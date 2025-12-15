/**
 * Neural Flow Unit Tests
 *
 * Testa o fluxo de comandos aprendidos vs providers
 *
 * PROBLEMA IDENTIFICADO (commit 34d82f4):
 * - Quando learnedCommands existe, o código faz yield mas NÃO retorna
 * - O provider chain continua executando e pode emitir comandos duplicados
 *
 * FLUXO ATUAL (BUGADO):
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ consultNeuralFlow() → learnedCommands                           │
 * │         ↓                                                        │
 * │ if (learnedCommands.length > 0)                                 │
 * │   → yield commands (EMITE)                                      │
 * │   → NÃO RETORNA! ← BUG                                          │
 * │         ↓                                                        │
 * │ Provider Chain executa                                          │
 * │   → yield commands (EMITE NOVAMENTE) ← DUPLICAÇÃO               │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * FLUXO ESPERADO (CORRETO):
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ consultNeuralFlow() → learnedCommands                           │
 * │         ↓                                                        │
 * │ if (learnedCommands.length > 0)                                 │
 * │   → yield commands                                              │
 * │   → RETURN ← CORRETO                                            │
 * │         ↓                                                        │
 * │ Provider Chain NÃO executa (função já retornou)                 │
 * └─────────────────────────────────────────────────────────────────┘
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock types para simular o comportamento
interface CommandResult {
  type: 'thinking' | 'command' | 'allcommands' | 'error';
  command?: string;
  commands?: string[];
  content?: string;
}

/**
 * Simula o comportamento ATUAL (bugado) do generateLinuxCommands
 * Quando há comandos aprendidos, emite E continua para provider
 */
async function* simulateCurrentBehavior(
  hasLearnedCommands: boolean,
  learnedCommands: string[],
  providerCommands: string[]
): AsyncGenerator<CommandResult> {
  // Neural Flow: busca comandos aprendidos
  if (hasLearnedCommands && learnedCommands.length > 0) {
    // Emite comandos aprendidos
    for (const cmd of learnedCommands) {
      yield { type: 'command', command: cmd };
    }
    yield { type: 'allcommands', commands: learnedCommands };
    // BUG: NÃO RETORNA! Continua para provider chain
  }

  // Provider Chain (sempre executa - BUG!)
  for (const cmd of providerCommands) {
    yield { type: 'command', command: cmd };
  }
  yield { type: 'allcommands', commands: providerCommands };
}

/**
 * Simula o comportamento CORRETO do generateLinuxCommands
 * Quando há comandos aprendidos, emite E RETORNA
 */
async function* simulateCorrectBehavior(
  hasLearnedCommands: boolean,
  learnedCommands: string[],
  providerCommands: string[]
): AsyncGenerator<CommandResult> {
  // Neural Flow: busca comandos aprendidos
  if (hasLearnedCommands && learnedCommands.length > 0) {
    // Emite comandos aprendidos
    for (const cmd of learnedCommands) {
      yield { type: 'command', command: cmd };
    }
    yield { type: 'allcommands', commands: learnedCommands };
    return; // CORRETO: Retorna após emitir comandos aprendidos
  }

  // Provider Chain (só executa se não há comandos aprendidos)
  for (const cmd of providerCommands) {
    yield { type: 'command', command: cmd };
  }
  yield { type: 'allcommands', commands: providerCommands };
}

/**
 * Helper para coletar todos os resultados de um generator
 */
async function collectResults(
  generator: AsyncGenerator<CommandResult>
): Promise<CommandResult[]> {
  const results: CommandResult[] = [];
  for await (const result of generator) {
    results.push(result);
  }
  return results;
}

describe('Neural Flow - Duplicação de Comandos', () => {
  const learnedCommands = ['sudo apt update', 'sudo apt upgrade -y'];
  const providerCommands = ['apt-get update', 'apt-get upgrade'];

  describe('Comportamento ATUAL (Bugado)', () => {
    it('deve emitir comandos aprendidos E provider (DUPLICAÇÃO)', async () => {
      const results = await collectResults(
        simulateCurrentBehavior(true, learnedCommands, providerCommands)
      );

      // Conta quantos "allcommands" foram emitidos
      const allCommandsResults = results.filter(r => r.type === 'allcommands');

      // BUG: Emite 2 vezes allcommands (learned + provider)
      expect(allCommandsResults.length).toBe(2);

      // Total de comandos individuais emitidos
      const commandResults = results.filter(r => r.type === 'command');
      expect(commandResults.length).toBe(4); // 2 learned + 2 provider = 4 (DUPLICAÇÃO!)
    });

    it('deve incluir comandos de AMBAS as fontes', async () => {
      const results = await collectResults(
        simulateCurrentBehavior(true, learnedCommands, providerCommands)
      );

      const allCommands = results
        .filter(r => r.type === 'command')
        .map(r => r.command);

      // Contém comandos aprendidos
      expect(allCommands).toContain('sudo apt update');
      expect(allCommands).toContain('sudo apt upgrade -y');

      // TAMBÉM contém comandos do provider (BUG!)
      expect(allCommands).toContain('apt-get update');
      expect(allCommands).toContain('apt-get upgrade');
    });
  });

  describe('Comportamento CORRETO (Esperado)', () => {
    it('deve emitir APENAS comandos aprendidos quando existem', async () => {
      const results = await collectResults(
        simulateCorrectBehavior(true, learnedCommands, providerCommands)
      );

      // Apenas 1 allcommands (learned)
      const allCommandsResults = results.filter(r => r.type === 'allcommands');
      expect(allCommandsResults.length).toBe(1);

      // Apenas comandos aprendidos
      const commandResults = results.filter(r => r.type === 'command');
      expect(commandResults.length).toBe(2); // Apenas 2 comandos aprendidos
    });

    it('deve usar provider APENAS quando não há comandos aprendidos', async () => {
      const results = await collectResults(
        simulateCorrectBehavior(false, [], providerCommands)
      );

      // Apenas comandos do provider
      const commandResults = results.filter(r => r.type === 'command');
      expect(commandResults.length).toBe(2);

      const commands = commandResults.map(r => r.command);
      expect(commands).toContain('apt-get update');
      expect(commands).toContain('apt-get upgrade');

      // NÃO contém comandos aprendidos
      expect(commands).not.toContain('sudo apt update');
    });

    it('NÃO deve emitir comandos do provider quando learned existe', async () => {
      const results = await collectResults(
        simulateCorrectBehavior(true, learnedCommands, providerCommands)
      );

      const allCommands = results
        .filter(r => r.type === 'command')
        .map(r => r.command);

      // NÃO deve conter comandos do provider
      expect(allCommands).not.toContain('apt-get update');
      expect(allCommands).not.toContain('apt-get upgrade');
    });
  });

  describe('Comparação de Resultados', () => {
    it('comportamento atual produz MAIS resultados que o correto', async () => {
      const currentResults = await collectResults(
        simulateCurrentBehavior(true, learnedCommands, providerCommands)
      );

      const correctResults = await collectResults(
        simulateCorrectBehavior(true, learnedCommands, providerCommands)
      );

      // Atual emite mais (BUG)
      expect(currentResults.length).toBeGreaterThan(correctResults.length);

      // Diferença é exatamente os comandos do provider
      const diff = currentResults.length - correctResults.length;
      expect(diff).toBe(providerCommands.length + 1); // +1 para allcommands
    });
  });
});

describe('Neural Flow - Casos Extremos', () => {
  it('deve funcionar com array vazio de comandos aprendidos', async () => {
    const results = await collectResults(
      simulateCorrectBehavior(true, [], ['cmd1'])
    );

    // Array vazio não deve entrar no if (length > 0)
    const commandResults = results.filter(r => r.type === 'command');
    expect(commandResults.length).toBe(1);
  });

  it('deve funcionar quando provider retorna vazio', async () => {
    const results = await collectResults(
      simulateCorrectBehavior(false, [], [])
    );

    const commandResults = results.filter(r => r.type === 'command');
    expect(commandResults.length).toBe(0);
  });

  it('deve manter ordem dos comandos aprendidos', async () => {
    const ordered = ['primeiro', 'segundo', 'terceiro'];
    const results = await collectResults(
      simulateCorrectBehavior(true, ordered, ['ignorado'])
    );

    const commands = results
      .filter(r => r.type === 'command')
      .map(r => r.command);

    expect(commands).toEqual(ordered);
  });
});
