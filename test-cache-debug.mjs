import { initAdapter } from './genaisrc/tools/adapter-bridge.mjs';
import { getSemanticCache, getEmbedder, getQdrantPool } from 'qdrant-universal-injection';

const killTimer = setTimeout(() => {
  console.error('TIMEOUT: processo preso após 20s');
  process.exit(1);
}, 20000);

try {
  await initAdapter();
  console.log('[1] adapter initialized');

  const cache = getSemanticCache();
  const embedder = getEmbedder();
  const pool = getQdrantPool();

  // Step 1: embed direto
  console.time('embed-cache-test');
  const vec = await embedder.embed('teste cache miss');
  console.timeEnd('embed-cache-test');
  console.log('[2] embed OK, dim:', vec.length);

  // Step 2: search direto na collection de cache
  console.time('search-cache-direct');
  const results = await pool.execute(c =>
    c.search('fazai_semantic_cache', {
      vector: vec,
      limit: 1,
      score_threshold: 0.88,
      with_payload: true,
      filter: {
        must: [
          { key: 'model', match: { value: 'phi3' } },
          { key: 'provider', match: { value: 'ollama' } },
        ],
      },
    })
  );
  console.timeEnd('search-cache-direct');
  console.log('[3] search direto OK, results:', results.length);

  // Step 3: agora pelo cache.lookup()
  console.time('cache-lookup');
  const hit = await cache.lookup('teste cache miss', 'phi3', 'ollama');
  console.timeEnd('cache-lookup');
  console.log('[4] cache.lookup OK, hit:', hit !== null);

  // Cleanup
  cache.destroy();
  console.log('[5] cache destroyed');

} catch (err) {
  console.error('ERRO:', err.message);
  if (err.cause) console.error('CAUSA:', err.cause);
  process.exit(1);
} finally {
  clearTimeout(killTimer);
  process.exit(0);
}
