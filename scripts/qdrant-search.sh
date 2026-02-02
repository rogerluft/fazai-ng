#!/bin/bash
# Busca semantica no Qdrant
# Uso: ./qdrant-search.sh "sua pergunta" [collection]
# Collections: source, learning, kb, memory, personality, inference

QUERY="${1:-}"
COLLECTION="${2:-source}"

if [ -z "$QUERY" ]; then
  echo "Uso: $0 \"sua pergunta\" [collection]"
  echo "Collections: source, learning, kb, memory, personality, inference"
  exit 1
fi

# Get URLs from environment or config, with localhost defaults
OLLAMA_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"
QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"

echo "Buscando: \"$QUERY\" em fazai_$COLLECTION..."
echo ""

# Gerar embedding
RAW_EMBED=$(curl -s -X POST "$OLLAMA_URL/api/embeddings" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"nomic-embed-text\",\"prompt\":\"$QUERY\"}" | jq -c '.embedding')

if [ "$RAW_EMBED" = "null" ] || [ -z "$RAW_EMBED" ]; then
  echo "Erro: Falha ao gerar embedding. Ollama esta rodando?"
  exit 1
fi

# Use native 768 dimensions (nomic-embed-text)
EMBED=$(echo "$RAW_EMBED" | jq -c '.')

# Buscar no Qdrant
curl -s -X POST "$QDRANT_URL/collections/fazai_$COLLECTION/points/search" \
  -H "Content-Type: application/json" \
  -d "{\"vector\":$EMBED,\"limit\":5,\"with_payload\":true}" | \
  jq -r '.result[] | "### Score: \(.score | . * 100 | floor)%\nPath: \(.payload.path // "N/A")\n\(.payload.content[:600] // .payload.text[:600] // "sem conteudo")\n---\n"'
