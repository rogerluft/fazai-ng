#!/bin/bash
# FazAI-OS: Migrador de dados do Host para o nspawn

MACHINE_PATH="/var/lib/machines/fazai-os"

if [ ! -d "$MACHINE_PATH" ]; then
  echo "Erro: Maquina nao encontrada em $MACHINE_PATH"
  exit 1
fi

echo "📂 Migrando configuracoes..."
mkdir -p "$MACHINE_PATH/etc/fazai"
cp /etc/fazai/fazai.conf "$MACHINE_PATH/etc/fazai/"

echo "🧠 Migrando banco Qdrant (se local)..."
if [ -d "/var/lib/qdrant" ]; then
  mkdir -p "$MACHINE_PATH/var/lib/qdrant"
  cp -r /var/lib/qdrant/* "$MACHINE_PATH/var/lib/qdrant/"
fi

echo "✅ Migracao concluida."
