#!/usr/bin/env bash
# Deploy script: Sincroniza ~/fazai-ng → /opt/fazai

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="/opt/fazai"

echo "🚀 Fazendo deploy do FazAI..."
echo "   Origem: $REPO_DIR"
echo "   Destino: $INSTALL_DIR"

# Verifica se está rodando como root
if [[ $EUID -ne 0 ]]; then
   echo "❌ Este script precisa ser executado como root (use sudo)"
   exit 1
fi

# Verifica se build foi feito
if [[ ! -f "$REPO_DIR/dist/app.cjs" ]]; then
   echo "❌ Build não encontrado. Execute 'npm run build' primeiro."
   exit 1
fi

# Cria diretório se não existir
mkdir -p "$INSTALL_DIR"

# Sincroniza arquivos (exclui node_modules, .git, etc)
echo "📦 Sincronizando arquivos..."
rsync -a --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.next' \
  --exclude='*.log' \
  --exclude='.env.local' \
  --exclude='claudio*' \
  --exclude='sessao_gege.txt' \
  "$REPO_DIR/" "$INSTALL_DIR/"

# Instala dependências de produção
echo "📦 Instalando dependências de produção..."
cd "$INSTALL_DIR"
npm install --omit=dev --quiet

# Restart serviços se estiverem ativos
if systemctl is-active --quiet fazai-web@root 2>/dev/null; then
  echo "🔄 Reiniciando fazai-web..."
  systemctl restart fazai-web@root
fi

echo "✅ Deploy concluído!"
echo "   Execute 'fazai --version' para verificar"
