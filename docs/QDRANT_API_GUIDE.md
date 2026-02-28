# Guia de Uso da API Qdrant para Economia de Tokens

> **Para CLIs de IA** (Claude Code, Gemini CLI, Copilot, etc.)

## Por que usar?

Em vez de ler arquivos fonte diretamente (gastando muitos tokens), use busca semântica no Qdrant para obter apenas chunks relevantes.

| Abordagem | Tokens |
|-----------|--------|
| Ler 10 arquivos completos | ~50k tokens |
| Buscar 5 chunks relevantes | ~3k tokens |
| **Economia** | **~94%** |

---

## Endpoints

| Serviço | URL |
|---------|-----|
| ONNX Embedder (qdrant-universal-injection) | local — sem servidor HTTP |
| Ollama (LLM inference apenas) | `http://192.168.0.101:11434` |
| Qdrant (vector search) | `http://localhost:6333` |

---

## Passo 1: Gerar Embedding da Pergunta

Embeddings agora sao gerados localmente via ONNX (BGE-base-en-v1.5, 768d) pelo pacote `qdrant-universal-injection`. Nao ha mais endpoint HTTP de embedding — use o serviço programaticamente ou via CLI do FazAI.

Para busca manual ad-hoc, voce pode usar o CLI do FazAI para obter embeddings:

```bash
# Via FazAI (recomendado)
fazai vector embed "como funciona o circuit breaker?"
```

Se precisar chamar o Ollama para LLM (nao para embedding):

```bash
# Ollama e usado APENAS para inferencia LLM, nao para embeddings
curl -s -X POST 'http://192.168.0.101:11434/api/generate' \
  -H 'Content-Type: application/json' \
  -d '{"model": "llama3.2", "prompt": "como funciona o circuit breaker?"}'
```

**Embedding:** Array de 768 floats nativo (BGE-base-en-v1.5, Lei 768 — sem padding)

---

## Passo 2: Buscar Chunks Relevantes

```bash
curl -s -X POST 'http://localhost:6333/collections/fazai_source/points/search' \
  -H 'Content-Type: application/json' \
  -d '{
    "vector": [0.1, 0.2, ...],
    "limit": 5,
    "with_payload": true
  }' | jq '.result[] | {path: .payload.path, score: .score, content: .payload.content[:200]}'
```

---

## Passo 3: Usar Contexto Retornado

O campo `payload.content` contém o chunk de código relevante. Use como contexto em vez de ler o arquivo inteiro.

---

## Collections Disponíveis

| Collection | Propósito | Quando Usar |
|------------|-----------|-------------|
| `fazai_source` | Código fonte indexado | Perguntas sobre implementação |
| `fazai_kb` | Knowledge base | Documentação, tutoriais |
| `fazai_memory` | Memórias de conversas | Contexto histórico |
| `fazai_learning` | Aprendizados | Comandos anteriores |
| `fazai_personality` | Traços de personalidade | Estilo de resposta |
| `fazai_inference` | Regras de inferência | Lógica de decisão |

---

## Filtros Úteis

### Por categoria
```json
{
  "vector": [...],
  "limit": 5,
  "filter": {
    "must": [
      {"key": "category", "match": {"value": "service"}}
    ]
  }
}
```

### Por path (contém texto)
```json
{
  "filter": {
    "must": [
      {"key": "path", "match": {"text": "embeddings"}}
    ]
  }
}
```

### Por função específica
```json
{
  "filter": {
    "must": [
      {"key": "functions", "match": {"any": ["createEmbeddingService"]}}
    ]
  }
}
```

---

## Campos do Payload (fazai_source)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `path` | string | Caminho relativo do arquivo |
| `filename` | string | Nome do arquivo |
| `content` | string | Chunk de código |
| `category` | string | core, service, command, ui, documentation |
| `functions` | string[] | Funções detectadas no chunk |
| `classes` | string[] | Classes detectadas no chunk |
| `imports` | string[] | Imports detectados |
| `importance_weight` | float | Prioridade (1.0 = crítico) |
| `chunk_index` | int | Índice do chunk no arquivo |
| `fazai_version` | string | Versão do FazAI na indexação |
| `hash` | string | MD5 do arquivo original |
| `indexed_at` | int | Timestamp da indexação |

---

## Exemplo Completo (One-liner)

```bash
# Buscar "como funciona embeddings" e mostrar os 3 chunks mais relevantes
# (use fazai vector search para gerar o embedding ONNX automaticamente)
fazai vector search "como funciona embeddings" --collection fazai_source --limit 3

# Ou com curl, fornecendo o vetor 768d ja gerado:
EMBED='[0.1, 0.2, ...]'  # vetor 768d gerado pelo qdrant-universal-injection
curl -s -X POST 'http://localhost:6333/collections/fazai_source/points/search' \
  -d "{\"vector\":$EMBED,\"limit\":3,\"with_payload\":true}" | \
  jq -r '.result[] | "### \(.payload.path) (score: \(.score | . * 100 | floor)%)\n\(.payload.content)\n"'
```

---

## Regra para CLIs de IA

**⚠️ Sempre tente Qdrant primeiro!**

Antes de usar `Read`, `Glob` ou `Grep` para explorar código:

1. Formule a pergunta em linguagem natural
2. Gere embedding via `qdrant-universal-injection` (ONNX BGE-base-en-v1.5, 768d) — ou use `fazai vector search`
3. Busque no Qdrant (fazai_source para código, fazai_kb para docs)
4. Só leia arquivos diretamente se o Qdrant não retornar resultados úteis

---

## Indexação

Para atualizar o índice após modificações no código:

```bash
# Indexação incremental (apenas modificados)
fazai index

# Forçar re-indexação completa
fazai index --force

# Com logs detalhados
fazai index --verbose
```

Estado persistido em: `/opt/fazai/data/source-index.json`

---

*Documentação gerada em 2025-12-28*
*FazAI v3.13.0 - Metacognition Engine*
