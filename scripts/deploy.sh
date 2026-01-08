#!/usr/bin/env bash
# Deploy script: Sincroniza ~/fazai-ng → /opt/fazai
# Inclui CLI + Interface Web

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="/opt/fazai"

echo "🚀 Fazendo deploy do FazAI v3.6.22-beta..."
echo "   Origem: $REPO_DIR"
echo "   Destino: $INSTALL_DIR"

# Verifica se está rodando como root
if [[ $EUID -ne 0 ]]; then
   echo "❌ Este script precisa ser executado como root (use sudo)"
   exit 1
fi

# Verifica se build CLI foi feito
if [[ ! -f "$REPO_DIR/dist/app.cjs" ]]; then
   echo "❌ Build CLI não encontrado. Execute 'npm run build' primeiro."
   exit 1
fi

# Verifica se build Web foi feito (opcional)
WEB_BUILD_EXISTS=false
if [[ -d "$REPO_DIR/web/.next" ]]; then
   WEB_BUILD_EXISTS=true
   echo "✓ Build web encontrado"
else
   echo "⚠ Build web não encontrado. Execute 'npm run build:web' para incluir interface web."
fi

# Cria diretórios se não existirem
mkdir -p "$INSTALL_DIR"
mkdir -p "/etc/fazai/ingest"
mkdir -p "/opt/fazai/data"

# Define permissões corretas
chmod 755 "/etc/fazai/ingest"
chmod 755 "/opt/fazai/data"

echo "✓ Diretórios criados: /etc/fazai/ingest, /opt/fazai/data"

# Sincroniza arquivos (exclui node_modules, .git, etc)
echo "📦 Sincronizando arquivos..."
rsync -a --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='*.log' \
  --exclude='.env.local' \
  --exclude='claudio*' \
  --exclude='sessao_gege.txt' \
  --exclude='web-monitor' \
  "$REPO_DIR/" "$INSTALL_DIR/"

# Instala dependências de produção (CLI)
echo "📦 Instalando dependências de produção (CLI)..."
cd "$INSTALL_DIR"
npm install --omit=dev --quiet

# Instala dependências web se build existir
if [[ "$WEB_BUILD_EXISTS" == true ]] && [[ -d "$INSTALL_DIR/web" ]]; then
  echo "📦 Instalando dependências de produção (Web)..."
  cd "$INSTALL_DIR/web"
  npm install --omit=dev --quiet
  echo "✓ Dependências web instaladas"
fi

# Restart serviços se estiverem ativos
if systemctl is-active --quiet fazai-web@root 2>/dev/null; then
  echo "🔄 Reiniciando fazai-web..."
  systemctl restart fazai-web@root
fi

# Ler porta configurada
WEB_PORT=3000
if [[ -f "/etc/fazai/fazai.conf" ]]; then
  WEB_PORT=$(grep -E "^WEB_PORT=" /etc/fazai/fazai.conf 2>/dev/null | cut -d= -f2 || echo "3000")
  WEB_PORT=${WEB_PORT:-3000}
fi

echo ""
echo "✅ Deploy concluído!"
echo "   CLI: fazai --version"
if [[ "$WEB_BUILD_EXISTS" == true ]]; then
  echo "   Web: http://localhost:${WEB_PORT}"
fi
