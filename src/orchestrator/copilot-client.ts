/**
 * @file Copilot Client - Comunicação com GitHub Copilot CLI
 * @description Este arquivo implementa um cliente para interagir com o GitHub Copilot via CLI (`gh copilot`).
 * É especializado em obter sugestões e explicações para comandos de shell, git e GitHub CLI.
 * @module src/orchestrator/copilot-client
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * @interface CopilotShellRequest
 * @description Define a estrutura para uma solicitação de comando shell ao Copilot.
 * @property {string} description - A descrição em linguagem natural do que o comando shell deve fazer.
 */
export interface CopilotShellRequest {
  description: string;
}

/**
 * @interface CopilotGitRequest
 * @description Define a estrutura para uma solicitação de comando git ao Copilot.
 * @property {string} description - A descrição em linguagem natural do que o comando git deve fazer.
 */
export interface CopilotGitRequest {
  description: string;
}

/**
 * @interface CopilotResponse
 * @description Define a estrutura da resposta retornada pelo Copilot CLI.
 * @property {boolean} success - Indica se a operação foi bem-sucedida.
 * @property {string} [command] - O comando sugerido pelo Copilot.
 * @property {string} [explanation] - A explicação do comando fornecida pelo Copilot.
 * @property {string} [error] - Uma mensagem de erro, se a operação falhou.
 */
export interface CopilotResponse {
  success: boolean;
  command?: string;
  explanation?: string;
  error?: string;
}

/**
 * Pede ao Copilot CLI uma sugestão de comando shell com base em uma descrição.
 * @param {CopilotShellRequest} request - O objeto da solicitação.
 * @returns {Promise<CopilotResponse>} Uma promessa que resolve com a sugestão do Copilot.
 */
export async function askCopilotForShellCommand(
  request: CopilotShellRequest,
): Promise<CopilotResponse> {
  try {
    const { stdout } = await execAsync(`gh copilot suggest -t shell "${request.description}"`, {
      cwd: process.cwd(),
    });

    return parseCopilotResponse(stdout);
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Pede ao Copilot CLI uma sugestão de comando git com base em uma descrição.
 * @param {CopilotGitRequest} request - O objeto da solicitação.
 * @returns {Promise<CopilotResponse>} Uma promessa que resolve com a sugestão do Copilot.
 */
export async function askCopilotForGitCommand(
  request: CopilotGitRequest,
): Promise<CopilotResponse> {
  try {
    const { stdout } = await execAsync(`gh copilot suggest -t git "${request.description}"`, {
      cwd: process.cwd(),
    });

    return parseCopilotResponse(stdout);
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Pede ao Copilot CLI uma sugestão de comando `gh` (GitHub CLI) com base em uma descrição.
 * @param {string} description - A descrição em linguagem natural do que o comando `gh` deve fazer.
 * @returns {Promise<CopilotResponse>} Uma promessa que resolve com a sugestão do Copilot.
 */
export async function askCopilotForGhCommand(description: string): Promise<CopilotResponse> {
  try {
    const { stdout } = await execAsync(`gh copilot suggest -t gh "${description}"`, {
      cwd: process.cwd(),
    });

    return parseCopilotResponse(stdout);
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Pede ao Copilot CLI para explicar um comando de shell.
 * @param {string} command - O comando a ser explicado.
 * @returns {Promise<CopilotResponse>} Uma promessa que resolve com a explicação do Copilot.
 */
export async function askCopilotToExplainCommand(command: string): Promise<CopilotResponse> {
  try {
    const { stdout } = await execAsync(`gh copilot explain "${command}"`, {
      cwd: process.cwd(),
    });

    return {
      success: true,
      explanation: stdout,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Analisa a saída de texto do `gh copilot` e a converte em um objeto `CopilotResponse` estruturado.
 * @private
 * @param {string} output - A saída padrão (stdout) do comando do Copilot.
 * @returns {CopilotResponse} O objeto de resposta estruturado.
 */
function parseCopilotResponse(output: string): CopilotResponse {
  const lines = output.split('\n');

  let command = '';
  let explanation = '';
  let inExplanation = false;

  for (const line of lines) {
    if (line.startsWith('Command:') || line.startsWith('Suggestion:')) {
      command = line.replace(/^(Command|Suggestion):\s*/, '').trim();
    } else if (line.startsWith('Explanation:')) {
      inExplanation = true;
      explanation = line.replace(/^Explanation:\s*/, '').trim();
    } else if (inExplanation) {
      explanation += '\n' + line;
    }
  }

  // Se não encontrou formato estruturado, retorna output inteiro
  if (!command && !explanation) {
    return {
      success: true,
      command: output.trim(),
    };
  }

  return {
    success: true,
    command: command || undefined,
    explanation: explanation || undefined,
  };
}

/**
 * Função auxiliar para obter um comando `find` complexo do Copilot.
 * @param {string} filePattern - O padrão dos arquivos a serem procurados (ex: "*.ts").
 * @param {string} criteria - Os critérios de busca (ex: "modificados na última semana").
 * @returns {Promise<string | null>} O comando sugerido ou `null` em caso de falha.
 */
export async function getCopilotFindCommand(
  filePattern: string,
  criteria: string,
): Promise<string | null> {
  const response = await askCopilotForShellCommand({
    description: `Find ${filePattern} files ${criteria}`,
  });

  return response.command || null;
}

/**
 * Função auxiliar para obter um workflow de git complexo do Copilot.
 * @param {string} workflow - A descrição do workflow desejado (ex: "Rebasear branch atual na main e resolver conflitos").
 * @returns {Promise<string | null>} O comando sugerido ou `null` em caso de falha.
 */
export async function getCopilotGitWorkflow(workflow: string): Promise<string | null> {
  const response = await askCopilotForGitCommand({
    description: workflow,
  });

  return response.command || null;
}

/**
 * NOTA: Copilot Editor/Chat não tem API CLI
 * Usar diretamente no editor:
 * - Comentários descritivos para sugestões inline
 * - @workspace para perguntas de alto nível
 * - /fix, /explain, /tests para comandos específicos
 */
