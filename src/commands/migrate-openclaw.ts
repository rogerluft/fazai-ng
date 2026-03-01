import { logger } from '../logger';
import { execSync } from 'child_process';
import path from 'path';

export async function handleMigrateOpenClawCommand(args: string[]) {
  const sqlitePath = args[0] || '/home/rluft/.openclaw/memory/main.sqlite';

  logger.info(`Iniciando a migração do OpenClaw SQLite: ${sqlitePath}`);

  try {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'migrate-openclaw-memory.js');
    execSync(`node ${scriptPath} ${sqlitePath}`, { stdio: 'inherit' });
  } catch (error: any) {
    logger.error(`❌ Erro ao rodar o script de migração: ${error.message}`);
    process.exit(1);
  }
}
