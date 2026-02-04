/**
 * @module orchestrator/resilience-orchestrator
 * @description Implements the multi-level resilience and fallback workflow for task execution.
 */

import { logger } from '../logger';
import { AgenticWebCrawler, SearchResult } from '../research/web-crawler';
import { getConfigValue } from '../config';
import { askAI } from '../askAI';
import { models } from '../models';

/**
 * Defines the execution status at each level of the resilience workflow.
 */
export interface ExecutionResult {
  success: boolean;
  level: string;
  data?: any;
  error?: string;
  finalAnswer?: string;
}

/**
 * Orchestrates task execution with a 4-level resilience and fallback logic.
 */
export class ResilienceOrchestrator {
  private webCrawler: AgenticWebCrawler;

  constructor() {
    this.webCrawler = new AgenticWebCrawler();
    logger.debug('ResilienceOrchestrator initialized.');
  }

  /**
   * Executes a given task (e.g., a user query) following the complete resilience workflow.
   * @param query The user's query or task.
   * @returns A final result after progressing through the necessary fallback levels.
   */
  public async executeTaskWithResilience(query: string): Promise<ExecutionResult> {
    logger.info(`🚀 Starting resilient execution for query: "${query}"`);

    // Level 1 & 2: AI Model Execution (Placeholder)
    // This part will be implemented in the next step. It will handle retries and fallbacks between AI models.
    const aiResult = await this.tryAiModels(query);
    if (aiResult.success) {
      logger.info('✅ Task completed successfully at AI level.');
      return aiResult;
    }
    logger.warn('⚠️ AI models failed to execute the task. Moving to knowledge fallback.');

    // Level 3: Context7 Fallback (se configurado)
    const context7Configured = getConfigValue('MCP_CONTEXT7_URL') || getConfigValue('MCP_CONTEXT7_COMMAND');
    if (context7Configured) {
      const context7Result = await this.tryContext7(query);
      if (context7Result.success) {
        logger.info('✅ Task resolved using Context7 knowledge base.');
        return context7Result;
      }
      logger.warn('⚠️ Context7 lookup failed or yielded no results. Moving to web search.');
    } else {
      logger.debug('⚠️ Context7 not configured. Skipping to web search.');
    }

    // Level 4: Web Search Fallback
    const webSearchResult = await this.tryWebSearch(query);
    if (webSearchResult.success) {
      logger.info('✅ Task resolved using Web Search.');
      return webSearchResult;
    }

    // Critical Failure
    logger.error('❌ All resilience levels failed. Unable to complete the task.');
    return {
      success: false,
      level: 'critical_failure',
      error: 'All fallback mechanisms were exhausted without a successful result.',
      finalAnswer: 'Desculpe, não consegui encontrar uma resposta para sua solicitação após tentar todas as minhas estratégias. Por favor, tente reformular a pergunta.',
    };
  }

  /**
   * Implements Level 1 & 2 of the resilience workflow:
   * Tries the primary AI model, then a fallback model, each with retries.
   */
  private async tryAiModels(query: string): Promise<ExecutionResult> {
    const MAX_RETRIES = 3;

    // Level 1: Primary AI Model
    const primaryModel = models[0]; // Assuming the first model is the preferred one
    if (primaryModel) {
      logger.debug(`Executing Level 1: Primary AI Model (${primaryModel.name}) with ${MAX_RETRIES} retries...`);
      for (let i = 0; i < MAX_RETRIES; i++) {
        try {
          const stream = askAI('', query, primaryModel.name, primaryModel.provider, true, false);
          let finalAnswer = '';
          for await (const chunk of stream) {
            finalAnswer += chunk;
          }

          if (finalAnswer.trim()) {
            return { success: true, level: 'primary_ai', finalAnswer };
          }
        } catch (error: any) {
          logger.warn(`Primary AI model failed on attempt ${i + 1}/${MAX_RETRIES}: ${error.message}`);
        }
      }
    }

    // Level 2: Fallback AI Model
    const fallbackModel = models.find(m => m.provider !== primaryModel?.provider) || models[1];
    if (fallbackModel) {
        logger.debug(`Executing Level 2: Fallback AI Model (${fallbackModel.name}) with ${MAX_RETRIES} retries...`);
        for (let i = 0; i < MAX_RETRIES; i++) {
            try {
                const stream = askAI('', query, fallbackModel.name, fallbackModel.provider, true, false);
                let finalAnswer = '';
                for await (const chunk of stream) {
                    finalAnswer += chunk;
                }

                if (finalAnswer.trim()) {
                    return { success: true, level: 'fallback_ai', finalAnswer };
                }
            } catch (error: any) {
                logger.warn(`Fallback AI model failed on attempt ${i + 1}/${MAX_RETRIES}: ${error.message}`);
            }
        }
    }
    
    return { success: false, level: 'ai_models', error: 'Both primary and fallback AI models failed.' };
  }

  /**
   * Implements Level 3: Queries the Context7 knowledge base.
   */
  private async tryContext7(query: string): Promise<ExecutionResult> {
    logger.debug('Executing Level 3: Context7 Knowledge Base...');
    const context7Url = getConfigValue('MCP_CONTEXT7_URL');
    const apiKey = getConfigValue('MCP_CONTEXT7_API_KEY');

    if (!context7Url) {
      return { success: false, level: 'context7', error: 'Context7 URL is not configured.' };
    }

    try {
      const response = await fetch(`${context7Url}?q=${encodeURIComponent(query)}&source=devdocs`, {
        headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
      });

      if (!response.ok) {
        throw new Error(`Context7 responded with status ${response.status}`);
      }

      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const topResult = data.results[0];
        const finalAnswer = `De acordo com a base de conhecimento Context7, aqui está uma informação relevante sobre "${query}":\n\nTítulo: ${topResult.title}\nTrecho: ${topResult.content.substring(0, 500)}...\nFonte: ${topResult.url}`;
        return { success: true, level: 'context7', data: data.results, finalAnswer };
      }

      return { success: false, level: 'context7', error: 'No relevant results found in Context7.' };

    } catch (error: any) {
      logger.warn(`Context7 lookup failed: ${error.message}`);
      return { success: false, level: 'context7', error: error.message };
    }
  }

  /**
   * Implements the final fallback level: a robust web search.
   */
  private async tryWebSearch(query: string): Promise<ExecutionResult> {
    logger.debug('Executing Level 4: Web Search...');
    try {
      const results = await this.webCrawler.searchMultiSource(query, {
        sources: ['web', 'forums', 'docs'], // Ensure all sources are attempted
      });

      if (results.length === 0) {
        return { success: false, level: 'web_search', error: 'No results found.' };
      }

      // Consolidate results into a final answer (simplified for now)
      const consolidated = await this.webCrawler.crossReference(results);
      const finalAnswer = `A pesquisa na web encontrou ${consolidated.totalResults} resultados. O principal resultado é: "${results[0].title}". Resumo: ${consolidated.summary}`;

      return {
        success: true,
        level: 'web_search',
        data: consolidated,
        finalAnswer,
      };
    } catch (error: any) {
      logger.error(`An error occurred during web search: ${error.message}`);
      return { success: false, level: 'web_search', error: error.message };
    }
  }
}
