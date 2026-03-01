import Database from 'better-sqlite3';
import { getQdrantClient } from '../database/qdrant-pool';
import { UniversalLocalEmbedder } from '../services/universal-embedder';
import { logger } from '../logger';
import { v4 as uuidv4 } from 'uuid';

const SQLITE_PATH = process.argv[2] || '/home/rluft/.openclaw/memory/main.sqlite';
const COLLECTION_NAME = 'fazai_memory';

async function migrate() {
  logger.info(`Iniciando migração de memória do OpenClaw...`);
  logger.info(`Banco SQLite: ${SQLITE_PATH}`);
  logger.info(`Coleção de destino: ${COLLECTION_NAME}`);

  let db;
  try {
    db = new Database(SQLITE_PATH, { readonly: true });
  } catch (error: any) {
    logger.error(`Falha ao abrir o banco SQLite: ${error.message}`);
    process.exit(1);
  }

  const chunksCountRow = db.prepare('SELECT count(*) as count FROM chunks').get() as { count: number };
  const totalChunks = chunksCountRow.count;
  logger.info(`Total de memórias a migrar: ${totalChunks}`);

  if (totalChunks === 0) {
    logger.info('Nenhuma memória encontrada no banco. Saindo.');
    process.exit(0);
  }

  const qdrant = await getQdrantClient();
  const embedder = new UniversalLocalEmbedder();

  // Verifica/cria a coleção
  try {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

    if (!exists) {
      logger.info(`Criando coleção ${COLLECTION_NAME}...`);
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: {
          size: 768,
          distance: 'Cosine'
        }
      });
    }
  } catch (error: any) {
    logger.error(`Erro ao verificar/criar coleção Qdrant: ${error.message}`);
    process.exit(1);
  }

  const stmt = db.prepare('SELECT id, path, source, start_line, end_line, text, updated_at FROM chunks');
  const rows = stmt.all() as any[];

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    logger.debug(`Processando memória ${i + 1}/${totalChunks} (ID: ${row.id})`);

    try {
      // Gera o novo embedding local de 768 dimensões
      const vector = await embedder.embed(row.text);

      const payload = {
        // Campos requeridos pelo FazAI Memory Loader
        content: row.text,
        timestamp: new Date(row.updated_at).toISOString(),
        role: 'user', // Default genérico para memórias de migração
        sessionId: 'migrated-memory',
        tags: ['migration'],

        // Campos originais para rastreabilidade
        openclaw_id: row.id,
        openclaw_path: row.path,
        openclaw_source: row.source,
        openclaw_start_line: row.start_line,
        openclaw_end_line: row.end_line,
        openclaw_text: row.text,
        openclaw_updated_at: row.updated_at,

        migrated_at: Date.now(),
        type: 'openclaw_migration'
      };

      // Injeta no Qdrant
      await qdrant.upsert(COLLECTION_NAME, {
        wait: true,
        points: [
          {
            id: uuidv4(), // Qdrant requires UUID or u64. OpenClaw ID might be a hash.
            vector: vector,
            payload: payload
          }
        ]
      });

      successCount++;
    } catch (error: any) {
      logger.error(`Erro ao migrar memória ${row.id}: ${error.message}`);
      errorCount++;
    }
  }

  logger.info(`Migração concluída! Sucesso: ${successCount}, Erros: ${errorCount}`);
  process.exit(0);
}

migrate().catch(err => {
  logger.error(`Erro fatal na migração: ${err.message}`);
  process.exit(1);
});
