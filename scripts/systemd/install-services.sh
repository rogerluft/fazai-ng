#!/usr/bin/env bash
# =============================================================================
# FazAI Services Installer - Script de Instalacao dos Servicos Systemd
# =============================================================================
# Descricao: Instala e configura os servicos systemd do FazAI
#
# Uso:
#   sudo ./install-services.sh [opcoes]
#
# Opcoes:
#   --uninstall     Remove os servicos instalados
#   --status        Mostra status dos servicos
#   --restart       Reinicia todos os servicos
#   --logs          Mostra logs em tempo real
#   --help          Mostra esta ajuda
#
# Requisitos:
#   - Executar como root (sudo)
#   - systemd instalado
#   - FazAI instalado em /opt/fazai
# =============================================================================

set -euo pipefail

# -------------------------------------------------------------------------
# Cores para output
# -------------------------------------------------------------------------
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[0;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# -------------------------------------------------------------------------
# Configuracoes
# -------------------------------------------------------------------------
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SYSTEMD_DIR="/etc/systemd/system"
readonly FAZAI_USER="fazai"
readonly FAZAI_GROUP="fazai"
readonly FAZAI_HOME="/opt/fazai"
readonly FAZAI_CONFIG_DIR="/etc/fazai"
readonly FAZAI_LOG_DIR="/var/log/fazai"
readonly FAZAI_DATA_DIR="/opt/fazai/data"
readonly FAZAI_INGEST_DIR="/etc/fazai/ingest"

# Lista de servicos a instalar
readonly SERVICES=(
    "fazai-worker.service"
    "fazai-skill-seeker.service"
    "fazai-worker.timer"
    "fazai-health-check.service"
)

# Servicos opcionais (instalados separadamente)
readonly OPTIONAL_SERVICES=(
    "fazai-llama.service"  # Instalado via install_llama_cpp no install.sh
)

# -------------------------------------------------------------------------
# Funcoes de Utilidade
# -------------------------------------------------------------------------

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "Este script deve ser executado como root (sudo)"
        exit 1
    fi
}

show_help() {
    head -30 "$0" | tail -25
    exit 0
}

# -------------------------------------------------------------------------
# Funcao: Criar usuario fazai se nao existir
# -------------------------------------------------------------------------
create_user() {
    log_info "Verificando usuario '$FAZAI_USER'..."

    if id "$FAZAI_USER" &>/dev/null; then
        log_success "Usuario '$FAZAI_USER' ja existe"
    else
        log_info "Criando usuario '$FAZAI_USER'..."

        # Cria grupo se nao existir
        if ! getent group "$FAZAI_GROUP" &>/dev/null; then
            groupadd --system "$FAZAI_GROUP"
            log_success "Grupo '$FAZAI_GROUP' criado"
        fi

        # Cria usuario de sistema (sem shell de login, sem home interativo)
        useradd \
            --system \
            --gid "$FAZAI_GROUP" \
            --home-dir "$FAZAI_HOME" \
            --shell /usr/sbin/nologin \
            --comment "FazAI Service Account" \
            "$FAZAI_USER"

        log_success "Usuario '$FAZAI_USER' criado"
    fi
}

# -------------------------------------------------------------------------
# Funcao: Criar diretorios necessarios
# -------------------------------------------------------------------------
create_directories() {
    log_info "Criando diretorios necessarios..."

    # Diretorio de configuracao
    mkdir -p "$FAZAI_CONFIG_DIR"
    chmod 755 "$FAZAI_CONFIG_DIR"

    # Diretorio de logs
    mkdir -p "$FAZAI_LOG_DIR"
    chown "$FAZAI_USER:$FAZAI_GROUP" "$FAZAI_LOG_DIR"
    chmod 750 "$FAZAI_LOG_DIR"

    # Diretorio de dados
    mkdir -p "$FAZAI_DATA_DIR"
    chown "$FAZAI_USER:$FAZAI_GROUP" "$FAZAI_DATA_DIR"
    chmod 750 "$FAZAI_DATA_DIR"

    # Diretorios de ingest
    mkdir -p "$FAZAI_INGEST_DIR"
    mkdir -p "$FAZAI_INGEST_DIR/processed"
    mkdir -p "$FAZAI_INGEST_DIR/failed"
    chown -R "$FAZAI_USER:$FAZAI_GROUP" "$FAZAI_INGEST_DIR"
    chmod -R 750 "$FAZAI_INGEST_DIR"

    log_success "Diretorios criados"
}

# -------------------------------------------------------------------------
# Funcao: Criar arquivo de ambiente padrao
# -------------------------------------------------------------------------
create_env_file() {
    local env_file="$FAZAI_CONFIG_DIR/fazai.env"

    if [[ -f "$env_file" ]]; then
        log_warn "Arquivo $env_file ja existe, mantendo configuracao atual"
        return
    fi

    log_info "Criando arquivo de ambiente padrao..."

    cat > "$env_file" << 'EOF'
# =============================================================================
# FazAI Environment Variables
# =============================================================================
# Este arquivo contem variaveis de ambiente sensiveis para o FazAI.
# NAO commitar este arquivo em repositorios publicos!
#
# Permissoes recomendadas: chmod 600 /etc/fazai/fazai.env
# =============================================================================

# -------------------------------------------------------------------------
# Configuracoes de Conexao
# -------------------------------------------------------------------------
# URL do servidor Qdrant (banco de vetores)
QDRANT_URL=http://localhost:6333

# URL do servidor Ollama para CHAT (modelos de inferencia)
# Use servidor remoto para phi3:8b ou outros modelos de chat
OLLAMA_URL=http://localhost:11434

# Embeddings: ONNX BGE-base-en-v1.5 via qdrant-universal-injection (local, 768d)
# Não requer Ollama — embedder estático carregado no processo Node.js

# -------------------------------------------------------------------------
# API Keys (preencher conforme necessario)
# -------------------------------------------------------------------------
# Anthropic Claude
# ANTHROPIC_API_KEY=sk-ant-...

# OpenAI
# OPENAI_API_KEY=sk-...

# Google AI (Gemini)
# GOOGLE_API_KEY=...

# OpenRouter
# OPENROUTER_API_KEY=...

# Jules API (Google)
# JULES_API_KEY=...

# -------------------------------------------------------------------------
# Configuracoes do Sistema
# -------------------------------------------------------------------------
# Nivel de log (debug, info, warn, error)
LOG_LEVEL=info

# Modo (development, production)
NODE_ENV=production
EOF

    # Permissoes restritas para arquivo com secrets
    chmod 600 "$env_file"
    chown root:root "$env_file"

    log_success "Arquivo de ambiente criado em $env_file"
    log_warn "Edite $env_file para adicionar suas API keys"
}

# -------------------------------------------------------------------------
# Funcao: Instalar servicos systemd
# -------------------------------------------------------------------------
install_services() {
    log_info "Instalando servicos systemd..."

    for service in "${SERVICES[@]}"; do
        local src="$SCRIPT_DIR/$service"
        local dst="$SYSTEMD_DIR/$service"

        if [[ -f "$src" ]]; then
            cp "$src" "$dst"
            chmod 644 "$dst"
            log_success "Instalado: $service"
        else
            log_warn "Arquivo nao encontrado: $src"
        fi
    done

    # Recarrega configuracao do systemd
    log_info "Recarregando daemon do systemd..."
    systemctl daemon-reload
    log_success "Systemd recarregado"
}

# -------------------------------------------------------------------------
# Funcao: Habilitar servicos
# -------------------------------------------------------------------------
enable_services() {
    log_info "Habilitando servicos para iniciar no boot..."

    # Servicos principais
    systemctl enable fazai-worker.service 2>/dev/null || true
    log_success "fazai-worker.service habilitado"

    systemctl enable fazai-skill-seeker.service 2>/dev/null || true
    log_success "fazai-skill-seeker.service habilitado"

    # Timer de health check (opcional)
    systemctl enable fazai-worker.timer 2>/dev/null || true
    log_success "fazai-worker.timer habilitado"
}

# -------------------------------------------------------------------------
# Funcao: Iniciar servicos
# -------------------------------------------------------------------------
start_services() {
    log_info "Iniciando servicos..."

    # Inicia worker primeiro
    if systemctl start fazai-worker.service; then
        log_success "fazai-worker.service iniciado"
    else
        log_error "Falha ao iniciar fazai-worker.service"
        log_info "Verifique os logs: journalctl -u fazai-worker -e"
    fi

    # Inicia skill-seeker
    if systemctl start fazai-skill-seeker.service; then
        log_success "fazai-skill-seeker.service iniciado"
    else
        log_warn "Falha ao iniciar fazai-skill-seeker.service (pode depender do worker)"
    fi

    # Inicia timer
    if systemctl start fazai-worker.timer; then
        log_success "fazai-worker.timer iniciado"
    else
        log_warn "Falha ao iniciar fazai-worker.timer"
    fi
}

# -------------------------------------------------------------------------
# Funcao: Mostrar status dos servicos
# -------------------------------------------------------------------------
show_status() {
    echo ""
    echo "=========================================="
    echo "        Status dos Servicos FazAI        "
    echo "=========================================="
    echo ""

    for service in "${SERVICES[@]}"; do
        echo -e "${BLUE}--- $service ---${NC}"
        systemctl status "$service" --no-pager 2>/dev/null || echo "Nao instalado"
        echo ""
    done

    echo "=========================================="
    echo "              Timers Ativos              "
    echo "=========================================="
    systemctl list-timers fazai-worker.timer --no-pager 2>/dev/null || echo "Timer nao ativo"
}

# -------------------------------------------------------------------------
# Funcao: Desinstalar servicos
# -------------------------------------------------------------------------
uninstall_services() {
    log_info "Desinstalando servicos FazAI..."

    # Para todos os servicos
    for service in "${SERVICES[@]}"; do
        systemctl stop "$service" 2>/dev/null || true
        systemctl disable "$service" 2>/dev/null || true
        rm -f "$SYSTEMD_DIR/$service"
        log_success "Removido: $service"
    done

    systemctl daemon-reload
    log_success "Servicos desinstalados"

    log_warn "Usuario '$FAZAI_USER' e diretorios foram mantidos"
    log_info "Para remover completamente:"
    log_info "  sudo userdel $FAZAI_USER"
    log_info "  sudo rm -rf $FAZAI_LOG_DIR $FAZAI_DATA_DIR $FAZAI_INGEST_DIR"
}

# -------------------------------------------------------------------------
# Funcao: Reiniciar servicos
# -------------------------------------------------------------------------
restart_services() {
    log_info "Reiniciando servicos FazAI..."

    systemctl restart fazai-worker.service || log_error "Falha ao reiniciar worker"
    systemctl restart fazai-skill-seeker.service || log_warn "Falha ao reiniciar skill-seeker"
    systemctl restart fazai-worker.timer || log_warn "Falha ao reiniciar timer"

    log_success "Servicos reiniciados"
    show_status
}

# -------------------------------------------------------------------------
# Funcao: Mostrar logs
# -------------------------------------------------------------------------
show_logs() {
    log_info "Mostrando logs dos servicos FazAI (Ctrl+C para sair)..."
    journalctl -u fazai-worker -u fazai-skill-seeker -u fazai-health-check -f
}

# -------------------------------------------------------------------------
# Funcao Principal de Instalacao
# -------------------------------------------------------------------------
install() {
    echo ""
    echo "=========================================="
    echo "    FazAI Services Installer v1.0.0      "
    echo "=========================================="
    echo ""

    check_root

    # Verifica se FazAI esta instalado
    if [[ ! -d "$FAZAI_HOME" ]]; then
        log_error "FazAI nao encontrado em $FAZAI_HOME"
        log_info "Instale o FazAI primeiro com: ./install.sh"
        exit 1
    fi

    # Passos de instalacao
    create_user
    create_directories
    create_env_file
    install_services
    enable_services

    echo ""
    log_success "Instalacao concluida!"
    echo ""
    echo "Proximos passos:"
    echo "  1. Edite /etc/fazai/fazai.env com suas API keys"
    echo "  2. Inicie os servicos: sudo systemctl start fazai-worker"
    echo "  3. Verifique status: sudo systemctl status fazai-worker"
    echo "  4. Veja logs: journalctl -u fazai-worker -f"
    echo ""

    read -p "Deseja iniciar os servicos agora? [y/N] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        start_services
        show_status
    fi
}

# -------------------------------------------------------------------------
# Main - Processamento de argumentos
# -------------------------------------------------------------------------
main() {
    case "${1:-}" in
        --help|-h)
            show_help
            ;;
        --uninstall)
            check_root
            uninstall_services
            ;;
        --status)
            show_status
            ;;
        --restart)
            check_root
            restart_services
            ;;
        --logs)
            show_logs
            ;;
        *)
            install
            ;;
    esac
}

main "$@"
