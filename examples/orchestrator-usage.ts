/**
 * @file Orchestrator Usage Examples
 * @description Examples demonstrating how to use the FazAI multi-agent orchestration system
 */

import {
  routeTask,
  formatJulesPrompt,
  canDelegate,
  delegateToJules,
  delegateToGemini,
  askGeminiForApproaches,
  askCopilotForShellCommand,
  type Task,
  type JulesTask,
} from '../src/orchestrator';

/**
 * Example 1: Automatic Task Routing
 * The orchestrator automatically determines which agent should handle a task
 */
async function example1_automaticRouting() {
  console.log('=== Example 1: Automatic Task Routing ===\n');

  // Define a task
  const task: Task = {
    title: 'Implement Redis caching',
    objective: 'Add caching layer to user lookup function',
    context: {
      files: ['src/user.service.ts'],
      errors: ['Timeout on user fetch after 5 seconds'],
      expectedBehavior: 'User lookup completes in < 100ms',
    },
    acceptanceCriteria: ['Tests passing', 'Response time < 100ms', 'TTL of 1 hour'],
  };

  // Route the task
  const decision = routeTask(task);

  console.log(`Task: ${task.title}`);
  console.log(`Routed to: ${decision.agent}`);
  console.log(`Reason: ${decision.reason}`);
  console.log(`Confidence: ${(decision.confidence * 100).toFixed(0)}%`);
  console.log('');
}

/**
 * Example 2: Delegating to Jules for Implementation
 * Shows how to delegate a complete implementation task to Jules
 */
async function example2_delegateToJules() {
  console.log('=== Example 2: Delegating to Jules ===\n');

  const julesTask: JulesTask = {
    title: 'Fix authentication timeout',
    objective: 'Resolve JWT token validation timeout issue',
    context: {
      files: ['src/auth/jwt.ts', 'src/middleware/auth.ts'],
      errors: [
        'Error: JWT validation timeout after 30s',
        'Stack trace: at verifyToken (jwt.ts:42)',
      ],
      currentBehavior: 'Authentication takes 30+ seconds',
      expectedBehavior: 'Authentication completes in < 1 second',
      resources: ['https://jwt.io/introduction'],
    },
    acceptanceCriteria: [
      'Authentication completes in < 1 second',
      'All existing tests still pass',
      'New tests added for timeout scenario',
    ],
    technicalContext: 'Using jsonwebtoken v9.0.0, Redis for token storage',
  };

  // Check if delegation is safe
  if (!canDelegate(julesTask, 'jules')) {
    console.log('❌ Cannot delegate this task to Jules (security concern)');
    return;
  }

  // Format the prompt
  const prompt = formatJulesPrompt(julesTask);
  console.log('Jules Prompt:');
  console.log(prompt);
  console.log('');

  // In a real scenario, you would:
  // const result = await delegateToJules(julesTask);
  // if (result.plan) {
  //   console.log("Jules's plan:", result.plan);
  //   await approveJulesPlan();
  // }
}

/**
 * Example 3: Using Gemini for Multiple Approaches
 * Ask Gemini to compare different approaches for solving a problem
 */
async function example3_geminiApproaches() {
  console.log('=== Example 3: Gemini - Multiple Approaches ===\n');

  const problem = 'Implement rate limiting for API endpoints';
  const context = `
    We have a Node.js Express API with multiple endpoints.
    Current traffic: ~1000 requests/second
    Requirements: 
    - Different limits per endpoint
    - User-based rate limiting
    - Redis available for distributed state
  `;

  console.log('Problem:', problem);
  console.log('Context:', context.trim());
  console.log('\nAsking Gemini for different approaches...\n');

  // In a real scenario:
  // const response = await askGeminiForApproaches(problem, context);
  // if (response.success && response.approaches) {
  //   response.approaches.forEach((approach, i) => {
  //     console.log(`\nApproach ${i + 1}: ${approach.name}`);
  //     console.log('Pros:', approach.pros);
  //     console.log('Cons:', approach.cons);
  //   });
  // }

  console.log('(Would receive 2-3 different approaches with pros/cons)');
}

/**
 * Example 4: Using Copilot for Shell Commands
 * Get shell command suggestions from GitHub Copilot CLI
 */
async function example4_copilotShell() {
  console.log('=== Example 4: Copilot CLI - Shell Commands ===\n');

  const description = 'Find all TypeScript files modified in the last 7 days';
  console.log('Description:', description);
  console.log('\nAsking Copilot for shell command...\n');

  // In a real scenario:
  // const response = await askCopilotForShellCommand({ description });
  // if (response.success) {
  //   console.log('Command:', response.command);
  //   console.log('Explanation:', response.explanation);
  // }

  console.log('(Would receive optimized find/grep command)');
}

/**
 * Example 5: Complete Workflow with Safety Checks
 * Demonstrates a complete workflow with routing, validation, and delegation
 */
async function example5_completeWorkflow() {
  console.log('=== Example 5: Complete Workflow ===\n');

  // Step 1: Define the task
  const task: Task = {
    title: 'Update password hashing algorithm',
    objective: 'Migrate from bcrypt to argon2 for password hashing',
    context: {
      files: ['src/auth/password.ts', 'src/models/user.ts'],
      currentBehavior: 'Using bcrypt with cost factor 10',
      expectedBehavior: 'Using argon2id with secure defaults',
    },
    acceptanceCriteria: [
      'All passwords can still be verified',
      'New passwords use argon2',
      'Migration script for existing passwords',
      'Security tests pass',
    ],
  };

  console.log('Step 1: Task Definition');
  console.log('Title:', task.title);
  console.log('');

  // Step 2: Route the task
  const decision = routeTask(task);
  console.log('Step 2: Routing Decision');
  console.log('Agent:', decision.agent);
  console.log('Reason:', decision.reason);
  console.log('');

  // Step 3: Check if delegation is allowed (security keyword!)
  console.log('Step 3: Security Check');
  const safeForJules = canDelegate(task, 'jules');
  const safeForClaude = canDelegate(task, 'claude');
  
  console.log('Can delegate to Jules?', safeForJules ? '✅' : '❌');
  console.log('Can delegate to Claude?', safeForClaude ? '✅' : '✅');
  console.log('');

  // Security-critical tasks must go to Claude
  if (!safeForJules && decision.agent === 'jules') {
    console.log('Step 4: Re-routing for Security');
    console.log('This is a security-critical task, must be handled by Claude Code');
    console.log('');
  }
}

/**
 * Example 6: Task Priority Matrix
 * Shows how different tasks are routed to different agents
 */
async function example6_priorityMatrix() {
  console.log('=== Example 6: Task Priority Matrix ===\n');

  const tasks = [
    { title: 'Design new API architecture', expected: 'claude' },
    { title: 'Implement new feature', expected: 'jules' },
    { title: 'Review 30 code files', expected: 'gemini' },
    { title: 'Research best practices for TypeScript', expected: 'gemini' },
    { title: 'Need git rebase command', expected: 'copilot' },
    { title: 'Security audit required', expected: 'claude' },
  ];

  console.log('Task Routing Results:\n');
  console.log('Task                                    → Agent     | Reason');
  console.log('─'.repeat(80));

  for (const { title, expected } of tasks) {
    const task: Task = {
      title,
      objective: title,
      context: title.includes('30 files') ? { files: Array(30).fill('file.ts') } : {},
      acceptanceCriteria: ['Done'],
    };

    const decision = routeTask(task);
    const match = decision.agent === expected ? '✅' : '⚠️';
    console.log(
      `${match} ${title.padEnd(40)} → ${decision.agent.padEnd(10)} | ${decision.reason}`
    );
  }
}

// Main execution
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  FazAI Multi-Agent Orchestration System - Examples        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  await example1_automaticRouting();
  await example2_delegateToJules();
  await example3_geminiApproaches();
  await example4_copilotShell();
  await example5_completeWorkflow();
  await example6_priorityMatrix();

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Examples completed successfully!                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  example1_automaticRouting,
  example2_delegateToJules,
  example3_geminiApproaches,
  example4_copilotShell,
  example5_completeWorkflow,
  example6_priorityMatrix,
};
