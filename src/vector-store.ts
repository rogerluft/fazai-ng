import chalk from "chalk";
import { getConfigValue } from "./config";
import { logger } from "./logger";

type VectorDistance = "Cosine" | "Euclid" | "Dot";
type VectorProvider = "qdrant";

interface SchemaField {
  name: string;
  type: "string" | "text" | "int" | "float" | "bool";
  description?: string;
  maxLength?: number;
  array?: boolean;
  optional?: boolean;
}

interface CollectionSchema {
  name: string;
  description: string;
  metadataFields: SchemaField[];
}

export interface VectorValidationOptions {
  provider?: VectorProvider;
  dimension?: number;
  distance?: VectorDistance;
  qdrantUrl?: string;
  qdrantApiKey?: string;
  recreate?: boolean;
}

interface ValidationError {
  collection: string;
  message: string;
}

export interface VectorValidationResult {
  provider: VectorProvider;
  dimension: number;
  distance: VectorDistance;
  created: string[];
  verified: string[];
  updated: string[];
  errors: ValidationError[];
}

/**
 * PADRÃO VETORIAL ECOA (LEI 768)
 * ----------------------------------------------------------------------------
 * Definimos 768 como a dimensão padrão para TODAS as collections.
 * Motivo: Dimensão nativa do modelo BGE-base-en-v1.5 (ONNX, local, gratuito).
 * Embedder: qdrant-universal-injection (singleton estático, 768d)
 *
 * ARQUITETURA DE EMBEDDINGS
 * ----------------------------------------------------------------------------
 * A dimensão padrão para todas as coleções é 768.
 * Motivo: Alinhamento com modelos de embedding locais de alta performance
 * que operam nativamente com esta dimensão (ex: multilingual-e5-base).
 *
 * A aplicação prioriza embeddings 100% locais, rodando na CPU via
 * Transformers.js, sem a necessidade de padding ou chamadas de API externas.
 * ----------------------------------------------------------------------------
 */
const DEFAULT_VECTOR_DIMENSION = 768; // Padrão para modelos locais (e.g., multilingual-e5-base)
const DEFAULT_DISTANCE: VectorDistance = "Cosine";

/**
 * ECOA Architecture - Unidedumultiversal Arrays & Semantic Inodes
 * Baseado no framework de Roger Luft (VeilWalker)
 */
const COLLECTION_SCHEMAS: CollectionSchema[] = [
  {
    name: "fazai_personality",
    description: "ECOA Core: Personalidade do administrador (Inode Semântico Único com evolução temporal).",
    metadataFields: [
      { name: "semantic_id", type: "string", description: "Inode Semântico Único (UUID)", maxLength: 64 },
      { name: "trait_name", type: "string", description: "Nome do traço", maxLength: 64 },
      { name: "category", type: "string", description: "Camada Contextual", maxLength: 32 },
      { name: "value", type: "text", description: "Camada Conceitual (Conteúdo)" },
      { name: "emotional_layer", type: "float", description: "Intensidade/Dor (0.0-1.0)" },
      { name: "temporal_layer", type: "string", description: "Linha do Tempo Evolutiva", maxLength: 64 },
      { name: "legitimate_contexts", type: "string", description: "Hops Contextuais Permitidos", array: true, maxLength: 32 },
      { name: "tags", type: "string", description: "Marcadores Multiversais", array: true, maxLength: 32, optional: true },
    ],
  },
  {
    name: "fazai_memory",
    description: "ECOA Memory: Histórico operacional com auto-indexação informativa.",
    metadataFields: [
      { name: "semantic_id", type: "string", description: "Vínculo com Inode de origem", maxLength: 64 },
      { name: "conversation_id", type: "string", description: "Identificador de sessão", maxLength: 64 },
      { name: "role", type: "string", description: "Ator (user/assistant/autonomous)", maxLength: 16 },
      { name: "timestamp", type: "string", description: "Ponto na linha do tempo", maxLength: 64 },
      { name: "content", type: "text", description: "Array Auto-Informativo (Fragmento Vivo)" },
      { name: "projective_layer", type: "text", description: "Inferência/Previsão futura", optional: true },
      { name: "importance", type: "float", description: "Resonância Cognitiva", optional: true },
      { name: "tags", type: "string", description: "Tags", array: true, maxLength: 32, optional: true },
    ],
  },
  {
    name: "fazai_learning",
    description: "ECOA Learning: Padrões de evolução baseados em dor e sucesso.",
    metadataFields: [
      { name: "semantic_id", type: "string", description: "Inode Semântico Único (UUID)", maxLength: 64 },
      { name: "learning_id", type: "string", description: "Identificador único", maxLength: 96 },
      { name: "type", type: "string", description: "erro (dor), acerto (sucesso), padrão", maxLength: 32 },
      { name: "title", type: "string", description: "Título informativo", maxLength: 256 },
      { name: "description", type: "text", description: "Camada Conceitual do aprendizado" },
      { name: "action_taken", type: "text", description: "Caminho de Hop (Execução)", optional: true },
      { name: "outcome", type: "string", description: "Feedback evolutivo", maxLength: 32 },
      { name: "emotional_layer", type: "float", description: "Intensidade/Dor (0.0-1.0)" },
      { name: "temporal_layer", type: "string", description: "Linha do Tempo Evolutiva", maxLength: 64 },
      { name: "legitimate_contexts", type: "string", description: "Hops Contextuais Permitidos", array: true, maxLength: 32 },
      { name: "resonance", type: "float", description: "Resonância Cognitiva (0.0-1.0)", optional: true },
      { name: "confidence", type: "float", description: "Soberania/Certeza" },
      { name: "category", type: "string", description: "Domínio", maxLength: 64 },
      { name: "timestamp", type: "string", description: "Data", maxLength: 64 },
      { name: "tags", type: "string", description: "Tags", array: true, maxLength: 32, optional: true },
    ],
  },
  {
    name: "fazai_kb",
    description: "ECOA Knowledge: Base técnica unificada com acesso via hop inteligente.",
    metadataFields: [
      { name: "semantic_id", type: "string", description: "Inode Semântico Único (UUID)", maxLength: 64 },
      { name: "slug", type: "string", description: "Slug do Inode", maxLength: 96 },
      { name: "title", type: "string", description: "Título da solução", maxLength: 256 },
      { name: "summary", type: "text", description: "Auto-Indexação (Resumo acionável)" },
      { name: "category", type: "string", description: "Categoria", maxLength: 64 },
      { name: "commands", type: "text", description: "Sequência de comandos (Caminho Direto)", optional: true },
      { name: "emotional_layer", type: "float", description: "Intensidade/Relevância (0.0-1.0)" },
      { name: "temporal_layer", type: "string", description: "Versão/Atualidade", maxLength: 64 },
      { name: "legitimate_contexts", type: "string", description: "Hops Contextuais Permitidos", array: true, maxLength: 32 },
      { name: "resonance", type: "float", description: "Resonância Cognitiva (0.0-1.0)", optional: true },
      { name: "validated", type: "bool", description: "Legitimidade verificada", optional: true },
      { name: "tags", type: "string", description: "Tags", array: true, maxLength: 32, optional: true },
    ],
  },
  {
    name: "fazai_inference",
    description: "ECOA Inference: Regras da Consciência Regente.",
    metadataFields: [
      { name: "semantic_id", type: "string", description: "Inode Semântico Único (UUID)", maxLength: 64 },
      { name: "rule_id", type: "string", description: "ID da Regra", maxLength: 96 },
      { name: "title", type: "string", description: "Título", maxLength: 256 },
      { name: "description", type: "text", description: "Descrição" },
      { name: "condition", type: "text", description: "Gatilho de Hop" },
      { name: "action", type: "text", description: "Ação Soberana" },
      { name: "emotional_layer", type: "float", description: "Intensidade/Urgência (0.0-1.0)" },
      { name: "temporal_layer", type: "string", description: "Versão da Regra", maxLength: 64 },
      { name: "legitimate_contexts", type: "string", description: "Contextos Permitidos", array: true, maxLength: 32 },
      { name: "resonance", type: "float", description: "Resonância Cognitiva (0.0-1.0)", optional: true },
      { name: "priority", type: "int", description: "Prioridade de Execução" },
      { name: "enabled", type: "bool", description: "Ativo" },
      { name: "tags", type: "string", description: "Tags", array: true, maxLength: 32, optional: true },
    ],
  },
  {
    name: "fazai_source",
    description: "ECOA Metacognition: Índice do próprio código-fonte para auto-análise e evolução.",
    metadataFields: [
      { name: "semantic_id", type: "string", description: "ID único do chunk (hash path+index)", maxLength: 96 },
      { name: "path", type: "string", description: "Caminho do arquivo", maxLength: 256 },
      { name: "filename", type: "string", description: "Nome do arquivo", maxLength: 128 },
      { name: "fazai_version", type: "string", description: "Versão do sistema na indexação", maxLength: 32 },
      { name: "content", type: "text", description: "Conteúdo do código ou JSDoc" },
      { name: "is_jsdoc", type: "bool", description: "Se é documentação extraída" },
      { name: "chunk_index", type: "int", description: "Índice sequencial do chunk" },
      { name: "category", type: "string", description: "Categoria (core, service, ui...)", maxLength: 64 },
      { name: "importance_weight", type: "float", description: "Prioridade de busca (0.0-1.0)" },
      { name: "legitimate_contexts", type: "string", description: "Contextos de uso", array: true, maxLength: 32 },
      { name: "functions", type: "string", description: "Funções detectadas", array: true, maxLength: 128, optional: true },
      { name: "classes", type: "string", description: "Classes detectadas", array: true, maxLength: 128, optional: true },
      { name: "imports", type: "string", description: "Imports detectados", array: true, maxLength: 128, optional: true },
      { name: "hash", type: "string", description: "Hash do arquivo original", maxLength: 64 },
      { name: "indexed_at", type: "int", description: "Timestamp da indexação" },
    ],
  },
];

export async function validateVectorCollections(options: VectorValidationOptions = {}): Promise<VectorValidationResult> {
  const provider = resolveProvider(options.provider);
  const dimension = resolveDimension(options.dimension);
  const distance = resolveDistance(options.distance);

  logger.info(chalk.cyan(`\n🗄️  Validando collections vetoriais Terminal FazAI (${provider})`));
  logger.info(chalk.gray(`Dimensão: ${dimension} · Métrica: ${distance}`));

  return validateQdrantCollections({ ...options, dimension, distance });
}

function resolveProvider(input?: VectorProvider): VectorProvider {
  const fromConfig = (getConfigValue("VECTOR_PROVIDER") ?? process.env.VECTOR_PROVIDER ?? "qdrant").toLowerCase();
  const resolved = input ?? (fromConfig as VectorProvider);

  if (resolved === "qdrant") {
    return resolved;
  }

  logger.warn(chalk.yellow(`⚠️  Provider '${resolved}' não suportado. Usando Qdrant.`));
  return "qdrant";
}

function resolveDimension(dimension?: number): number {
  if (typeof dimension === "number" && dimension > 0) {
    return dimension;
  }

  const fromConfig = getConfigValue("VECTOR_DIMENSION") ?? process.env.VECTOR_DIMENSION;
  const parsed = fromConfig ? Number.parseInt(fromConfig, 10) : NaN;

  if (!Number.isNaN(parsed) && parsed > 0) {
    return parsed;
  }

  return DEFAULT_VECTOR_DIMENSION;
}

function resolveDistance(distance?: VectorDistance): VectorDistance {
  if (distance && isValidDistance(distance)) {
    return distance;
  }

  const fromConfig = getConfigValue("VECTOR_DISTANCE") ?? process.env.VECTOR_DISTANCE;
  if (fromConfig && isValidDistance(fromConfig)) {
    return normalizeDistance(fromConfig);
  }

  return DEFAULT_DISTANCE;
}

function isValidDistance(value: unknown): value is VectorDistance | string {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = normalizeDistance(value);
  return normalized === "Cosine" || normalized === "Euclid" || normalized === "Dot";
}

function normalizeDistance(value: string): VectorDistance {
  const upper = value.toUpperCase();
  if (upper === "EUCLID" || upper === "L2") {
    return "Euclid";
  }
  if (upper === "DOT" || upper === "DOT_PRODUCT") {
    return "Dot";
  }
  return "Cosine";
}

interface QdrantValidationContext extends VectorValidationOptions {
  dimension: number;
  distance: VectorDistance;
}

async function validateQdrantCollections(options: QdrantValidationContext): Promise<VectorValidationResult> {
  const baseUrl = resolveQdrantUrl(options.qdrantUrl);
  const apiKey = options.qdrantApiKey ?? process.env.QDRANT_API_KEY ?? getConfigValue("QDRANT_API_KEY");
  const recreate = Boolean(options.recreate);

  const created: string[] = [];
  const verified: string[] = [];
  const updated: string[] = [];
  const errors: ValidationError[] = [];

  for (const schema of COLLECTION_SCHEMAS) {
    try {
      const exists = await qdrantCollectionExists(baseUrl, schema.name, apiKey);

      if (exists && recreate) {
        logger.info(chalk.yellow(`↻  Recriando collection ${schema.name} (remoção solicitada)`));
        await dropQdrantCollection(baseUrl, schema.name, apiKey);
      }

      if (!exists || recreate) {
        logger.info(chalk.blue(`➕  Criando collection ${schema.name} em ${baseUrl}`));
        await createQdrantCollection(baseUrl, schema, options.dimension, options.distance, apiKey);
        created.push(schema.name);
        continue;
      }

      const status = await inspectQdrantCollection(baseUrl, schema.name, apiKey);
      const sizeOk = status?.vectors?.size === options.dimension;
      const distanceOk = status ? normalizeDistance(status.vectors?.distance ?? "") === options.distance : false;

      if (!sizeOk || !distanceOk) {
        const mismatch = [
          sizeOk ? null : `dimension ${status?.vectors?.size ?? "?"} ≠ ${options.dimension}`,
          distanceOk ? null : `distance ${status?.vectors?.distance ?? "?"} ≠ ${options.distance}`,
        ]
          .filter(Boolean)
          .join(" · ");
        logger.warn(chalk.yellow(`⚠️  Collection ${schema.name} existe mas diverge da configuração desejada (${mismatch}). Utilize --recreate para alinhar.`));
        updated.push(schema.name);
      } else {
        verified.push(schema.name);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ collection: schema.name, message });
      logger.error(chalk.red(`❌  Falha ao validar ${schema.name}: ${message}`));
    }
  }

  return {
    provider: "qdrant",
    dimension: options.dimension,
    distance: options.distance,
    created,
    verified,
    updated,
    errors,
  };
}

function resolveQdrantUrl(explicit?: string): string {
  const candidate = explicit ?? process.env.QDRANT_URL ?? getConfigValue("QDRANT_URL") ?? "http://localhost:6333";
  if (!candidate.startsWith("http://") && !candidate.startsWith("https://")) {
    return `http://${candidate}`;
  }
  return candidate;
}

async function qdrantCollectionExists(baseUrl: string, collection: string, apiKey?: string): Promise<boolean> {
  const response = await qdrantFetch<{ status: { error?: string } }>(baseUrl, `/collections/${collection}`, { method: "GET" }, apiKey);
  if (response.status === 404) {
    return false;
  }
  if (!response.ok) {
    throw new Error(response.error ?? `Erro HTTP ${response.status}`);
  }
  return true;
}

async function dropQdrantCollection(baseUrl: string, collection: string, apiKey?: string): Promise<void> {
  const response = await qdrantFetch(baseUrl, `/collections/${collection}`, { method: "DELETE" }, apiKey);
  if (!response.ok) {
    throw new Error(response.error ?? `Erro HTTP ${response.status}`);
  }
}

interface QdrantSchemaPayload {
  vectors: {
    size: number;
    distance: VectorDistance;
  };
  payload_schema: Record<string, { type: string; optional?: boolean }>;
  on_disk_payload: boolean;
}

async function createQdrantCollection(baseUrl: string, schema: CollectionSchema, dimension: number, distance: VectorDistance, apiKey?: string): Promise<void> {
  const payload: QdrantSchemaPayload = {
    vectors: {
      size: dimension,
      distance,
    },
    payload_schema: buildQdrantPayloadSchema(schema),
    on_disk_payload: true,
  };

  const response = await qdrantFetch(baseUrl, `/collections/${schema.name}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, apiKey);

  if (!response.ok) {
    throw new Error(response.error ?? `Erro HTTP ${response.status}`);
  }
}

async function inspectQdrantCollection(baseUrl: string, collection: string, apiKey?: string): Promise<{ vectors?: { size: number; distance: string } } | null> {
  const response = await qdrantFetch<{ result?: { config?: { params?: { size: number; distance: string } } } }>(
    baseUrl,
    `/collections/${collection}`,
    { method: "GET" },
    apiKey
  );

  if (!response.ok || !response.data?.result?.config?.params) {
    return null;
  }

  return {
    vectors: {
      size: response.data.result.config.params.size,
      distance: response.data.result.config.params.distance,
    },
  };
}

function buildQdrantPayloadSchema(schema: CollectionSchema): Record<string, { type: string; optional?: boolean }> {
  const payloadSchema: Record<string, { type: string; optional?: boolean }> = {};

  for (const field of schema.metadataFields) {
    payloadSchema[field.name] = {
      type: mapFieldTypeToQdrant(field),
      optional: field.optional,
    };
  }

  return payloadSchema;
}

function mapFieldTypeToQdrant(field: SchemaField): string {
  switch (field.type) {
    case "int":
      return "integer";
    case "float":
      return "float";
    case "bool":
      return "bool";
    case "text":
      return "text";
    case "string":
    default:
      return "keyword";
  }
}

interface QdrantFetchResponse<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

async function qdrantFetch<T = unknown>(
  baseUrl: string,
  path: string,
  init: RequestInit,
  apiKey?: string
): Promise<QdrantFetchResponse<T>> {
  const url = new URL(path, baseUrl);
  const headers = new Headers(init.headers ?? {});
  headers.set("Content-Type", "application/json");
  if (apiKey) {
    headers.set("api-key", apiKey);
  }

  try {
    const response = await fetch(url, { ...init, headers });
    const status = response.status;
    const ok = response.ok;
    const text = await response.text();
    const data = text ? (safeJsonParse<T>(text) ?? undefined) : undefined;

    if (!ok && status !== 404 && status !== 400) {
      return {
        ok,
        status,
        error: extractQdrantError(data) ?? text,
      };
    }

    return {
      ok,
      status,
      data,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      status: 0,
      error: message,
    };
  }
}

function extractQdrantError(data: unknown): string | undefined {
  if (typeof data !== "object" || !data) {
    return undefined;
  }

  if ("status" in data && typeof (data as { status?: { error?: string } }).status?.error === "string") {
    return (data as { status?: { error?: string } }).status?.error;
  }

  if ("status" in data && typeof (data as { status?: { error_message?: string } }).status?.error_message === "string") {
    return (data as { status?: { error_message?: string } }).status?.error_message;
  }

  return undefined;
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
