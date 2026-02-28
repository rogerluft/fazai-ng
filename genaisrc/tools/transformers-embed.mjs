/**
 * Transformers.js Embeddings - 100% Local CPU
 *
 * Gera embeddings usando Transformers.js (Xenova)
 * Modelo: all-MiniLM-L6-v2 (384 dims, ~80MB)
 *
 * Features:
 * - 100% local, sem API
 * - Caching de modelo (lazy loading)
 * - Padding para compatibilidade com Qdrant (768 dims)
 * - Zero custo
 */

import { pipeline } from "@xenova/transformers";

// Cache do modelo (singleton)
let embedder = null;
let modelLoading = false;
let modelLoadPromise = null;

// Configuração
const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";  // 384 dims, leve
const NATIVE_DIM = 384;
const TARGET_DIM = 768;  // BGE-base-en-v1.5 native (Lei 768)

/**
 * Obtém o embedder local (lazy loading com cache)
 * @returns {Promise<Pipeline>} Pipeline de feature-extraction
 */
export async function getLocalEmbedder() {
  // Retorna cache se disponível
  if (embedder) {
    return embedder;
  }

  // Evita múltiplas inicializações simultâneas
  if (modelLoading && modelLoadPromise) {
    return modelLoadPromise;
  }

  modelLoading = true;
  console.log(`[Transformers.js] Carregando modelo ${MODEL_NAME}...`);

  modelLoadPromise = pipeline("feature-extraction", MODEL_NAME, {
    // Configurações para CPU
    quantized: true,  // Modelo quantizado (menor, mais rápido)
    progress_callback: (progress) => {
      if (progress.status === "downloading") {
        const pct = Math.round((progress.loaded / progress.total) * 100);
        if (pct % 20 === 0) {
          console.log(`[Transformers.js] Download: ${pct}%`);
        }
      }
    },
  }).then((model) => {
    embedder = model;
    modelLoading = false;
    console.log(`[Transformers.js] Modelo carregado com sucesso!`);
    return model;
  }).catch((error) => {
    modelLoading = false;
    console.error(`[Transformers.js] Erro ao carregar modelo:`, error);
    throw error;
  });

  return modelLoadPromise;
}

/**
 * Gera embedding para um texto
 * @param {string} text - Texto para gerar embedding
 * @returns {Promise<number[]>} Vetor de embedding (768 dims com padding)
 */
export async function embed(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Texto inválido para embedding");
  }

  const model = await getLocalEmbedder();

  // Gera embedding
  const output = await model(text, {
    pooling: "mean",      // Mean pooling para representação densa
    normalize: true,      // Normaliza para unit vector
  });

  // Extrai array do tensor
  const rawVector = Array.from(output.data);

  // Padding para compatibilidade com Qdrant (768 dims)
  if (rawVector.length < TARGET_DIM) {
    const padding = new Array(TARGET_DIM - rawVector.length).fill(0);
    return [...rawVector, ...padding];
  }

  return rawVector.slice(0, TARGET_DIM);
}

/**
 * Gera embeddings em batch
 * @param {string[]} texts - Array de textos
 * @returns {Promise<number[][]>} Array de vetores
 */
export async function embedBatch(texts) {
  if (!Array.isArray(texts)) {
    throw new Error("Input deve ser array de textos");
  }

  const results = [];
  const model = await getLocalEmbedder();

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];

    try {
      const output = await model(text, {
        pooling: "mean",
        normalize: true,
      });

      const rawVector = Array.from(output.data);

      // Padding
      if (rawVector.length < TARGET_DIM) {
        const padding = new Array(TARGET_DIM - rawVector.length).fill(0);
        results.push([...rawVector, ...padding]);
      } else {
        results.push(rawVector.slice(0, TARGET_DIM));
      }

      // Progress log para batches grandes
      if (texts.length > 10 && (i + 1) % 10 === 0) {
        console.log(`[Transformers.js] Batch: ${i + 1}/${texts.length}`);
      }
    } catch (error) {
      console.error(`[Transformers.js] Erro no item ${i}:`, error);
      // Retorna zero vector como fallback
      results.push(new Array(TARGET_DIM).fill(0));
    }
  }

  return results;
}

/**
 * Obtém informações do modelo
 * @returns {Object} Info do modelo
 */
export function getModelInfo() {
  return {
    provider: "transformers.js",
    model: MODEL_NAME,
    nativeDimension: NATIVE_DIM,
    targetDimension: TARGET_DIM,
    isLocal: true,
    isCached: embedder !== null,
    quantized: true,
  };
}

/**
 * Limpa o cache do modelo (libera memória)
 */
export async function clearCache() {
  if (embedder) {
    embedder = null;
    modelLoadPromise = null;
    console.log("[Transformers.js] Cache limpo");
  }
}

// Export default
export default {
  embed,
  embedBatch,
  getLocalEmbedder,
  getModelInfo,
  clearCache,
};
