#!/bin/bash
# =============================================================================
# FazAI Agent Installer
# =============================================================================
# Instala o agent mínimo no host para comunicação com o container
#
# Uso:
#   curl -sSL https://fazai.io/install-agent | sudo bash
#   ou
#   sudo ./install.sh
# =============================================================================

set -euo pipefail

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# -----------------------------------------------------------------------------
# Verificações
# -----------------------------------------------------------------------------
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "Este script precisa ser executado como root (sudo)"
    fi
}

check_dependencies() {
    local missing=()

    if ! command -v socat &> /dev/null; then
        missing+=("socat")
    fi

    if ! command -v jq &> /dev/null; then
        missing+=("jq")
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        warn "Dependências faltando: ${missing[*]}"
        info "Instalando dependências..."

        if command -v dnf &> /dev/null; then
            dnf install -y "${missing[@]}"
        elif command -v apt-get &> /dev/null; then
            apt-get update && apt-get install -y "${missing[@]}"
        elif command -v pacman &> /dev/null; then
            pacman -Sy --noconfirm "${missing[@]}"
        else
            error "Não foi possível instalar dependências. Instale manualmente: ${missing[*]}"
        fi
    fi
}

# -----------------------------------------------------------------------------
# Instalação
# -----------------------------------------------------------------------------
install_agent() {
    local INSTALL_DIR="/opt/fazai"
    local SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    info "Criando diretório $INSTALL_DIR"
    mkdir -p "$INSTALL_DIR"

    info "Copiando agent..."
    if [[ -f "$SCRIPT_DIR/fazai-agent.sh" ]]; then
        # Instalação local
        cp "$SCRIPT_DIR/fazai-agent.sh" "$INSTALL_DIR/"
    else
        # Download remoto
        curl -sSL https://raw.githubusercontent.com/rluft/fazai-ng/master/docker/agent/fazai-agent.sh \
            -o "$INSTALL_DIR/fazai-agent.sh"
    fi

    chmod +x "$INSTALL_DIR/fazai-agent.sh"

    info "Instalando serviço systemd..."
    if [[ -f "$SCRIPT_DIR/fazai-agent.service" ]]; then
        cp "$SCRIPT_DIR/fazai-agent.service" /etc/systemd/system/
    else
        curl -sSL https://raw.githubusercontent.com/rluft/fazai-ng/master/docker/agent/fazai-agent.service \
            -o /etc/systemd/system/fazai-agent.service
    fi

    info "Criando diretório de runtime..."
    mkdir -p /run/fazai
    chmod 750 /run/fazai

    info "Criando diretório de log..."
    touch /var/log/fazai-agent.log
    chmod 640 /var/log/fazai-agent.log
}

# -----------------------------------------------------------------------------
# Configuração
# -----------------------------------------------------------------------------
configure_agent() {
    local CONF_FILE="/etc/fazai/fazai.conf"

    # Adiciona configurações do agent se não existirem
    if [[ -f "$CONF_FILE" ]]; then
        if ! grep -q "^AGENT_" "$CONF_FILE"; then
            info "Adicionando configurações do agent ao fazai.conf..."
            cat >> "$CONF_FILE" << 'EOF'

# =============================================================================
# FazAI Agent Configuration
# =============================================================================
# Socket para comunicação com container
AGENT_SOCKET=/run/fazai/agent.sock

# Senha para autenticação (deixe vazio para desabilitar)
AGENT_PASSWORD=

# Arquivo de log
AGENT_LOG=/var/log/fazai-agent.log

# Timeout em segundos para comandos
AGENT_TIMEOUT=300

# Padrões de comandos bloqueados (separados por vírgula)
AGENT_BLOCKED_PATTERNS=rm -rf /,dd if=/dev,mkfs,> /dev/sd,chmod 777 /,:(){ :|:& };:

EOF
        fi
    else
        warn "Arquivo $CONF_FILE não encontrado - usando defaults"
    fi
}

# -----------------------------------------------------------------------------
# Ativação
# -----------------------------------------------------------------------------
enable_agent() {
    info "Recarregando systemd..."
    systemctl daemon-reload

    info "Habilitando serviço..."
    systemctl enable fazai-agent

    info "Iniciando agent..."
    systemctl start fazai-agent

    # Verifica status
    sleep 2
    if systemctl is-active --quiet fazai-agent; then
        info "Agent iniciado com sucesso!"
    else
        warn "Agent pode não ter iniciado corretamente. Verifique: journalctl -u fazai-agent"
    fi
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
    echo "==========================================="
    echo "  FazAI Agent Installer"
    echo "==========================================="
    echo

    check_root
    check_dependencies
    install_agent
    configure_agent
    enable_agent

    echo
    echo "==========================================="
    info "Instalação concluída!"
    echo "==========================================="
    echo
    echo "Comandos úteis:"
    echo "  systemctl status fazai-agent    # Ver status"
    echo "  journalctl -fu fazai-agent      # Ver logs"
    echo "  cat /var/log/fazai-agent.log    # Log do agent"
    echo
    echo "Socket: /run/fazai/agent.sock"
    echo
    echo "Para testar:"
    echo '  echo '"'"'{"cmd":"hostname"}'"'"' | socat - UNIX-CONNECT:/run/fazai/agent.sock'
    echo
}

main "$@"
