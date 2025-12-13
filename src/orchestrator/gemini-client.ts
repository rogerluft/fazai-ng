/**
 * Gemini Client - Comunicação com Gemini 3 (Google)
 * Gemini é um modelo de linguagem multimodal com contexto 2M tokens
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GeminiTask {
  role: string; // Ex: "Engenheiro de Software Sênior, especialista em TypeScript"
  context: string; // Código, arquitetura, dependências
  intention: string; // O que queremos
  requirements: string[]; // Lista de requisitos
  format: 'code-only' | 'explanation-code' | 'multiple-approaches';
}

export interface GeminiResponse {
  success: boolean;
  content?: string;
  error?: string;
  approaches?: Array<{
    name: string;
    pros: string[];
    cons: string[];
    code: string;
  }>;
}

/**
 * Delega tarefa para Gemini via CLI
 * Usa estratégia: Contexto, Intenção, Formato
 */
export async function delegateToGemini(task: GeminiTask): Promise<GeminiResponse> {
  try {
    const prompt = formatGeminiPrompt(task);

    // Gemini opera via gemini-cli
    const { stdout, stderr } = await execAsync(`gemini-cli "${escapePrompt(prompt)}"`, {
      cwd: process.cwd(),
      maxBuffer: 20 * 1024 * 1024, // 20MB buffer (contexto 2M tokens)
    });

    if (stderr && !stdout) {
      return {
        success: false,
        error: stderr,
      };
    }

    return {
      success: true,
      content: stdout,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Usa Gemini via Jules (já integrado)
 * Jules pode chamar Gemini internamente
 */
export async function delegateToGeminiViaJules(task: GeminiTask): Promise<GeminiResponse> {
  try {
    const prompt = formatGeminiPrompt(task);

    // Jules pode usar Gemini como backend
    const { stdout } = await execAsync(`echo "${escapePrompt(prompt)}" | jules --use-gemini`, {
      cwd: process.cwd(),
      maxBuffer: 20 * 1024 * 1024,
    });

    return {
      success: true,
      content: stdout,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Formata prompt no template que Gemini espera
 * Estratégia: Contexto, Intenção, Formato
 */
function formatGeminiPrompt(task: GeminiTask): string {
  const formatInstructions = {
    'code-only': 'Por favor, me forneça apenas o código completo, pronto para copiar e colar. Não adicione explicações.',
    'explanation-code': 'Por favor, explique o código passo a passo primeiro, e depois forneça o bloco de código completo.',
    'multiple-approaches': 'Por favor, me apresente 2-3 abordagens diferentes para resolver este problema, com os prós e contras de cada uma.',
  };

  return `Olá Gemini,

**Meu Papel:** Eu sou o desenvolvedor orquestrador (Claude Code).
**Seu Papel:** Você é ${task.role}.

**Contexto:**
${task.context}

**Intenção:**
${task.intention}

**Requisitos:**
${task.requirements.map((r, i) => `${i + 1}.  ${r}`).join('\n')}

**Formato da Resposta:**
${formatInstructions[task.format]}`;
}

/**
 * Pede para Gemini comparar múltiplas abordagens
 */
export async function askGeminiForApproaches(
  problem: string,
  context: string,
): Promise<GeminiResponse> {
  const task: GeminiTask = {
    role: 'Arquiteto de Software Sênior',
    context,
    intention: `Quero avaliar diferentes abordagens para: ${problem}`,
    requirements: [
      'Apresente 2-3 abordagens distintas',
      'Para cada abordagem, liste prós e contras claros',
      'Inclua snippet de código exemplo para cada uma',
    ],
    format: 'multiple-approaches',
  };

  return delegateToGemini(task);
}

/**
 * Pede para Gemini analisar código massivo (usa contexto 2M)
 */
export async function askGeminiToAnalyzeBulk(files: string[]): Promise<GeminiResponse> {
  const fs = await import('fs/promises');

  // Lê todos os arquivos
  const fileContents = await Promise.all(
    files.map(async (file) => {
      const content = await fs.readFile(file, 'utf-8');
      return `\n\n// File: ${file}\n${content}`;
    }),
  );

  const task: GeminiTask = {
    role: 'Code Reviewer Sênior',
    context: `Preciso revisar os seguintes arquivos:\n${fileContents.join('\n')}`,
    intention: 'Quero uma análise completa identificando: bugs potenciais, problemas de performance, code smells, e sugestões de melhoria',
    requirements: [
      'Liste todos os problemas encontrados por arquivo',
      'Priorize por severidade (crítico, médio, baixo)',
      'Sugira correções específicas para cada problema',
    ],
    format: 'explanation-code',
  };

  return delegateToGemini(task);
}

/**
 * Pede para Gemini fazer pesquisa web com grounding
 */
export async function askGeminiToResearchWeb(query: string): Promise<GeminiResponse> {
  const task: GeminiTask = {
    role: 'Pesquisador Técnico Sênior',
    context: `Preciso de informações atualizadas sobre: ${query}`,
    intention: 'Quero um resumo completo com fontes confiáveis',
    requirements: [
      'Use grounding web para buscar informações atualizadas',
      'Cite todas as fontes',
      'Resuma os pontos principais',
      'Identifique consensos e divergências',
    ],
    format: 'explanation-code',
  };

  return delegateToGemini(task);
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
