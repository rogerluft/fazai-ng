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
# SEMPRE instala em /opt/fazai (centralizado)
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
info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

success() {
  echo -e "${GREEN}✓${NC} $1"
}

warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

error() {
  echo -e "${RED}✗${NC} $1"
  exit 1
}

# Verificar dependências
check_dependencies() {
  info "Verificando dependências..."

  local missing_deps=()
  
  # Node.js
  if ! command -v node &> /dev/null; then
    missing_deps+=("Node.js 18+")
    warning "Node.js não encontrado"
  else
    local node_version=$(node --version | sed 's/v//' | cut -d. -f1)
    if [ "$node_version" -lt 18 ]; then
      missing_deps+=("Node.js 18+ (atual: $(node --version))")
      warning "Node.js 18+ requerido. Versão atual: $(node --version)"
    else
      success "Node.js $(node --version) ✓"
    fi
  fi
  
  # npm
  if ! command -v npm &> /dev/null; then
    missing_deps+=("npm")
    warning "npm não encontrado"
  else
    success "npm $(npm --version) ✓"
  fi
  
  # git
  if ! command -v git &> /dev/null; then
    missing_deps+=("git")
    warning "git não encontrado"
  else
    success "git $(git --version | cut -d' ' -f3) ✓"
  fi

  # curl ou wget
  if ! command -v curl &> /dev/null && ! command -v wget &> /dev/null; then
    missing_deps+=("curl ou wget")
    warning "curl ou wget não encontrado"
  else
    if command -v curl &> /dev/null; then
      success "curl $(curl --version | head -n1 | cut -d' ' -f2) ✓"
    else
      success "wget $(wget --version | head -n1 | cut -d' ' -f3) ✓"
    fi
  fi

  # Verificar se há dependências faltando
  if [ ${#missing_deps[@]} -gt 0 ]; then
    error "Dependências faltando:\n  - ${missing_deps[*]}\n\nInstale as dependências e tente novamente."
  fi

  # Verificar espaço em disco
  local available_space=$(df -BG "$HOME" | awk 'NR==2 {print $4}' | sed 's/G//')
  if [ "$available_space" -lt 1 ]; then
    warning "Espaço em disco baixo: ${available_space}GB disponível"
  else
    success "Espaço em disco: ${available_space}GB disponível ✓"
  fi
}

# Criar diretórios
setup_directories() {
  info "Configurando diretórios..."

  # Diretórios do usuário
  mkdir -p "$INSTALL_DIR"
  mkdir -p "$INSTALL_DIR/data"  # Dados centralizados (memory, cache, etc)
  mkdir -p "$BIN_DIR"
  mkdir -p "$HOME/.config/fazai"

  # Limpar instalações antigas em $HOME
  if [ -d "$HOME/.fazai" ] && [ "$HOME/.fazai" != "$INSTALL_DIR" ]; then
    warning "Removendo instalação antiga em $HOME/.fazai..."
    rm -rf "$HOME/.fazai"
    success "Instalação antiga removida"
  fi

  # Diretórios do sistema (requer sudo)
  if [ "$EUID" -eq 0 ] || sudo -n true 2>/dev/null; then
    sudo mkdir -p /etc/fazai 2>/dev/null || warning "Não foi possível criar /etc/fazai (necessita sudo)"
    sudo mkdir -p /var/log/fazai 2>/dev/null || warning "Não foi possível criar /var/log/fazai (necessita sudo)"
    sudo chmod 755 /etc/fazai 2>/dev/null || true
    sudo chmod 777 /var/log/fazai 2>/dev/null || true  # Todos podem escrever logs

    # Criar arquivo fzalias com permissões corretas
    sudo touch /etc/fazai/fzalias
    sudo chmod 666 /etc/fazai/fzalias
    sudo chown root:root /etc/fazai/fzalias

    success "Diretório de sistema criado: /etc/fazai"
  else
    warning "Pule /etc/fazai (necessita sudo). Use ~/.config/fazai/"
  fi

  # Criar diretório de logs (tentar com sudo se necessário)
  if [ "$EUID" -eq 0 ] || sudo -n true 2>/dev/null; then
    sudo mkdir -p /var/log/fazai 2>/dev/null || mkdir -p /opt/fazai/logs
    sudo chmod 775 /var/log/fazai 2>/dev/null || true
    sudo chown $(whoami):$(id -gn) /var/log/fazai 2>/dev/null || true
    success "Diretório de logs criado: /var/log/fazai"
  else
    mkdir -p /opt/fazai/logs
    warning "Usando /opt/fazai/logs (necessita sudo para /var/log/fazai)"
  fi

  success "Diretórios configurados"
}

# =============================================================================
# SETUP INSTALLATION: DEV (SYMLINK) VS PROD (CLONE)
# =============================================================================
setup_installation() {
  local IS_DEV_MODE=0
  if [ -d ".git" ] && [ -f "package.json" ]; then
    IS_DEV_MODE=1
    info "Modo DESENVOLVIMENTO detectado (repositório git encontrado)."
  fi

  if [ "$IS_DEV_MODE" -eq 1 ]; then
    # --- DEV MODE ---
    local SRC_DIR=$(pwd)

    # Se /opt/fazai existe e NÃO é um symlink para o diretório atual
    if [ -d "$INSTALL_DIR" ] && [ "$(readlink -f "$INSTALL_DIR")" != "$SRC_DIR" ]; then
        if [ ! -L "$INSTALL_DIR" ]; then
            warning "Diretório $INSTALL_DIR existe e não é um link para este repo."
            # Em modo dev, assumimos que o usuário quer que /opt/fazai aponte para cá.
            # Mas só apagamos se for seguro ou interativo.
            # Como estamos em script, tentaremos criar symlinks DENTRO de /opt/fazai se ele já existir como dir real,
            # OU linkar /opt/fazai -> PWD se não existir.

            # Estratégia híbrida segura:
            # 1. Se /opt/fazai não existe, cria symlink para PWD
            # 2. Se /opt/fazai existe, entra nele e cria symlinks para os arquivos do PWD (sobrescrevendo)
        fi
    fi

    # Se INSTALL_DIR não existe, ou é um link quebrado, cria link para PWD
    if [ ! -e "$INSTALL_DIR" ]; then
        info "Criando link principal: $INSTALL_DIR -> $SRC_DIR"
        sudo ln -sfn "$SRC_DIR" "$INSTALL_DIR"
    elif [ -L "$INSTALL_DIR" ]; then
        # Atualiza link existente
        info "Atualizando link principal: $INSTALL_DIR -> $SRC_DIR"
        sudo ln -sfn "$SRC_DIR" "$INSTALL_DIR"
    else
        # É um diretório físico. Vamos popular com symlinks internos para manter a estrutura.
        info "Populando $INSTALL_DIR com symlinks para o código fonte..."

        local LINKS=(
          "bin" "completion" "dist" "etc" "fazai.conf.example"
          "node_modules" "package.json" "package-lock.json"
          "web" "scripts" "src" "tsconfig.json" "tsup.config.js"
        )

        for item in "${LINKS[@]}"; do
          if [ -e "$SRC_DIR/$item" ]; then
            sudo rm -rf "$INSTALL_DIR/$item"
            sudo ln -s "$SRC_DIR/$item" "$INSTALL_DIR/$item"
            success "Linkado: $item"
          fi
        done

        # Diretórios físicos necessários
        sudo mkdir -p "$INSTALL_DIR/data"
        sudo mkdir -p "$INSTALL_DIR/alias-backups"
        sudo mkdir -p "$INSTALL_DIR/llama.cpp"
        sudo mkdir -p "$INSTALL_DIR/models"
    fi

    # Ajustar permissões
    if [ -d "$INSTALL_DIR/models" ]; then
        sudo chmod 775 "$INSTALL_DIR/models"
    fi

    success "Ambiente de desenvolvimento configurado em $INSTALL_DIR"

  else
    # --- PROD MODE ---
    info "Modo PRODUÇÃO: Clonando repositório..."
    clone_repo
  fi
}

# Clonar repositório (Usado apenas em PROD)
clone_repo() {
  info "Clonando Terminal FazAI $FAZAI_VERSION..."

  # Se diretório existe e não é vazio
  if [ -d "$INSTALL_DIR" ] && [ "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]; then
    # Se é um repositório git válido
    if [ -d "$INSTALL_DIR/.git" ]; then
      info "Repositório já existe. Atualizando..."
      cd "$INSTALL_DIR"

      # Verificar se é um repositório git válido
      if ! git rev-parse --git-dir > /dev/null 2>&1; then
        warning "Repositório corrompido, recriando..."
        cd /
        sudo rm -rf "$INSTALL_DIR"
        sudo git clone "$REPO_URL" "$INSTALL_DIR" || error "Falha ao clonar"
        success "Repositório clonado"
        return
      fi

      # Atualizar repositório
      sudo git fetch origin 2>/dev/null || {
        warning "Fetch falhou, reconfigurando remote..."
        sudo git remote set-url origin "$REPO_URL"
        sudo git fetch origin
      }

      sudo git pull origin master || warning "Pull falhou, usando código atual"
      success "Repositório atualizado"
    else
      # Backup e clonar
      warning "Diretório existe mas não é git"
      local backup_dir="${INSTALL_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
      info "Criando backup em $backup_dir..."
      sudo mv "$INSTALL_DIR" "$backup_dir"
      sudo git clone "$REPO_URL" "$INSTALL_DIR" || error "Falha ao clonar"
      success "Repositório clonado (backup criado)"
    fi
  else
    sudo git clone "$REPO_URL" "$INSTALL_DIR" || error "Falha ao clonar"
    success "Repositório clonado"
  fi
}

# Instalar dependências
install_deps() {
  info "Instalando dependências Node.js..."
  cd "$INSTALL_DIR"

  # Instalar TODAS as dependências (incluindo devDependencies para build)
  local npm_log="${TMPDIR:-/tmp}/fazai-npm-$$.log"
  if npm install --silent > "$npm_log" 2>&1; then
    success "Dependências instaladas"

    # Instalar browsers do Playwright (necessário para scraping de SPA)
    info "Instalando browsers do Playwright (Chromium)..."
    if npx playwright install chromium > "$npm_log" 2>&1; then
       success "Playwright Chromium instalado"
    else
       warning "Falha ao instalar Playwright Chromium. Verifique $npm_log"
    fi

    rm -f "$npm_log"
  else
    error "Falha ao instalar dependências. Verifique $npm_log"
  fi
}

# Build do projeto
build_project() {
  info "Compilando FazAI..."
  cd "$INSTALL_DIR"
  
  # Build com output
  local build_log="${TMPDIR:-/tmp}/fazai-build-$$.log"
  npm run build > "$build_log" 2>&1
  local build_status=$?
  
  # Verificar se dist/app.js foi criado (ESM)
  if [ ! -f "dist/app.js" ]; then
    error "Build falhou: dist/app.js não foi criado. Verifique $build_log"
  fi
  
  if [ $build_status -eq 0 ]; then
    local dist_size=$(du -h dist/app.js | cut -f1)
    success "Build concluído (dist/app.js: $dist_size)"
    rm -f "$build_log"
  else
    warning "Build teve avisos mas arquivo foi criado. Verifique $build_log"
  fi
}

# Criar ponto de entrada no PATH
create_entry_point() {
  info "Criando ponto de entrada em /usr/local/bin/fazai..."

  local entry_point="/usr/local/bin/fazai"
  local target_executable="/opt/fazai/bin/fazai.mjs"

  if [ "$EUID" -ne 0 ] && ! sudo -n true 2>/dev/null; then
    error "Permissão de superusuário (sudo) é necessária para criar o link em ${entry_point}"
  fi

  info "Garantindo que o alvo '${target_executable}' seja executável..."
  sudo chmod +x "$target_executable"

  info "Criando link simbólico: ${entry_point} -> ${target_executable}"
  sudo ln -sf "$target_executable" "$entry_point"
  
  success "Ponto de entrada criado com sucesso."
}

# Configurar PATH
setup_path() {
  # /usr/local/bin já está no PATH por padrão
  success "PATH configurado (/usr/local/bin)"
}

# Instalar fzsamba (gerenciador Samba)
install_fzsamba() {
  info "Instalando fzsamba (gerenciador Samba)..."

  local FZSAMBA_SOURCE="$INSTALL_DIR/scripts/fzsamba"
  local FZSAMBA_TARGET="/opt/fazai/scripts/fzsamba"

  if [ -f "$FZSAMBA_SOURCE" ]; then
    sudo mkdir -p /opt/fazai/scripts

    # Check if source and target are the same (symlink case)
    if [ "$(readlink -f "$FZSAMBA_SOURCE")" != "$(readlink -f "$FZSAMBA_TARGET")" ]; then
        sudo cp "$FZSAMBA_SOURCE" "$FZSAMBA_TARGET"
    fi

    sudo chmod +x "$FZSAMBA_TARGET"

    if [ -d /etc/bash_completion.d ]; then
      "$FZSAMBA_TARGET" completion | sudo tee /etc/bash_completion.d/fzsamba > /dev/null 2>&1
      success "fzsamba instalado com completion"
    else
      success "fzsamba instalado"
    fi
  else
    warning "Script fzsamba não encontrado em $INSTALL_DIR/scripts/"
  fi
}

# Instalar bash completion do fazai
install_fazai_completion() {
  info "Instalando bash completion do fazai..."

  local COMPLETION_SOURCE="$INSTALL_DIR/completion/fazai-completion.bash"
  local COMPLETION_TARGET="/etc/bash_completion.d/fazai"

  if [ -f "$COMPLETION_SOURCE" ]; then
    if [ -d /etc/bash_completion.d ]; then
        sudo cp "$COMPLETION_SOURCE" "$COMPLETION_TARGET"
        success "Bash completion instalado em $COMPLETION_TARGET"
    else
      warning "Diretório /etc/bash_completion.d não existe. Completion não instalado."
    fi
  else
    # Tentar gerar dinamicamente
    if command -v fazai &> /dev/null; then
      if [ -d /etc/bash_completion.d ]; then
        info "Gerando completion dinamicamente..."
        fazai completion bash | sudo tee "$COMPLETION_TARGET" > /dev/null 2>&1
        success "Bash completion gerado e instalado"
      fi
    else
      warning "Arquivo de completion não encontrado."
    fi
  fi
}

# Instalar fzalias
install_fzalias_system() {
  info "Instalando fzalias (sistema de aliases global)..."

  if [ -f "$INSTALL_DIR/scripts/fzalias" ]; then
      sudo bash "$INSTALL_DIR/scripts/fzalias" install
      success "fzalias instalado"
  else
    warning "Script fzalias não encontrado em $INSTALL_DIR/scripts/"
  fi

  # Injetar source no /etc/bashrc
  local BASHRC_FILE=""
  if [ -f /etc/bashrc ]; then BASHRC_FILE="/etc/bashrc"; elif [ -f /etc/bash.bashrc ]; then BASHRC_FILE="/etc/bash.bashrc"; fi

  if [ -n "$BASHRC_FILE" ]; then
    if ! grep -q "source /etc/fazai/fzalias" "$BASHRC_FILE" 2>/dev/null; then
        echo -e "\n# FazAI aliases\n[ -f /etc/fazai/fzalias ] && source /etc/fazai/fzalias" | sudo tee -a "$BASHRC_FILE" > /dev/null
        success "Aliases configurados globalmente"
    fi
  fi
}

# Configurar fazai.conf
setup_config() {
  local system_config="/etc/fazai/fazai.conf"

  # Configuração do sistema (global - requer sudo)
  if [ "$EUID" -eq 0 ] || sudo -n true 2>/dev/null; then
    if [ -f "$system_config" ]; then
      info "Configuração do sistema já existe: $system_config"
    else
        # Se existe exemplo, copia
        if [ -f "$INSTALL_DIR/fazai.conf.example" ]; then
            info "Criando configuração padrão..."
            sudo cp "$INSTALL_DIR/fazai.conf.example" "$system_config"
            sudo chmod 644 "$system_config"
            success "Config do sistema criada: $system_config"
        else
            warning "Exemplo de config não encontrado."
        fi
    fi
  fi
}

# Criar arquivo de configuração (Fallback se não tiver exemplo)
create_config_file() {
  local config_file="$1"
  cat > "$config_file" << 'EOF'
# FazAI Configuration
# See README for details
EOF
}

# Instalar Qdrant
install_qdrant() {
  info "Verificando Qdrant..."

  # Se estamos em DEV e .git existe, PULAR instalação pesada automática,
  # a menos que forçado.
  if [ -d ".git" ]; then
      info "Modo DEV: Pulando instalação automática de serviços (Qdrant/Llama)."
      return 0
  fi

  if curl -sf "$QDRANT_DEFAULT_URL/collections" > /dev/null 2>&1; then
    success "Qdrant já está rodando em $QDRANT_DEFAULT_URL"
    return 0
  fi

  if [ -n "$FAZAI_AUTO_INSTALL" ]; then
    install_qdrant_docker && return 0
    return 1
  fi

  echo ""
  echo -e "${YELLOW}Qdrant não está rodando. Deseja instalar?${NC}"
  echo -e "${CYAN}1)${NC} Docker (recomendado)"
  echo -e "${CYAN}2)${NC} Pular"
  read -p "Escolha [1-2]: " choice

  case $choice in
    1) install_qdrant_docker ;;
    *) warning "Pulando Qdrant."; return 1 ;;
  esac
}

install_qdrant_docker() {
  if ! command -v docker &> /dev/null; then
    warning "Docker não encontrado. Instale Docker primeiro."
    return 1
  fi

  info "Instalando Qdrant via Docker..."
  docker run -d \
      --name qdrant \
      --restart unless-stopped \
      -p 6333:6333 \
      -p 6334:6334 \
      -v /opt/fazai/qdrant_storage:/qdrant/storage:z \
      qdrant/qdrant:latest

  success "Qdrant iniciado via Docker"
}

# LLAMA.CPP + PHI-3-MINI
install_llama_cpp() {
  # Pular em DEV
  if [ -d ".git" ]; then return 0; fi

  info "Verificando llama.cpp..."
  if command -v llama-server &> /dev/null; then
    success "llama-server já instalado"
    return 0
  fi

  # Simplificação: Em modo prod, instruir ou compilar se tiver ferramentas
  warning "Instalação automática do llama.cpp requer compilação manual ou binários pré-compilados."
  warning "Consulte a documentação para configurar o modelo local."
}

# Criar collections
setup_collections() {
  info "Configurando collections Qdrant..."
  if ! curl -sf "$QDRANT_DEFAULT_URL/collections" > /dev/null 2>&1; then
    warning "Qdrant não disponível. Pule esta etapa."
    return
  fi
  if [ -x "$BIN_DIR/fazai" ]; then
    "$BIN_DIR/fazai" vector validate || warning "Collections não criadas automaticamente"
  fi
}

# Instalar Web Interface
install_web_interface() {
  # Pular em DEV
  if [ -d ".git" ]; then return 0; fi

  echo ""
  info "Instalando Interface Web..."
  if [ -d "$INSTALL_DIR/web" ] && [ -f "$INSTALL_DIR/web/package.json" ]; then
      cd "$INSTALL_DIR/web"
      npm install --silent || warning "Falha ao instalar deps web"
      npm run build || warning "Falha no build web"
      success "Web interface instalada"
  fi
}

# Mensagem final
print_success() {
  echo ""
  echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║                                                       ║${NC}"
  echo -e "${GREEN}║  ✓ FazAI v$FAZAI_VERSION instalado com sucesso!      ║${NC}"
  echo -e "${GREEN}║                                                       ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${CYAN}📁 Instalado em:${NC} $INSTALL_DIR"
  echo -e "${CYAN}🔗 Executável:${NC} $BIN_DIR/fazai"
  echo -e "${CYAN}⚙️  Config:${NC} $HOME/.config/fazai/fazai.conf"
  echo ""
  echo -e "${YELLOW}⚡ Próximos passos:${NC}"
  echo -e "  ${BLUE}1.${NC} Reinicie seu terminal"
  echo -e "  ${BLUE}2.${NC} Configure suas API keys: ${CYAN}nano /etc/fazai/fazai.conf${NC}"
  echo -e "  ${BLUE}3.${NC} Execute: ${CYAN}fazai${NC}"
  echo ""
}

# Main
main() {
  print_banner
  check_dependencies
  setup_directories
  setup_installation  # Detecta DEV vs PROD e clona/linka

  # Daqui pra baixo, estamos dentro de $INSTALL_DIR (ou linkado)
  install_deps
  build_project
  create_entry_point
  setup_path
  install_fzalias_system
  install_fzsamba
  install_fazai_completion
  setup_config

  # Instalações pesadas (apenas se não for DEV ou se forçado)
  install_qdrant
  install_llama_cpp
  setup_collections
  install_web_interface

  print_success
}

# Setup /var/log/fazai
setup_log_directory() {
  local LOG_DIR="/var/log/fazai"
  if [ "$EUID" -eq 0 ]; then
      mkdir -p "$LOG_DIR"
      chmod 777 "$LOG_DIR"
  else
      sudo mkdir -p "$LOG_DIR"
      sudo chmod 777 "$LOG_DIR"
  fi
}

main "$@"
