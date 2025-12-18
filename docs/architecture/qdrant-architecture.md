# FazAI - Arquitetura Qdrant e Fluxo RAG

**Versão:** 3.6.22-beta
**Atualizado:** 2025-12-18
**Autor:** ClaudiÃO (Claude Opus 4.5) + Agentes Especializados

---

## 1. Visão Geral

O FazAI implementa um sistema **RAG (Retrieval-Augmented Generation)** completo usando Qdrant como backbone de persistência vetorial.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FAZAI RAG ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐     │
│  │   CLI    │    │   MCP    │    │  Web UI  │    │  Daemon  │     │
│  │ (app.ts) │    │ (server) │    │ (Next.js)│    │ (worker) │     │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘     │
│       │               │               │               │            │
│       └───────────────┴───────────────┴───────────────┘            │
│                               │                                     │
│                               ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    RAG PIPELINE                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │ Neural Flow │  │ Auto-Learn  │  │   Semantic Cache    │  │   │
│  │  │ (multi-col) │  │ (capture)   │  │   (0.95 threshold)  │  │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │   │
│  └─────────┼────────────────┼────────────────────┼──────────────┘   │
│            │                │                    │                  │
│            └────────────────┴────────────────────┘                  │
│                               │                                     │
│                               ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   EMBEDDING SERVICE                          │   │
│  │  ┌─────────────────┐         ┌─────────────────────────┐    │   │
│  │  │ Ollama (local)  │ ──────► │ OpenAI (fallback cloud) │    │   │
│  │  │ mxbai: 1024 dim │         │ ada-3-small: 1536 dim   │    │   │
│  │  └─────────────────┘         └─────────────────────────┘    │   │
│  └──────────────────────────────────┬──────────────────────────┘   │
│                                     │                               │
│                                     ▼                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   QDRANT CONNECTION POOL                     │   │
│  │  • Singleton Pattern      • Health Check: 5min              │   │
│  │  • Auto-reconnect         • Metrics tracking                │   │
│  │  • Timeout: 30s           • Error recovery                  │   │
│  └──────────────────────────────────┬──────────────────────────┘   │
│                                     │                               │
│                                     ▼                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   QDRANT SERVER                              │   │
│  │                   http://localhost:6333                      │   │
│  │                                                              │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │   │
│  │  │  personality │ │    memory    │ │   learning   │        │   │
│  │  │     15%      │ │     20%      │ │     30%      │        │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘        │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │   │
│  │  │      kb      │ │  inference   │ │ semantic_    │        │   │
│  │  │     25%      │ │     10%      │ │ cache        │        │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Collections do Qdrant

### 2.1 Tabela de Collections

| Collection | Peso RAG | Propósito | Campos Principais |
|------------|----------|-----------|-------------------|
| `fazai_personality` | 15% | Traços de personalidade, expertise, estilo | `trait_id`, `category`, `strength`, `examples` |
| `fazai_memory` | 20% | Histórico de conversas, contexto | `conversation_id`, `role`, `content`, `importance` |
| `fazai_learning` | **30%** | Padrões aprendidos, soluções validadas | `pattern_id`, `problem`, `solution`, `confidence` |
| `fazai_kb` | 25% | Knowledge base Linux/redes | `slug`, `title`, `commands`, `category` |
| `fazai_inference` | 10% | Regras operacionais, políticas | `rule_id`, `type`, `condition`, `action` |
| `fazai_semantic_cache` | - | Cache de respostas por similaridade | `query`, `response`, `model`, `timestamp` |

### 2.2 Detalhamento das Collections

#### fazai_personality (15%)
```typescript
// Como a IA deve se comportar
{
  trait_id: string,          // "expert_linux"
  category: "expertise" | "communication" | "behavior" | "preferences" | "constraints",
  name: string,              // "Linux Expert"
  description: string,       // "Deep knowledge of Linux..."
  strength: number,          // 0.0 - 1.0
  active: boolean,
  examples: string[],        // Exemplos de aplicação
  created_at: string         // ISO 8601
}
```

#### fazai_memory (20%)
```typescript
// Histórico de interações
{
  conversation_id: string,   // UUID da sessão
  message_id: string,        // UUID da mensagem
  role: "user" | "assistant" | "system" | "autonomous",
  timestamp: string,         // ISO 8601
  content: string,           // Conteúdo da mensagem
  summary: string,           // Resumo para contexto
  emotional_context: string, // Estado emocional detectado
  importance: number,        // 0.0 - 1.0
  tags: string[]
}
```

#### fazai_learning (30%) - **MAIS IMPORTANTE**
```typescript
// Padrões aprendidos com experiência
{
  pattern_id: string,        // UUID
  title: string,             // "Fix nginx 502 error"
  problem: string,           // Descrição do problema
  solution: string,          // Descrição da solução
  error_pattern: string,     // Regex ou padrão de erro
  solution_commands: string[], // Comandos que resolvem
  confidence: number,        // 0.0 - 1.0 (aumenta com uso)
  success_count: number,     // Quantas vezes funcionou
  learned_at: string,        // Quando aprendeu
  last_used_at: string,      // Último uso
  validated: boolean,        // Validado por humano
  tags: string[]
}
```

#### fazai_kb (25%)
```typescript
// Base de conhecimento técnico
{
  slug: string,              // "nginx-proxy-setup"
  title: string,             // "Como configurar Nginx como proxy"
  summary: string,           // Resumo
  category: string,          // "webserver"
  scope: string,             // "production" | "development"
  linux_distribution: string, // "ubuntu" | "fedora" | "any"
  component: string,         // "nginx" | "docker" | "systemd"
  commands: string[],        // Comandos relacionados
  source: string,            // URL de referência
  confidence: number,        // 0.0 - 1.0
  validated: boolean,
  tags: string[]
}
```

#### fazai_inference (10%)
```typescript
// Regras operacionais e políticas
{
  rule_id: string,           // UUID
  type: "security" | "operational" | "safety" | "optimization" | "compliance",
  name: string,              // "Prevent rm -rf /"
  description: string,       // Descrição da regra
  condition: string,         // Quando aplicar
  action: string,            // O que fazer
  priority: number,          // 1-100
  enforced: boolean,         // Forçar aplicação
  severity: "low" | "medium" | "high" | "critical",
  examples: string[],
  created_at: string
}
```

#### fazai_semantic_cache
```typescript
// Cache de respostas por similaridade semântica
{
  query: string,             // Query original
  response: string,          // Resposta cacheada
  model: string,             // "qwen2.5:7b"
  provider: string,          // "ollama"
  timestamp: number,         // Unix timestamp
  hits: number,              // Contador de uso
  lastHit: number,           // Último acesso
  ttl: number                // Time-to-live em ms
}
```

---

## 3. Fluxo Completo de uma Requisição

### 3.1 Diagrama de Sequência

```
USUÁRIO                          FAZAI                           QDRANT
   │                               │                               │
   │  "instalar nginx"             │                               │
   ├──────────────────────────────►│                               │
   │                               │                               │
   │                               │  1. Carrega /etc/fazai/fazai.conf
   │                               │◄──────────────────────────────┤
   │                               │                               │
   │                               │  2. Coleta systemInfo         │
   │                               │  (distro, kernel, services)   │
   │                               │                               │
   │                               │  3. Gera embedding            │
   │                               │  [Ollama: mxbai-embed-large]  │
   │                               │                               │
   │                               │  4. consultNeuralFlow()       │
   │                               ├──────────────────────────────►│
   │                               │  Busca paralela em:           │
   │                               │  - fazai_learning (30%)       │
   │                               │  - fazai_kb (25%)             │
   │                               │◄──────────────────────────────┤
   │                               │                               │
   │                               │  5. Score >= 0.5?             │
   │                               │  ┌──────────────────────────┐ │
   │                               │  │ SIM: Usa comandos do RAG │ │
   │                               │  │ NÃO: Continua para IA    │ │
   │                               │  └──────────────────────────┘ │
   │                               │                               │
   │                               │  6. enrichContextWithRAG()    │
   │                               ├──────────────────────────────►│
   │                               │  Adiciona contexto técnico    │
   │                               │◄──────────────────────────────┤
   │                               │                               │
   │                               │  7. SemanticCache.lookup()    │
   │                               ├──────────────────────────────►│
   │                               │  Busca em fazai_semantic_cache│
   │                               │  threshold: 0.95              │
   │                               │◄──────────────────────────────┤
   │                               │                               │
   │                               │  8. Cache MISS → Provider     │
   │                               │  Fallback: ollama → openrouter│
   │                               │  → anthropic → openai         │
   │                               │                               │
   │                               │  9. Parse JSON de comandos    │
   │                               │                               │
   │  ┌────────────────────────────┤                               │
   │  │ 10. Confirmação do usuário │                               │
   │  └────────────────────────────┤                               │
   │                               │                               │
   │                               │  11. Executa comandos         │
   │                               │  child_process.exec()         │
   │                               │                               │
   │                               │  12. Se SUCCESS:              │
   │                               │  captureLearning()            │
   │                               ├──────────────────────────────►│
   │                               │  Armazena em fazai_learning   │
   │                               │◄──────────────────────────────┤
   │                               │                               │
   │  ✅ Comandos executados       │                               │
   │◄──────────────────────────────┤                               │
   │                               │                               │
```

### 3.2 Fluxo em Linguagem Natural

#### Passo 1: Entrada do Usuário
```
O usuário digita: fazai "instalar nginx" qwen2.5:7b
                  ──────────────────── ──────────
                  tarefa               modelo (opcional)
```

#### Passo 2: Carregamento de Configuração
```
Arquivo: /etc/fazai/fazai.conf
Carrega:
  - QDRANT_URL=http://localhost:6333
  - OLLAMA_BASE_URL=http://192.168.0.101:11434
  - MODELS_OLLAMA=qwen2.5:7b,tinyllama:1b
  - API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc)
```

#### Passo 3: Coleta de Informações do Sistema
```typescript
// src/system-info.ts
systemInfo = {
  distro: "Fedora 42",
  kernel: "6.17.8-200.fc42.x86_64",
  hostname: "fazai",
  services: ["nginx.service", "docker.service", ...],
  disk: "50G used / 200G total",
  memory: "8G / 32G"
}
```

#### Passo 4: Geração de Embedding
```
Query: "instalar nginx" + systemInfo (truncado 500 chars)
        ↓
Ollama API: POST http://192.168.0.101:11434/api/embeddings
        ↓
Vetor: [0.123, -0.456, 0.789, ...] (1024 dimensões)
```

#### Passo 5: Neural Flow - Busca no Qdrant
```typescript
// Busca PARALELA em múltiplas collections
neuralQuery(query, embedding, {
  collections: ["fazai_learning", "fazai_kb"],
  weights: { learning: 0.4, kb: 0.6 },
  topK: 5,
  minScore: 0.5
})

// Resultado com Fusion Scoring:
[
  { collection: "fazai_learning", score: 0.78, content: "apt install nginx..." },
  { collection: "fazai_kb", score: 0.65, content: "Nginx é um servidor web..." }
]
```

#### Passo 6: Decisão RAG vs IA
```
SE score >= 0.5:
  → Usa comandos do RAG diretamente
  → Não chama provider de IA
  → Economia de tokens!

SE score < 0.5:
  → Enriquece contexto com RAG
  → Chama provider de IA
```

#### Passo 7: Semantic Cache
```typescript
// Antes de chamar o provider
cachedResponse = await semanticCache.lookup(prompt, "qwen2.5:7b", "ollama");

if (cachedResponse && score >= 0.95) {
  return cachedResponse;  // Cache HIT - não chama IA
}
// Cache MISS - continua para provider
```

#### Passo 8: Chamada ao Provider
```typescript
// Fallback chain automático
providers = ["ollama", "openrouter", "anthropic", "openai", "google"];

for (provider of providers) {
  try {
    response = await callProvider(provider, prompt);
    break;  // Sucesso - sai do loop
  } catch (error) {
    continue;  // Falha - tenta próximo
  }
}
```

#### Passo 9: Parsing de Comandos
```json
// Resposta da IA (JSON estruturado)
{
  "type": "command",
  "command": {
    "command": "sudo apt install nginx -y",
    "explain": "Instala o servidor web Nginx",
    "riskLevel": "low",
    "requiresConfirmation": false
  }
}
```

#### Passo 10: Execução
```bash
# Se --yolo: executa sem perguntar
# Se --dry-run: simula sem executar
# Caso contrário: pede confirmação

$ sudo apt install nginx -y
✅ Comando executado com sucesso
```

#### Passo 11: Captura de Learning
```typescript
// Se comando executou com sucesso
captureLearning({
  type: "acerto",
  title: "Instalação de Nginx",
  problem: "instalar nginx",
  solution: "sudo apt install nginx -y",
  commands: ["sudo apt install nginx -y"],
  category: "webserver",
  confidence: 0.85
})
// → Armazenado em fazai_learning
// → Próxima vez: score alto, usa RAG direto
```

---

## 4. Embedding Service

### 4.1 Providers Disponíveis

| Provider | Modelo | Dimensão | Prioridade | Custo |
|----------|--------|----------|------------|-------|
| Ollama | `mxbai-embed-large` | 1024 | 1º | Grátis (local) |
| Ollama | `nomic-embed-text` | 768 | 2º | Grátis (local) |
| OpenAI | `text-embedding-3-small` | 1536 | Fallback | $0.02/1M tokens |

### 4.2 Fluxo de Seleção
```
1. Verifica se Ollama está disponível
   → GET http://192.168.0.101:11434/api/tags

2. Se Ollama OK e tem mxbai-embed-large:
   → Usa Ollama com 1024 dimensões

3. Se Ollama OK mas não tem mxbai:
   → Tenta nomic-embed-text (768 dim)

4. Se Ollama indisponível:
   → Fallback para OpenAI (1536 dim)
   → Requer OPENAI_API_KEY
```

### 4.3 Cache de Embeddings

```typescript
// Arquivo: src/services/embedding-cache.ts
// Cache LRU em memória com persistência

Cache L1: Memória (Map com LRU)
  - Tamanho máximo: 10.000 entries
  - Eviction: Least Recently Used
  - Persistência: /opt/fazai/data/embedding-cache.json
  - Auto-save: A cada 5 minutos
```

---

## 5. Semantic Cache

### 5.1 Como Funciona

```
Cache Tradicional:
  "instalar nginx" → hash → busca exata → HIT ou MISS

Cache Semântico:
  "instalar nginx" → embedding → busca por similaridade
  "install nginx" → embedding → similaridade 0.97 → HIT!
```

### 5.2 Configuração

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| `similarityThreshold` | 0.95 | Score mínimo para cache hit |
| `defaultTTL` | 1 hora | Tempo de vida padrão |
| `maxCacheSize` | 10.000 | Máximo de entries |
| `cleanupInterval` | 10 min | Intervalo de limpeza |
| `evictionStrategy` | LRU | Remove menos usados |

### 5.3 Collection no Qdrant

```typescript
// Collection: fazai_semantic_cache
// Distance: Cosine
// Dimension: 1024 (ou 768/1536 conforme provider)

// Payload indexes:
{
  model: "keyword",      // Filtro por modelo
  provider: "keyword",   // Filtro por provider
  timestamp: "integer"   // Ordenação temporal
}
```

---

## 6. Fusion Scoring (Neural Flow)

### 6.1 Pesos das Collections

```typescript
const DEFAULT_WEIGHTS = {
  personality: 0.15,  // 15% - Como responder
  memory: 0.20,       // 20% - Contexto histórico
  learning: 0.30,     // 30% - Padrões aprendidos (MAIS IMPORTANTE)
  kb: 0.25,           // 25% - Knowledge base
  inference: 0.10,    // 10% - Regras operacionais
}
// Total: 100%
```

### 6.2 Cálculo do Score Fusionado

```typescript
fusedScore = vectorScore × collectionWeight × recencyBoost

// Recency Boost (decai com o tempo):
// - 0 dias: 1.2x (boost)
// - 30 dias: 1.0x (neutro)
// - 90 dias: 0.8x (penalidade)
// - 180+ dias: 0.5x (penalidade forte)
```

### 6.3 Fluxo de Busca

```
1. Busca PARALELA em 5 collections (simultânea)
2. Aplica weight de cada collection
3. Aplica recency boost
4. Filtra por minScore (default: 0.3)
5. Re-ranking descendente
6. Retorna top-K resultados (default: 10)
```

---

## 7. Auto-Learning

### 7.1 Tipos de Captura

| Tipo | Quando | Confidence Inicial |
|------|--------|-------------------|
| `erro` | Comando falhou | 0.6 |
| `acerto` | Comando funcionou | 0.85 |
| `padrão` | Padrão identificado | 0.7 |
| `otimização` | Melhoria aplicada | 0.75 |

### 7.2 Fluxo de Aprendizado

```
1. Usuário executa tarefa
2. Comando é executado (success ou failure)
3. Se SUCCESS:
   - Captura como "acerto"
   - confidence = 0.85
   - Armazena em fazai_learning
4. Próxima execução similar:
   - Neural Flow encontra com score alto
   - Usa comandos aprendidos (não chama IA)
   - Incrementa success_count
   - Aumenta confidence
```

### 7.3 Validação Humana

```typescript
// Se validado=true, boost adicional no score
if (payload.validated) {
  score *= 1.1;  // +10% de confiança
}
```

---

## 8. Connection Pool

### 8.1 Características

| Aspecto | Valor |
|---------|-------|
| Padrão | Singleton |
| Health Check | A cada 5 minutos |
| Timeout | 30 segundos |
| Auto-reconnect | Sim |
| Retry | 3 tentativas |

### 8.2 Métricas Rastreadas

```typescript
interface PoolMetrics {
  state: "disconnected" | "connecting" | "connected" | "error";
  totalQueries: number;
  totalErrors: number;
  reconnectionAttempts: number;
  lastHealthCheck: Date;
  averageLatency: number;
}
```

### 8.3 Uso

```typescript
// Simples
const client = await getQdrantClient();
await client.search("collection", { vector, limit: 5 });

// Com error tracking automático
await withQdrantClient(async (client) => {
  return client.search("collection", { vector, limit: 5 });
});
```

---

## 9. Arquivos Relevantes

```
src/
├── database/
│   └── qdrant-pool.ts          # Connection pool (349 linhas)
├── schemas/
│   └── vector-schemas.ts       # Schemas Zod das collections (467 linhas)
├── services/
│   ├── embeddings.ts           # Geração de embeddings (422 linhas)
│   ├── semantic-cache.ts       # Cache semântico (587 linhas)
│   └── embedding-cache.ts      # Cache LRU de embeddings
├── rag/
│   ├── neural-flow.ts          # Multi-collection search + fusion
│   ├── auto-learning.ts        # Captura de aprendizado
│   ├── metrics.ts              # Métricas RAG
│   └── index.ts                # Exports
├── scripts/
│   └── init-qdrant-collections.ts  # Setup inicial
├── config.ts                   # Carregamento de /etc/fazai/fazai.conf
├── linux-admin.ts              # Pipeline admin (RAG + IA)
├── askAI.ts                    # Chamada aos providers
└── app.ts                      # Entry point CLI
```

---

## 10. Configuração

### 10.1 Variáveis de Ambiente

```bash
# /etc/fazai/fazai.conf

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=                    # Opcional se auth habilitada

# Embeddings
OLLAMA_BASE_URL=http://192.168.0.101:11434
OPENAI_API_KEY=sk-...              # Fallback

# Modelos
MODELS_OLLAMA=qwen2.5:7b,tinyllama:1b
MODELS_ANTHROPIC=claude-3-5-sonnet-latest
MODELS_OPENROUTER=qwen/qwen3-coder:free
```

### 10.2 Dimensões dos Vetores

| Provider | Modelo | Dimensão |
|----------|--------|----------|
| Ollama | mxbai-embed-large | 1024 |
| Ollama | nomic-embed-text | 768 |
| OpenAI | text-embedding-3-small | 1536 |

**IMPORTANTE:** Todas as collections devem usar a MESMA dimensão do provider de embeddings ativo.

---

## 11. Problemas Conhecidos

### 11.1 Potenciais Issues

| Issue | Causa | Solução |
|-------|-------|---------|
| Score sempre baixo | Collections vazias | Popular com dados iniciais |
| Cache miss frequente | Threshold muito alto (0.95) | Reduzir para 0.90 |
| Embedding lento | Ollama sem GPU | Usar modelo menor ou OpenAI |
| Connection timeout | Qdrant sobrecarregado | Aumentar pool size |

### 11.2 Debugging

```bash
# Verificar status do Qdrant
curl http://localhost:6333/healthz

# Listar collections
curl http://localhost:6333/collections

# Verificar pontos em uma collection
curl http://localhost:6333/collections/fazai_learning

# Logs do FazAI
fazai --debug "tarefa aqui"
tail -f /var/log/fazai/fazai.log
```

---

**Documento gerado por:** ClaudiÃO (Claude Opus 4.5) + Agentes Especializados
**Data:** 2025-12-18
**Projeto:** FazAI v3.6.22-beta
