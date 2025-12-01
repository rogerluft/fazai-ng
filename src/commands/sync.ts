/**
 * Sync command: Synchronize repository changes to /opt/fazai
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { logger } from '../logger';

// Detecta o usuário real mesmo quando rodando com sudo
const REAL_USER = process.env.SUDO_USER || process.env.USER || 'root';
const REAL_HOME = REAL_USER === 'root' 
  ? '/root' 
  : `/home/${REAL_USER}`;

const REPO_PATH = process.env.FAZAI_REPO || `${REAL_HOME}/fazai-ng`;
const INSTALL_PATH = '/opt/fazai';

interface SyncOptions {
  verbose?: boolean;
  dryRun?: boolean;
}

export async function syncCommand(options: SyncOptions = {}): Promise<void> {
  logger.warn('DEPRECATED: The `fazai sync` command has been replaced by a more robust symlink-based development workflow.');
  logger.info('----------------------------------------------------------------------------------');
  logger.info('To set up a development environment where changes are reflected instantly, run:');
  logger.info('  sudo bash scripts/link-for-dev.sh');
  logger.info('\nThis will link /opt/fazai directly to your development repository.');
  logger.info('The `sync` command is no longer necessary in this workflow.');
  logger.info('\nFor standard "production" installations, please use the main installer:');
  logger.info('  curl -fsSL https://raw.githubusercontent.com/rogerluft/fazai-ng/master/install.sh | bash');
  logger.info('----------------------------------------------------------------------------------');
  process.exit(0);
}
