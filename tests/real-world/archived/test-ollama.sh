#!/bin/bash
# Teste de Conectividade Ollama (Llama) - FazAI
TARGET=${1:-"localhost:11434"}

echo "Conectando em Ollama (Llama): $TARGET..."
curl -s "http://$TARGET/api/tags" | jq -r '.models[].name' || echo "Erro ao conectar no Ollama em $TARGET"