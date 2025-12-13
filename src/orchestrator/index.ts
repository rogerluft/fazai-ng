
     /**
      * Orchestrator - Sistema de Orquestração Multi-Agente FazAI
      *
      * Coordena Claude Code, Jules, Gemini 3, e Copilot
      * para otimizar performance e economizar tokens
      */

     export { routeTask, formatJulesPrompt, canDelegate } from './task-router';
     export type { Task, JulesTask, RoutingDecision, AgentType } from './task-router';

     export {
       delegateToJules,
       approveJulesPlan,
       respondToJules,
       listJulesSessions,
     } from './jules-client';
     export type { JulesResponse } from './jules-client';

     export {
       delegateToGemini,
       delegateToGeminiViaJules,
       askGeminiForApproaches,
       askGeminiToAnalyzeBulk,
       askGeminiToResearchWeb,
     } from './gemini-client';
     export type { GeminiTask, GeminiResponse } from './gemini-client';

     export {
       askCopilotForShellCommand,
       askCopilotForGitCommand,
       askCopilotForGhCommand,
       askCopilotToExplainCommand,
       getCopilotFindCommand,
       getCopilotGitWorkflow,
     } from './copilot-client';
     export type { CopilotShellRequest, CopilotGitRequest, CopilotResponse } from './copilot-client';

     /**
      * Exemplo de uso:
      *
      * ```typescript
      * import { routeTask, delegateToJules, delegateToGemini } from './orchestrator';
      *
      * const task = {
      *   title: "Implementar cache Redis",
      *   objective: "Adicionar caching na função findUser",
      *   context: { files: ["src/user.service.ts"] },
      *   acceptanceCriteria: ["Testes passando", "TTL de 1 hora"]
      * };
      *
      * const decision = routeTask(task);
      *
      * if (decision.agent === 'jules') {
      *   const result = await delegateToJules(task as JulesTask);
      *   if (result.plan) {
      *     console.log("Plano apresentado:", result.plan);
      *     await approveJulesPlan();
      *   }
      * }
      * ```
      */
