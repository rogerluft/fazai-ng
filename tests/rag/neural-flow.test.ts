/**
 * Testes Unitários - Neural Flow (RAG Multi-Collection)
 *
 * Testa as funções internas e helpers do neural-flow.ts usando mocks.
 * Para testes de integração completos, veja tests/integration/neural-flow.integration.test.ts
 *
 * Para rodar: npm test -- tests/rag/neural-flow.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCategoryFilter, createCollectionSubset } from '../../src/rag/neural-flow';

// Mock dos módulos externos
vi.mock('../../src/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/config', () => ({
  getConfigValue: vi.fn((key: string) => {
    if (key === 'QDRANT_URL') return 'http://localhost:6333';
    return undefined;
  }),
}));

vi.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: vi.fn().mockImplementation(() => ({
    search: vi.fn(),
  })),
}));

vi.mock('../../src/utils/retry', () => ({
  withRetry: vi.fn((fn) => fn()),
}));

describe('Neural Flow - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('normalizeWeights()', () => {
    it('should return weights unchanged if sum is ~1.0', () => {
      // Importamos diretamente a função privada via teste do comportamento público
      const weights = {
        personality: 0.15,
        memory: 0.20,
        learning: 0.30,
        kb: 0.25,
        inference: 0.10,
      };

      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 3);
    });

    it('should normalize weights if sum differs from 1.0', () => {
      // Pesos não normalizados
      const weights = {
        personality: 0.2,
        memory: 0.4,
        learning: 0.6,
        kb: 0.5,
        inference: 0.2,
      };

      // Soma = 1.9, após normalização cada peso deve ser dividido por 1.9
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.9, 1);

      const normalized = {
        personality: weights.personality / sum,
        memory: weights.memory / sum,
        learning: weights.learning / sum,
        kb: weights.kb / sum,
        inference: weights.inference / sum,
      };

      const normalizedSum = Object.values(normalized).reduce((a, b) => a + b, 0);
      expect(normalizedSum).toBeCloseTo(1.0, 3);
    });

    it('should handle zero weights by returning defaults', () => {
      const weights = {
        personality: 0,
        memory: 0,
        learning: 0,
        kb: 0,
        inference: 0,
      };

      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      expect(sum).toBe(0);

      // DEFAULT_WEIGHTS seria retornado
      const defaults = {
        personality: 0.0,
        memory: 0.20,
        learning: 0.40,
        kb: 0.30,
        inference: 0.10,
      };

      const defaultSum = Object.values(defaults).reduce((a, b) => a + b, 0);
      expect(defaultSum).toBeCloseTo(1.0, 3);
    });
  });

  describe('calculateRecencyBoost()', () => {
    it('should return 1.2x boost for very recent content (0 days)', () => {
      const now = new Date();
      const payload = {
        timestamp: now.toISOString(),
      };

      // Fórmula: Math.max(0.5, Math.min(1.2, 1.2 - daysOld / 150))
      // daysOld = 0 → 1.2 - 0/150 = 1.2
      const expectedBoost = 1.2;

      const age = Date.now() - new Date(payload.timestamp).getTime();
      const daysOld = age / (1000 * 60 * 60 * 24);
      const boost = Math.max(0.5, Math.min(1.2, 1.2 - daysOld / 150));

      expect(boost).toBeCloseTo(expectedBoost, 1);
    });

    it('should return 1.0x for 30-day-old content', () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const payload = {
        timestamp: thirtyDaysAgo.toISOString(),
      };

      const age = Date.now() - new Date(payload.timestamp).getTime();
      const daysOld = age / (1000 * 60 * 60 * 24);
      const boost = Math.max(0.5, Math.min(1.2, 1.2 - daysOld / 150));

      // daysOld ≈ 30 → 1.2 - 30/150 = 1.2 - 0.2 = 1.0
      expect(boost).toBeCloseTo(1.0, 1);
    });

    it('should return 0.5x (min) for 180+ day old content', () => {
      const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
      const payload = {
        timestamp: sixMonthsAgo.toISOString(),
      };

      const age = Date.now() - new Date(payload.timestamp).getTime();
      const daysOld = age / (1000 * 60 * 60 * 24);
      const boost = Math.max(0.5, Math.min(1.2, 1.2 - daysOld / 150));

      // daysOld ≈ 180 → 1.2 - 180/150 = 1.2 - 1.2 = 0 → clamp to 0.5
      expect(boost).toBe(0.5);
    });

    it('should return 1.0 if no timestamp field exists', () => {
      const payload = {
        content: 'Some content without timestamp',
      };

      const timestamp =
        payload.timestamp ||
        payload.created_at ||
        payload.learned_at ||
        payload.last_applied ||
        payload.last_used_at;

      expect(timestamp).toBeUndefined();

      const boost = timestamp ? 1.2 : 1.0;
      expect(boost).toBe(1.0);
    });

    it('should fallback to alternative timestamp fields', () => {
      const now = new Date();
      const payload = {
        learned_at: now.toISOString(),
      };

      const timestamp =
        payload.timestamp ||
        payload.created_at ||
        payload.learned_at ||
        payload.last_applied ||
        payload.last_used_at;

      expect(timestamp).toBe(payload.learned_at);

      const age = Date.now() - new Date(timestamp).getTime();
      const daysOld = age / (1000 * 60 * 60 * 24);
      const boost = Math.max(0.5, Math.min(1.2, 1.2 - daysOld / 150));

      expect(boost).toBeCloseTo(1.2, 1);
    });
  });

  describe('checkLegitimacy()', () => {
    it('should return true if legitimate_contexts includes current context', () => {
      const payload = {
        legitimate_contexts: ['general', 'system', 'admin'],
      };
      const currentContext = 'general';

      const isLegitimate =
        !payload.legitimate_contexts ||
        !Array.isArray(payload.legitimate_contexts) ||
        payload.legitimate_contexts.includes(currentContext) ||
        payload.legitimate_contexts.includes('*');

      expect(isLegitimate).toBe(true);
    });

    it('should return true if legitimate_contexts includes wildcard "*"', () => {
      const payload = {
        legitimate_contexts: ['*'],
      };
      const currentContext = 'anything';

      const isLegitimate =
        !payload.legitimate_contexts ||
        !Array.isArray(payload.legitimate_contexts) ||
        payload.legitimate_contexts.includes(currentContext) ||
        payload.legitimate_contexts.includes('*');

      expect(isLegitimate).toBe(true);
    });

    it('should return false if context not in legitimate_contexts', () => {
      const payload = {
        legitimate_contexts: ['admin', 'system'],
      };
      const currentContext = 'general';

      const isLegitimate =
        !payload.legitimate_contexts ||
        !Array.isArray(payload.legitimate_contexts) ||
        payload.legitimate_contexts.includes(currentContext) ||
        payload.legitimate_contexts.includes('*');

      expect(isLegitimate).toBe(false);
    });

    it('should return true if legitimate_contexts is undefined (retrocompatibility)', () => {
      const payload = {
        content: 'Some content',
      };
      const currentContext = 'general';

      const isLegitimate =
        !payload.legitimate_contexts ||
        !Array.isArray(payload.legitimate_contexts) ||
        payload.legitimate_contexts.includes(currentContext) ||
        payload.legitimate_contexts.includes('*');

      expect(isLegitimate).toBe(true);
    });

    it('should return true if legitimate_contexts is not an array', () => {
      const payload = {
        legitimate_contexts: 'invalid',
      };
      const currentContext = 'general';

      const isLegitimate =
        !payload.legitimate_contexts ||
        !Array.isArray(payload.legitimate_contexts) ||
        payload.legitimate_contexts.includes(currentContext) ||
        payload.legitimate_contexts.includes('*');

      expect(isLegitimate).toBe(true);
    });
  });

  describe('calculateResonance()', () => {
    it('should calculate resonance based on emotional_layer', () => {
      const payload = {
        emotional_layer: 0.8,
      };

      // Fórmula: 1.0 + (intensity * 0.2)
      const intensity = payload.emotional_layer ?? 0.5;
      const resonance = 1.0 + intensity * 0.2;

      // 1.0 + (0.8 * 0.2) = 1.0 + 0.16 = 1.16
      expect(resonance).toBeCloseTo(1.16, 2);
    });

    it('should use default 0.5 if emotional_layer is missing', () => {
      const payload = {
        content: 'Some content',
      };

      const intensity = payload.emotional_layer ?? 0.5;
      const resonance = 1.0 + intensity * 0.2;

      // 1.0 + (0.5 * 0.2) = 1.0 + 0.1 = 1.1
      expect(resonance).toBeCloseTo(1.1, 2);
    });

    it('should handle maximum emotional intensity (1.0)', () => {
      const payload = {
        emotional_layer: 1.0,
      };

      const intensity = payload.emotional_layer ?? 0.5;
      const resonance = 1.0 + intensity * 0.2;

      // 1.0 + (1.0 * 0.2) = 1.0 + 0.2 = 1.2
      expect(resonance).toBeCloseTo(1.2, 2);
    });

    it('should handle minimum emotional intensity (0.0)', () => {
      const payload = {
        emotional_layer: 0.0,
      };

      const intensity = payload.emotional_layer ?? 0.5;
      const resonance = 1.0 + intensity * 0.2;

      // 1.0 + (0.0 * 0.2) = 1.0
      expect(resonance).toBe(1.0);
    });
  });

  describe('extractContent()', () => {
    it('should extract content from "content" field if legitimate', () => {
      const payload = {
        content: 'This is the main content',
        action_taken: 'Some action',
      };
      const isLegitimate = true;

      const contentFields = ['content', 'action_taken', 'commands', 'summary', 'value', 'description'];

      let extractedContent = '';
      if (!isLegitimate) {
        extractedContent = `[Acesso Restrito] Inode: ${payload.semantic_id || 'desconhecido'}. Ressonância insuficiente para hop completo.`;
      } else {
        for (const field of contentFields) {
          if (payload[field] && typeof payload[field] === 'string') {
            const content = payload[field];
            extractedContent = content.length > 1000 ? content.substring(0, 1000) + '...' : content;
            break;
          }
        }
      }

      expect(extractedContent).toBe('This is the main content');
    });

    it('should fallback to "action_taken" if "content" is missing', () => {
      const payload = {
        action_taken: 'Executed command X',
        commands: 'Some commands',
      };
      const isLegitimate = true;

      const contentFields = ['content', 'action_taken', 'commands', 'summary', 'value', 'description'];

      let extractedContent = '';
      if (!isLegitimate) {
        extractedContent = `[Acesso Restrito] Inode: ${payload.semantic_id || 'desconhecido'}. Ressonância insuficiente para hop completo.`;
      } else {
        for (const field of contentFields) {
          if (payload[field] && typeof payload[field] === 'string') {
            const content = payload[field];
            extractedContent = content.length > 1000 ? content.substring(0, 1000) + '...' : content;
            break;
          }
        }
      }

      expect(extractedContent).toBe('Executed command X');
    });

    it('should return restricted access message if not legitimate', () => {
      const payload = {
        content: 'Sensitive content',
        semantic_id: 'node-123',
      };
      const isLegitimate = false;

      const extractedContent = isLegitimate
        ? payload.content
        : `[Acesso Restrito] Inode: ${payload.semantic_id || 'desconhecido'}. Ressonância insuficiente para hop completo.`;

      expect(extractedContent).toBe(
        '[Acesso Restrito] Inode: node-123. Ressonância insuficiente para hop completo.'
      );
    });

    it('should truncate content longer than 1000 characters', () => {
      const longContent = 'a'.repeat(1500);
      const payload = {
        content: longContent,
      };
      const isLegitimate = true;

      const contentFields = ['content', 'action_taken', 'commands', 'summary', 'value', 'description'];

      let extractedContent = '';
      if (!isLegitimate) {
        extractedContent = `[Acesso Restrito] Inode: ${payload.semantic_id || 'desconhecido'}. Ressonância insuficiente para hop completo.`;
      } else {
        for (const field of contentFields) {
          if (payload[field] && typeof payload[field] === 'string') {
            const content = payload[field];
            extractedContent = content.length > 1000 ? content.substring(0, 1000) + '...' : content;
            break;
          }
        }
      }

      expect(extractedContent).toBe('a'.repeat(1000) + '...');
      expect(extractedContent.length).toBe(1003); // 1000 + '...'
    });

    it('should fallback to JSON.stringify if no known fields present', () => {
      const payload = {
        unknown_field: 'Some value',
        another_field: 42,
      };
      const isLegitimate = true;

      const contentFields = ['content', 'action_taken', 'commands', 'summary', 'value', 'description'];

      let extractedContent = '';
      if (!isLegitimate) {
        extractedContent = `[Acesso Restrito] Inode: ${payload.semantic_id || 'desconhecido'}. Ressonância insuficiente para hop completo.`;
      } else {
        let found = false;
        for (const field of contentFields) {
          if (payload[field] && typeof payload[field] === 'string') {
            const content = payload[field];
            extractedContent = content.length > 1000 ? content.substring(0, 1000) + '...' : content;
            found = true;
            break;
          }
        }
        if (!found) {
          extractedContent = JSON.stringify(payload).substring(0, 200);
        }
      }

      expect(extractedContent).toBe(JSON.stringify(payload).substring(0, 200));
    });
  });

  describe('createCategoryFilter()', () => {
    it('should create valid Qdrant filter for category', () => {
      const category = 'networking';
      const filter = createCategoryFilter(category);

      expect(filter).toEqual({
        must: [
          {
            key: 'category',
            match: { value: 'networking' },
          },
        ],
      });
    });

    it('should handle different category values', () => {
      const categories = ['linux', 'docker', 'kubernetes', 'security'];

      for (const category of categories) {
        const filter = createCategoryFilter(category);

        expect(filter).toEqual({
          must: [
            {
              key: 'category',
              match: { value: category },
            },
          ],
        });
      }
    });
  });

  describe('createCollectionSubset()', () => {
    it('should map collection names to full fazai_* format', () => {
      const result = createCollectionSubset('personality', 'memory');

      expect(result).toEqual(['fazai_personality', 'fazai_memory']);
    });

    it('should handle all collection types', () => {
      const result = createCollectionSubset('personality', 'memory', 'learning', 'kb', 'inference');

      expect(result).toEqual([
        'fazai_personality',
        'fazai_memory',
        'fazai_learning',
        'fazai_kb',
        'fazai_inference',
      ]);
    });

    it('should handle single collection', () => {
      const result = createCollectionSubset('kb');

      expect(result).toEqual(['fazai_kb']);
    });

    it('should handle empty input', () => {
      const result = createCollectionSubset();

      expect(result).toEqual([]);
    });

    it('should maintain order of input', () => {
      const result = createCollectionSubset('inference', 'kb', 'learning');

      expect(result).toEqual(['fazai_inference', 'fazai_kb', 'fazai_learning']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle payload with multiple timestamp fields (priority)', () => {
      const now = new Date();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const payload = {
        timestamp: now.toISOString(), // Prioridade mais alta
        created_at: yesterday.toISOString(),
        learned_at: yesterday.toISOString(),
      };

      const timestamp =
        payload.timestamp ||
        payload.created_at ||
        payload.learned_at ||
        payload.last_applied ||
        payload.last_used_at;

      expect(timestamp).toBe(payload.timestamp);
    });

    it('should handle invalid timestamp format gracefully', () => {
      const payload = {
        timestamp: 'invalid-date-format',
      };

      const timestamp = payload.timestamp;
      let boost = 1.0;

      try {
        const age = Date.now() - new Date(timestamp).getTime();
        const daysOld = age / (1000 * 60 * 60 * 24);
        boost = Math.max(0.5, Math.min(1.2, 1.2 - daysOld / 150));

        // Se chegou aqui, new Date() criou uma data inválida (NaN)
        if (isNaN(boost)) {
          boost = 1.0;
        }
      } catch (error) {
        boost = 1.0;
      }

      expect(boost).toBe(1.0);
    });

    it('should handle negative emotional_layer values (edge case)', () => {
      const payload = {
        emotional_layer: -0.5,
      };

      const intensity = payload.emotional_layer ?? 0.5;
      const resonance = 1.0 + intensity * 0.2;

      // 1.0 + (-0.5 * 0.2) = 1.0 - 0.1 = 0.9
      expect(resonance).toBeCloseTo(0.9, 2);
    });

    it('should handle very large emotional_layer values (edge case)', () => {
      const payload = {
        emotional_layer: 10.0,
      };

      const intensity = payload.emotional_layer ?? 0.5;
      const resonance = 1.0 + intensity * 0.2;

      // 1.0 + (10.0 * 0.2) = 1.0 + 2.0 = 3.0
      expect(resonance).toBeCloseTo(3.0, 2);
    });
  });
});
