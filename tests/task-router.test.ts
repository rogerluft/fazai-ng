/**
 * @file Tests for Task Router - Multi-Agent Orchestration
 * @description Unit tests for the task routing logic that determines which agent should handle each task
 */

import { describe, it, expect } from 'vitest';
import {
  routeTask,
  formatJulesPrompt,
  canDelegate,
  type Task,
  type JulesTask,
} from '../src/orchestrator/task-router';

describe('Task Router - Multi-Agent Orchestration', () => {
  describe('routeTask', () => {
    it('should route architectural decisions to Claude Code', () => {
      const task: Task = {
        title: 'Design new API architecture',
        objective: 'Create a scalable REST API design',
        context: {
          files: ['src/api/index.ts'],
        },
        acceptanceCriteria: ['Well-documented', 'Scalable', 'Secure'],
      };

      const decision = routeTask(task);

      expect(decision.agent).toBe('claude');
      expect(decision.reason).toContain('arquitetural');
      expect(decision.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should route implementation tasks to Jules', () => {
      const task: Task = {
        title: 'Implement Redis cache',
        objective: 'Add caching to user lookup function',
        context: {
          files: ['src/user.service.ts'],
          errors: ['Timeout on user fetch'],
        },
        acceptanceCriteria: ['Tests passing', '1 hour TTL'],
      };

      const decision = routeTask(task);

      expect(decision.agent).toBe('jules');
      expect(decision.reason).toContain('Implementação');
      expect(decision.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('should route bug fixes to Jules', () => {
      const task: Task = {
        title: 'Fix authentication bug',
        objective: 'Resolve login timeout issue',
        context: {
          files: ['src/auth.ts'],
          errors: ['Error: Connection timeout after 30s'],
        },
        acceptanceCriteria: ['Bug fixed', 'Tests added', 'No regression'],
      };

      const decision = routeTask(task);

      expect(decision.agent).toBe('jules');
      expect(decision.reason).toContain('bug fix');
    });

    it('should route bulk analysis to Gemini with many files', () => {
      const task: Task = {
        title: 'Review entire codebase',
        objective: 'Analyze all TypeScript files for code smells',
        context: {
          files: Array(20).fill('src/file.ts'),
        },
        acceptanceCriteria: ['All files reviewed', 'Report generated'],
      };

      const decision = routeTask(task);

      expect(decision.agent).toBe('gemini');
      expect(decision.reason).toContain('bulk');
      expect(decision.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should route web research to Gemini', () => {
      const task: Task = {
        title: 'Research best practices',
        objective: 'Find latest information about TypeScript patterns',
        context: {},
        acceptanceCriteria: ['Recent sources', 'Cited references'],
      };

      const decision = routeTask(task);

      expect(decision.agent).toBe('gemini');
      expect(decision.reason).toContain('web');
    });

    it('should route shell commands to Copilot', () => {
      const task: Task = {
        title: 'Help with find command',
        objective: 'Need a bash command to find all .ts files modified this week',
        context: {},
        acceptanceCriteria: ['Working command'],
      };

      const decision = routeTask(task);

      expect(decision.agent).toBe('copilot');
      expect(decision.reason).toContain('shell');
    });

    it('should route git workflows to Copilot', () => {
      const task: Task = {
        title: 'Rebase workflow',
        objective: 'Help with git rebase and conflict resolution',
        context: {},
        acceptanceCriteria: ['Step-by-step guide'],
      };

      const decision = routeTask(task);

      expect(decision.agent).toBe('copilot');
      expect(decision.reason).toContain('git');
    });

    it('should default to Claude for unclassified tasks', () => {
      const task: Task = {
        title: 'Unknown task',
        objective: 'Some random objective',
        context: {},
        acceptanceCriteria: ['Done'],
      };

      const decision = routeTask(task);

      expect(decision.agent).toBe('claude');
      expect(decision.reason).toContain('não classificada');
      expect(decision.confidence).toBeLessThan(0.7);
    });

    it('should handle tasks with multiple keywords prioritizing architecture', () => {
      const task: Task = {
        title: 'Design and implement new feature',
        objective: 'Create architecture and implement user management',
        context: {},
        acceptanceCriteria: ['Designed', 'Implemented'],
      };

      const decision = routeTask(task);

      // Architecture should take precedence
      expect(decision.agent).toBe('claude');
      expect(decision.reason).toContain('arquitetural');
    });
  });

  describe('formatJulesPrompt', () => {
    it('should format a complete Jules task prompt', () => {
      const task: JulesTask = {
        title: 'Implement cache',
        objective: 'Add Redis caching to user service',
        context: {
          files: ['src/user.service.ts', 'src/cache.ts'],
          errors: ['Timeout error on line 42'],
          currentBehavior: 'Slow user lookups',
          expectedBehavior: 'Fast cached lookups',
          resources: ['https://redis.io/docs'],
        },
        acceptanceCriteria: ['Tests pass', 'Response time < 100ms', 'TTL of 1 hour'],
        technicalContext: 'Using ioredis library v5.3.0',
      };

      const prompt = formatJulesPrompt(task);

      expect(prompt).toContain('Olá Jules');
      expect(prompt).toContain('**Tarefa:** Implement cache');
      expect(prompt).toContain('**Objetivo Final:** Add Redis caching to user service');
      expect(prompt).toContain('src/user.service.ts');
      expect(prompt).toContain('src/cache.ts');
      expect(prompt).toContain('Timeout error on line 42');
      expect(prompt).toContain('Slow user lookups');
      expect(prompt).toContain('Fast cached lookups');
      expect(prompt).toContain('https://redis.io/docs');
      expect(prompt).toContain('1.  Tests pass');
      expect(prompt).toContain('2.  Response time < 100ms');
      expect(prompt).toContain('3.  TTL of 1 hour');
    });

    it('should handle minimal Jules task without optional fields', () => {
      const task: JulesTask = {
        title: 'Simple fix',
        objective: 'Fix typo',
        context: {},
        acceptanceCriteria: ['Fixed'],
        technicalContext: 'Simple text change',
      };

      const prompt = formatJulesPrompt(task);

      expect(prompt).toContain('Olá Jules');
      expect(prompt).toContain('Simple fix');
      expect(prompt).toContain('Fix typo');
      expect(prompt).toContain('N/A');
    });

    it('should properly escape special characters in task data', () => {
      const task: JulesTask = {
        title: 'Fix "authentication" bug',
        objective: "Handle user's input",
        context: {
          errors: ['Error: Invalid $TOKEN'],
        },
        acceptanceCriteria: ['Works with special chars: <>'],
        technicalContext: 'Use `process.env`',
      };

      const prompt = formatJulesPrompt(task);

      expect(prompt).toContain('"authentication"');
      expect(prompt).toContain("user's");
      expect(prompt).toContain('$TOKEN');
      expect(prompt).toContain('`process.env`');
    });
  });

  describe('canDelegate', () => {
    it('should allow delegation of normal tasks to Jules', () => {
      const task: Task = {
        title: 'Implement feature',
        objective: 'Add new functionality',
        context: {},
        acceptanceCriteria: ['Tests pass', 'Code reviewed'],
      };

      const result = canDelegate(task, 'jules');

      expect(result).toBe(true);
    });

    it('should prevent delegation of security-critical tasks to non-Claude agents', () => {
      const task: Task = {
        title: 'Security audit',
        objective: 'Review authentication security',
        context: {},
        acceptanceCriteria: ['Vulnerabilities fixed'],
      };

      expect(canDelegate(task, 'jules')).toBe(false);
      expect(canDelegate(task, 'gemini')).toBe(false);
      expect(canDelegate(task, 'copilot')).toBe(false);
      expect(canDelegate(task, 'claude')).toBe(true);
    });

    it('should prevent delegation of API-breaking changes to non-Claude agents', () => {
      const task: Task = {
        title: 'Update API pública',
        objective: 'Change public API interface',
        context: {},
        acceptanceCriteria: ['Backward compatible'],
      };

      expect(canDelegate(task, 'jules')).toBe(false);
      expect(canDelegate(task, 'claude')).toBe(true);
    });

    it('should require acceptance criteria for Jules tasks', () => {
      const taskWithoutCriteria: Task = {
        title: 'Do something',
        objective: 'Complete the task',
        context: {},
        acceptanceCriteria: [],
      };

      expect(canDelegate(taskWithoutCriteria, 'jules')).toBe(false);
    });

    it('should allow tasks without criteria for other agents', () => {
      const taskWithoutCriteria: Task = {
        title: 'Research topic',
        objective: 'Find information',
        context: {},
        acceptanceCriteria: [],
      };

      expect(canDelegate(taskWithoutCriteria, 'gemini')).toBe(true);
      expect(canDelegate(taskWithoutCriteria, 'copilot')).toBe(true);
      expect(canDelegate(taskWithoutCriteria, 'claude')).toBe(true);
    });

    it('should handle case-insensitive security keyword detection', () => {
      const task: Task = {
        title: 'SECURITY review',
        objective: 'Check SEGURANÇA',
        context: {},
        acceptanceCriteria: ['Secure'],
      };

      expect(canDelegate(task, 'jules')).toBe(false);
    });
  });

  describe('Integration scenarios', () => {
    it('should correctly route and validate a complete workflow', () => {
      // Step 1: Route the task
      const task: Task = {
        title: 'Implement user authentication',
        objective: 'Add JWT-based authentication to the API',
        context: {
          files: ['src/auth/jwt.ts', 'src/middleware/auth.ts'],
          expectedBehavior: 'Secure token-based authentication',
        },
        acceptanceCriteria: [
          'JWT tokens generated correctly',
          'Middleware validates tokens',
          'Tests cover happy and error paths',
        ],
      };

      const decision = routeTask(task);

      // Should route to Jules for implementation
      expect(decision.agent).toBe('jules');

      // Step 2: Check if delegation is allowed
      const canDelegateToJules = canDelegate(task, decision.agent);
      expect(canDelegateToJules).toBe(true);

      // Step 3: Format prompt for Jules
      const julesTask: JulesTask = {
        ...task,
        technicalContext: 'Using jsonwebtoken library v9.0.0',
      };

      const prompt = formatJulesPrompt(julesTask);

      expect(prompt).toContain('JWT-based authentication');
      expect(prompt).toContain('JWT tokens generated correctly');
    });

    it('should prevent and re-route security-critical tasks', () => {
      const securityTask: Task = {
        title: 'Fix security vulnerability',
        objective: 'Patch SQL injection in user query',
        context: {
          errors: ['CVE-2024-1234: SQL Injection detected'],
        },
        acceptanceCriteria: ['Vulnerability patched', 'Security test added'],
      };

      // First routing attempt
      const firstDecision = routeTask(securityTask);

      // Even if routed elsewhere initially, canDelegate should block it
      const canDelegateToJules = canDelegate(securityTask, 'jules');
      expect(canDelegateToJules).toBe(false);

      // Only Claude can handle it
      const canDelegateToClaude = canDelegate(securityTask, 'claude');
      expect(canDelegateToClaude).toBe(true);
    });
  });
});
