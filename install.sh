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

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configurações
FAZAI_VERSION="3.1.0-beta"
INSTALL_DIR="${FAZAI_INSTALL_DIR:-$HOME/.fazai}"
BIN_DIR="${FAZAI_BIN_DIR:-$HOME/.local/bin}"
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
║   Terminal FazAI v3.1-beta                           ║
║   Administrador Linux Senior + Redes                 ║
║   AutoGPT + Genkit + RAG                             ║
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

  # Node.js
  if ! command -v node &> /dev/null; then
    error "Node.js não encontrado. Instale Node.js 18+ primeiro: https://nodejs.org"
  fi

  local node_version=$(node --version | sed 's/v//' | cut -d. -f1)
  if [ "$node_version" -lt 18 ]; then
    error "Node.js 18+ requerido. Versão atual: $(node --version)"
  fi
  success "Node.js $(node --version) ✓"

  # npm
  if ! command -v npm &> /dev/null; then
    error "npm não encontrado"
  fi
  success "npm $(npm --version) ✓"

  # git
  if ! command -v git &> /dev/null; then
    error "git não encontrado. Instale git primeiro."
  fi
  success "git $(git --version | cut -d' ' -f3) ✓"
}

# Criar diretórios
setup_directories() {
  info "Configurando diretórios..."

  # Diretórios do usuário
  mkdir -p "$INSTALL_DIR"
  mkdir -p "$BIN_DIR"
  mkdir -p "$HOME/.fazai"
  mkdir -p "$HOME/.config/fazai"

  # Diretório de config do sistema (requer sudo)
  if [ "$EUID" -eq 0 ] || sudo -n true 2>/dev/null; then
    sudo mkdir -p /etc/fazai 2>/dev/null || warning "Não foi possível criar /etc/fazai (necessita sudo)"
    sudo chmod 755 /etc/fazai 2>/dev/null || true
    success "Diretório de sistema criado: /etc/fazai"
  else
    warning "Pule /etc/fazai (necessita sudo). Use ~/.config/fazai/"
  fi

  # Criar diretório de logs (tentar com sudo se necessário)
  if [ "$EUID" -eq 0 ] || sudo -n true 2>/dev/null; then
    sudo mkdir -p /var/log/fazai 2>/dev/null || mkdir -p "$HOME/.fazai/logs"
    sudo chmod 775 /var/log/fazai 2>/dev/null || true
    sudo chown $(whoami):$(id -gn) /var/log/fazai 2>/dev/null || true
    success "Diretório de logs criado: /var/log/fazai"
  else
    mkdir -p "$HOME/.fazai/logs"
    warning "Usando $HOME/.fazai/logs (necessita sudo para /var/log/fazai)"
  fi

  success "Diretórios configurados"
}

# Clonar repositório
clone_repo() {
  info "Clonando Terminal FazAI $FAZAI_VERSION..."

  if [ -d "$INSTALL_DIR/.git" ]; then
    warning "FazAI já instalado. Atualizando..."
    cd "$INSTALL_DIR"
    git fetch origin
    git checkout master
    git pull origin master
  else
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
  fi

  success "Repositório clonado/atualizado"
}

# Instalar dependências
install_deps() {
  info "Instalando dependências Node.js..."
  cd "$INSTALL_DIR"
  npm install --production
  success "Dependências instaladas"
}

# Build do projeto
build_project() {
  info "Compilando FazAI..."
  cd "$INSTALL_DIR"
  npm run build
  success "Build concluído"
}

# Criar symlink
create_symlink() {
  info "Criando symlink..."

  ln -sf "$INSTALL_DIR/bin/fazai.js" "$BIN_DIR/fazai"
  chmod +x "$BIN_DIR/fazai"
  chmod +x "$INSTALL_DIR/bin/fazai.js"

  success "Symlink criado: $BIN_DIR/fazai"
}

# Configurar PATH
setup_path() {
  local shell_rc=""

  if [ -n "$BASH_VERSION" ]; then
    shell_rc="$HOME/.bashrc"
  elif [ -n "$ZSH_VERSION" ]; then
    shell_rc="$HOME/.zshrc"
  else
    shell_rc="$HOME/.profile"
  fi

  if ! grep -q "$BIN_DIR" "$shell_rc" 2>/dev/null; then
    info "Adicionando $BIN_DIR ao PATH em $shell_rc..."
    echo "" >> "$shell_rc"
    echo "# FazAI Terminal" >> "$shell_rc"
    echo "export PATH=\"$BIN_DIR:\$PATH\"" >> "$shell_rc"
    success "PATH configurado"
  else
    success "PATH já configurado"
  fi
}

# Configurar fazai.conf
setup_config() {
  local user_config="$HOME/.config/fazai/fazai.conf"
  local system_config="/etc/fazai/fazai.conf"

  # Configuração do usuário
  if [ -f "$user_config" ]; then
    warning "Configuração do usuário já existe: $user_config"
  else
    info "Criando configuração do usuário..."
    create_config_file "$user_config"
    success "Config do usuário criada: $user_config"
  fi

  # Configuração do sistema (global - requer sudo)
  if [ "$EUID" -eq 0 ] || sudo -n true 2>/dev/null; then
    if [ -f "$system_config" ]; then
      info "Configuração do sistema já existe: $system_config"
    else
      echo ""
      read -p "Criar config global do sistema em /etc/fazai/fazai.conf? [S/n]: " create_system
      if [[ "$create_system" =~ ^[Ss]$ ]] || [[ -z "$create_system" ]]; then
        info "Criando configuração do sistema..."
        sudo bash -c "$(declare -f create_config_file); create_config_file '$system_config'"
        sudo chmod 644 "$system_config"
        success "Config do sistema criada: $system_config"
        echo -e "${CYAN}→${NC} Configurações do sistema têm prioridade sobre ~/.config/fazai/"
      fi
    fi
  fi
}

# Criar arquivo de configuração
create_config_file() {
  local config_file="$1"

  cat > "$config_file" << 'EOF'
# FazAI v3.1-beta Configuration
# Terminal FazAI - Administrador Linux Senior + Redes
# Documentação: https://github.com/rogerluft/fazai-ng

# ============================================
# AI Providers (configure pelo menos um)
# ============================================

# Anthropic Claude (recomendado para admin Linux/redes)
# Modelos: sonnet35 (mais capaz), haiku (rápido)
# Obter em: https://console.anthropic.com/
ANTHROPIC_API_KEY=

# OpenAI GPT
# Modelos: gpt4o, gpt4mini (padrão), gpt4turbo
# Obter em: https://platform.openai.com/api-keys
OPENAI_API_KEY=

# Ollama (local/gratuito - privacidade)
# Modelos: llama32, qwen, mistral
# Instalar: https://ollama.ai
OLLAMA_BASE_URL=http://localhost:11434

# ============================================
# Vector Store (Qdrant) - RAG e Memória
# ============================================
VECTOR_PROVIDER=qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
VECTOR_DIMENSION=1536
VECTOR_DISTANCE=Cosine

# ============================================
# MCP Context7 Research (Opcional)
# ============================================
# URL do serviço Context7 (se disponível)
MCP_CONTEXT7_URL=

# Comando local Context7 (alternativa ao URL)
# Exemplo: MCP_CONTEXT7_COMMAND=context7 --json --query "{query}"
MCP_CONTEXT7_COMMAND=

# API Key se Context7 requer autenticação
MCP_CONTEXT7_API_KEY=

# Fallback para busca web quando Context7 indisponível
WEB_SEARCH_PROVIDER=duckduckgo

# Habilitar pesquisa automática
FAZAI_DISABLE_RESEARCH=false
FAZAI_RESEARCH_ON_FAILURE=true

# ============================================
# Logging e Debug
# ============================================
# Níveis: error, warn, info, debug
LOG_LEVEL=info

# Caminho do arquivo de log
# Padrão: /var/log/fazai/fazai.log (requer permissão)
# Fallback: ./fazai.log (diretório atual)
LOG_FILE_PATH=/var/log/fazai/fazai.log

# ============================================
# Configurações Avançadas
# ============================================

# Auto-build se detectar mudanças no código-fonte
# FAZAI_AUTO_BUILD=1

# Timeout para comandos em modo dry-run (ms)
# FAZAI_COMMAND_TIMEOUT=30000

# Máximo de tentativas em caso de falha de rede
# FAZAI_MAX_RETRIES=3
EOF
}

# Instalar Qdrant
install_qdrant() {
  info "Verificando Qdrant..."

  # Verificar se já está rodando
  if curl -sf "$QDRANT_DEFAULT_URL/collections" > /dev/null 2>&1; then
    success "Qdrant já está rodando em $QDRANT_DEFAULT_URL"
    return 0
  fi

  echo ""
  echo -e "${YELLOW}Qdrant não está rodando. Deseja instalar?${NC}"
  echo -e "${CYAN}1)${NC} Docker (recomendado)"
  echo -e "${CYAN}2)${NC} Podman"
  echo -e "${CYAN}3)${NC} Binário nativo"
  echo -e "${CYAN}4)${NC} Pular (instalar manualmente depois)"
  echo ""
  read -p "Escolha [1-4]: " choice

  case $choice in
    1)
      install_qdrant_docker
      ;;
    2)
      install_qdrant_podman
      ;;
    3)
      install_qdrant_binary
      ;;
    4)
      warning "Qdrant não instalado. Instale manualmente:"
      echo -e "  ${CYAN}docker run -d -p 6333:6333 -p 6334:6334 qdrant/qdrant${NC}"
      return 1
      ;;
    *)
      warning "Opção inválida. Pulando instalação do Qdrant."
      return 1
      ;;
  esac
}

# Instalar Qdrant via Docker
install_qdrant_docker() {
  if ! command -v docker &> /dev/null; then
    error "Docker não encontrado. Instale Docker primeiro: https://docs.docker.com/get-docker/"
  fi

  info "Instalando Qdrant via Docker..."

  # Parar container existente se houver
  docker stop fazai-qdrant 2>/dev/null || true
  docker rm fazai-qdrant 2>/dev/null || true

  # Criar volume para persistência
  mkdir -p "$HOME/.fazai/qdrant_storage"

  # Iniciar Qdrant
  docker run -d \
    --name fazai-qdrant \
    -p 6333:6333 \
    -p 6334:6334 \
    -v "$HOME/.fazai/qdrant_storage:/qdrant/storage:z" \
    qdrant/qdrant:latest

  # Aguardar inicialização
  info "Aguardando Qdrant inicializar..."
  for i in {1..30}; do
    if curl -sf "$QDRANT_DEFAULT_URL/collections" > /dev/null 2>&1; then
      success "Qdrant instalado e rodando!"
      return 0
    fi
    sleep 1
  done

  error "Qdrant não iniciou corretamente. Verifique: docker logs fazai-qdrant"
}

# Instalar Qdrant via Podman
install_qdrant_podman() {
  if ! command -v podman &> /dev/null; then
    error "Podman não encontrado. Instale Podman primeiro: https://podman.io/getting-started/installation"
  fi

  info "Instalando Qdrant via Podman..."

  # Parar container existente se houver
  podman stop fazai-qdrant 2>/dev/null || true
  podman rm fazai-qdrant 2>/dev/null || true

  # Criar volume para persistência
  mkdir -p "$HOME/.fazai/qdrant_storage"

  # Iniciar Qdrant
  podman run -d \
    --name fazai-qdrant \
    -p 6333:6333 \
    -p 6334:6334 \
    -v "$HOME/.fazai/qdrant_storage:/qdrant/storage:z" \
    qdrant/qdrant:latest

  # Aguardar inicialização
  info "Aguardando Qdrant inicializar..."
  for i in {1..30}; do
    if curl -sf "$QDRANT_DEFAULT_URL/collections" > /dev/null 2>&1; then
      success "Qdrant instalado e rodando!"
      return 0
    fi
    sleep 1
  done

  error "Qdrant não iniciou corretamente. Verifique: podman logs fazai-qdrant"
}

# Instalar Qdrant via binário
install_qdrant_binary() {
  info "Instalando Qdrant via binário nativo..."

  # Detectar arquitetura
  local arch=$(uname -m)
  local qdrant_arch=""

  case $arch in
    x86_64)
      qdrant_arch="x86_64"
      ;;
    aarch64|arm64)
      qdrant_arch="aarch64"
      ;;
    *)
      error "Arquitetura $arch não suportada. Use Docker/Podman."
      ;;
  esac

  # Download da última versão
  local qdrant_version="v1.7.4"
  local qdrant_url="https://github.com/qdrant/qdrant/releases/download/${qdrant_version}/qdrant-${qdrant_arch}-unknown-linux-musl.tar.gz"

  info "Baixando Qdrant $qdrant_version..."
  wget -q -O /tmp/qdrant.tar.gz "$qdrant_url" || error "Falha ao baixar Qdrant"

  # Extrair
  tar -xzf /tmp/qdrant.tar.gz -C /tmp/

  # Instalar
  if [ "$EUID" -eq 0 ] || sudo -n true 2>/dev/null; then
    sudo mv /tmp/qdrant /usr/local/bin/
    sudo chmod +x /usr/local/bin/qdrant
    success "Qdrant instalado em /usr/local/bin/qdrant"
  else
    mkdir -p "$HOME/.local/bin"
    mv /tmp/qdrant "$HOME/.local/bin/"
    chmod +x "$HOME/.local/bin/qdrant"
    success "Qdrant instalado em $HOME/.local/bin/qdrant"
  fi

  # Criar diretório de dados
  mkdir -p "$HOME/.fazai/qdrant"

  # Criar serviço systemd (se tiver permissão)
  if [ "$EUID" -eq 0 ] || sudo -n true 2>/dev/null; then
    info "Criando serviço systemd..."
    sudo tee /etc/systemd/system/qdrant.service > /dev/null <<SYSTEMD
[Unit]
Description=Qdrant Vector Database
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$HOME/.fazai/qdrant
ExecStart=/usr/local/bin/qdrant
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SYSTEMD

    sudo systemctl daemon-reload
    sudo systemctl enable qdrant
    sudo systemctl start qdrant

    # Aguardar inicialização
    info "Aguardando Qdrant inicializar..."
    for i in {1..30}; do
      if curl -sf "$QDRANT_DEFAULT_URL/collections" > /dev/null 2>&1; then
        success "Qdrant instalado e rodando como serviço systemd!"
        return 0
      fi
      sleep 1
    done
  else
    warning "Sem sudo. Inicie manualmente: qdrant"
    info "Para iniciar: cd ~/.fazai/qdrant && qdrant"
  fi
}

# Verificar Qdrant (mantido para compatibilidade)
check_qdrant() {
  if ! curl -sf "$QDRANT_DEFAULT_URL/collections" > /dev/null 2>&1; then
    warning "Qdrant não está rodando em $QDRANT_DEFAULT_URL"
    return 1
  fi
  return 0
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
  echo ""
  echo -e "  ${BLUE}1.${NC} Reinicie seu terminal ou rode:"
  echo -e "     ${CYAN}source ~/.bashrc${NC}  # ou ~/.zshrc"
  echo ""
  echo -e "  ${BLUE}2.${NC} Configure suas API keys:"
  echo -e "     ${CYAN}nano ~/.config/fazai/fazai.conf${NC}"
  echo ""
  echo -e "  ${BLUE}3.${NC} Inicie o Qdrant (se ainda não estiver rodando):"
  echo -e "     ${CYAN}docker run -d -p 6333:6333 qdrant/qdrant${NC}"
  echo ""
  echo -e "  ${BLUE}4.${NC} Crie as collections:"
  echo -e "     ${CYAN}fazai vector validate${NC}"
  echo ""
  echo -e "  ${BLUE}5.${NC} Execute o FazAI:"
  echo -e "     ${CYAN}fazai${NC}                    # Modo admin Linux"
  echo -e "     ${CYAN}fazai --cli${NC}              # Modo CLI interativo"
  echo -e "     ${CYAN}fazai ask \"pergunta\"${NC}    # Perguntas gerais"
  echo ""
  echo -e "${CYAN}📖 Documentação:${NC} $INSTALL_DIR/README.md"
  echo -e "${CYAN}🐛 Issues:${NC} https://github.com/rogerluft/fazai-ng/issues"
  echo ""
  echo -e "${GREEN}Bora administrar! 🚀${NC}"
  echo ""
}

# Main
main() {
  print_banner
  check_dependencies
  setup_directories
  clone_repo
  install_deps
  build_project
  create_symlink
  setup_path
  setup_config
  install_qdrant  # Instalação interativa do Qdrant
  setup_collections
  print_success
}

# Executar
main "$@"
