#!/bin/bash
# Recria collections do Qdrant com dimensão correta (1536)

QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"
DIMENSION=1536

echo "🔧 Recriando collections do Qdrant com dimensão $DIMENSION..."

collections=(
  "fazai_personality"
  "fazai_memory"
  "fazai_learning"
  "fazai_kb"
  "fazai_inference"
)

for collection in "${collections[@]}"; do
  echo "  Deletando $collection..."
  curl -s -X DELETE "$QDRANT_URL/collections/$collection" > /dev/null
  
  echo "  Criando $collection com dimensão $DIMENSION..."
  curl -s -X PUT "$QDRANT_URL/collections/$collection" \
    -H 'Content-Type: application/json' \
    -d "{
      \"vectors": {
        \"size\": $DIMENSION,
        \"distance\": \"Cosine\"
      }
    }" > /dev/null
  
  echo "  ✓ $collection criada"
done

echo "✅ Todas as collections recriadas com sucesso!"
echo ""
echo "Execute 'fazai vectorize' para popular as collections."
