import { logger } from '../logger';
import { getQdrantClient } from '../database/qdrant-pool';
import { UniversalLocalEmbedder } from '../services/universal-embedder';

export async function handleMemoryCommand(args: string[]) {
  if (args.length === 0) {
    console.log(`
Uso:
  fazai memory search "texto da busca" [limite]
  fazai memory index <caminho_arquivo>
    `);
    process.exit(0);
  }

  const subCommand = args[0];

  if (subCommand === 'search') {
    const query = args[1];
    const limit = parseInt(args[2] || '5', 10);

    if (!query) {
      logger.error('Você deve fornecer um termo de busca. Ex: fazai memory search "minha busca"');
      process.exit(1);
    }

    try {
      const qdrant = await getQdrantClient();
      const embedder = new UniversalLocalEmbedder();
      const vector = await embedder.embed(query);

      const searchResult = await qdrant.search('fazai_memory', {
        vector: vector,
        limit: limit,
        with_payload: true
      });

      if (searchResult.length === 0) {
        console.log('Nenhuma memória encontrada para esta busca.');
        process.exit(0);
      }

      console.log(`\n🔍 Resultados da Busca em Memória:`);
      searchResult.forEach((res: any, index: number) => {
        const payload = res.payload || {};
        console.log(`\n[${index + 1}] Arquivo: ${payload.path || 'Desconhecido'} (Score: ${res.score.toFixed(4)})`);
        console.log(`----------------------------------------`);
        console.log(payload.text || '(Sem conteúdo em texto)');
      });

    } catch (error: any) {
      logger.error(`Falha ao buscar na memória: ${error.message}`);
      process.exit(1);
    }
  } else if (subCommand === 'index') {
    // Placeholder for memory index
    logger.info(`Indexando arquivo ${args[1]}... (Ainda a ser implementado)`);
  } else {
    logger.error(`Subcomando desconhecido: ${subCommand}`);
  }
}
