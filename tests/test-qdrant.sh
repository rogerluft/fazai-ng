#!/bin/bash
# Teste de Conectividade Qdrant - FazAI
TARGET=${1:-"localhost:6333"}

echo "Conectando em Qdrant: $TARGET..."
curl -s "http://$TARGET/collections" | jq -r '.result.collections[].name' || echo "Erro ao conectar no Qdrant em $TARGET"