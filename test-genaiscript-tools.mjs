/**
 * Teste direto das tools do qdrant-adapter SEM precisar do loop agêntico GenAIScript.
 * Simula o que o GenAIScript faria ao chamar as tools.
 */

const killTimer = setTimeout(() => {
  console.error('TIMEOUT: processo preso após 60s');
  process.exit(1);
}, 60000);

try {
  // Importa as mesmas funções que o GenAIScript usa via defTool
  const bridge = await import('./genaisrc/tools/adapter-bridge.mjs');

  // 1. Test adapter_embed
  console.log('\n=== adapter_embed ===');
  const vec = await bridge.embed('como configurar nginx proxy reverso');
  console.log(`dimension: ${vec.length}, first3: [${vec.slice(0,3).map(v => v.toFixed(4))}]`);

  // 2. Test adapter_inject (ECOA multi-collection)
  console.log('\n=== adapter_inject ===');
  const injection = await bridge.inject('como configurar nginx proxy reverso');
  console.log(`personality: ${injection.personality.length} chunks`);
  console.log(`memory: ${injection.memory.length} chunks`);
  console.log(`kb: ${injection.kb.length} chunks`);
  console.log(`learning: ${injection.learning.length} chunks`);
  console.log(`total: ${injection.totalChunks}, time: ${injection.queryTimeMs}ms`);

  // 3. Test buildPrompt
  console.log('\n=== buildPrompt ===');
  const prompt = bridge.buildPrompt(injection, 'Você é o FazAI.');
  console.log(`prompt length: ${prompt.length} chars`);
  console.log(`sections: ${(prompt.match(/^## /gm) || []).length}`);
  console.log(`first 200 chars: ${prompt.substring(0, 200)}...`);

  // 4. Test adapter_cache_lookup (expected miss)
  console.log('\n=== adapter_cache_lookup ===');
  const cached = await bridge.cacheLookup('teste cache miss', 'phi3', 'ollama');
  console.log(`cache hit: ${cached !== null}`);

  // 5. Test adapter_personality
  console.log('\n=== adapter_personality ===');
  const traits = await bridge.getPersonalityTraits();
  console.log(`traits keys: ${Object.keys(traits).join(', ')}`);

  console.log('\n=== TODOS OS TESTES PASSARAM COM DADOS REAIS ===');

} catch (err) {
  console.error('ERRO:', err.message);
  if (err.cause) console.error('CAUSA:', err.cause.code || err.cause);
  console.error(err.stack);
  process.exit(1);
} finally {
  clearTimeout(killTimer);
  process.exit(0);
}
