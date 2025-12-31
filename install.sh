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
FAZAI_VERSION="3.10.0"
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
║   Terminal FazAI v3.10.0                             ║
║   Administrador Linux Senior + Redes                 ║
║   GenAIScript Agentic Core + Dashboard               ║
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
}

setup_log_directory() {
    info "Configurando diretório de logs..."
    local LOG_DIR="/var/log/fazai"

    # Criar diretório se não existir
    if [ ! -d "$LOG_DIR" ]; then
        sudo mkdir -p "$LOG_DIR"
        success "Diretório $LOG_DIR criado"
    fi

    # Permissões 777 recursivo
    sudo chmod -R 777 "$LOG_DIR"
    success "Permissões de $LOG_DIR configuradas (777 -R)"
}

# Main
main() {
  print_banner
  check_dependencies
  setup_installation
  install_deps_build
  create_bin_link
  setup_config_file
  setup_log_directory

  echo ""
  success "Instalação concluída!"
  echo -e "Execute 'fazai' para começar."
}

main "$@"
