
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decomposeTask } from '../src/agentic/task-decomposer';
import * as askAIModule from '../src/askAI';
import * as composerModule from '../src/agentic/execution-composer';

// Mock das dependências
vi.mock('../src/askAI');
vi.mock('../src/agentic/execution-composer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/agentic/execution-composer')>();
  return {
    ...actual,
    composeExecution: vi.fn(),
  };
});

// Mock do logger para não sujar a saída do teste
vi.mock('../src/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TaskDecomposer - Decomposição Parcial', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('deve usar decomposição parcial quando cobertura > 0.5', async () => {
    const task = "instalar nginx e configurar firewall";

    // 1. Mock composeExecution para retornar cobertura parcial (0.6 > 0.5)
    vi.mocked(composerModule.composeExecution).mockResolvedValue({
      fully_composed: false,
      matched_blocks: [
        {
          block_id: 'b1',
          intent: 'instalar nginx',
          steps: [{ command: 'apt install nginx', description: 'Install nginx' }],
          stats: { times_used: 1, success_rate: 1, learned_from: [] }
        }
      ],
      missing_intents: ['configurar firewall'],
      coverage: 0.6,
      composition_time_ms: 10
    });

    // 2. Mock askAI para retornar a nova subtarefa
    vi.mocked(askAIModule.askAI).mockImplementation(async function* (context, prompt) {
      // Verifica se o prompt contém as partes esperadas da decomposição parcial
      if (prompt.includes('BLOCOS JÁ CONHECIDOS') && prompt.includes('configurar firewall')) {
        yield JSON.stringify({
          new_subtasks: [
            {
              id: 'task-2',
              description: 'Configurar firewall',
              command: 'ufw allow 80',
              dependencies: ['task-1'],
              estimatedComplexity: 2,
              requiresInstallation: false
            }
          ],
          executionPlan: 'Plano integrado'
        });
      } else {
          yield JSON.stringify({ subtasks: [], executionPlan: 'Falhou' });
      }
    });

    const result = await decomposeTask(task, 'gpt-4', 'openai');

    // 3. Verificações
    expect(result.subtasks.length).toBe(2);
    expect(result.subtasks[0].id).toBe('task-1');
    expect(result.subtasks[0].description).toBe('instalar nginx');
    expect(result.subtasks[0].command).toBe('apt install nginx');

    expect(result.subtasks[1].id).toBe('task-2');
    expect(result.subtasks[1].description).toBe('Configurar firewall');
    expect(result.subtasks[1].command).toBe('ufw allow 80');
    expect(result.subtasks[1].dependencies).toContain('task-1');

    expect(result.executionPlan).toBe('Plano integrado');
  });

  it('deve usar decomposição total quando cobertura <= 0.5', async () => {
    const task = "tarefa totalmente nova";

    // Mock cobertura baixa (0.1 <= 0.5)
    vi.mocked(composerModule.composeExecution).mockResolvedValue({
      fully_composed: false,
      matched_blocks: [],
      missing_intents: ['tarefa totalmente nova'],
      coverage: 0.1,
      composition_time_ms: 5
    });

    vi.mocked(askAIModule.askAI).mockImplementation(async function* (context, prompt) {
      // Verifica se está usando o prompt padrão (não o parcial)
      if (!prompt.includes('BLOCOS JÁ CONHECIDOS')) {
        yield JSON.stringify({
          subtasks: [
            {
              id: 'task-1',
              description: 'Tarefa nova',
              command: 'ls -la',
              dependencies: [],
              estimatedComplexity: 1,
              requiresInstallation: false
            }
          ],
          executionPlan: 'Plano total'
        });
      }
    });

    const result = await decomposeTask(task, 'gpt-4', 'openai');

    expect(result.subtasks.length).toBe(1);
    expect(result.subtasks[0].description).toBe('Tarefa nova');
    expect(result.executionPlan).toBe('Plano total');
  });

  it('deve retornar composição completa sem chamar LLM quando fully_composed é true', async () => {
    const task = "instalar nginx";

    vi.mocked(composerModule.composeExecution).mockResolvedValue({
      fully_composed: true,
      matched_blocks: [
        {
          block_id: 'b1',
          intent: 'instalar nginx',
          steps: [{ command: 'apt install nginx', description: 'Install nginx' }],
          stats: { times_used: 1, success_rate: 1, learned_from: [] }
        }
      ],
      missing_intents: [],
      coverage: 1.0,
      composition_time_ms: 5
    });

    const result = await decomposeTask(task, 'gpt-4', 'openai');

    expect(result.subtasks.length).toBe(1);
    expect(result.subtasks[0].command).toBe('apt install nginx');
    expect(askAIModule.askAI).not.toHaveBeenCalled();
    expect(result.executionPlan).toContain('ECOA');
  });
});
