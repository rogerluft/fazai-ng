# Personality Ingestion - Setup Guide

Guia rápido de setup para começar a usar o sistema de ingestão de personalidade.

## Quick Start

### 1. Verificar Pré-requisitos

```bash
# Qdrant rodando
curl http://localhost:6333/collections

# Modelo de embedding disponível
ollama list | grep embed
# OU
echo $OPENAI_API_KEY
```

### 2. Criar Collection

```bash
# Via CLI do FazAI (recomendado)
fazai qdrant create-collection fazai_personality --dimension 1536

# Ou via script TypeScript
tsx -e "
import { getQdrantClient } from './src/database/qdrant-pool';

const client = await getQdrantClient();
await client.createCollection('fazai_personality', {
  vectors: { size: 1536, distance: 'Cosine' }
});

console.log('✅ Collection created!');
"
```

### 3. Preparar Dados

Organizar dados exportados do Claude em um diretório:

```bash
DATA_DIR="/dados/Claudio-kp-2025-12-22-11-57-29-batch-0000"

ls -lh $DATA_DIR/
# Deve ter:
# conversations.json
# memories.json
# projects.json
# users.json
```

### 4. Executar Ingestão

```bash
# Via script CLI
tsx src/scripts/ingest-personality.ts $DATA_DIR

# Ou via código
tsx -e "
import { ingestPersonalityData } from './src/services/personality-ingestor';

const stats = await ingestPersonalityData('$DATA_DIR');
console.log(\`✅ Ingested \${stats.totalChunks} chunks\`);
"
```

### 5. Verificar Resultado

```bash
# Info da collection
fazai qdrant info fazai_personality

# Busca de teste
fazai qdrant search fazai_personality "What is FazAI?" --limit 5

# Contar por tipo
tsx -e "
import { getQdrantClient } from './src/database/qdrant-pool';

const client = await getQdrantClient();
const types = ['dialogue', 'fact', 'technical_context', 'social_context'];

for (const type of types) {
  const result = await client.count('fazai_personality', {
    filter: { must: [{ key: 'type', match: { value: type } }] }
  });
  console.log(\`\${type}: \${result.count}\`);
}
"
```

## Integração com Código Existente

### Carregar Personalidade em Prompts

```typescript
// Em app.ts ou onde gera system prompts
import { loadPersonalityFromQdrant } from "./services/personality-loader";
import { buildPersonalitySystemPrompt } from "./services/personality-loader";

async function getSystemPrompt(): Promise<string> {
  const personality = await loadPersonalityFromQdrant();

  // Opção 1: Usar builder padrão
  const prompt = buildPersonalitySystemPrompt(personality);

  // Opção 2: Custom
  const customPrompt = `
You are FazAI, an AI assistant with deep knowledge from ${personality.loadedFrom}.

Key traits:
${personality.expertise.map((t) => `- ${t.name}`).join("\n")}

Communication style: ${personality.communication[0]?.description || "Direct"}
  `.trim();

  return prompt; // ou customPrompt
}
```

### Busca Semântica de Contexto

```typescript
import { getQdrantClient } from "./database/qdrant-pool";
import { createEmbeddingService } from "./services/embeddings";

async function findRelevantContext(query: string): Promise<string[]> {
  const embedder = await createEmbeddingService();
  const client = await getQdrantClient();

  // Gerar embedding da query
  const queryEmbedding = await embedder.generate(query);

  // Buscar chunks relevantes
  const results = await client.search("fazai_personality", {
    vector: queryEmbedding,
    limit: 5,
    score_threshold: 0.7,
    filter: {
      must: [
        // Filtrar apenas dialogues (conversas passadas)
        { key: "type", match: { value: "dialogue" } },
      ],
    },
  });

  // Extrair textos dos payloads
  const contexts = results.map((r) => {
    const payload = r.payload as { text?: string };
    return payload.text || "";
  });

  return contexts;
}

// Uso em chat
const userQuery = "How do I configure Qdrant?";
const relevantContexts = await findRelevantContext(userQuery);

const systemPrompt = `
You are FazAI. Use the following context from past conversations:

${relevantContexts.join("\n\n---\n\n")}

Now answer the user's question.
`;
```

### Cache de Embeddings

```typescript
import { CachedEmbeddingService } from "./services/cached-embedding-service";

// Usar cache para evitar gerar embeddings duplicados
const embedder = new CachedEmbeddingService();

const embedding1 = await embedder.generate("What is FazAI?");
const embedding2 = await embedder.generate("What is FazAI?"); // Cache hit!

console.log("Cache stats:", embedder.getStats());
```

## Automação

### Cron Job para Re-ingestão

```bash
# /etc/cron.d/fazai-personality-sync

# Rodar toda segunda-feira às 3h
0 3 * * 1 root tsx /opt/fazai/src/scripts/ingest-personality.ts /dados/latest-export 2>&1 | logger -t fazai-personality
```

### Systemd Timer

```ini
# /etc/systemd/system/fazai-personality-sync.service
[Unit]
Description=FazAI Personality Data Ingestion
After=qdrant.service

[Service]
Type=oneshot
User=root
WorkingDirectory=/opt/fazai
ExecStart=/usr/bin/tsx src/scripts/ingest-personality.ts /dados/latest-export
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/fazai-personality-sync.timer
[Unit]
Description=FazAI Personality Sync Timer

[Timer]
OnCalendar=Mon *-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
systemctl daemon-reload
systemctl enable fazai-personality-sync.timer
systemctl start fazai-personality-sync.timer
systemctl list-timers | grep fazai
```

## Troubleshooting

### Collection já existe com dimensão diferente

```bash
# Deletar e recriar
fazai qdrant delete-collection fazai_personality
fazai qdrant create-collection fazai_personality --dimension 1536
```

### Embeddings muito lentos (Ollama)

```bash
# 1. Verificar se está usando GPU
ollama ps

# 2. Reduzir batch size no código
# src/services/personality-ingestor.ts
const BATCH_SIZE = 20; // ao invés de 50

# 3. Ou usar OpenAI
export OPENAI_API_KEY="sk-..."
```

### Erro "Cannot find module fs/promises"

```bash
# Versão do Node muito antiga
node --version  # deve ser >= 18.17.0

# Atualizar Node
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Qdrant connection timeout

```bash
# Verificar se está rodando
docker ps | grep qdrant

# Verificar porta
netstat -tulpn | grep 6333

# Testar conexão
curl http://localhost:6333/collections
```

## Performance Tuning

### Batch Size

```typescript
// src/services/personality-ingestor.ts
const BATCH_SIZE = 50; // Padrão

// GPU potente: 100+
// CPU fraco: 10-20
```

### Parallel Processing

```typescript
// Processar tipos em paralelo (já implementado)
await Promise.all([
  this.ingestConversations(`${dataDir}/conversations.json`),
  this.ingestMemories(`${dataDir}/memories.json`),
  this.ingestProjects(`${dataDir}/projects.json`),
  this.ingestUsers(`${dataDir}/users.json`),
]);
```

### Incremental Updates

```typescript
// Filtrar por ingestion_version para re-ingestão parcial
const existingVersions = await client.scroll("fazai_personality", {
  filter: {
    must: [{ key: "ingestion_version", match: { value: "v1-resurrected" } }],
  },
  limit: 1,
});

if (existingVersions.points.length > 0) {
  console.log("Version already exists, skipping...");
} else {
  await ingestor.ingestAll(dataDir);
}
```

## Monitoring

### Collection Stats

```bash
# Via CLI
watch -n 5 'fazai qdrant info fazai_personality'

# Via código
tsx -e "
import { getQdrantClient } from './src/database/qdrant-pool';

setInterval(async () => {
  const client = await getQdrantClient();
  const info = await client.getCollection('fazai_personality');

  console.clear();
  console.log('fazai_personality stats:');
  console.log(\`  Points: \${info.points_count}\`);
  console.log(\`  Vectors: \${info.vectors_count}\`);
  console.log(\`  Indexed: \${info.indexed_vectors_count}\`);
}, 5000);
"
```

### Logs

```bash
# Journalctl (systemd)
journalctl -u fazai-personality-sync -f

# Arquivo de log
tail -f /var/log/fazai/personality-ingestion.log
```

## Backup & Restore

### Backup Collection

```bash
# Via Qdrant snapshot
curl -X POST http://localhost:6333/collections/fazai_personality/snapshots

# Baixar snapshot
wget http://localhost:6333/collections/fazai_personality/snapshots/snapshot-2025-12-27.snapshot

# Ou exportar via script
tsx -e "
import { getQdrantClient } from './src/database/qdrant-pool';
import { writeFile } from 'fs/promises';

const client = await getQdrantClient();
let offset = undefined;
const allPoints = [];

do {
  const result = await client.scroll('fazai_personality', {
    limit: 100,
    offset,
    with_payload: true,
    with_vector: true
  });

  allPoints.push(...result.points);
  offset = result.next_page_offset;
} while (offset);

await writeFile('personality-backup.json', JSON.stringify(allPoints, null, 2));
console.log(\`Backed up \${allPoints.length} points\`);
"
```

### Restore Collection

```bash
# Via snapshot
curl -X PUT "http://localhost:6333/collections/fazai_personality/snapshots/upload" \
  --form 'snapshot=@snapshot-2025-12-27.snapshot'

# Ou re-ingerir do JSON original
tsx src/scripts/ingest-personality.ts /dados/Claudio-kp-2025-12-22-11-57-29-batch-0000
```

## Next Steps

1. **Integrar com chat**: Usar `findRelevantContext()` no loop de conversa
2. **RAG completo**: Combinar personality + source code (fazai_source collection)
3. **Feedback loop**: Armazenar novas conversas do FazAI de volta ao Qdrant
4. **Multi-version**: Manter múltiplas versões de ingestão para comparação

---

**Autor**: Claude Code
**Versão**: 1.0.0
**Data**: 2025-12-27
