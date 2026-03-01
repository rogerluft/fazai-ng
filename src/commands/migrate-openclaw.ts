import { logger } from '../logger';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function handleMigrateOpenClawCommand(args: string[]) {
  const sqlitePath = args[0] || '/home/rluft/.openclaw/memory/main.sqlite';

  logger.info(`Iniciando a migração de memória local SQLite: ${sqlitePath}`);

  try {
    // Determine se estamos rodando compilado (dist/) ou dev (src/)
    const ext = __filename.endsWith('.ts') ? '.ts' : '.js';
    const executor = ext === '.ts' ? 'npx tsx' : 'node';
    const scriptPath = path.join(__dirname, '..', 'scripts', `migrate-openclaw-memory${ext}`);

    execSync(`${executor} ${scriptPath} ${sqlitePath}`, { stdio: 'inherit' });
  } catch (error: any) {
    logger.error(`❌ Erro ao rodar o script de migração: ${error.message}`);
    process.exit(1);
  }
}
