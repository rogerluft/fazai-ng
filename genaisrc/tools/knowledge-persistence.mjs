/**
 * Knowledge Persistence - Gerencia persistência de conhecimento no Qdrant
 *
 * Responsabilidades:
 * 1. Upsert inteligente com metadata enriquecida
 * 2. Deduplicação semântica
 * 3. Versionamento de conhecimento
 * 4. Garbage collection de conhecimento obsoleto
 */

import {
  qdrantUpsert,
  qdrantSearch,
  qdrantScroll,
  qdrantDelete,
  COLLECTIONS,
  ensureCollection,
} from "./qdrant-tools.mjs";

/**
 * Enriquece metadata com informações de contexto
 */
function enrichMetadata(baseMetadata) {
  return {
    ...baseMetadata,
    indexed_at: new Date().toISOString(),
    version: baseMetadata.version || "1.0.0",
    status: baseMetadata.status || "active",
    quality_score: baseMetadata.quality_score || 0.5,
    last_accessed: null,
    access_count: 0,
    tags: baseMetadata.tags || [],
  };
}

/**
 * Calcula hash de conteúdo para deduplicação
 */
function contentHash(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Verifica duplicação semântica antes de inserir
 */
export async function checkSemanticDuplication(collection, embedding, content, threshold = 0.92) {
  const similar = await qdrantSearch(collection, embedding, 5);

  // Verifica similaridade semântica
  const semanticDuplicates = similar.filter((s) => s.score > threshold);

  if (semanticDuplicates.length > 0) {
    return {
      isDuplicate: true,
      matches: semanticDuplicates.map((s) => ({
        id: s.id,
        score: s.score,
        content: s.payload.content?.substring(0, 100) + "...",
      })),
      reason: "semantic_similarity",
    };
  }

  // Verifica hash exato (conteúdo idêntico)
  const hash = contentHash(content);
  const exactMatches = similar.filter(
    (s) => s.payload.content_hash === hash && s.score > 0.98
  );

  if (exactMatches.length > 0) {
    return {
      isDuplicate: true,
      matches: exactMatches.map((s) => ({
        id: s.id,
        score: s.score,
      })),
      reason: "exact_content_match",
    };
  }

  return {
    isDuplicate: false,
    matches: [],
  };
}

/**
 * Upsert com deduplicação automática
 */
export async function upsertWithDeduplication(collection, content, embedding, metadata = {}) {
  // Verifica duplicação
  const dupCheck = await checkSemanticDuplication(collection, embedding, content);

  if (dupCheck.isDuplicate) {
    // Se já existe, incrementa contador de acesso
    const existingId = dupCheck.matches[0].id;

    // TODO: Update access count (Qdrant não tem update parcial, precisa re-upsert)

    return {
      success: true,
      action: "deduplicated",
      existing_id: existingId,
      reason: dupCheck.reason,
      matches: dupCheck.matches,
    };
  }

  // Cria novo ponto
  const hash = contentHash(content);
  const enrichedMetadata = enrichMetadata(metadata);

  const point = {
    id: metadata.id || `kb_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    vector: embedding,
    payload: {
      content,
      content_hash: hash,
      ...enrichedMetadata,
    },
  };

  const result = await qdrantUpsert(collection, [point]);

  return {
    success: result.success,
    action: "inserted",
    id: point.id,
    content_length: content.length,
  };
}

/**
 * Batch upsert com deduplicação
 */
export async function batchUpsertWithDeduplication(collection, items) {
  const results = {
    inserted: [],
    deduplicated: [],
    failed: [],
  };

  for (const item of items) {
    try {
      const result = await upsertWithDeduplication(
        collection,
        item.content,
        item.embedding,
        item.metadata || {}
      );

      if (result.action === "inserted") {
        results.inserted.push(result);
      } else {
        results.deduplicated.push(result);
      }
    } catch (error) {
      results.failed.push({
        content: item.content.substring(0, 50) + "...",
        error: error.message,
      });
    }
  }

  return {
    success: true,
    summary: {
      total: items.length,
      inserted: results.inserted.length,
      deduplicated: results.deduplicated.length,
      failed: results.failed.length,
    },
    details: results,
  };
}

/**
 * Atualiza versão de conhecimento existente
 */
export async function updateKnowledgeVersion(collection, knowledgeId, newContent, newEmbedding, updateMetadata = {}) {
  // Busca versão anterior
  const previous = await qdrantScroll(collection, 1, {
    must: [{ key: "id", match: { value: knowledgeId } }],
  });

  if (previous.length === 0) {
    throw new Error(`Knowledge not found: ${knowledgeId}`);
  }

  const oldPayload = previous[0].payload;
  const oldVersion = oldPayload.version || "1.0.0";

  // Incrementa versão
  const versionParts = oldVersion.split(".").map(Number);
  versionParts[2]++; // Patch version
  const newVersion = versionParts.join(".");

  // Arquiva versão antiga
  const archivedPoint = {
    id: `${knowledgeId}_v${oldVersion}`,
    vector: previous[0].vector || new Array(768).fill(0),
    payload: {
      ...oldPayload,
      status: "archived",
      archived_at: new Date().toISOString(),
      replaced_by: knowledgeId,
    },
  };

  await qdrantUpsert(`${collection}_archive`, [archivedPoint]);

  // Atualiza com nova versão
  const updatedPoint = {
    id: knowledgeId,
    vector: newEmbedding,
    payload: {
      ...oldPayload,
      content: newContent,
      content_hash: contentHash(newContent),
      version: newVersion,
      updated_at: new Date().toISOString(),
      previous_version: oldVersion,
      ...updateMetadata,
    },
  };

  await qdrantUpsert(collection, [updatedPoint]);

  return {
    success: true,
    id: knowledgeId,
    old_version: oldVersion,
    new_version: newVersion,
    archived_id: archivedPoint.id,
  };
}

/**
 * Garbage Collection - Remove conhecimento obsoleto
 */
export async function garbageCollectObsolete(collection, criteria = {}) {
  const {
    olderThan = 90, // dias
    minQualityScore = 0.3,
    maxAccessCount = 5,
    status = "draft",
  } = criteria;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThan);

  // Busca candidatos a remoção
  const candidates = await qdrantScroll(collection, 100, {
    must: [
      {
        key: "status",
        match: { value: status },
      },
    ],
  });

  const toDelete = candidates.filter((point) => {
    const indexed = new Date(point.payload.indexed_at || 0);
    const quality = point.payload.quality_score || 0;
    const accesses = point.payload.access_count || 0;

    return (
      indexed < cutoffDate &&
      quality < minQualityScore &&
      accesses < maxAccessCount
    );
  });

  // Deleta em batch
  const deleteIds = toDelete.map((p) => p.id);

  if (deleteIds.length > 0) {
    await qdrantDelete(collection, {
      must: [
        {
          key: "id",
          match: { any: deleteIds },
        },
      ],
    });
  }

  return {
    success: true,
    deleted_count: deleteIds.length,
    criteria,
    deleted_ids: deleteIds,
  };
}

/**
 * Promove conhecimento de draft para active
 */
export async function promoteKnowledge(collection, knowledgeId) {
  const existing = await qdrantScroll(collection, 1, {
    must: [{ key: "id", match: { value: knowledgeId } }],
  });

  if (existing.length === 0) {
    throw new Error(`Knowledge not found: ${knowledgeId}`);
  }

  const payload = existing[0].payload;

  const updatedPoint = {
    id: knowledgeId,
    vector: existing[0].vector || new Array(768).fill(0),
    payload: {
      ...payload,
      status: "active",
      activated_at: new Date().toISOString(),
      quality_score: Math.min(1.0, (payload.quality_score || 0.5) + 0.2),
    },
  };

  await qdrantUpsert(collection, [updatedPoint]);

  return {
    success: true,
    id: knowledgeId,
    new_status: "active",
  };
}

/**
 * Exporta conhecimento para backup
 */
export async function exportKnowledge(collection, outputPath = null) {
  const allPoints = await qdrantScroll(collection, 10000);

  const exportData = {
    collection,
    exported_at: new Date().toISOString(),
    total_points: allPoints.length,
    points: allPoints,
  };

  if (outputPath) {
    // TODO: Write to file
    console.log(`Export to ${outputPath} not implemented. Use JSON below:`);
  }

  return exportData;
}

/**
 * Importa conhecimento de backup
 */
export async function importKnowledge(collection, backupData) {
  const { points } = backupData;

  await ensureCollection(collection);

  // Batch upsert
  const batchSize = 100;
  let imported = 0;

  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize);
    await qdrantUpsert(collection, batch);
    imported += batch.length;
  }

  return {
    success: true,
    imported_count: imported,
    collection,
  };
}

export default {
  enrichMetadata,
  contentHash,
  checkSemanticDuplication,
  upsertWithDeduplication,
  batchUpsertWithDeduplication,
  updateKnowledgeVersion,
  garbageCollectObsolete,
  promoteKnowledge,
  exportKnowledge,
  importKnowledge,
};
