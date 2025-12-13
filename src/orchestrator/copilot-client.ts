/**
 * Copilot Client - Comunicação com GitHub Copilot CLI
 * Copilot é um assistente de comandos shell/git, não executa tarefas autônomas
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface CopilotShellRequest {
  description: string; // Ex: "Find all TypeScript files modified in last week"
}

export interface CopilotGitRequest {
  description: string; // Ex: "Rebase current branch on main and resolve conflicts"
}

export interface CopilotResponse {
  success: boolean;
  command?: string;
  explanation?: string;
  error?: string;
}

/**
 * Pede sugestão de comando shell para Copilot
 * Copilot CLI retorna comando + explicação
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
 * Pede sugestão de comando git para Copilot
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
 * Pede sugestão de comando gh (GitHub CLI) para Copilot
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
 * Pede explicação de comando para Copilot
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
 * Parse resposta de Copilot CLI
 * Formato típico: "Command: ...\n\nExplanation: ..."
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
 * Helpers para casos de uso comuns
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
