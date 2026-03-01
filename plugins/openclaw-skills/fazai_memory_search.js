/**
 * OpenClaw Skill: Fazai Memory Search
 *
 * This tool replaces the default memory_search in OpenClaw by wrapping
 * the "fazai memory search" command. This allows the OpenClaw agent to
 * query the local Qdrant vector database where all memories were migrated.
 */

import { execSync } from 'child_process';

export const name = 'fazai_memory_search';
export const description = 'Semantic search over agent memories using the Fazai Qdrant backend.';

export const parameters = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'The search query or concept to look up in the memory database.',
    },
    limit: {
      type: 'number',
      description: 'The maximum number of results to return (default is 5).',
    }
  },
  required: ['query'],
};

export async function execute(args, context) {
  try {
    const limit = args.limit || 5;
    // We assume 'fazai' is available in the PATH or we use the local /usr/local/bin/fazai
    const output = execSync(`fazai memory search "${args.query}" ${limit}`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    return output;
  } catch (error) {
    if (error.stdout) {
      return error.stdout.toString();
    }
    return `Error executing fazai memory search: ${error.message}`;
  }
}
