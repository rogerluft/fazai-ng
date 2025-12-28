# SOURCE_INDEX_FLOW.md

**Fluxo de Indexação de Código Fonte (fazai_source)**

> Metacognition Engine - Sistema de auto-análise e evolução do FazAI

---

## Visão Geral

O sistema de indexação de código fonte permite que o FazAI "entenda" seu próprio código. Isso habilita capacidades de auto-análise, manutenção e evolução assistida por IA.

A collection `fazai_source` no Qdrant armazena vetores semânticos de cada trecho do código-fonte, permitindo buscas por similaridade e contexto.

---

## Arquivos Envolvidos

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/commands/index-command.ts` | Entry point CLI (`fazai index`) |
| `src/services/source-indexer.ts` | Core: scan, hash, chunk, indexação |
| `src/services/embeddings.ts` | Geração de embeddings (Ollama/OpenAI) |
| `src/services/embedding-strategies.ts` | Chunking semântico inteligente |
| `src/database/qdrant-pool.ts` | Conexão Qdrant com Circuit Breaker |
| `src/vector-store.ts` | Schema da collection `fazai_source` |
| `/opt/fazai/data/source-index.json` | Estado persistido (hash por arquivo) |

---

## Fluxo Detalhado

### 1. Iniciação do Comando

```bash
fazai index [--force] [--verbose]
```

O usuário executa o comando. O arquivo `index-command.ts` processa os argumentos:
- `--force`: Força re-indexação de todos os arquivos
- `--verbose`: Habilita logs detalhados

A função `handleIndexCommand()` chama `runSourceIndexer()`.

---

### 2. Carregamento do Estado

O indexer tenta carregar o estado anterior de `/opt/fazai/data/source-index.json`:

```json
{
  "files": {
    "src/app.ts": {
      "hash": "a1b2c3d4...",
      "mtime": 1703123456789,
      "indexedAt": 1703123456789,
      "version": "3.13.0"
    }
  },
  "lastRun": "2025-12-27T10:00:00.000Z",
  "fazaiVersion": "3.13.0"
}
```

Se não existir, inicia com estado vazio.

---

### 3. Inicialização de Serviços

Dois serviços são inicializados:

**Embedding Service** (`createEmbeddingService()`):
- Tenta Ollama primeiro (`nomic-embed-text`, 768 dim, 8192 tokens de contexto)
- Fallback para `mxbai-embed-large` (1024 dim, 512 tokens de contexto)
- Fallback final para OpenAI (`text-embedding-3-small`, 1536 dim)
- Aplica zero-padding para padronizar em 1536 dimensões

**Qdrant Client** (`getQdrantClient()`):
- Singleton com Circuit Breaker (evita loops infinitos)
- Conecta em `localhost:6333` ou conforme configuração

---

### 4. Scan do Diretório

A função `walkDirectory()` percorre recursivamente a partir do diretório atual:

```
/home/rluft/fazai-ng/
├── src/           → Indexado
├── scripts/       → Indexado
├── docs/          → Indexado
├── web/           → Indexado
├── node_modules/  → IGNORADO
├── .git/          → IGNORADO
├── dist/          → IGNORADO
└── .claude/       → IGNORADO
```

**Regras de Exclusão** (`shouldIgnore()`):
- Diretórios: `node_modules`, `.git`, `.claude`, `dist`, `.next`, `coverage`
- Extensões: `.log`, `.bak`, `.swp`, `.map`

---

### 5. Detecção de Mudanças

Para cada arquivo encontrado:

1. **Calcula hash MD5** do conteúdo
2. **Compara** com estado anterior
3. **Marca para indexação** se:
   - Arquivo é novo (não existe no estado)
   - Hash mudou (conteúdo modificado)
   - Versão do FazAI mudou
   - Flag `--force` ativado

---

### 6. Detecção de Deleções

Compara arquivos no estado vs. arquivos no disco:
- Arquivos no estado mas não no disco → marcados para deleção
- Remove do estado em memória

---

### 7. Processamento de Deleções

Para cada arquivo deletado:

```typescript
await qdrant.delete("fazai_source", {
  filter: {
    must: [{ key: "path", match: { value: relativePath } }]
  }
});
```

Remove todos os chunks associados ao arquivo do Qdrant.

---

### 8. Análise de Metadados

A função `analyzeCode()` extrai:

| Metadado | Regex | Exemplo |
|----------|-------|---------|
| `functions` | `/function\s+(\w+)/g` | `["runSourceIndexer", "walkDirectory"]` |
| `classes` | `/class\s+(\w+)/g` | `["CircuitBreaker"]` |
| `imports` | `/import.*from\s+['"]([^'"]+)['"]/g` | `["../logger", "fs/promises"]` |

**Categorização por Path** (`PATH_CONFIG`):

| Path | Categoria | Peso |
|------|-----------|------|
| `src/app.ts` | core | 1.0 |
| `src/config.ts` | core | 1.0 |
| `src/services/` | service | 0.8 |
| `src/commands/` | command | 0.7 |
| `src/ui/` | ui | 0.6 |
| `docs/` | documentation | 0.9 |

---

### 9. Chunking Semântico

A função `chunkFile()` usa estratégias diferentes:

**Código** (`CODE_CHUNKING`):
```typescript
{
  maxChunkSize: 1500,
  overlap: 150,
  separators: ["\n\n\n", "\n\n", "\nfunction ", "\nclass ", "\nexport ", "\nimport ", "\n"],
  minChunkSize: 200
}
```

**Documentação** (`DOC_CHUNKING`):
```typescript
{
  maxChunkSize: 800,
  overlap: 100,
  separators: ["\n## ", "\n### ", "\n\n", "\n", ". "],
  minChunkSize: 150
}
```

O chunking respeita boundaries naturais (funções, classes, parágrafos) e mantém overlap para contexto.

---

### 10. Geração de Embeddings

Para cada chunk:

1. **Ollama API** (`/api/embeddings`):
   - Modelo preferido: `nomic-embed-text` (8192 tokens de contexto)
   - Dimensão nativa: 768
   - Aplica truncamento (max 24000 chars para nomic)
   - Fallback: `mxbai-embed-large` (512 tokens de contexto, 1024 dim)

2. **Zero Padding**:
   - Vetor 768 ou 1024 dim → padded para 1536 dim
   - Padrão ECOA (compatibilidade OpenAI)

3. **Fallback OpenAI** (se Ollama indisponível):
   - Modelo: `text-embedding-3-small`
   - Dimensão: 1536 (nativo)

---

### 11. Geração de Semantic ID

Cada chunk recebe um ID único e determinístico:

```typescript
const semanticId = crypto
  .createHash("sha256")
  .update(`${relativePath}:${chunkIndex}:${version}`)
  .digest("hex");
```

Isso permite:
- Upsert (atualiza se existir, insere se não)
- Rastreabilidade por arquivo/versão
- Idempotência na re-indexação

---

### 12. Upsert no Qdrant

Cada chunk é inserido/atualizado:

```typescript
await qdrant.upsert("fazai_source", {
  points: [{
    id: semanticId,
    vector: embedding,  // 1536 dimensões
    payload: {
      semantic_id: semanticId,
      path: "src/services/source-indexer.ts",
      filename: "source-indexer.ts",
      fazai_version: "3.13.0",
      content: "...(chunk content)...",
      is_jsdoc: false,
      chunk_index: 0,
      category: "service",
      importance_weight: 0.8,
      legitimate_contexts: ["maintenance", "self-reflection", "coding"],
      functions: ["runSourceIndexer", "walkDirectory"],
      classes: [],
      imports: ["fs/promises", "path", "crypto"],
      hash: "a1b2c3d4...",
      indexed_at: 1703123456789
    }
  }]
});
```

---

### 13. Persistência do Estado

Ao final, salva o novo estado:

```typescript
await fs.writeFile(
  STATE_FILE_PATH,
  JSON.stringify(state, null, 2)
);
```

Isso permite indexação incremental na próxima execução.

---

## Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER CLI                                    │
│                     $ fazai index --force                            │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   index-command.ts                                   │
│                   handleIndexCommand()                               │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   source-indexer.ts                                  │
│                   runSourceIndexer()                                 │
│                                                                      │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────────┐        │
│  │ walkDirectory│  │ shouldIgnore  │  │ analyzeCode        │        │
│  │ (recursive)  │  │ (filters)     │  │ (metadata extract) │        │
│  └──────────────┘  └───────────────┘  └────────────────────┘        │
│                                                                      │
│  ┌──────────────┐  ┌───────────────┐                                │
│  │ chunkFile    │  │ semanticChunk │  ← embedding-strategies.ts     │
│  │ (CODE/DOC)   │  │ (recursive)   │                                │
│  └──────────────┘  └───────────────┘                                │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│     embeddings.ts       │   │    qdrant-pool.ts       │
│                         │   │                         │
│ createEmbeddingService()│   │ getQdrantClient()       │
│                         │   │                         │
│ ┌─────────────────────┐ │   │ ┌─────────────────────┐ │
│ │ OllamaEmbedding     │ │   │ │ CircuitBreaker      │ │
│ │ Service             │ │   │ │ (fail fast)         │ │
│ └─────────────────────┘ │   │ └─────────────────────┘ │
│                         │   │                         │
│ ┌─────────────────────┐ │   │ ┌─────────────────────┐ │
│ │ OpenAIEmbedding     │ │   │ │ Health Check        │ │
│ │ Service (fallback)  │ │   │ │ (5 min interval)    │ │
│ └─────────────────────┘ │   │ └─────────────────────┘ │
└───────────┬─────────────┘   └───────────┬─────────────┘
            │                             │
            ▼                             ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│      OLLAMA SERVER      │   │      QDRANT SERVER      │
│   192.168.0.101:11434   │   │     localhost:6333      │
│                         │   │                         │
│  nomic-embed-text       │   │  Collection:            │
│  (768 dim → 1536 pad)   │   │  fazai_source           │
│  (8192 token context)   │   │  (1536 dim, Cosine)     │
└─────────────────────────┘   └─────────────────────────┘
```

---

## Schema da Collection (fazai_source)

```yaml
name: fazai_source
description: "ECOA Metacognition: Índice do próprio código-fonte"
dimension: 1536
distance: Cosine

payload_schema:
  semantic_id:        # ID único do chunk (SHA256)
    type: string
    maxLength: 96

  path:               # Caminho relativo do arquivo
    type: string
    maxLength: 256

  filename:           # Nome do arquivo
    type: string
    maxLength: 128

  fazai_version:      # Versão do FazAI na indexação
    type: string
    maxLength: 32

  content:            # Conteúdo do chunk
    type: text

  is_jsdoc:           # Se é documentação JSDoc
    type: bool

  chunk_index:        # Índice sequencial do chunk
    type: int

  category:           # Categoria (core, service, ui...)
    type: string
    maxLength: 64

  importance_weight:  # Prioridade de busca (0.0-1.0)
    type: float

  legitimate_contexts:  # Contextos de uso permitidos
    type: string[]

  functions:          # Funções detectadas no chunk
    type: string[]
    optional: true

  classes:            # Classes detectadas no chunk
    type: string[]
    optional: true

  imports:            # Imports detectados no chunk
    type: string[]
    optional: true

  hash:               # Hash MD5 do arquivo original
    type: string
    maxLength: 64

  indexed_at:         # Timestamp da indexação
    type: int
```

---

## Uso do Sistema

### Comandos CLI

```bash
# Indexação incremental (apenas modificados)
fazai index

# Força re-indexação completa
fazai index --force

# Com logs detalhados
fazai index --verbose

# Ajuda
fazai index --help
```

### Consulta Programática

```typescript
import { getQdrantClient } from "./database/qdrant-pool";

const qdrant = await getQdrantClient();
const results = await qdrant.search("fazai_source", {
  vector: queryEmbedding,
  limit: 10,
  filter: {
    must: [
      { key: "category", match: { value: "core" } }
    ]
  }
});
```

---

## Considerações de Performance

| Aspecto | Valor | Descrição |
|---------|-------|-----------|
| Chunk size (code) | 1500 chars | Balanceado para coesão semântica |
| Chunk size (docs) | 800 chars | Menor para documentação |
| Overlap | 150/100 chars | Preserva contexto entre chunks |
| Embedding timeout | 30s | Via Ollama API |
| Circuit Breaker | 3 falhas | Abre circuito após 3 erros |
| Reset timeout | 30s | Tempo até retry após circuito aberto |

---

## Troubleshooting

### Qdrant Indisponível
```
Error: Qdrant circuit breaker is OPEN
```
**Solução**: Verifique se o Qdrant está rodando (`docker ps`) e reinicie.

### Ollama Sem Modelo
```
Ollama available but no embedding models found
```
**Solução**: `ollama pull nomic-embed-text` (preferido, 8192 tokens de contexto)
Alternativa: `ollama pull mxbai-embed-large` (512 tokens de contexto)

### Re-indexação Não Detecta Mudanças
**Solução**: Use `fazai index --force` ou delete `/opt/fazai/data/source-index.json`

---

*Documentação gerada em 2025-12-28*
*FazAI v3.13.0 - Metacognition Engine*
