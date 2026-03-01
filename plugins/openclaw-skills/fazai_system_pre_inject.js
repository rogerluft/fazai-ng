/**
 * OpenClaw Skill: Fazai Pre-Injection Hook
 *
 * This tool utilizes Fazai's memory and RAG pre-injection architecture.
 * Instead of relying entirely on OpenClaw's prompt system, it fetches
 * Fazai's pre-compiled context to append to the system prompt dynamically.
 */

import { execSync } from 'child_process';

export const name = 'fazai_system_pre_inject';
export const description = 'Injects deep context (personality, KB, RAG) from Fazai dynamically.';

export const parameters = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'The current user query to derive context for.',
    }
  },
  required: ['query'],
};

export async function execute(args, context) {
  try {
    // Calling an internal Fazai helper to get enriched context without generating a response
    // For now, we utilize the "fazai memory search" to pre-inject context
    const output = execSync(`fazai memory search "${args.query}" 3`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    return "Pre-Injected Fazai Context:\n" + output;
  } catch (error) {
    return "Failed to pre-inject Fazai context.";
  }
}
