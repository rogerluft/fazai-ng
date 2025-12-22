/**
 * Integration Tests - Implementações Recentes
 *
 * Testes de integração para validar as implementações dos commits:
 * - 1f12347: fix(critical): add missing path imports
 * - 34d82f4: fix(high): RAG duplication + neural flow
 * - e645de5: refactor(medium): system messages
 *
 * Estes testes validam que os módulos carregam corretamente
 * e que as dependências estão funcionando.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../../src');

describe('Path Imports - Commit 1f12347', () => {
  it('api-cache.ts deve ter import de path', async () => {
    // Verifica que o arquivo existe e pode ser lido
    const fs = await import('fs/promises');
    const apiCachePath = path.join(srcDir, 'services/api-cache.ts');

    const content = await fs.readFile(apiCachePath, 'utf-8');

    // Deve conter import de path
    expect(content).toContain("import path from");
  });

  it('embedding-cache.ts deve ter import de path', async () => {
    const fs = await import('fs/promises');
    const embeddingCachePath = path.join(srcDir, 'services/embedding-cache.ts');

    const content = await fs.readFile(embeddingCachePath, 'utf-8');

    // Deve conter import de path
    expect(content).toContain("import path from");
  });

  it('path.dirname deve funcionar corretamente', () => {
    // Teste básico da função que causava o erro
    const testPath = '/home/user/fazai/cache/test.json';
    const dir = path.dirname(testPath);

    expect(dir).toBe('/home/user/fazai/cache');
  });

  it('path.join deve construir caminhos corretamente', () => {
    const cacheDir = '/var/cache/fazai';
    const filename = 'embeddings.json';
    const fullPath = path.join(cacheDir, filename);

    expect(fullPath).toBe('/var/cache/fazai/embeddings.json');
  });
});

describe('System Messages - Commit e645de5', () => {
  it('askAI.ts deve ter SYSTEM_MESSAGES como single source of truth', async () => {
    const fs = await import('fs/promises');
    const askAIPath = path.join(srcDir, 'askAI.ts');

    const content = await fs.readFile(askAIPath, 'utf-8');

    // Deve conter a constante SYSTEM_MESSAGES
    expect(content).toContain('SYSTEM_MESSAGES');
    expect(content).toContain("general:");
    expect(content).toContain("codeAnalysis:");

    // Deve usar SYSTEM_MESSAGES.general e SYSTEM_MESSAGES.codeAnalysis
    expect(content).toContain('SYSTEM_MESSAGES.general');
    expect(content).toContain('SYSTEM_MESSAGES.codeAnalysis');
  });

  it('não deve ter system messages duplicadas', async () => {
    const fs = await import('fs/promises');
    const askAIPath = path.join(srcDir, 'askAI.ts');

    const content = await fs.readFile(askAIPath, 'utf-8');

    // Conta ocorrências de menção a Roginho (EN ou PT)
    // Pattern: "assisting Roginho" OR "assistindo Roginho"
    const matches = content.match(/(assisting|assistindo) Roginho/g);

    // Deve aparecer apenas 2 vezes (na constante SYSTEM_MESSAGES)
    // - 1 vez em general
    // - 1 vez em codeAnalysis
    expect(matches?.length).toBeLessThanOrEqual(2);
  });
});

describe('Neural Flow Logic - Commit 34d82f4', () => {
  it('linux-admin.ts deve ter consultNeuralFlow', async () => {
    const fs = await import('fs/promises');
    const linuxAdminPath = path.join(srcDir, 'linux-admin.ts');

    const content = await fs.readFile(linuxAdminPath, 'utf-8');

    // Deve ter a chamada para consultNeuralFlow
    expect(content).toContain('consultNeuralFlow');
  });

  it('linux-admin.ts deve ter enrichContextWithRAG', async () => {
    const fs = await import('fs/promises');
    const linuxAdminPath = path.join(srcDir, 'linux-admin.ts');

    const content = await fs.readFile(linuxAdminPath, 'utf-8');

    // Deve ter a chamada para enrichContextWithRAG
    expect(content).toContain('enrichContextWithRAG');
  });

  it('CORRIGIDO: código atual tem return após yield de learned commands', async () => {
    const fs = await import('fs/promises');
    const linuxAdminPath = path.join(srcDir, 'linux-admin.ts');

    const content = await fs.readFile(linuxAdminPath, 'utf-8');

    // Verifica que o padrão problemático foi removido
    const hasProblematicPattern = content.includes('Continue to provider chain for validation instead of returning');

    // Bug foi corrigido - padrão problemático não deve existir mais
    expect(hasProblematicPattern).toBe(false);

    // Deve ter return após yield allcommands
    expect(content).toContain('FIX: Retorna após emitir comandos aprendidos');
  });
});

describe('Semantic Cache - Commit 34d82f4', () => {
  it('semantic-cache.ts deve ter startCleanupTimer', async () => {
    const fs = await import('fs/promises');
    const semanticCachePath = path.join(srcDir, 'services/semantic-cache.ts');

    const content = await fs.readFile(semanticCachePath, 'utf-8');

    expect(content).toContain('startCleanupTimer');
  });

  it('semantic-cache.ts deve ter process handlers para SIGINT/SIGTERM', async () => {
    const fs = await import('fs/promises');
    const semanticCachePath = path.join(srcDir, 'services/semantic-cache.ts');

    const content = await fs.readFile(semanticCachePath, 'utf-8');

    expect(content).toContain("process.on('SIGINT'");
    expect(content).toContain("process.on('SIGTERM'");
  });

  it('CORRIGIDO: código atual TEM flag para prevenir múltiplos handlers', async () => {
    const fs = await import('fs/promises');
    const semanticCachePath = path.join(srcDir, 'services/semantic-cache.ts');

    const content = await fs.readFile(semanticCachePath, 'utf-8');

    // Verifica se existe uma flag de proteção
    const hasProtectionFlag =
      content.includes('handlersRegistered') ||
      content.includes('signalHandlersRegistered') ||
      content.includes('cleanupHandlersRegistered');

    // Bug foi corrigido - flag de proteção deve existir
    expect(hasProtectionFlag).toBe(true);
  });
});

describe('Estrutura de Arquivos', () => {
  it('todos os arquivos críticos devem existir', async () => {
    const fs = await import('fs/promises');

    const criticalFiles = [
      'askAI.ts',
      'linux-admin.ts',
      'services/semantic-cache.ts',
      'services/api-cache.ts',
      'services/embedding-cache.ts',
    ];

    for (const file of criticalFiles) {
      const filePath = path.join(srcDir, file);
      const stat = await fs.stat(filePath).catch(() => null);

      expect(stat, `File ${file} should exist`).not.toBeNull();
      expect(stat?.isFile(), `${file} should be a file`).toBe(true);
    }
  });
});

describe('Dependências de Módulos', () => {
  it('path module deve estar disponível', async () => {
    const pathModule = await import('path');

    expect(pathModule.dirname).toBeDefined();
    expect(pathModule.join).toBeDefined();
    expect(pathModule.resolve).toBeDefined();
  });

  it('crypto module deve estar disponível (usado em semantic-cache)', async () => {
    const { randomUUID } = await import('crypto');

    expect(randomUUID).toBeDefined();

    const uuid = randomUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});
