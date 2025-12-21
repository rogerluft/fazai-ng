#!/bin/bash

# Script de compilação para o módulo de sistema do FazAI

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v gcc &> /dev/null; then
    echo "Erro: gcc não encontrado. Instale o pacote build-essential ou gcc."
    exit 1
fi

echo "Compilando módulo de sistema..."
gcc -shared -fPIC -o system_mod.so system_mod.c

if [ $? -eq 0 ]; then
    echo "Compilação concluída com sucesso: system_mod.so"
else
    echo "Erro na compilação."
    exit 1
fi
