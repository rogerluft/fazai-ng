import { embed, inject } from './genaisrc/tools/adapter-bridge.mjs';

// Timeout de segurança - mata o processo se travar
const killTimer = setTimeout(() => {
  console.error('TIMEOUT: processo preso após 25s');
  process.exit(1);
}, 25000);

try {
  console.time('embed');
  const vec = await embed('teste de integração');
  console.timeEnd('embed');
  console.log('embed dim:', vec.length);

  if (vec.length !== 768) {
    console.error('FALHA: dimensão esperada 768, obtida ' + vec.length);
    process.exit(1);
  }

  console.time('inject');
  const result = await inject('como configurar nginx proxy reverso');
  console.timeEnd('inject');

  // InjectionResult tem campos separados: personality, memory, learning, kb, inference, source
  const categories = ['personality', 'memory', 'learning', 'kb', 'inference', 'source'];
  const byCollection = {};
  let totalChunks = 0;

  for (const cat of categories) {
    const arr = result[cat] || [];
    if (arr.length > 0) {
      byCollection[cat] = arr.length;
      totalChunks += arr.length;
      // Mostra top score de cada categoria
      console.log(`  ${cat}: ${arr.length} chunks (top score: ${arr[0].vectorScore.toFixed(4)}, fused: ${arr[0].fusedScore.toFixed(4)})`);
    }
  }

  console.log('inject totalChunks:', totalChunks, '(reportado:', result.totalChunks + ')');
  console.log('inject queryTimeMs:', result.queryTimeMs + 'ms');
  console.log('por collection:', JSON.stringify(byCollection));

  // Validação real - NÃO mascarar falhas
  if (totalChunks === 0) {
    console.error('FALHA: inject retornou 0 chunks em todas as collections');
    process.exit(1);
  }

  if (!byCollection.personality) console.error('AVISO: 0 chunks de personality');
  if (!byCollection.memory) console.error('AVISO: 0 chunks de memory');

  console.log('RESULTADO: ' + totalChunks + ' chunks reais retornados');

} catch (err) {
  console.error('ERRO:', err.message);
  if (err.cause) console.error('CAUSA:', err.cause.code || err.cause);
  process.exit(1);
} finally {
  clearTimeout(killTimer);
  process.exit(0);
}
