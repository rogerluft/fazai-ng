/**
 * @file Gemini Client - Comunicação com Gemini 3 (Google)
 * @description Este arquivo implementa o cliente para interagir com o modelo de linguagem Gemini.
 * Ele é otimizado para tarefas que exigem grande janela de contexto, raciocínio complexo e pesquisa web.
 * @module src/orchestrator/gemini-client
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * @interface GeminiTask
 * @description Define a estrutura de uma tarefa a ser delegada para o Gemini, seguindo a estratégia "Contexto, Intenção, Formato".
 * @property {string} role - O "papel" ou persona que o Gemini deve assumir (ex: "Engenheiro de Software Sênior").
 * @property {string} context - Todo o contexto necessário para a tarefa (código, logs, descrições).
 * @property {string} intention - O objetivo claro e direto da tarefa.
 * @property {string[]} requirements - Uma lista de requisitos específicos que a resposta deve cumprir.
 * @property {'code-only' | 'explanation-code' | 'multiple-approaches'} format - O formato desejado para a resposta do Gemini.
 */
export interface GeminiTask {
  role: string;
  context: string;
  intention: string;
  requirements: string[];
  format: 'code-only' | 'explanation-code' | 'multiple-approaches';
}

/**
 * @interface GeminiResponse
 * @description Define a estrutura da resposta retornada pelo Gemini.
 * @property {boolean} success - Indica se a operação foi bem-sucedida.
 * @property {string} [content] - O conteúdo principal da resposta do Gemini.
 * @property {string} [error] - Uma mensagem de erro, se a operação falhou.
 * @property {object[]} [approaches] - Um array de abordagens diferentes, se solicitado no formato 'multiple-approaches'.
 */
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
 * Delega uma tarefa para o Gemini via sua própria CLI (`gemini-cli`).
 * @param {GeminiTask} task - O objeto da tarefa a ser delegada.
 * @returns {Promise<GeminiResponse>} Uma promessa que resolve com a resposta do Gemini.
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
 * Delega uma tarefa para o Gemini através do agente Jules, que pode atuar como um proxy.
 * @param {GeminiTask} task - O objeto da tarefa a ser delegada.
 * @returns {Promise<GeminiResponse>} Uma promessa que resolve com a resposta do Gemini.
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
 * Formata um objeto de tarefa no template de prompt específico que o Gemini espera.
 * @private
 * @param {GeminiTask} task - O objeto da tarefa a ser formatado.
 * @returns {string} O prompt formatado como uma string.
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
 * Cria e delega uma tarefa para o Gemini comparar múltiplas abordagens para resolver um problema.
 * @param {string} problem - A descrição do problema a ser resolvido.
 * @param {string} context - O contexto técnico do problema.
 * @returns {Promise<GeminiResponse>} A resposta do Gemini com as diferentes abordagens.
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
 * Pede para o Gemini analisar um grande volume de código de múltiplos arquivos, aproveitando sua grande janela de contexto.
 * @param {string[]} files - Um array de caminhos para os arquivos a serem analisados.
 * @returns {Promise<GeminiResponse>} A resposta do Gemini com a análise do código.
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
 * Pede para o Gemini realizar uma pesquisa web sobre um determinado tópico usando sua capacidade de "grounding".
 * @param {string} query - O tópico ou pergunta a ser pesquisado.
 * @returns {Promise<GeminiResponse>} A resposta do Gemini com o resumo da pesquisa.
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
 * Escapa uma string para uso seguro em comandos shell.
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
