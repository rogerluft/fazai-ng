/**
 * Qdrant Tools para GenAIScript - VERSÃO COMPLETA
 * Ferramentas para interagir com todas as collections do Qdrant
 */

import { QdrantClient } from "@qdrant/js-client-rest";

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const client = new QdrantClient({ url: QDRANT_URL });

// Collections disponíveis com seus propósitos
export const COLLECTIONS = {
  personality: "fazai_personality",    // Traços de personalidade
  memory: "fazai_memory",              // Memórias de conversas
  learning: "fazai_learning",          // Aprendizados técnicos
  kb: "fazai_kb",                      // Knowledge base
  inference: "fazai_inference",        // Regras de inferência
  semantic_cache: "fazai_semantic_cache", // Cache semântico
  source: "fazai_source",              // Código fonte indexado
};

// Dimensão padrão (nomic-embed-text nativo)
const VECTOR_DIMENSION = 768;

/**
 * Verifica se collection existe e cria se necessário
 */
export async function ensureCollection(collectionName, dimension = VECTOR_DIMENSION) {
  try {
    await client.getCollection(collectionName);
    return { exists: true };
  } catch (error) {
    if (error.status === 404) {
      await client.createCollection(collectionName, {
        vectors: {
          size: dimension,
          distance: "Cosine",
        },
      });
      return { exists: false, created: true };
    }
    throw error;
  }
}

/**
 * Busca semântica em uma collection
 * @param {string} collection - Nome da collection
 * @param {number[]} vector - Vetor de embedding
 * @param {number} limit - Número máximo de resultados
 * @param {object} filter - Filtro opcional
 */
export async function qdrantSearch(collection, vector, limit = 5, filter = null) {
  try {
    const searchParams = {
      vector,
      limit,
      with_payload: true,
      with_vector: false,
    };

    if (filter) {
      searchParams.filter = filter;
    }

    const results = await client.search(collection, searchParams);
    return results.map((r) => ({
      id: r.id,
      score: r.score,
      payload: r.payload,
    }));
  } catch (error) {
    console.error(`Erro ao buscar em ${collection}:`, error.message);
    return { error: error.message };
  }
}

/**
 * Busca em múltiplas collections simultaneamente
 * @param {number[]} vector - Vetor de embedding
 * @param {string[]} collections - Lista de collections para buscar
 * @param {number} limitPerCollection - Limite por collection
 */
export async function qdrantMultiSearch(vector, collections = ["memory", "kb", "learning"], limitPerCollection = 3) {
  const results = {};

  await Promise.all(
    collections.map(async (collName) => {
      const fullName = COLLECTIONS[collName] || collName;
      const searchResults = await qdrantSearch(fullName, vector, limitPerCollection);
      results[collName] = searchResults;
    })
  );

  return results;
}

/**
 * Busca com fusion scoring (Neural Flow style)
 * @param {number[]} vector - Vetor de embedding
 * @param {object} weights - Pesos por collection
 */
export async function qdrantFusionSearch(vector, weights = {
  memory: 0.20,
  learning: 0.40,
  kb: 0.30,
  inference: 0.10,
}) {
  const collections = Object.keys(weights);
  const multiResults = await qdrantMultiSearch(vector, collections, 5);

  // Aplica fusion scoring
  const fusedResults = [];

  for (const [collName, results] of Object.entries(multiResults)) {
    if (Array.isArray(results)) {
      const weight = weights[collName] || 0.25;
      for (const result of results) {
        fusedResults.push({
          ...result,
          source: collName,
          fusedScore: result.score * weight,
        });
      }
    }
  }

  // Ordena por score fusionado
  fusedResults.sort((a, b) => b.fusedScore - a.fusedScore);

  return fusedResults.slice(0, 10);
}

/**
 * Upsert de pontos em uma collection
 * @param {string} collection - Nome da collection
 * @param {object[]} points - Array de pontos {id, vector, payload}
 */
export async function qdrantUpsert(collection, points) {
  try {
    await ensureCollection(collection);

    await client.upsert(collection, {
      wait: true,
      points: points.map((p) => ({
        id: p.id || Date.now() + Math.random(),
        vector: p.vector,
        payload: {
          ...p.payload,
          indexed_at: new Date().toISOString(),
        },
      })),
    });

    return { success: true, count: points.length };
  } catch (error) {
    console.error(`Erro ao upsert em ${collection}:`, error.message);
    return { error: error.message };
  }
}

/**
 * Upsert de insight/aprendizado
 * @param {string} content - Conteúdo do insight
 * @param {number[]} vector - Vetor de embedding
 * @param {string} category - Categoria (error_fix, pattern, optimization, insight)
 * @param {string} source - Origem do insight
 */
export async function qdrantUpsertInsight(content, vector, category = "insight", source = "agentic_loop") {
  const point = {
    id: Date.now(),
    vector,
    payload: {
      content,
      category,
      source,
      timestamp: new Date().toISOString(),
      type: "insight",
    },
  };

  return await qdrantUpsert(COLLECTIONS.learning, [point]);
}

/**
 * Upsert de reflexão
 */
export async function qdrantUpsertReflection(reflection, vector, context = {}) {
  const point = {
    id: Date.now(),
    vector,
    payload: {
      content: reflection,
      type: "reflection",
      context,
      timestamp: new Date().toISOString(),
    },
  };

  return await qdrantUpsert(COLLECTIONS.memory, [point]);
}

/**
 * Lista collections disponíveis
 */
export async function qdrantListCollections() {
  try {
    const collections = await client.getCollections();
    return collections.collections.map((c) => ({
      name: c.name,
      isFazAI: Object.values(COLLECTIONS).includes(c.name),
    }));
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Scroll por uma collection (para reflexão)
 * @param {string} collection - Nome da collection
 * @param {number} limit - Limite de resultados
 * @param {object} filter - Filtro opcional
 */
export async function qdrantScroll(collection, limit = 10, filter = null) {
  try {
    const scrollParams = {
      limit,
      with_payload: true,
      with_vector: false,
    };

    if (filter) {
      scrollParams.filter = filter;
    }

    const results = await client.scroll(collection, scrollParams);
    return results.points.map((p) => ({
      id: p.id,
      payload: p.payload,
    }));
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Conta pontos em uma collection
 */
export async function qdrantCount(collection) {
  try {
    const info = await client.getCollection(collection);
    return {
      points_count: info.points_count,
      vectors_count: info.vectors_count,
      status: info.status,
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Deleta pontos por filtro
 */
export async function qdrantDelete(collection, filter) {
  try {
    await client.delete(collection, {
      wait: true,
      filter,
    });
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Obtém estatísticas de todas as collections FazAI
 */
export async function qdrantStats() {
  const stats = {};

  for (const [name, fullName] of Object.entries(COLLECTIONS)) {
    const count = await qdrantCount(fullName);
    stats[name] = count;
  }

  return stats;
}

// Exporta cliente para uso direto se necessário
export { client };

// Export default com todas as funções
export default {
  COLLECTIONS,
  client,
  ensureCollection,
  qdrantSearch,
  qdrantMultiSearch,
  qdrantFusionSearch,
  qdrantUpsert,
  qdrantUpsertInsight,
  qdrantUpsertReflection,
  qdrantListCollections,
  qdrantScroll,
  qdrantCount,
  qdrantDelete,
  qdrantStats,
};
