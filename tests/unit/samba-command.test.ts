/**
 * Unit Tests - Samba Command Handler
 *
 * Tests for fazai samba commands including:
 * - Help display (no args, --help)
 * - Invalid command handling
 * - List operation
 * - Add operation (with validation)
 * - Del operation
 * - Criauser operation
 * - Criadir operation
 * - Criagroup operation
 * - Completion operation
 * - Error handling (script not found, execution failure)
 *
 * Run: npm test -- tests/unit/samba-command.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SpawnSyncReturns } from 'child_process';

// Mock modules BEFORE imports
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawnSync: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('../../src/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  initLogger: vi.fn(),
}));

vi.mock('chalk', () => {
  const createChainableMock = () => {
    const mockFn = vi.fn((str: string) => str);
    mockFn.cyan = vi.fn((str: string) => str);
    mockFn.green = vi.fn((str: string) => str);
    mockFn.red = vi.fn((str: string) => str);
    mockFn.yellow = vi.fn((str: string) => str);
    mockFn.gray = vi.fn((str: string) => str);
    return mockFn;
  };

  return {
    default: {
      bold: createChainableMock(),
      green: vi.fn((str: string) => str),
      red: vi.fn((str: string) => str),
      yellow: vi.fn((str: string) => str),
      gray: vi.fn((str: string) => str),
      cyan: vi.fn((str: string) => str),
    },
  };
});

// Import after mocks
import { handleSambaCommand } from '../../src/commands/samba';
import { execSync, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { logger } from '../../src/logger';

describe('Samba Command Handler', () => {
  let consoleLogSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });

    // Default: script exists at /opt/fazai/scripts/fzsamba
    (existsSync as any).mockImplementation((path: string) => {
      return path === '/opt/fazai/scripts/fzsamba';
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('Help Display', () => {
    it('should show help when no arguments provided', async () => {
      await handleSambaCommand([]);

      expect(consoleLogSpy).toHaveBeenCalled();
      const helpOutput = consoleLogSpy.mock.calls[0][0];
      expect(helpOutput).toContain('FAZAI SAMBA MANAGEMENT');
      expect(helpOutput).toContain('Usage:');
      expect(helpOutput).toContain('list');
      expect(helpOutput).toContain('add');
      expect(helpOutput).toContain('del');
    });

    it('should show help with --help flag', async () => {
      await handleSambaCommand(['--help']);

      expect(consoleLogSpy).toHaveBeenCalled();
      const helpOutput = consoleLogSpy.mock.calls[0][0];
      expect(helpOutput).toContain('FAZAI SAMBA MANAGEMENT');
    });

    it('should show help with -h flag', async () => {
      await handleSambaCommand(['-h']);

      expect(consoleLogSpy).toHaveBeenCalled();
      const helpOutput = consoleLogSpy.mock.calls[0][0];
      expect(helpOutput).toContain('FAZAI SAMBA MANAGEMENT');
    });

    it('should show help with help command', async () => {
      await handleSambaCommand(['help']);

      expect(consoleLogSpy).toHaveBeenCalled();
      const helpOutput = consoleLogSpy.mock.calls[0][0];
      expect(helpOutput).toContain('FAZAI SAMBA MANAGEMENT');
    });
  });

  describe('Invalid Command Handling', () => {
    it('should error on invalid operation', async () => {
      await expect(async () => {
        await handleSambaCommand(['invalidcmd']);
      }).rejects.toThrow('Invalid operation: invalidcmd');

      // Note: parseSambaArgs throws before entering try/catch,
      // so logger.error is NOT called in this case
    });

    it('should error when required argument is missing for add', async () => {
      await expect(async () => {
        await handleSambaCommand(['add']);
      }).rejects.toThrow("requires an argument");

      // Note: parseSambaArgs throws before entering try/catch
    });

    it('should error when required argument is missing for del', async () => {
      await expect(async () => {
        await handleSambaCommand(['del']);
      }).rejects.toThrow("requires an argument");
    });

    it('should error when required argument is missing for criauser', async () => {
      await expect(async () => {
        await handleSambaCommand(['criauser']);
      }).rejects.toThrow("requires an argument");
    });

    it('should error when required argument is missing for criadir', async () => {
      await expect(async () => {
        await handleSambaCommand(['criadir']);
      }).rejects.toThrow("requires an argument");
    });

    it('should error when required argument is missing for criagroup', async () => {
      await expect(async () => {
        await handleSambaCommand(['criagroup']);
      }).rejects.toThrow("requires an argument");
    });
  });

  describe('List Command', () => {
    it('should execute list command successfully', async () => {
      const mockOutput = `--- Compartilhamentos Samba ---
Nome: compartilhado
  Caminho: /dados/compartilhado
------------------------------`;

      (execSync as any).mockReturnValue(mockOutput);

      await handleSambaCommand(['list']);

      expect(execSync).toHaveBeenCalledWith(
        'bash /opt/fazai/scripts/fzsamba list',
        expect.objectContaining({
          encoding: 'utf-8',
        })
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(mockOutput);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Listing Samba shares')
      );
    });

    it('should handle list command execution failure', async () => {
      (execSync as any).mockImplementation(() => {
        throw new Error('Command failed');
      });

      await expect(async () => {
        await handleSambaCommand(['list']);
      }).rejects.toThrow('process.exit(1)');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to list shares')
      );
    });
  });

  describe('Add Command', () => {
    it('should execute add command with valid path', async () => {
      const testPath = '/dados/test';

      (existsSync as any).mockImplementation((path: string) => {
        return path === '/opt/fazai/scripts/fzsamba' || path.includes(testPath);
      });

      (spawnSync as any).mockReturnValue({
        status: 0,
        error: undefined,
      } as SpawnSyncReturns<string>);

      await handleSambaCommand(['add', testPath]);

      expect(spawnSync).toHaveBeenCalledWith(
        'sudo',
        ['/opt/fazai/scripts/fzsamba', 'add', testPath],
        expect.objectContaining({
          stdio: 'inherit',
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Adding share for: ${testPath}`)
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Share added successfully')
      );
    });

    it('should error when path does not exist', async () => {
      (existsSync as any).mockImplementation((path: string) => {
        return path === '/opt/fazai/scripts/fzsamba';
      });

      await expect(async () => {
        await handleSambaCommand(['add', '/nonexistent']);
      }).rejects.toThrow('process.exit(1)');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Directory does not exist')
      );
    });

    it('should handle spawnSync execution failure', async () => {
      const testPath = '/dados/test';

      (existsSync as any).mockImplementation((path: string) => {
        return path === '/opt/fazai/scripts/fzsamba' || path.includes(testPath);
      });

      (spawnSync as any).mockReturnValue({
        status: 1,
        error: undefined,
      } as SpawnSyncReturns<string>);

      await expect(async () => {
        await handleSambaCommand(['add', testPath]);
      }).rejects.toThrow('process.exit(1)');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('fzsamba exited with code 1')
      );
    });

    it('should handle spawnSync error object', async () => {
      const testPath = '/dados/test';

      (existsSync as any).mockImplementation((path: string) => {
        return path === '/opt/fazai/scripts/fzsamba' || path.includes(testPath);
      });

      (spawnSync as any).mockReturnValue({
        status: null,
        error: new Error('spawn failed'),
      } as SpawnSyncReturns<string>);

      await expect(async () => {
        await handleSambaCommand(['add', testPath]);
      }).rejects.toThrow('process.exit(1)');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to execute fzsamba')
      );
    });
  });

  describe('Del Command', () => {
    it('should execute del command with share name', async () => {
      (spawnSync as any).mockReturnValue({
        status: 0,
        error: undefined,
      } as SpawnSyncReturns<string>);

      await handleSambaCommand(['del', 'myshare']);

      expect(spawnSync).toHaveBeenCalledWith(
        'sudo',
        ['/opt/fazai/scripts/fzsamba', 'del', 'myshare'],
        expect.objectContaining({
          stdio: 'inherit',
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Removing share: myshare')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('prompted for confirmation')
      );
    });
  });

  describe('Criauser Command', () => {
    it('should execute criauser command with username', async () => {
      (spawnSync as any).mockReturnValue({
        status: 0,
        error: undefined,
      } as SpawnSyncReturns<string>);

      await handleSambaCommand(['criauser', 'joao']);

      expect(spawnSync).toHaveBeenCalledWith(
        'sudo',
        ['/opt/fazai/scripts/fzsamba', 'criauser', 'joao'],
        expect.objectContaining({
          stdio: 'inherit',
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Creating user: joao')
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('prompt for Samba password')
      );
    });
  });

  describe('Criadir Command', () => {
    it('should execute criadir command with path', async () => {
      const testPath = '/dados/newshare';

      (spawnSync as any).mockReturnValue({
        status: 0,
        error: undefined,
      } as SpawnSyncReturns<string>);

      await handleSambaCommand(['criadir', testPath]);

      expect(spawnSync).toHaveBeenCalledWith(
        'sudo',
        ['/opt/fazai/scripts/fzsamba', 'criadir', testPath],
        expect.objectContaining({
          stdio: 'inherit',
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Creating directory and share: ${testPath}`)
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('prompt for owner and group')
      );
    });
  });

  describe('Criagroup Command', () => {
    it('should execute criagroup command with group name', async () => {
      (spawnSync as any).mockReturnValue({
        status: 0,
        error: undefined,
      } as SpawnSyncReturns<string>);

      await handleSambaCommand(['criagroup', 'developers']);

      expect(spawnSync).toHaveBeenCalledWith(
        'sudo',
        ['/opt/fazai/scripts/fzsamba', 'criagroup', 'developers'],
        expect.objectContaining({
          stdio: 'inherit',
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Creating group: developers')
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('prompt for users and directory')
      );
    });
  });

  describe('Completion Command', () => {
    it('should execute completion command and display install instructions', async () => {
      const mockCompletionScript = `_fzsamba() {
  # completion script content
}
complete -F _fzsamba fzsamba`;

      (execSync as any).mockReturnValue(mockCompletionScript);

      await handleSambaCommand(['completion']);

      expect(execSync).toHaveBeenCalledWith(
        'bash /opt/fazai/scripts/fzsamba completion',
        expect.objectContaining({
          encoding: 'utf-8',
        })
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(mockCompletionScript);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('To install, run:')
      );
    });

    it('should handle completion command execution failure', async () => {
      (execSync as any).mockImplementation(() => {
        throw new Error('Script not found');
      });

      await expect(async () => {
        await handleSambaCommand(['completion']);
      }).rejects.toThrow('process.exit(1)');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate completion')
      );
    });
  });

  describe('Script Path Resolution', () => {
    it('should use fallback script path when /opt/fazai not found', async () => {
      // Mock: script only exists at fallback location
      (existsSync as any).mockImplementation((path: string) => {
        return path.includes('scripts/fzsamba') && !path.startsWith('/opt/fazai');
      });

      const mockOutput = '--- Shares ---';
      (execSync as any).mockReturnValue(mockOutput);

      await handleSambaCommand(['list']);

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('scripts/fzsamba list'),
        expect.any(Object)
      );
    });

    it('should error when script not found in any location', async () => {
      // Mock: script doesn't exist anywhere
      (existsSync as any).mockReturnValue(false);

      await expect(async () => {
        await handleSambaCommand(['list']);
      }).rejects.toThrow('process.exit(1)');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('fzsamba script not found')
      );
    });
  });

  describe('Error Stack Logging', () => {
    it('should log error stack in debug mode when available', async () => {
      const errorWithStack = new Error('Test error');
      errorWithStack.stack = 'Error: Test error\n  at someFunction';

      (existsSync as any).mockImplementation(() => {
        throw errorWithStack;
      });

      await expect(async () => {
        await handleSambaCommand(['list']);
      }).rejects.toThrow();

      expect(logger.error).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});
