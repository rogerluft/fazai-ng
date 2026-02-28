/**
 * adapter-bridge.mjs — Bridge ESM para qdrant-universal-injection
 *
 * Exporta funções wrapper com singleton init para uso no GenAIScript.
 * O adaptador fornece: embedder ONNX (BGE-base-en-v1.5, 768d),
 * injector multi-collection com ECOA scoring, semantic cache, indexer.
 *
 * Requer: npm link qdrant-universal-injection
 */

import {
  getEmbedder,
  getInjector,
  getQdrantPool,
  getSemanticCache,
  getIndexer,
  loadPersonality,
  buildPersonalityPrompt,
  clearPersonalityCache,
} from "qdrant-universal-injection";

// Singleton init guard
let initialized = false;
let initPromise = null;

/**
 * Inicializa pool Qdrant + embedder ONNX (uma vez só).
 * Safe para chamar múltiplas vezes — idempotente.
 */
export async function initAdapter() {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Embedder PRIMEIRO: carrega modelo ONNX (~5s).
    // Pool DEPOIS: evita socket timeout — Qdrant fecha keep-alive em ~5s
    // e o load do ONNX demora mais que isso.
    const embedder = getEmbedder();
    await embedder.init();

    const pool = getQdrantPool();
    await pool.init();

    const cache = getSemanticCache();
    await cache.init();

    initialized = true;
    console.log(
      `[adapter-bridge] Ready: embedder ${embedder.getDimension()}d, pool ${pool.getState().state}`
    );
  })();

  return initPromise;
}

// ─── Embeddings ────────────────────────────────────────

/**
 * Gera embedding para um texto.
 * Compatível com EmbeddingService.generate(text) do fazai-ng.
 * @param {string} text
 * @returns {Promise<number[]>} vetor 768d normalizado
 */
export async function embed(text) {
  await initAdapter();
  return getEmbedder().embed(text);
}

/**
 * Gera embeddings em batch.
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function embedBatch(texts) {
  await initAdapter();
  return getEmbedder().embedBatch(texts);
}

/**
 * Retorna info do embedder.
 * @returns {{ provider: string, model: string, dimension: number, isLocal: boolean }}
 */
export function getEmbedderInfo() {
  const embedder = getEmbedder();
  return {
    provider: "onnx",
    model: "BGE-base-en-v1.5",
    dimension: embedder.getDimension(),
    isLocal: true,
  };
}

// ─── Injection (ECOA multi-collection search) ──────────

/**
 * Busca multi-collection com ECOA fusion scoring.
 * @param {string} query
 * @param {object} [options]
 * @param {boolean} [options.personalityAlways=true]
 * @param {boolean} [options.includeSource=false]
 * @param {string[]} [options.collections]
 * @param {number} [options.topK=5]
 * @returns {Promise<import("qdrant-universal-injection").InjectionResult>}
 */
export async function inject(query, options = {}) {
  await initAdapter();
  const injector = getInjector();
  return injector.query(query, {
    personalityAlways: true,
    ...options,
  });
}

/**
 * Monta prompt injetado com personalidade + contexto.
 * @param {import("qdrant-universal-injection").InjectionResult} injection
 * @param {string} [originalSystemPrompt]
 * @returns {string}
 */
export function buildPrompt(injection, originalSystemPrompt) {
  const injector = getInjector();
  return injector.buildInjectedPrompt(injection, originalSystemPrompt);
}

// ─── Semantic Cache ────────────────────────────────────

/**
 * Busca no cache semântico.
 * @param {string} query
 * @param {string} model
 * @param {string} provider
 * @returns {Promise<{response: string, hitCount: number} | null>}
 */
export async function cacheLookup(query, model, provider) {
  await initAdapter();
  return getSemanticCache().lookup(query, model, provider);
}

/**
 * Armazena no cache semântico.
 * @param {string} query
 * @param {string} response
 * @param {string} model
 * @param {string} provider
 */
export async function cacheStore(query, response, model, provider) {
  await initAdapter();
  return getSemanticCache().store(query, response, model, provider);
}

/**
 * Estatísticas do cache.
 */
export async function cacheStats() {
  await initAdapter();
  return getSemanticCache().getStats();
}

// ─── Indexer ───────────────────────────────────────────

/**
 * Indexa texto com chunking automático e deduplicação.
 * @param {string} text
 * @param {object} options
 * @param {string} options.collection
 * @param {object} [options.metadata]
 * @param {number} [options.chunkSize=500]
 * @param {number} [options.chunkOverlap=100]
 * @param {boolean} [options.dedup=true]
 */
export async function indexText(text, options) {
  await initAdapter();
  return getIndexer().index(text, options);
}

/**
 * Armazena entrada única (sem chunking).
 * @param {string} text
 * @param {string} collection
 * @param {object} [payload]
 * @returns {Promise<string>} UUID do ponto criado
 */
export async function storeEntry(text, collection, payload) {
  await initAdapter();
  return getIndexer().store(text, collection, payload);
}

// ─── Personality ───────────────────────────────────────

/**
 * Carrega personalidade do Qdrant (com cache 1h).
 * @returns {Promise<import("qdrant-universal-injection").PersonalityTraits>}
 */
export async function getPersonalityTraits() {
  await initAdapter();
  return loadPersonality();
}

/**
 * Gera prompt de personalidade.
 * @param {import("qdrant-universal-injection").PersonalityTraits} [personality]
 * @returns {Promise<string>}
 */
export async function getPersonalityPrompt(personality) {
  await initAdapter();
  const traits = personality || (await loadPersonality());
  return buildPersonalityPrompt(traits);
}

/**
 * Limpa cache de personalidade.
 */
export function clearPersonality() {
  clearPersonalityCache();
}

// ─── Compatibilidade com EmbeddingService do fazai-ng ──

/**
 * Cria um EmbeddingService compatível com a interface do fazai-ng.
 * Drop-in replacement para createEmbeddingService().
 *
 * @returns {Promise<{generate: function, generateBatch: function, getInfo: function}>}
 */
export async function createEmbeddingService() {
  await initAdapter();

  return {
    generate: embed,
    generateBatch: embedBatch,
    getInfo: getEmbedderInfo,
  };
}
