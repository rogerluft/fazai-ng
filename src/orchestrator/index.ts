
     /**
      * Orchestrator - Sistema de Orquestração Multi-Agente FazAI
      *
      * Coordena Claude Code, Jules, Gemini 3, e Copilot
      * para otimizar performance e economizar tokens
      */

     export { routeTask, formatJulesPrompt, canDelegate } from './task-router';
     export type { Task, JulesTask, RoutingDecision, AgentType } from './task-router';

     // Jules CLI Client (legacy - via command line)
     export {
       delegateToJules,
       approveJulesPlan,
       respondToJules,
       listJulesSessions,
     } from './jules-client';
     export type { JulesResponse } from './jules-client';

     // Jules API Client (new - via REST API)
     export {
       JulesAPIClient,
       createJulesAPIClient,
       getJulesAPIClient,
       julesApiClient,
     } from './jules-api-client';
     export type {
       Source,
       Session,
       Message,
       SourceContext,
       GitHubRepoContext,
       CreateSessionRequest,
       SendMessageRequest,
       SendMessageResponse,
       ListSourcesResponse,
       ListSessionsResponse,
       JulesAPIError,
     } from './jules-api-client';

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

     // Qdrant Management
     export * from './qdrant-backup';
     export * from './qdrant-metrics';
     export * from './qdrant-import-export';
     export * from './qdrant-container';

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
