#!/usr/bin/env bash
#
# Script para instalar o serviço fazai-llama (llama.cpp + Phi-3-mini)
# Uso: sudo ./scripts/install-llama-service.sh
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

# Verificar root
if [ "$EUID" -ne 0 ]; then
    error "Este script deve ser executado como root (sudo)"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║   Instalando serviço fazai-llama (llama.cpp)          ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# 1. Criar grupo fazai se não existir
if ! getent group fazai > /dev/null 2>&1; then
    groupadd -f fazai
    info "Grupo 'fazai' criado"
else
    info "Grupo 'fazai' já existe"
fi

# 2. Criar symlinks se não existem
if [ ! -L /usr/local/bin/llama-server ]; then
    ln -sf /opt/fazai/llama.cpp/build/bin/llama-server /usr/local/bin/llama-server
    info "Symlink llama-server criado"
else
    info "Symlink llama-server já existe"
fi

if [ ! -L /usr/local/bin/llama-cli ]; then
    ln -sf /opt/fazai/llama.cpp/build/bin/llama-cli /usr/local/bin/llama-cli
    info "Symlink llama-cli criado"
else
    info "Symlink llama-cli já existe"
fi

# 3. Verificar modelo
MODEL_PATH="/opt/fazai/models/phi3/Phi-3-mini-4k-instruct-q4.gguf"
if [ ! -f "$MODEL_PATH" ]; then
    error "Modelo não encontrado: $MODEL_PATH"
fi
MODEL_SIZE=$(stat -c%s "$MODEL_PATH")
if [ "$MODEL_SIZE" -lt 2000000000 ]; then
    error "Modelo parece incompleto (< 2GB)"
fi
info "Modelo Phi-3-mini encontrado: $(numfmt --to=iec $MODEL_SIZE)"

# 4. Configurar permissões
mkdir -p /var/log/fazai
chown root:fazai /var/log/fazai
chmod 775 /var/log/fazai
chown -R root:fazai /opt/fazai/models
chmod -R 755 /opt/fazai/models
info "Permissões configuradas"

# 5. Copiar arquivo de serviço
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_SRC="$SCRIPT_DIR/../etc/fazai/fazai-llama.service"
SERVICE_DST="/etc/systemd/system/fazai-llama.service"

if [ -f "$SERVICE_SRC" ]; then
    cp "$SERVICE_SRC" "$SERVICE_DST"
    info "Arquivo de serviço copiado"
else
    error "Arquivo não encontrado: $SERVICE_SRC"
fi

# 6. Recarregar systemd
systemctl daemon-reload
info "systemd recarregado"

# 7. Habilitar serviço
systemctl enable fazai-llama
info "Serviço habilitado no boot"

# 8. Iniciar serviço
echo ""
info "Iniciando fazai-llama (carregando modelo na memória)..."
systemctl start fazai-llama

# 9. Aguardar inicialização
echo -n "Aguardando llama-server responder"
for i in {1..60}; do
    if curl -sf "http://localhost:11430/health" > /dev/null 2>&1; then
        echo ""
        info "fazai-llama iniciado e respondendo!"
        echo ""
        echo "═══════════════════════════════════════════════════════"
        echo "   INSTALAÇÃO CONCLUÍDA!"
        echo "═══════════════════════════════════════════════════════"
        echo ""
        echo "  Status:    systemctl status fazai-llama"
        echo "  Logs:      journalctl -u fazai-llama -f"
        echo "  Parar:     sudo systemctl stop fazai-llama"
        echo "  Health:    curl http://localhost:11430/health"
        echo ""
        exit 0
    fi
    echo -n "."
    sleep 1
done

echo ""
warn "llama-server ainda não respondeu após 60s"
warn "Verifique os logs: journalctl -u fazai-llama -n 50"
echo ""
systemctl status fazai-llama --no-pager || true
