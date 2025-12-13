/**
 * @file Task Router - Orquestração Multi-Agente
 * @description Este arquivo contém a lógica principal para distribuir tarefas para agentes especializados (Jules, Gemini, Copilot).
 * @module src/orchestrator/task-router
 */

/**
 * @typedef {'claude' | 'jules' | 'gemini' | 'copilot'} AgentType
 * @description Define os tipos de agentes disponíveis no sistema de orquestração.
 */
export type AgentType = 'claude' | 'jules' | 'gemini' | 'copilot';

/**
 * @interface Task
 * @description Representa uma tarefa genérica a ser executada por um agente.
 * @property {string} title - Título curto e descritivo da tarefa.
 * @property {string} objective - O resultado esperado que define o sucesso da tarefa.
 * @property {object} context - O contexto técnico da tarefa.
 * @property {string[]} [context.files] - Lista de arquivos relevantes para a tarefa.
 * @property {string[]} [context.errors] - Logs de erro ou stack traces, se aplicável.
 * @property {string} [context.currentBehavior] - Descrição do comportamento atual do sistema.
 * @property {string} [context.expectedBehavior] - Descrição do comportamento esperado após a conclusão da tarefa.
 * @property {string[]} [context.resources] - Links para documentação ou outros recursos externos.
 * @property {string[]} acceptanceCriteria - Lista de critérios mensuráveis para que a tarefa seja considerada concluída.
 */
export interface Task {
  title: string;
  objective: string;
  context: {
    files?: string[];
    errors?: string[];
    currentBehavior?: string;
    expectedBehavior?: string;
    resources?: string[];
  };
  acceptanceCriteria: string[];
}

/**
 * @interface JulesTask
 * @extends Task
 * @description Representa uma tarefa específica para o agente Jules, que requer contexto técnico adicional.
 * @property {string} technicalContext - String com detalhes técnicos adicionais que o Jules pode precisar.
 */
export interface JulesTask extends Task {
  /** Jules precisa de contexto técnico completo */
  technicalContext: string;
}

/**
 * @interface RoutingDecision
 * @description Representa a decisão de roteamento tomada pelo orquestrador.
 * @property {AgentType} agent - O agente selecionado para executar a tarefa.
 * @property {string} reason - A justificativa para a escolha do agente.
 * @property {number} confidence - Um valor de 0 a 1 que representa a confiança na decisão de roteamento.
 */
export interface RoutingDecision {
  agent: AgentType;
  reason: string;
  confidence: number;
}

/**
 * Decide qual agente é mais adequado para executar uma determinada tarefa com base em palavras-chave.
 * @param {Task} task - O objeto da tarefa a ser analisado.
 * @returns {RoutingDecision} A decisão de qual agente deve lidar com a tarefa.
 */
export function routeTask(task: Task): RoutingDecision {
  // Análise de keywords para decisão
  const keywords = {
    architecture: ['arquitetura', 'design', 'decisão', 'estratégia', 'api pública'],
    implementation: ['implementar', 'criar', 'adicionar feature', 'bug fix', 'refatorar'],
    bulkAnalysis: ['revisar', 'analisar', 'changelog', 'documentação completa', 'múltiplos arquivos'],
    webResearch: ['pesquisar', 'buscar', 'web', 'biblioteca', 'framework'],
    shellHelp: ['comando', 'shell', 'git', 'bash', 'find', 'awk', 'sed'],
  };

  const taskText = `${task.title} ${task.objective}`.toLowerCase();

  // Decisões estratégicas → Claude Code
  if (keywords.architecture.some(kw => taskText.includes(kw))) {
    return {
      agent: 'claude',
      reason: 'Decisão arquitetural estratégica - Tech Lead',
      confidence: 0.95,
    };
  }

  // Implementação autônoma → Jules
  if (keywords.implementation.some(kw => taskText.includes(kw))) {
    return {
      agent: 'jules',
      reason: 'Implementação/bug fix - Engenheiro autônomo',
      confidence: 0.9,
    };
  }

  // Análise massiva → Gemini 3
  if (keywords.bulkAnalysis.some(kw => taskText.includes(kw))) {
    const fileCount = task.context.files?.length || 0;
    if (fileCount > 10) {
      return {
        agent: 'gemini',
        reason: 'Análise bulk de múltiplos arquivos - Contexto 2M',
        confidence: 0.85,
      };
    }
  }

  // Pesquisa web → Gemini 3
  if (keywords.webResearch.some(kw => taskText.includes(kw))) {
    return {
      agent: 'gemini',
      reason: 'Pesquisa web com grounding gratuito',
      confidence: 0.8,
    };
  }

  // Comandos shell → Copilot CLI
  if (keywords.shellHelp.some(kw => taskText.includes(kw))) {
    return {
      agent: 'copilot',
      reason: 'Especialista em shell e git workflows',
      confidence: 0.75,
    };
  }

  // Default: Claude Code (orquestrador)
  return {
    agent: 'claude',
    reason: 'Tarefa não classificada - Orquestrador decide',
    confidence: 0.5,
  };
}

/**
 * Formata um objeto de tarefa no template de prompt específico que o agente Jules espera.
 * @param {JulesTask} task - O objeto da tarefa a ser formatado.
 * @returns {string} O prompt formatado como uma string, pronto para ser enviado ao Jules.
 */
export function formatJulesPrompt(task: JulesTask): string {
  const files = task.context.files?.map(f => `\`${f}\``).join(', ') || 'Não especificado';
  const errors = task.context.errors?.join('\n') || 'Nenhum';

  return `Olá Jules,

**Tarefa:** ${task.title}

**Objetivo Final:** ${task.objective}

**Contexto Técnico:**
*   **Arquivos Principais:** ${files}
*   **Logs de Erro:**
\`\`\`
${errors}
\`\`\`
*   **Comportamento Atual vs. Esperado:** ${task.context.currentBehavior || 'N/A'} → ${task.context.expectedBehavior || 'N/A'}
*   **Recursos Externos:** ${task.context.resources?.join(', ') || 'Nenhum'}

**Critérios de Aceitação:**
${task.acceptanceCriteria.map((c, i) => `${i + 1}.  ${c}`).join('\n')}

Por favor, analise o cenário e me apresente seu plano de ação.`;
}

/**
 * Valida se uma tarefa é adequada para ser delegada a um agente específico, com base em regras de segurança e governança.
 * @param {Task} task - A tarefa a ser validada.
 * @param {AgentType} toAgent - O agente para o qual a tarefa seria delegada.
 * @returns {boolean} Retorna `true` se a delegação for segura, e `false` caso contrário.
 */
export function canDelegate(task: Task, toAgent: AgentType): boolean {
  // Nunca delegar decisões críticas
  const criticalKeywords = ['security', 'segurança', 'api pública', 'breaking change'];
  const taskText = `${task.title} ${task.objective}`.toLowerCase();

  if (criticalKeywords.some(kw => taskText.includes(kw)) && toAgent !== 'claude') {
    return false;
  }

  // Jules precisa de critérios de aceitação claros
  if (toAgent === 'jules' && task.acceptanceCriteria.length === 0) {
    return false;
  }

  return true;
}
