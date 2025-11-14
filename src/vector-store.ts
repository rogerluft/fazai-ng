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

const DEFAULT_VECTOR_DIMENSION = 1536;
const DEFAULT_DISTANCE: VectorDistance = "Cosine";

/**
 * Terminal Jarvis + AutoGPT Collections
 * Arquitetura de memória autônoma para o agente
 */
const COLLECTION_SCHEMAS: CollectionSchema[] = [
  {
    name: "jarvis_personality",
    description: "Personalidade e preferências do agente - traits, valores, estilo de comunicação.",
    metadataFields: [
      { name: "trait_name", type: "string", description: "Nome do traço de personalidade", maxLength: 64 },
      { name: "category", type: "string", description: "Categoria (comunicação, decisão, ética)", maxLength: 32 },
      { name: "value", type: "text", description: "Descrição detalhada do valor/traço" },
      { name: "intensity", type: "float", description: "Intensidade do traço (0.0-1.0)" },
      { name: "context", type: "string", description: "Contexto de aplicação", maxLength: 128, optional: true },
      { name: "tags", type: "string", description: "Tags auxiliares", array: true, maxLength: 32, optional: true },
    ],
  },
  {
    name: "jarvis_memory",
    description: "Memória de longo prazo - conversas, contexto do usuário, histórico de vida.",
    metadataFields: [
      { name: "conversation_id", type: "string", description: "Identificador lógico da conversa", maxLength: 64 },
      { name: "message_id", type: "int", description: "Sequência incremental por conversa" },
      { name: "role", type: "string", description: "user/assistant/system/autonomous", maxLength: 16 },
      { name: "timestamp", type: "string", description: "ISO timestamp", maxLength: 64 },
      { name: "content", type: "text", description: "Conteúdo bruto da mensagem/ação" },
      { name: "summary", type: "text", description: "Resumo curto para buscas", optional: true },
      { name: "emotional_context", type: "string", description: "Contexto emocional detectado", maxLength: 64, optional: true },
      { name: "importance", type: "float", description: "Score de importância (0.0-1.0)", optional: true },
      { name: "tags", type: "string", description: "Marcadores auxiliares", array: true, maxLength: 32, optional: true },
    ],
  },
  {
    name: "jarvis_learning",
    description: "Aprendizado contínuo - erros, acertos, padrões descobertos, otimizações.",
    metadataFields: [
      { name: "learning_id", type: "string", description: "Identificador único do aprendizado", maxLength: 96 },
      { name: "type", type: "string", description: "Tipo: erro, acerto, padrão, otimização", maxLength: 32 },
      { name: "title", type: "string", description: "Título resumido", maxLength: 256 },
      { name: "description", type: "text", description: "Descrição detalhada do que foi aprendido" },
      { name: "context", type: "text", description: "Contexto completo da situação" },
      { name: "action_taken", type: "text", description: "Ação que foi tomada", optional: true },
      { name: "outcome", type: "string", description: "Resultado: sucesso, falha, parcial", maxLength: 32 },
      { name: "confidence", type: "float", description: "Confiança na lição aprendida (0.0-1.0)" },
      { name: "category", type: "string", description: "Categoria (linux, network, security, social)", maxLength: 64 },
      { name: "timestamp", type: "string", description: "Quando foi aprendido", maxLength: 64 },
      { name: "applied_count", type: "int", description: "Quantas vezes foi aplicado com sucesso", optional: true },
      { name: "tags", type: "string", description: "Tags para busca", array: true, maxLength: 32, optional: true },
    ],
  },
  {
    name: "jarvis_kb",
    description: "Base de conhecimento - soluções Linux, redes, inferências validadas (RAG).",
    metadataFields: [
      { name: "slug", type: "string", description: "Identificador estável", maxLength: 96 },
      { name: "title", type: "string", description: "Título curto da solução", maxLength: 256 },
      { name: "summary", type: "text", description: "Resumo detalhado da solução" },
      { name: "category", type: "string", description: "Categoria principal (networking, storage, security)", maxLength: 64 },
      { name: "scope", type: "string", description: "Escopo de aplicação (cluster, host, container)", maxLength: 64, optional: true },
      { name: "linux_distribution", type: "string", description: "Distribuição alvo (debian, rhel, arch)", maxLength: 48, optional: true },
      { name: "component", type: "string", description: "Componente/serviço relacionado", maxLength: 64, optional: true },
      { name: "commands", type: "text", description: "Sequência de comandos prevista", optional: true },
      { name: "source", type: "string", description: "Fonte da informação", maxLength: 256, optional: true },
      { name: "confidence", type: "float", description: "Score de confiança (0.0-1.0)", optional: true },
      { name: "validated", type: "bool", description: "Se foi validado na prática", optional: true },
      { name: "tags", type: "string", description: "Marcadores livres", array: true, maxLength: 32, optional: true },
    ],
  },
  {
    name: "jarvis_inference",
    description: "Inferências manuais - decisões explícitas, regras personalizadas, políticas do usuário.",
    metadataFields: [
      { name: "rule_id", type: "string", description: "Identificador da regra", maxLength: 96 },
      { name: "title", type: "string", description: "Título da regra/decisão", maxLength: 256 },
      { name: "description", type: "text", description: "Descrição completa da inferência" },
      { name: "condition", type: "text", description: "Condição para aplicar a regra" },
      { name: "action", type: "text", description: "Ação a ser tomada" },
      { name: "priority", type: "int", description: "Prioridade de execução (maior = mais prioritária)" },
      { name: "enabled", type: "bool", description: "Se a regra está ativa" },
      { name: "created_by", type: "string", description: "user ou autonomous", maxLength: 32 },
      { name: "created_at", type: "string", description: "Timestamp de criação", maxLength: 64 },
      { name: "last_applied", type: "string", description: "Última vez que foi aplicada", maxLength: 64, optional: true },
      { name: "apply_count", type: "int", description: "Quantas vezes foi aplicada", optional: true },
      { name: "tags", type: "string", description: "Tags de categorização", array: true, maxLength: 32, optional: true },
    ],
  },
];

export async function validateVectorCollections(options: VectorValidationOptions = {}): Promise<VectorValidationResult> {
  const provider = resolveProvider(options.provider);
  const dimension = resolveDimension(options.dimension);
  const distance = resolveDistance(options.distance);

  logger.info(chalk.cyan(`\n🗄️  Validando collections vetoriais Terminal Jarvis (${provider})`));
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
