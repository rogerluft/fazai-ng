#!/usr/bin/env node
/**
 * FazAI Sync Command
 * Synchronizes repository changes to /opt/fazai installation
 */

import { execSync } from 'child_process';
import { existsSync, statSync } from 'fs';
import { join } from 'path';

const REPO_PATH = process.env.FAZAI_REPO_PATH || '/home/rluft/fazai-ng';
const INSTALL_PATH = '/opt/fazai';

interface SyncOptions {
  verbose?: boolean;
  dryRun?: boolean;
}

export async function syncCommand(options: SyncOptions = {}): Promise<void> {
  const { verbose = false, dryRun = false } = options;

  console.log('🔄 FazAI Sync: Repository → System\n');

  // Validate repository
  if (!existsSync(REPO_PATH)) {
    throw new Error(`Repository not found: ${REPO_PATH}`);
  }

  if (!existsSync(join(REPO_PATH, 'package.json'))) {
    throw new Error(`Invalid repository: ${REPO_PATH}`);
  }

  // Validate installation
  if (!existsSync(INSTALL_PATH)) {
    throw new Error(`Installation not found: ${INSTALL_PATH}\nRun: sudo bash install.sh`);
  }

  // Check if we need sudo
  const needsSudo = process.getuid && process.getuid() !== 0;
  const sudo = needsSudo ? 'sudo ' : '';

  try {
    // Step 1: Build in repository
    console.log('📦 Building from repository...');
    if (!dryRun) {
      execSync('npm run build', { cwd: REPO_PATH, stdio: verbose ? 'inherit' : 'pipe' });
    }
    console.log('✅ Build completed\n');

    // Step 2: Sync dist/
    console.log('📁 Syncing dist/...');
    if (!dryRun) {
      execSync(`${sudo}rsync -av --delete ${REPO_PATH}/dist/ ${INSTALL_PATH}/dist/`, {
        stdio: verbose ? 'inherit' : 'pipe'
      });
    }
    console.log('✅ dist/ synced\n');

    // Step 3: Sync web/ (if exists)
    if (existsSync(join(REPO_PATH, 'web'))) {
      console.log('🌐 Syncing web interface...');
      if (!dryRun) {
        execSync(`${sudo}rsync -av --delete ${REPO_PATH}/web/ ${INSTALL_PATH}/web/`, {
          stdio: verbose ? 'inherit' : 'pipe'
        });
      }
      console.log('✅ web/ synced\n');
    }

    // Step 4: Sync node_modules (production only)
    console.log('📦 Syncing dependencies...');
    if (!dryRun) {
      execSync(`${sudo}npm install --production --prefix ${INSTALL_PATH}`, {
        stdio: verbose ? 'inherit' : 'pipe'
      });
    }
    console.log('✅ Dependencies synced\n');

    // Step 5: Sync bin/
    console.log('🔧 Syncing executables...');
    if (!dryRun) {
      execSync(`${sudo}rsync -av ${REPO_PATH}/bin/ ${INSTALL_PATH}/bin/`, {
        stdio: verbose ? 'inherit' : 'pipe'
      });
      execSync(`${sudo}chmod +x ${INSTALL_PATH}/bin/fazai`, { stdio: 'pipe' });
    }
    console.log('✅ Executables synced\n');

    // Step 6: Validate
    console.log('✔️  Validating sync...');
    const repoSize = getDirectorySize(join(REPO_PATH, 'dist'));
    const installSize = getDirectorySize(join(INSTALL_PATH, 'dist'));
    
    if (Math.abs(repoSize - installSize) > 1024 * 100) { // 100KB tolerance
      console.warn(`⚠️  Size mismatch: repo=${formatBytes(repoSize)}, install=${formatBytes(installSize)}`);
    } else {
      console.log(`✅ Sizes match: ${formatBytes(installSize)}\n`);
    }

    // Step 7: Restart services (if running)
    console.log('🔄 Restarting services...');
    if (!dryRun) {
      try {
        execSync(`${sudo}systemctl is-active fazai --quiet`, { stdio: 'pipe' });
        execSync(`${sudo}systemctl restart fazai`, { stdio: verbose ? 'inherit' : 'pipe' });
        console.log('✅ fazai service restarted');
      } catch {
        console.log('ℹ️  fazai service not running');
      }

      try {
        const user = process.env.SUDO_USER || process.env.USER || 'root';
        execSync(`${sudo}systemctl is-active fazai-web@${user} --quiet`, { stdio: 'pipe' });
        execSync(`${sudo}systemctl restart fazai-web@${user}`, { stdio: verbose ? 'inherit' : 'pipe' });
        console.log(`✅ fazai-web@${user} service restarted`);
      } catch {
        console.log('ℹ️  fazai-web service not running');
      }
    }

    console.log('\n✅ Sync completed successfully!');
    console.log(`\n📍 Installation: ${INSTALL_PATH}`);
    console.log(`📍 Repository: ${REPO_PATH}`);

    if (dryRun) {
      console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    }

  } catch (error) {
    console.error('\n❌ Sync failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function getDirectorySize(dir: string): number {
  if (!existsSync(dir)) return 0;
  
  try {
    const output = execSync(`du -sb ${dir}`).toString();
    return parseInt(output.split('\t')[0]);
  } catch {
    return 0;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
