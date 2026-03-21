---
description: Busca semantica no Qdrant antes de ler arquivos (economia de tokens)
arguments:
  - name: query
    description: Pergunta ou termo para buscar
    required: true
  - name: collection
    description: Collection para buscar (source, learning, kb, memory, personality, inference)
    required: false
---

# Qdrant Semantic Search

Busque informacoes no Qdrant ANTES de usar Read/Grep/Glob.

## Instrucoes

1. Gere embedding da query usando Ollama:
```bash
EMBED=$(curl -s -X POST 'http://192.168.0.101:11434/api/embeddings' \
  -d '{"model":"nomic-embed-text","prompt":"$ARGUMENTS.query"}' | jq -c '.embedding')
```

2. Busque na collection especificada (default: fazai_source):
```bash
COLLECTION="${ARGUMENTS.collection:-fazai_source}"
curl -s -X POST "http://localhost:6333/collections/fazai_${COLLECTION}/points/search" \
  -d "{\"vector\":$EMBED,\"limit\":5,\"with_payload\":true}" | \
  jq '.result[] | {score: .score, path: .payload.path, content: .payload.content[:500]}'
```

3. Analise os resultados e responda a pergunta do usuario baseado nos chunks retornados.

4. Apenas use Read/Grep se os resultados do Qdrant forem insuficientes.

## Collections disponiveis

- source: Codigo fonte do FazAI
- learning: Erros corrigidos, padroes validados
- kb: Documentacao, tutoriais
- memory: Contexto de conversas
- personality: Tracos de personalidade, chats importados
- inference: Regras de seguranca, SLA

## Exemplo de uso

Usuario: /qdrant-search "como funciona embeddings"
Usuario: /qdrant-search "personalidade do assistente" personality
