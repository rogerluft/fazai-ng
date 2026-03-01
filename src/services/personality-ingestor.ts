/**
 * Personality Ingestor Service
 *
 * Processa os dados exportados do Claude (conversations, memories, projects, users)
 * e injeta na collection fazai_personality do Qdrant com embeddings 768d (Lei 768).
 *
 * Features:
 * - Chunking semântico de conversations (pares Q/A)
 * - Payloads específicos por tipo de dado (dialogue, fact, technical_context, social_context)
 * - Metadados de ingestão (version, timestamp)
 * - Embeddings via UniversalLocalEmbedder (768 dimensions - Lei 768)
 * - Progress tracking para grandes volumes
 *
 * @module services/personality-ingestor
 */

import { readFile } from "fs/promises";
import { randomUUID, createHash } from "crypto";
import { logger } from "../logger";

/**
 * Gera hash SHA256 curto de um texto para deduplicação
 */
function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}
import { getQdrantClient } from "../database/qdrant-pool";
import { createEmbeddingService } from "./embeddings";

/**
 * Estrutura de uma conversa exportada do Claude
 */
interface ClaudeConversation {
  uuid: string;
  name: string;
  summary: string;
  created_at: string;
  updated_at: string;
  account: {
    uuid: string;
  };
  chat_messages: ChatMessage[];
}

/**
 * Mensagem individual de um chat
 */
interface ChatMessage {
  uuid: string;
  text: string;
  sender: "human" | "assistant";
  created_at: string;
  updated_at: string;
  content?: Array<{
    type: string;
    text?: string;
  }>;
}

/**
 * Memória exportada do Claude
 */
interface ClaudeMemory {
  conversations_memory?: string;
  project_memories?: Record<string, string>;
  account_uuid: string;
}

/**
 * Projeto exportado do Claude
 */
interface ClaudeProject {
  uuid: string;
  name: string;
  description: string;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  creator: {
    uuid: string;
    full_name: string;
  };
  docs?: Array<{
    uuid: string;
    filename: string;
    content: string;
    created_at: string;
  }>;
}

/**
 * Usuário exportado do Claude
 */
interface ClaudeUser {
  uuid: string;
  full_name: string;
  email_address: string;
  verified_phone_number?: string;
}

/**
 * Chunk processado pronto para ingestão
 */
interface PersonalityChunk {
  id: string;
  text: string;
  embedding: number[];
  payload: {
    type: "dialogue" | "fact" | "technical_context" | "social_context";
    source_file: string;
    source_uuid?: string;
    created_at?: string;
    ingestion_version: string;
    ingested_at: string;

    // Campos específicos por tipo
    style?: string;
    emotional_layer?: number;
    ressonancia?: number;
    context?: string;
    importance?: number;
    project?: string;
    relation?: boolean;

    // Metadados adicionais
    metadata?: Record<string, unknown>;

    // Deduplicação
    content_hash?: string;
  };
}

/**
 * Estatísticas de ingestão
 */
export interface IngestionStats {
  conversations: {
    total: number;
    chunks: number;
    errors: number;
  };
  memories: {
    total: number;
    chunks: number;
    errors: number;
  };
  projects: {
    total: number;
    chunks: number;
    errors: number;
  };
  users: {
    total: number;
    chunks: number;
    errors: number;
  };
  totalChunks: number;
  totalEmbeddings: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

const COLLECTION_NAME = "fazai_personality";
const INGESTION_VERSION = "v1-resurrected";
const BATCH_SIZE = 50; // Inserir em lotes para melhor performance

/**
 * Classe principal do PersonalityIngestor
 */
export class PersonalityIngestor {
  private stats: IngestionStats;
  private existingHashes: Set<string> = new Set();

  constructor() {
    this.stats = {
      conversations: { total: 0, chunks: 0, errors: 0 },
      memories: { total: 0, chunks: 0, errors: 0 },
      projects: { total: 0, chunks: 0, errors: 0 },
      users: { total: 0, chunks: 0, errors: 0 },
      totalChunks: 0,
      totalEmbeddings: 0,
      startTime: new Date(),
    };
  }

  /**
   * Inicializa o set de hashes existentes no banco para deduplicação
   */
  private async loadExistingHashes(): Promise<void> {
    try {
      const client = await getQdrantClient();
      logger.info("🔍 Loading existing hashes for deduplication...");

      let offset: string | number | undefined = undefined;
      let hasNextPage = true;

      while (hasNextPage) {
        const scrollResult = await client.scroll(COLLECTION_NAME, {
          limit: 10000,
          offset,
          with_payload: ["content_hash"],
        });

        for (const point of scrollResult.points) {
          if (point.payload && typeof point.payload.content_hash === "string") {
            this.existingHashes.add(point.payload.content_hash);
          }
        }

        offset = scrollResult.next_page_offset;
        hasNextPage = offset !== null && offset !== undefined;
      }

      logger.info(`✅ Loaded ${this.existingHashes.size} existing hashes`);
    } catch (error) {
      // Coleção ainda não existe ou vazia
      logger.debug("No existing hashes found (new collection?)");
    }
  }

  /**
   * Ingere todos os 4 arquivos JSON de um diretório
   */
  async ingestAll(dataDir: string): Promise<IngestionStats> {
    logger.info(`🚀 Starting personality ingestion from ${dataDir}`);
    this.stats.startTime = new Date();

    try {
      // Carregar hashes para deduplicação antes de inserir novos
      await this.loadExistingHashes();

      // Processar em paralelo (arquivos independentes)
      await Promise.all([
        this.ingestConversations(`${dataDir}/conversations.json`),
        this.ingestMemories(`${dataDir}/memories.json`),
        this.ingestProjects(`${dataDir}/projects.json`),
        this.ingestUsers(`${dataDir}/users.json`),
      ]);

      this.stats.endTime = new Date();
      this.stats.duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();

      logger.info(`✅ Ingestion completed in ${(this.stats.duration / 1000).toFixed(2)}s`);
      this.logStats();

      return this.stats;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`❌ Ingestion failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Ingere conversations com chunking semântico (pares Q/A)
   */
  private async ingestConversations(filePath: string): Promise<void> {
    logger.info(`📚 Processing conversations from ${filePath}`);

    try {
      const data = await readFile(filePath, "utf-8");
      const conversations: ClaudeConversation[] = JSON.parse(data);

      this.stats.conversations.total = conversations.length;
      const chunks: PersonalityChunk[] = [];

      for (const conv of conversations) {
        try {
          // Chunking semântico: agrupar pares Q/A
          const pairs = this.extractQAPairs(conv);

          for (const pair of pairs) {
            const contentHash = hashText(pair.text);
            if (this.existingHashes.has(contentHash)) {
              continue; // Ignorar chunk duplicado
            }

            chunks.push({
              id: randomUUID(),
              text: pair.text,
              embedding: [], // Será preenchido em lote
              payload: {
                type: "dialogue",
                source_file: "conversations.json",
                source_uuid: conv.uuid,
                created_at: pair.created_at,
                ingestion_version: INGESTION_VERSION,
                ingested_at: new Date().toISOString(),
                style: "claudio",
                emotional_layer: 0.8,
                ressonancia: 1.2,
                content_hash: contentHash,
                metadata: {
                  conversation_name: conv.name,
                  conversation_summary: conv.summary,
                  human_message_uuid: pair.human_uuid,
                  assistant_message_uuid: pair.assistant_uuid,
                },
              },
            });
          }

          this.stats.conversations.chunks += pairs.length;
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.warn(`Failed to process conversation ${conv.uuid}: ${err.message}`);
          this.stats.conversations.errors++;
        }
      }

      // Gerar embeddings e inserir em lotes
      await this.embedAndInsertChunks(chunks);

      logger.info(`✓ Conversations: ${this.stats.conversations.chunks} chunks from ${this.stats.conversations.total} conversations`);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Failed to ingest conversations: ${err.message}`);
      throw err;
    }
  }

  /**
   * Extrai pares Q/A de uma conversa (chunking semântico)
   */
  private extractQAPairs(conv: ClaudeConversation): Array<{
    text: string;
    created_at: string;
    human_uuid: string;
    assistant_uuid: string;
  }> {
    const pairs: Array<{
      text: string;
      created_at: string;
      human_uuid: string;
      assistant_uuid: string;
    }> = [];

    const messages = conv.chat_messages;

    for (let i = 0; i < messages.length - 1; i++) {
      const current = messages[i];
      const next = messages[i + 1];

      // Par Q/A: human seguido de assistant
      if (current.sender === "human" && next.sender === "assistant") {
        const humanText = this.extractMessageText(current);
        const assistantText = this.extractMessageText(next);

        if (humanText && assistantText) {
          pairs.push({
            text: `Q: ${humanText}\n\nA: ${assistantText}`,
            created_at: current.created_at,
            human_uuid: current.uuid,
            assistant_uuid: next.uuid,
          });
        }
      }
    }

    return pairs;
  }

  /**
   * Extrai texto limpo de uma mensagem
   */
  private extractMessageText(msg: ChatMessage): string {
    // Priorizar campo text
    if (msg.text && msg.text.trim().length > 0) {
      return msg.text.trim();
    }

    // Fallback: extrair de content array
    if (msg.content && Array.isArray(msg.content)) {
      const textContents = msg.content
        .filter((c) => c.type === "text" && c.text)
        .map((c) => c.text!)
        .join("\n");

      return textContents.trim();
    }

    return "";
  }

  /**
   * Ingere memories (facts)
   */
  private async ingestMemories(filePath: string): Promise<void> {
    logger.info(`🧠 Processing memories from ${filePath}`);

    try {
      const data = await readFile(filePath, "utf-8");
      const memoriesArray: ClaudeMemory[] = JSON.parse(data);

      this.stats.memories.total = memoriesArray.length;
      const chunks: PersonalityChunk[] = [];

      for (const memoryObj of memoriesArray) {
        try {
          // Conversations memory
          if (memoryObj.conversations_memory) {
            const contentHash = hashText(memoryObj.conversations_memory);
            if (!this.existingHashes.has(contentHash)) {
              chunks.push({
                id: randomUUID(),
                text: memoryObj.conversations_memory,
                embedding: [],
                payload: {
                  type: "fact",
                  source_file: "memories.json",
                  ingestion_version: INGESTION_VERSION,
                  ingested_at: new Date().toISOString(),
                  context: "memory",
                  importance: 1.0,
                  content_hash: contentHash,
                  metadata: {
                    memory_type: "conversations",
                    account_uuid: memoryObj.account_uuid,
                  },
                },
              });
              this.stats.memories.chunks++;
            }
          }

          // Project memories
          if (memoryObj.project_memories) {
            for (const [projectUuid, memoryText] of Object.entries(memoryObj.project_memories)) {
              const contentHash = hashText(memoryText);
              if (!this.existingHashes.has(contentHash)) {
                chunks.push({
                  id: randomUUID(),
                  text: memoryText,
                  embedding: [],
                  payload: {
                    type: "fact",
                    source_file: "memories.json",
                    source_uuid: projectUuid,
                    ingestion_version: INGESTION_VERSION,
                    ingested_at: new Date().toISOString(),
                    context: "memory",
                    importance: 1.0,
                    content_hash: contentHash,
                    metadata: {
                      memory_type: "project",
                      project_uuid: projectUuid,
                      account_uuid: memoryObj.account_uuid,
                    },
                  },
                });
                this.stats.memories.chunks++;
              }
            }
          }
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.warn(`Failed to process memory: ${err.message}`);
          this.stats.memories.errors++;
        }
      }

      await this.embedAndInsertChunks(chunks);

      logger.info(`✓ Memories: ${this.stats.memories.chunks} chunks from ${this.stats.memories.total} memory objects`);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Failed to ingest memories: ${err.message}`);
      throw err;
    }
  }

  /**
   * Ingere projects (technical context)
   */
  private async ingestProjects(filePath: string): Promise<void> {
    logger.info(`📁 Processing projects from ${filePath}`);

    try {
      const data = await readFile(filePath, "utf-8");
      const projects: ClaudeProject[] = JSON.parse(data);

      this.stats.projects.total = projects.length;
      const chunks: PersonalityChunk[] = [];

      for (const proj of projects) {
        try {
          // Project description
          const projectText = `Project: ${proj.name}\n\nDescription: ${proj.description}`;
          const contentHash = hashText(projectText);

          if (!this.existingHashes.has(contentHash)) {
            chunks.push({
              id: randomUUID(),
              text: projectText,
              embedding: [],
              payload: {
                type: "technical_context",
                source_file: "projects.json",
                source_uuid: proj.uuid,
                created_at: proj.created_at,
                ingestion_version: INGESTION_VERSION,
                ingested_at: new Date().toISOString(),
                project: "fazai",
                content_hash: contentHash,
                metadata: {
                  project_name: proj.name,
                  is_private: proj.is_private,
                  creator_name: proj.creator.full_name,
                  creator_uuid: proj.creator.uuid,
                },
              },
            });
            this.stats.projects.chunks++;
          }

          // Project docs (se existir)
          if (proj.docs && proj.docs.length > 0) {
            for (const doc of proj.docs) {
              const docText = `Document: ${doc.filename}\n\n${doc.content}`;
              const docHash = hashText(docText);

              if (!this.existingHashes.has(docHash)) {
                chunks.push({
                  id: randomUUID(),
                  text: docText,
                  embedding: [],
                  payload: {
                    type: "technical_context",
                    source_file: "projects.json",
                    source_uuid: doc.uuid,
                    created_at: doc.created_at,
                    ingestion_version: INGESTION_VERSION,
                    ingested_at: new Date().toISOString(),
                    project: "fazai",
                    content_hash: docHash,
                    metadata: {
                      project_uuid: proj.uuid,
                      project_name: proj.name,
                      document_filename: doc.filename,
                    },
                  },
                });
                this.stats.projects.chunks++;
              }
            }
          }
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.warn(`Failed to process project ${proj.uuid}: ${err.message}`);
          this.stats.projects.errors++;
        }
      }

      await this.embedAndInsertChunks(chunks);

      logger.info(`✓ Projects: ${this.stats.projects.chunks} chunks from ${this.stats.projects.total} projects`);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Failed to ingest projects: ${err.message}`);
      throw err;
    }
  }

  /**
   * Ingere users (social context)
   */
  private async ingestUsers(filePath: string): Promise<void> {
    logger.info(`👤 Processing users from ${filePath}`);

    try {
      const data = await readFile(filePath, "utf-8");
      const users: ClaudeUser[] = JSON.parse(data);

      this.stats.users.total = users.length;
      const chunks: PersonalityChunk[] = [];

      for (const user of users) {
        try {
          const userText = `User: ${user.full_name}\nEmail: ${user.email_address}${
            user.verified_phone_number ? `\nPhone: ${user.verified_phone_number}` : ""
          }`;
          const contentHash = hashText(userText);

          if (!this.existingHashes.has(contentHash)) {
            chunks.push({
              id: randomUUID(),
              text: userText,
              embedding: [],
              payload: {
                type: "social_context",
                source_file: "users.json",
                source_uuid: user.uuid,
                ingestion_version: INGESTION_VERSION,
                ingested_at: new Date().toISOString(),
                relation: true,
                content_hash: contentHash,
                metadata: {
                  full_name: user.full_name,
                  email_address: user.email_address,
                  verified_phone: user.verified_phone_number,
                },
              },
            });
            this.stats.users.chunks++;
          }
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.warn(`Failed to process user ${user.uuid}: ${err.message}`);
          this.stats.users.errors++;
        }
      }

      await this.embedAndInsertChunks(chunks);

      logger.info(`✓ Users: ${this.stats.users.chunks} chunks from ${this.stats.users.total} users`);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Failed to ingest users: ${err.message}`);
      throw err;
    }
  }

  /**
   * Gera embeddings e insere chunks no Qdrant em lotes
   */
  private async embedAndInsertChunks(chunks: PersonalityChunk[]): Promise<void> {
    if (chunks.length === 0) {
      return;
    }

    logger.debug(`Generating embeddings for ${chunks.length} chunks...`);

    const embedder = await createEmbeddingService();
    const texts = chunks.map((c) => c.text);

    // Gerar embeddings em batch
    const embeddings = await embedder.generateBatch(texts);
    this.stats.totalEmbeddings += embeddings.length;

    // Atribuir embeddings aos chunks
    for (let i = 0; i < chunks.length; i++) {
      chunks[i].embedding = embeddings[i];
    }

    // Inserir no Qdrant em lotes
    const client = await getQdrantClient();

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);

      await client.upsert(COLLECTION_NAME, {
        wait: true,
        points: batch.map((chunk) => ({
          id: chunk.id,
          vector: chunk.embedding,
          payload: chunk.payload,
        })),
      });

      this.stats.totalChunks += batch.length;

      // Log progress para grandes volumes
      if (chunks.length > 100 && (i + BATCH_SIZE) % 100 === 0) {
        logger.debug(`  Inserted ${i + BATCH_SIZE}/${chunks.length} chunks`);
      }
    }
  }

  /**
   * Loga estatísticas finais
   */
  private logStats(): void {
    logger.info("📊 Ingestion Statistics:");
    logger.info(`  Conversations: ${this.stats.conversations.chunks} chunks (${this.stats.conversations.errors} errors)`);
    logger.info(`  Memories: ${this.stats.memories.chunks} chunks (${this.stats.memories.errors} errors)`);
    logger.info(`  Projects: ${this.stats.projects.chunks} chunks (${this.stats.projects.errors} errors)`);
    logger.info(`  Users: ${this.stats.users.chunks} chunks (${this.stats.users.errors} errors)`);
    logger.info(`  Total: ${this.stats.totalChunks} chunks, ${this.stats.totalEmbeddings} embeddings`);

    if (this.stats.duration) {
      const throughput = (this.stats.totalChunks / (this.stats.duration / 1000)).toFixed(2);
      logger.info(`  Throughput: ${throughput} chunks/sec`);
    }
  }

  /**
   * Retorna estatísticas de ingestão
   */
  getStats(): IngestionStats {
    return { ...this.stats };
  }
}

/**
 * Helper function para ingestão rápida
 */
export async function ingestPersonalityData(dataDir: string): Promise<IngestionStats> {
  const ingestor = new PersonalityIngestor();
  return await ingestor.ingestAll(dataDir);
}
