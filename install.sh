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

  mkdir -p "$INSTALL_DIR"
  mkdir -p "$BIN_DIR"
  mkdir -p "$HOME/.fazai"
  mkdir -p "$HOME/.config/fazai"

  # Criar diretório de logs (tentar com sudo se necessário)
  if [ -w /var/log ]; then
    sudo mkdir -p /var/log/fazai 2>/dev/null || mkdir -p "$HOME/.fazai/logs"
    sudo chmod 775 /var/log/fazai 2>/dev/null || true
  else
    mkdir -p "$HOME/.fazai/logs"
  fi

  success "Diretórios criados"
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
  local config_file="$HOME/.config/fazai/fazai.conf"

  if [ -f "$config_file" ]; then
    warning "Arquivo de configuração já existe: $config_file"
    return
  fi

  info "Criando configuração inicial..."

  cat > "$config_file" << EOF
# FazAI v3.1-beta Configuration
# Administrador Linux Senior + Redes

# ============================================
# AI Providers (configure pelo menos um)
# ============================================

# Anthropic Claude (recomendado para admin Linux)
ANTHROPIC_API_KEY=

# OpenAI GPT
OPENAI_API_KEY=

# Ollama (local/gratuito)
OLLAMA_BASE_URL=http://localhost:11434

# ============================================
# Vector Store (Qdrant)
# ============================================
VECTOR_PROVIDER=qdrant
QDRANT_URL=$QDRANT_DEFAULT_URL
QDRANT_API_KEY=
VECTOR_DIMENSION=1536
VECTOR_DISTANCE=Cosine

# ============================================
# MCP Context7 Research
# ============================================
MCP_CONTEXT7_URL=
MCP_CONTEXT7_COMMAND=
MCP_CONTEXT7_API_KEY=
WEB_SEARCH_PROVIDER=duckduckgo
FAZAI_DISABLE_RESEARCH=false
FAZAI_RESEARCH_ON_FAILURE=true

# ============================================
# Logging
# ============================================
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/fazai/fazai.log
EOF

  success "Configuração criada: $config_file"
}

# Verificar Qdrant
check_qdrant() {
  info "Verificando Qdrant..."

  if curl -sf "$QDRANT_DEFAULT_URL/collections" > /dev/null 2>&1; then
    success "Qdrant rodando em $QDRANT_DEFAULT_URL"
  else
    warning "Qdrant não está rodando"
    echo ""
    echo -e "${YELLOW}Para instalar Qdrant com Docker:${NC}"
    echo -e "  ${CYAN}docker run -d -p 6333:6333 qdrant/qdrant${NC}"
    echo ""
  fi
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
  check_qdrant
  setup_collections
  print_success
}

# Executar
main "$@"
