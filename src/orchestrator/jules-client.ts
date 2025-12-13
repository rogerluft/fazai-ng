/**
 * @file Jules Client - Comunicação com agente Jules (Google)
 * @description Este arquivo implementa o cliente para interagir com o agente de engenharia de software Jules,
 * que opera via uma interface de linha de comando (CLI).
 * @module src/orchestrator/jules-client
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { JulesTask } from './task-router';
import { formatJulesPrompt } from './task-router';

const execAsync = promisify(exec);

/**
 * @interface JulesResponse
 * @description Define a estrutura da resposta retornada pelo agente Jules após a execução de um comando.
 * @property {boolean} success - Indica se a operação foi bem-sucedida.
 * @property {string} [plan] - O plano de execução proposto pelo Jules, se aplicável.
 * @property {string} [result] - O resultado final da execução da tarefa, se aplicável.
 * @property {string} [error] - Uma mensagem de erro, se a operação falhou.
 * @property {boolean} [needsInput] - Indica se Jules está aguardando uma resposta do usuário (aprovação do plano ou resposta a uma pergunta).
 * @property {string} [question] - A pergunta feita por Jules, se aplicável.
 */
export interface JulesResponse {
  success: boolean;
  plan?: string;
  result?: string;
  error?: string;
  needsInput?: boolean;
  question?: string;
}

/**
 * Delega uma tarefa para o agente Jules, enviando o prompt formatado via CLI.
 * @param {JulesTask} task - O objeto da tarefa a ser delegada.
 * @returns {Promise<JulesResponse>} Uma promessa que resolve com a resposta parseada do Jules.
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
 * Envia uma mensagem de aprovação para o Jules, permitindo que ele continue com a execução de um plano proposto.
 * @param {string} [sessionId] - O ID da sessão do Jules para a qual a aprovação se destina (opcional).
 * @returns {Promise<void>}
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
 * Envia uma resposta a uma pergunta feita pelo Jules durante a execução de uma tarefa.
 * @param {string} answer - A resposta para a pergunta do Jules.
 * @param {string} [sessionId] - O ID da sessão do Jules para a qual a resposta se destina (opcional).
 * @returns {Promise<void>}
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
 * Analisa a saída de texto do CLI do Jules e a converte em um objeto estruturado `JulesResponse`.
 * @private
 * @param {string} output - A saída padrão (stdout) do comando do Jules.
 * @returns {JulesResponse} O objeto de resposta estruturado.
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
 * Escapa uma string para que ela possa ser usada com segurança em um comando shell.
 * @private
 * @param {string} prompt - A string a ser escapada.
 * @returns {string} A string escapada.
 */
function escapePrompt(prompt: string): string {
  return prompt
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`');
}

/**
 * Lista todas as sessões ativas do Jules que estão rodando no momento.
 * @returns {Promise<string[]>} Uma promessa que resolve com um array de IDs de sessão.
 */
export async function listJulesSessions(): Promise<string[]> {
  try {
    const { stdout } = await execAsync('jules --list-sessions');
    return stdout.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}
