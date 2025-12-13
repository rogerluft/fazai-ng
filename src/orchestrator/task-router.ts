/**
 * Task Router - Orquestração Multi-Agente
 * Distribui tarefas para agentes especializados (Jules, Gemini, Copilot)
 */

export type AgentType = 'claude' | 'jules' | 'gemini' | 'copilot';

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

export interface JulesTask extends Task {
  /** Jules precisa de contexto técnico completo */
  technicalContext: string;
}

export interface RoutingDecision {
  agent: AgentType;
  reason: string;
  confidence: number;
}

/**
 * Decide qual agente deve executar a tarefa
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
 * Formata tarefa no template que Jules espera
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
 * Valida se tarefa é adequada para delegação
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
