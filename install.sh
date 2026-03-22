#!/usr/bin/env bash
#
# Terminal FazAI v3.1-beta Installer
# Administrador Linux Senior + Redes com AutoGPT + RAG
#
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/rogerluft/fazai-ng/master/install.sh | bash
#   ou
#   wget -qO- https://raw.githubusercontent.com/rogerluft/fazai-ng/master/install.sh | bash
#
# Instalação não-interativa (CI/CD):
#   FAZAI_AUTO_INSTALL=1 bash install.sh
#   (Auto-instala Docker/Podman e Qdrant sem perguntar)
#

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configurações
FAZAI_VERSION="3.22.0"
INSTALL_DIR="/opt/fazai"
BIN_DIR="/usr/local/bin"
REPO_URL="https://github.com/rogerluft/fazai-ng"
QDRANT_DEFAULT_URL="http://localhost:6333"

# Banner
print_banner() {
  echo -e "${CYAN}"
  cat << "EOF"
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   ███████╗ █████╗ ███████╗ █████╗ ██╗              ║
║   ██╔════╝██╔══██╗╚══███╔╝██╔══██╗██║              ║
║   █████╗  ███████║  ███╔╝ ███████║██║              ║
║   ██╔══╝  ██╔══██║ ███╔╝  ██╔══██║██║              ║
║   ██║     ██║  ██║███████╗██║  ██║██║              ║
║   ╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝              ║
║                                                       ║
║   Terminal FazAI v3.22.0                             ║
║   Autonomous Agent + Linux Admin + Redes             ║
║   Budget Loop · Context Assembly · Skill Registry    ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
EOF
  echo -e "${NC}"
}

# Funções de log
info() { echo -e "${BLUE}ℹ${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warning() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

# Verificar dependências
check_dependencies() {
  info "Verificando dependências..."
  local missing_deps=()
  
  if ! command -v node &> /dev/null; then missing_deps+=("Node.js 18+"); else
    local node_version=$(node --version | sed 's/v//' | cut -d. -f1)
    [ "$node_version" -lt 18 ] && missing_deps+=("Node.js 18+ (atual: $(node --version))")
  fi
  
  for cmd in npm git curl; do
    ! command -v $cmd &> /dev/null && missing_deps+=("$cmd")
  done
  
  if [ ${#missing_deps[@]} -gt 0 ]; then
    error "Dependências faltando:\n  - ${missing_deps[*]}\n\nInstale as dependências e tente novamente."
  fi
  success "Dependências verificadas."
}

# Setup Directories and Code
setup_installation() {
  local IS_DEV_MODE=0
  if [ -d ".git" ]; then
    IS_DEV_MODE=1
    info "Modo Desenvolvimento detectado (repositório git encontrado)."
  fi

  info "Configurando instalação em $INSTALL_DIR..."

  # Se o diretório alvo já existe
  if [ -d "$INSTALL_DIR" ]; then
    # Se estamos no próprio diretório, não fazemos nada (apenas atualizamos permissões depois)
    if [ "$(readlink -f "$INSTALL_DIR")" == "$(pwd)" ]; then
      warning "Já estamos dentro de $INSTALL_DIR. Continuando configuração."
    else
      # Se for modo DEV e o alvo existe, verificamos se é um link ou diretório diferente
      if [ "$IS_DEV_MODE" -eq 1 ]; then
        if [ ! -L "$INSTALL_DIR" ]; then
            warning "Diretório $INSTALL_DIR existe. Preparando para linkar..."
            # Backup se necessário? Por enquanto, assumimos que o usuário sabe o que faz em dev.
            # Vamos limpar o diretório alvo para criar a estrutura correta de links
            # Mas cuidado para não apagar dados importantes.
            # A solicitação pede uma estrutura específica.

            # Vamos criar o diretório pai se não existir
            if [ ! -d "$INSTALL_DIR" ]; then
                sudo mkdir -p "$INSTALL_DIR"
            fi

            # Ajustar permissões
            sudo chown -R $(whoami):$(id -gn) "$INSTALL_DIR"
        fi
      fi
    fi
  else
    sudo mkdir -p "$INSTALL_DIR"
    sudo chown $(whoami):$(id -gn) "$INSTALL_DIR"
  fi

  if [ "$IS_DEV_MODE" -eq 1 ]; then
    info "Criando links simbólicos para modo desenvolvimento..."
    local SRC_DIR=$(pwd)

    # Lista de links solicitados
    local LINKS=(
      "bin"
      "completion"
      "dist"
      "etc"
      "fazai.conf.example"
      "node_modules"
      "package.json"
      "package-lock.json"
      "web"
      "scripts"
      "src"
      "tsconfig.json"
      "tsup.config.js"
    )

    for item in "${LINKS[@]}"; do
      if [ -e "$SRC_DIR/$item" ]; then
        if [ -L "$INSTALL_DIR/$item" ] || [ -e "$INSTALL_DIR/$item" ]; then
           rm -rf "$INSTALL_DIR/$item"
        fi
        ln -s "$SRC_DIR/$item" "$INSTALL_DIR/$item"
        success "Linkado: $item -> $SRC_DIR/$item"
      else
        warning "Origem não encontrada para link: $item"
      fi
    done

    # Lista de diretórios físicos solicitados
    local DIRS=(
      "data"
      "alias-backups"
      "llama.cpp"
      "models"
    )

    for dir in "${DIRS[@]}"; do
      if [ ! -d "$INSTALL_DIR/$dir" ]; then
        mkdir -p "$INSTALL_DIR/$dir"
        success "Criado diretório: $dir"
      else
        success "Diretório já existe: $dir"
      fi
    done

    # Permissões específicas (se necessário)
    # Ex: models precisa ser acessível
    chmod 755 "$INSTALL_DIR/models"
    chmod 755 "$INSTALL_DIR/llama.cpp"

  else
    # MODO PRODUÇÃO (Clone padrão)
    info "Modo Produção: Clonando repositório..."

    if [ -d "$INSTALL_DIR/.git" ]; then
      cd "$INSTALL_DIR"
      git pull origin master || warning "Git pull falhou"
    else
      # Backup se existir e não for git
      if [ -d "$INSTALL_DIR" ] && [ "$(ls -A "$INSTALL_DIR")" ]; then
         mv "$INSTALL_DIR" "${INSTALL_DIR}.backup.$(date +%s)"
      fi
      git clone "$REPO_URL" "$INSTALL_DIR"
    fi
    success "Código atualizado em $INSTALL_DIR"
  fi
}

install_deps_build() {
  info "Instalando dependências e compilando..."
  cd "$INSTALL_DIR"
  
  # npm install
  npm install --silent
  
  # Instalar Playwright
  npx playwright install chromium > /dev/null 2>&1 || warning "Falha ao instalar Playwright"
  
  # Build
  npm run build
  success "Build concluído."
}

create_bin_link() {
  info "Criando link binário..."
  local TARGET="$INSTALL_DIR/bin/fazai"
  local LINK="/usr/local/bin/fazai"
  
  if [ -x "$TARGET" ]; then
    sudo ln -sf "$TARGET" "$LINK"
    success "Link criado: $LINK -> $TARGET"
  else
    error "Binário não encontrado em $TARGET"
  fi
}

setup_config_file() {
    # Check if config file exists in /etc/fazai/fazai.conf
    # Note: User provided config is manually placed, script should respect it if exists
    if [ ! -f "/etc/fazai/fazai.conf" ]; then
        warning "/etc/fazai/fazai.conf não encontrado. Criando padrão..."
        sudo mkdir -p /etc/fazai
        if [ -f "$INSTALL_DIR/fazai.conf.example" ]; then
            sudo cp "$INSTALL_DIR/fazai.conf.example" /etc/fazai/fazai.conf
        else
            sudo touch /etc/fazai/fazai.conf
        fi
    else
        success "Configuração encontrada em /etc/fazai/fazai.conf"
    fi

    # Seed Phase 1-3 config keys if missing (idempotent)
    seed_config_key "AGENTIC_MAX_ITERATIONS" "5"
    seed_config_key "AGENTIC_TOKEN_BUDGET" "50000"
    seed_config_key "AGENTIC_CIRCUIT_BREAKER_MAX_FAILURES" "3"
    seed_config_key "AGENTIC_CIRCUIT_BREAKER_COOLDOWN" "30000"
    seed_config_key "AGENTIC_HEARTBEAT_INTERVAL" "30000"
    seed_config_key "AGENTIC_SESSION_PERSIST" "true"
    seed_config_key "SKILL_REGISTRY_SCAN_INTERVAL" "0"
    # Phase 5 config keys
    seed_config_key "ASYNC_MEMORY_INTERVAL" "86400"
    seed_config_key "RAM_CACHE_LIMIT_GB" "200"
    seed_config_key "SQLITE_VECTOR_PATH" "/opt/fazai/data/memory-vectors.sqlite"
    seed_config_key "LOG_PATH_MEMORY_INJECTOR" "/var/log/fazai/fazai-memory-injector.log"
}

# Seed a config key into fazai.conf if not already present (idempotent, no overwrite)
seed_config_key() {
    local KEY="$1"
    local DEFAULT_VALUE="$2"
    local CONF_FILE="/etc/fazai/fazai.conf"

    if ! grep -q "^${KEY}=" "$CONF_FILE" 2>/dev/null; then
        echo "# ${KEY}=${DEFAULT_VALUE}" | sudo tee -a "$CONF_FILE" > /dev/null
        info "Seeded config: ${KEY}=${DEFAULT_VALUE} (commented)"
    fi
}

setup_log_directory() {
    info "Configurando diretório de logs..."
    local LOG_DIR="/var/log/fazai"

    # Criar diretório se não existir
    if [ ! -d "$LOG_DIR" ]; then
        sudo mkdir -p "$LOG_DIR"
        success "Diretório $LOG_DIR criado"
    fi

    # Mudar o proprietário para o usuário atual e definir permissões seguras
    CURRENT_USER=$(whoami)
    sudo chown -R "$CURRENT_USER":"$(id -gn "$CURRENT_USER")" "$LOG_DIR"
    sudo chmod -R 755 "$LOG_DIR"
    success "Permissões de $LOG_DIR configuradas para o usuário $CURRENT_USER (755)"
}

setup_fazai_service_user() {
    info "Configurando usuário de serviço fazai..."
    local CURRENT_USER=$(whoami)
    local CURRENT_GROUP=$(id -gn "$CURRENT_USER")
    local HOME_DIR=$(eval echo ~$CURRENT_USER)

    # Criar grupo fazai se não existir
    if ! getent group fazai > /dev/null 2>&1; then
        sudo groupadd -r fazai
        success "Grupo 'fazai' criado"
    else
        info "Grupo 'fazai' já existe"
    fi

    # Criar usuário fazai se não existir
    if ! id fazai > /dev/null 2>&1; then
        sudo useradd -r -g fazai -s /sbin/nologin -d /opt/fazai -c "FazAI Service Account" fazai
        success "Usuário 'fazai' criado"
    else
        info "Usuário 'fazai' já existe"
    fi

    # Adicionar fazai ao grupo do usuário atual para acessar symlinks
    if ! groups fazai | grep -q "$CURRENT_GROUP"; then
        sudo usermod -aG "$CURRENT_GROUP" fazai
        success "Usuário 'fazai' adicionado ao grupo '$CURRENT_GROUP'"
    fi

    # Garantir que o home do usuário seja acessível (755 = rwxr-xr-x)
    # Permissivo para evitar problemas com symlinks
    local HOME_PERMS=$(stat -c "%a" "$HOME_DIR" 2>/dev/null || echo "700")
    if [ "$HOME_PERMS" -lt 755 ] 2>/dev/null; then
        sudo chmod 755 "$HOME_DIR"
        success "Permissão de $HOME_DIR alterada para 755"
    else
        info "Permissão de $HOME_DIR OK ($HOME_PERMS)"
    fi

    # Garantir que o diretório do projeto seja acessível
    if [ -d "$HOME_DIR/fazai-ng" ]; then
        # Definir permissões recursivamente para leitura pelo grupo
        chmod -R g+rX "$HOME_DIR/fazai-ng"
        success "Permissões de $HOME_DIR/fazai-ng ajustadas para acesso do grupo"
    fi

    # Criar diretório de dados com permissões corretas
    if [ -d "$INSTALL_DIR/data" ]; then
        sudo chown -R fazai:fazai "$INSTALL_DIR/data" 2>/dev/null || true
        sudo chmod -R 775 "$INSTALL_DIR/data"
    fi
}

verify_service_permissions() {
    info "Verificando permissões para o serviço fazai-worker..."
    local CURRENT_USER=$(whoami)
    local CURRENT_GROUP=$(id -gn "$CURRENT_USER")
    local HOME_DIR=$(eval echo ~$CURRENT_USER)
    local ISSUES_FOUND=0

    # 1. Verificar se usuário fazai existe
    if ! id fazai > /dev/null 2>&1; then
        warning "Usuário 'fazai' não existe."
        ISSUES_FOUND=1
    else
        # 2. Verificar se fazai está no grupo do usuário atual
        if ! groups fazai 2>/dev/null | grep -q "$CURRENT_GROUP"; then
            warning "Usuário 'fazai' não está no grupo '$CURRENT_GROUP'."
            info "Corrigindo: adicionando fazai ao grupo $CURRENT_GROUP..."
            sudo usermod -aG "$CURRENT_GROUP" fazai 2>/dev/null && \
                success "fazai adicionado ao grupo $CURRENT_GROUP" || \
                warning "Falha ao adicionar fazai ao grupo (requer sudo)"
            ISSUES_FOUND=1
        fi
    fi

    # 3. Verificar permissão do home directory (precisa ser 755 ou mais)
    if [ -d "$HOME_DIR" ]; then
        local HOME_PERMS=$(stat -c "%a" "$HOME_DIR" 2>/dev/null || echo "000")
        if [ "$HOME_PERMS" -lt 755 ] 2>/dev/null; then
            warning "Home directory $HOME_DIR com permissão restritiva ($HOME_PERMS)"
            info "Corrigindo: alterando para 755..."
            sudo chmod 755 "$HOME_DIR" 2>/dev/null && \
                success "$HOME_DIR agora tem permissão 755" || \
                warning "Falha ao alterar permissão (requer sudo)"
            ISSUES_FOUND=1
        fi
    fi

    # 4. Verificar se o diretório do projeto é acessível pelo grupo
    if [ -d "$INSTALL_DIR" ]; then
        if ! sudo -u fazai test -r "$INSTALL_DIR/dist/app.js" 2>/dev/null; then
            warning "Diretório $INSTALL_DIR não acessível pelo usuário fazai"
            info "Corrigindo: ajustando permissões do grupo..."
            chmod -R g+rX "$(readlink -f $INSTALL_DIR/dist 2>/dev/null || echo $INSTALL_DIR)" 2>/dev/null && \
                success "Permissões ajustadas" || \
                warning "Falha ao ajustar permissões"
            ISSUES_FOUND=1
        fi
    fi

    # Resultado
    if [ "$ISSUES_FOUND" -eq 0 ]; then
        success "Todas as permissões do serviço estão corretas!"
    else
        warning "Alguns problemas de permissão foram corrigidos."
        info "Execute 'sudo systemctl restart fazai-worker' se necessário."
    fi
}

# Setup systemd services/timers for Phase 5 memory injector
setup_systemd_services() {
    info "Configurando serviços systemd..."
    local SYSTEMD_DIR="/etc/systemd/system"
    local SRC_SYSTEMD="$INSTALL_DIR/scripts/systemd"

    # Install memory injector service + timer if files exist
    if [ -f "$SRC_SYSTEMD/fazai-memory-injector.service" ]; then
        if [ ! -f "$SYSTEMD_DIR/fazai-memory-injector.service" ] || \
           ! diff -q "$SRC_SYSTEMD/fazai-memory-injector.service" "$SYSTEMD_DIR/fazai-memory-injector.service" > /dev/null 2>&1; then
            sudo cp "$SRC_SYSTEMD/fazai-memory-injector.service" "$SYSTEMD_DIR/"
            success "Instalado: fazai-memory-injector.service"
        else
            info "fazai-memory-injector.service já atualizado"
        fi
    fi

    if [ -f "$SRC_SYSTEMD/fazai-memory-injector.timer" ]; then
        if [ ! -f "$SYSTEMD_DIR/fazai-memory-injector.timer" ] || \
           ! diff -q "$SRC_SYSTEMD/fazai-memory-injector.timer" "$SYSTEMD_DIR/fazai-memory-injector.timer" > /dev/null 2>&1; then
            sudo cp "$SRC_SYSTEMD/fazai-memory-injector.timer" "$SYSTEMD_DIR/"
            success "Instalado: fazai-memory-injector.timer"
        else
            info "fazai-memory-injector.timer já atualizado"
        fi
    fi

    # Install worker service if exists
    if [ -f "$SRC_SYSTEMD/fazai-worker.service" ]; then
        if [ ! -f "$SYSTEMD_DIR/fazai-worker.service" ] || \
           ! diff -q "$SRC_SYSTEMD/fazai-worker.service" "$SYSTEMD_DIR/fazai-worker.service" > /dev/null 2>&1; then
            sudo cp "$SRC_SYSTEMD/fazai-worker.service" "$SYSTEMD_DIR/"
            success "Instalado: fazai-worker.service"
        fi
    fi

    # Reload systemd daemon
    sudo systemctl daemon-reload 2>/dev/null || true
    info "systemd daemon reloaded"
}

# Main
main() {
  print_banner
  check_dependencies
  setup_installation
  setup_log_directory
  setup_fazai_service_user
  install_deps_build
  create_bin_link
  setup_config_file
  setup_systemd_services
  verify_service_permissions

  echo ""
  success "Instalação concluída! (v${FAZAI_VERSION})"
  echo -e "Execute 'fazai' para começar."
  echo -e "Para iniciar o serviço: ${CYAN}sudo systemctl start fazai-worker${NC}"
  echo -e "Para memory injector: ${CYAN}sudo systemctl enable --now fazai-memory-injector.timer${NC}"
}

main "$@"
