/**
 * Jules Client - Comunicação com agente Jules (Google)
 * Jules é um engenheiro de software autônomo que opera via CLI
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { JulesTask } from './task-router';
import { formatJulesPrompt } from './task-router';

const execAsync = promisify(exec);

export interface JulesResponse {
  success: boolean;
  plan?: string;
  result?: string;
  error?: string;
  needsInput?: boolean;
  question?: string;
}

/**
 * Delega tarefa para Jules via CLI
 */
export async function delegateToJules(task: JulesTask): Promise<JulesResponse> {
  try {
    const prompt = formatJulesPrompt(task);

    // Jules opera via CLI
    // Formato: echo "prompt" | jules
    const { stdout, stderr } = await execAsync(`echo "${escapePrompt(prompt)}" | jules`, {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    if (stderr && !stdout) {
      return {
        success: false,
        error: stderr,
      };
    }

    // Parse resposta de Jules
    return parseJulesResponse(stdout);
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Aprova plano apresentado por Jules
 */
export async function approveJulesPlan(sessionId?: string): Promise<void> {
  const approval = "Plano aprovado, pode prosseguir";

  if (sessionId) {
    await execAsync(`echo "${approval}" | jules --session ${sessionId}`);
  } else {
    await execAsync(`echo "${approval}" | jules`);
  }
}

/**
 * Responde pergunta de Jules (request_user_input)
 */
export async function respondToJules(answer: string, sessionId?: string): Promise<void> {
  const escaped = escapePrompt(answer);

  if (sessionId) {
    await execAsync(`echo "${escaped}" | jules --session ${sessionId}`);
  } else {
    await execAsync(`echo "${escaped}" | jules`);
  }
}

/**
 * Parse resposta de Jules
 */
function parseJulesResponse(output: string): JulesResponse {
  // Jules retorna estrutura específica
  // Detectar diferentes tipos de resposta

  if (output.includes('set_plan')) {
    // Jules apresentou um plano
    const planMatch = output.match(/set_plan\((.*?)\)/s);
    return {
      success: true,
      plan: planMatch?.[1] || output,
      needsInput: true, // Aguarda aprovação
    };
  }

  if (output.includes('request_user_input')) {
    // Jules fez uma pergunta
    const questionMatch = output.match(/request_user_input\((.*?)\)/s);
    return {
      success: true,
      needsInput: true,
      question: questionMatch?.[1] || 'Jules aguarda resposta',
    };
  }

  if (output.includes('submit')) {
    // Jules finalizou a tarefa
    return {
      success: true,
      result: 'Tarefa concluída e submetida por Jules',
    };
  }

  // Resposta genérica
  return {
    success: true,
    result: output,
  };
}

/**
 * Escape prompt para shell
 */
function escapePrompt(prompt: string): string {
  return prompt
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`');
}

/**
 * Lista sessões ativas de Jules
 */
export async function listJulesSessions(): Promise<string[]> {
  try {
    const { stdout } = await execAsync('jules --list-sessions');
    return stdout.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}
