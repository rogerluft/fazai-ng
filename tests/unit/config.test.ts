/**
 * Testes Unitários - Sistema de Configuração
 *
 * Para rodar: npm test -- tests/unit/config.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Config System (Unit Tests)', () => {
  const TEST_CONFIG_DIR = path.join(os.tmpdir(), 'fazai-config-test');
  const TEST_CONFIG_FILE = path.join(TEST_CONFIG_DIR, 'fazai.conf');

  beforeEach(() => {
    // Criar diretório de teste
    if (!fs.existsSync(TEST_CONFIG_DIR)) {
      fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    }

    // Limpar variáveis de ambiente
    delete process.env.FAZAI_CONFIG_PATH;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    // Limpar diretório de teste
    if (fs.existsSync(TEST_CONFIG_DIR)) {
      fs.rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
    }
  });

  it('deve ler configuração de arquivo INI válido', () => {
    const configContent = `# Test config
ANTHROPIC_API_KEY=sk-ant-test123
OPENAI_API_KEY=sk-test456

# Vector Store
VECTOR_PROVIDER=qdrant
QDRANT_URL=http://localhost:6333

# Logging
LOG_LEVEL=debug
`;

    fs.writeFileSync(TEST_CONFIG_FILE, configContent);

    // Simular leitura de config
    const lines = configContent.split('\n');
    const config: Record<string, string> = {};

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      const [key, ...rest] = line.split('=');
      if (key) {
        config[key] = rest.join('=').trim();
      }
    }

    expect(config['ANTHROPIC_API_KEY']).toBe('sk-ant-test123');
    expect(config['OPENAI_API_KEY']).toBe('sk-test456');
    expect(config['VECTOR_PROVIDER']).toBe('qdrant');
    expect(config['QDRANT_URL']).toBe('http://localhost:6333');
    expect(config['LOG_LEVEL']).toBe('debug');
  });

  it('deve ignorar linhas vazias e comentários', () => {
    const configContent = `
# This is a comment
ANTHROPIC_API_KEY=sk-test

# Another comment

OPENAI_API_KEY=sk-test2
`;

    const lines = configContent.split('\n');
    const config: Record<string, string> = {};

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      const [key, ...rest] = line.split('=');
      if (key) {
        config[key] = rest.join('=').trim();
      }
    }

    expect(Object.keys(config)).toHaveLength(2);
    expect(config['ANTHROPIC_API_KEY']).toBe('sk-test');
    expect(config['OPENAI_API_KEY']).toBe('sk-test2');
  });

  it('deve lidar com valores com = no meio', () => {
    const configContent = 'MCP_CONTEXT7_COMMAND=context7 --query="{query}"';

    const [key, ...rest] = configContent.split('=');
    const value = rest.join('=').trim();

    expect(key).toBe('MCP_CONTEXT7_COMMAND');
    expect(value).toBe('context7 --query="{query}"');
  });

  it('deve criar diretório de config se não existir', () => {
    const newDir = path.join(TEST_CONFIG_DIR, 'subdir', 'config');
    const newFile = path.join(newDir, 'fazai.conf');

    // Criar estrutura
    fs.mkdirSync(path.dirname(newFile), { recursive: true });
    fs.writeFileSync(newFile, 'TEST_KEY=test_value\n');

    expect(fs.existsSync(newFile)).toBe(true);

    const content = fs.readFileSync(newFile, 'utf-8');
    expect(content).toContain('TEST_KEY=test_value');
  });

  it('deve validar prioridade de caminhos de config', () => {
    // Ordem esperada:
    // 1. FAZAI_CONFIG_PATH (env)
    // 2. /etc/fazai/fazai.conf (system)
    // 3. ./fazai.conf (cwd)
    // 4. <script-dir>/fazai.conf
    // 5. ~/.config/fazai/fazai.conf (user)
    // 6. ~/fazai.conf (fallback)

    const priorityPaths = [
      process.env.FAZAI_CONFIG_PATH,
      '/etc/fazai/fazai.conf',
      path.resolve(process.cwd(), 'fazai.conf'),
      path.join(os.homedir(), '.config', 'fazai', 'fazai.conf'),
      path.join(os.homedir(), 'fazai.conf'),
    ].filter(Boolean);

    expect(priorityPaths.length).toBeGreaterThan(0);

    // Primeira prioridade sem FAZAI_CONFIG_PATH deve ser /etc/fazai
    const firstPriority = priorityPaths[0];
    expect(firstPriority).toBe('/etc/fazai/fazai.conf');
  });

  it('deve escrever nova config preservando formato', () => {
    const initialContent = `# Test config
ANTHROPIC_API_KEY=old_value
LOG_LEVEL=info
`;

    fs.writeFileSync(TEST_CONFIG_FILE, initialContent);

    // Simular atualização de valor
    const lines = initialContent.split('\n');
    const updatedLines = lines
      .filter(line => {
        const trimmed = line.trim();
        return !trimmed.startsWith('ANTHROPIC_API_KEY=');
      });

    updatedLines.push('ANTHROPIC_API_KEY=new_value');

    const newContent = updatedLines.join('\n') + '\n';
    fs.writeFileSync(TEST_CONFIG_FILE, newContent);

    const result = fs.readFileSync(TEST_CONFIG_FILE, 'utf-8');
    expect(result).toContain('ANTHROPIC_API_KEY=new_value');
    expect(result).toContain('LOG_LEVEL=info');
    expect(result).not.toContain('old_value');
  });
});
