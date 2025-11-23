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
  logger.info('🔄 Syncing repository to production...\n');
  
  // Check if we have sudo permissions for /opt/fazai
  if (process.getuid && process.getuid() !== 0) {
    logger.error('❌ Sync requires sudo privileges to write to /opt/fazai');
    logger.info('💡 Run: sudo -E fazai sync');
    process.exit(1);
  }

  logger.info(`📂 Repository: ${REPO_PATH}`);
  logger.info(`📂 Install path: ${INSTALL_PATH}`);
  logger.info(`👤 Real user: ${REAL_USER}\n`);

  // Check if repo exists
  if (!existsSync(REPO_PATH)) {
    logger.error(`❌ Repository not found at ${REPO_PATH}`);
    logger.info(`Set FAZAI_REPO environment variable or ensure ${REAL_HOME}/fazai-ng exists`);
    process.exit(1);
  }

  try {
    // Step 1: Pull latest changes
    logger.info(`📥 Pulling latest changes from ${REPO_PATH}...`);
    execSync('git pull', { cwd: REPO_PATH, stdio: 'inherit' });

    // Step 2: Install dependencies (if package.json changed)
    logger.info('\n📦 Installing dependencies...');
    execSync('npm install --production=false', { cwd: REPO_PATH, stdio: 'inherit' });

    // Step 3: Build
    logger.info('\n🔨 Building...');
    execSync('npm run build', { cwd: REPO_PATH, stdio: 'inherit' });

    // Step 4: Sync to /opt/fazai
    logger.info(`\n📤 Syncing to ${INSTALL_PATH}...`);
    
    // Copy essential files
    const filesToSync = [
      'dist/',
      'node_modules/',
      'package.json',
      'package-lock.json',
      'fazai.conf.example',
      'completion/',
      'web/',
      'etc/',
    ];

    for (const file of filesToSync) {
      const source = `${REPO_PATH}/${file}`;
      if (existsSync(source)) {
        logger.info(`  • Copying ${file}...`);
        execSync(`rsync -a --delete "${source}" "${INSTALL_PATH}/${file}"`, { stdio: 'pipe' });
      }
    }

    // Step 5: Update symlinks if needed
    if (!existsSync('/opt/fazai/bin/fazai')) {
      logger.info('\n🔗 Creating symlink...');
      execSync('mkdir -p /opt/fazai/bin', { stdio: 'pipe' });
      execSync('ln -sf /opt/fazai/dist/app.cjs /opt/fazai/bin/fazai', { stdio: 'pipe' });
      execSync('chmod +x /opt/fazai/bin/fazai', { stdio: 'pipe' });
    }

    // Step 6: Reload services if running
    logger.info('\n🔄 Reloading services...');
    try {
      execSync('systemctl is-active --quiet fazai-web@$(whoami) && systemctl restart fazai-web@$(whoami)', { 
        stdio: 'pipe',
        shell: '/bin/bash'
      });
      logger.info('  ✅ fazai-web service restarted');
    } catch {
      logger.info('  ℹ️  fazai-web service not running');
    }

    logger.info('\n✅ Sync completed successfully!\n');
    logger.info('Run `fazai --help` to verify the update.');
    
  } catch (error) {
    logger.error(`\n❌ Sync failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
