/**
 * Neural Flow Unit Tests
 *
 * Testa o fluxo de comandos aprendidos vs providers
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
 * Simula o comportamento do Neural Flow no generateLinuxCommands
 * Quando há comandos aprendidos, emite E RETORNA
 */
async function* simulateNeuralFlowBehavior(
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

  describe('Neural Flow - Comportamento do Fluxo', () => {
    it('deve emitir APENAS comandos aprendidos quando existem', async () => {
      const results = await collectResults(
        simulateNeuralFlowBehavior(true, learnedCommands, providerCommands)
      );

      // Apenas 1 allcommands (learned)
      const allCommandsResults = results.filter(r => r.type === 'allcommands');
      expect(allCommandsResults.length).toBe(1);

      // Apenas comandos aprendidos
      const commandResults = results.filter(r => r.type === 'command');
      expect(commandResults.length).toBe(2); // Apenas 2 comandos aprendidos

      const commands = commandResults.map(r => r.command);
      expect(commands).toContain('sudo apt update');
      expect(commands).toContain('sudo apt upgrade -y');

      // NÃO deve conter comandos do provider
      expect(commands).not.toContain('apt-get update');
    });

    it('deve usar provider APENAS quando não há comandos aprendidos', async () => {
      const results = await collectResults(
        simulateNeuralFlowBehavior(false, [], providerCommands)
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
  });
});

describe('Neural Flow - Casos Extremos', () => {
  it('deve funcionar com array vazio de comandos aprendidos', async () => {
    const results = await collectResults(
      simulateNeuralFlowBehavior(true, [], ['cmd1'])
    );

    // Array vazio não deve entrar no if (length > 0)
    const commandResults = results.filter(r => r.type === 'command');
    expect(commandResults.length).toBe(1);
  });

  it('deve funcionar quando provider retorna vazio', async () => {
    const results = await collectResults(
      simulateNeuralFlowBehavior(false, [], [])
    );

    const commandResults = results.filter(r => r.type === 'command');
    expect(commandResults.length).toBe(0);
  });

  it('deve manter ordem dos comandos aprendidos', async () => {
    const ordered = ['primeiro', 'segundo', 'terceiro'];
    const results = await collectResults(
      simulateNeuralFlowBehavior(true, ordered, ['ignorado'])
    );

    const commands = results
      .filter(r => r.type === 'command')
      .map(r => r.command);

    expect(commands).toEqual(ordered);
  });
});
