#!/bin/bash
# Busca semantica no Qdrant
# Uso: ./qdrant-search.sh "sua pergunta" [collection]
# Collections: source, learning, kb, memory, personality, inference
#
# Embedder: ONNX BGE-base-en-v1.5 via qdrant-universal-injection

QUERY="${1:-}"
COLLECTION="${2:-source}"

if [ -z "$QUERY" ]; then
  echo "Uso: $0 \"sua pergunta\" [collection]"
  echo "Collections: source, learning, kb, memory, personality, inference"
  exit 1
fi

QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAZAI_NG_DIR="$(dirname "$SCRIPT_DIR")"

echo "Buscando: \"$QUERY\" em fazai_$COLLECTION..."
echo ""

# Gerar embedding via ONNX BGE-base-en-v1.5 (direto, sem adapter-bridge stdout noise)
EMBED=$(node --input-type=module -e "
import { getEmbedder } from 'qdrant-universal-injection';
const e = getEmbedder();
if (!e.isReady) await e.init();
const v = await e.embed(process.argv[1]);
process.stdout.write(JSON.stringify(v));
process.exit(0);
" "$QUERY" 2>/dev/null)

if [ -z "$EMBED" ] || [ "$EMBED" = "null" ]; then
  echo "Erro: Falha ao gerar embedding ONNX."
  echo "Verifique: npm link qdrant-universal-injection"
  exit 1
fi

# Buscar no Qdrant
curl -s -X POST "$QDRANT_URL/collections/fazai_$COLLECTION/points/search" \
  -H "Content-Type: application/json" \
  -d "{\"vector\":$EMBED,\"limit\":5,\"with_payload\":true}" | \
  jq -r '.result[] | "### Score: \(.score | . * 100 | floor)%\nPath: \(.payload.path // "N/A")\n\(.payload.content[:600] // .payload.text[:600] // "sem conteudo")\n---\n"'
