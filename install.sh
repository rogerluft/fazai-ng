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

# Clonar repositório
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
        rm -rf "$INSTALL_DIR"
        git clone "$REPO_URL" "$INSTALL_DIR" || error "Falha ao clonar"
        success "Repositório clonado"
        return
      fi

      # Verificar se tem commits
      if ! git rev-parse HEAD > /dev/null 2>&1; then
        warning "Repositório sem commits, recriando..."
        cd /
        rm -rf "$INSTALL_DIR"
        git clone "$REPO_URL" "$INSTALL_DIR" || error "Falha ao clonar"
        success "Repositório clonado"
        return
      fi

      # Salvar mudanças locais se houver
      if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
        warning "Detectadas mudanças locais. Fazendo stash..."
        git stash push -m "Install script auto-stash $(date +%Y-%m-%d_%H:%M:%S)" || true
      fi

      # Detectar branch principal
      local main_branch=$(git remote show origin 2>/dev/null | grep "HEAD branch" | cut -d: -f2 | tr -d ' ')
      if [ -z "$main_branch" ]; then
        main_branch="master"
      fi

      # Atualizar repositório
      git fetch origin 2>/dev/null || {
        warning "Fetch falhou, reconfigurando remote..."
        git remote set-url origin "$REPO_URL"
        git fetch origin || warning "Fetch ainda falhou, usando código atual"
      }
      
      git reset --hard "origin/$main_branch" 2>/dev/null || warning "Reset falhou, usando estado atual"
      git pull origin "$main_branch" 2>/dev/null || warning "Pull falhou, usando código atual"

      success "Repositório atualizado"
    else
      # Backup e clonar
      warning "Diretório existe mas não é git"
      local backup_dir="${INSTALL_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
      info "Criando backup em $backup_dir..."
      mv "$INSTALL_DIR" "$backup_dir"
      git clone "$REPO_URL" "$INSTALL_DIR" || error "Falha ao clonar"
      success "Repositório clonado (backup criado)"
    fi
  else
    git clone "$REPO_URL" "$INSTALL_DIR" || error "Falha ao clonar"
    success "Repositório clonado"
  fi













}

# Instalar dependências
install_deps() {
  info "Instalando dependências Node.js..."
  cd "$INSTALL_DIR"
  
  # Verificar se package.json existe
  if [ ! -f "package.json" ]; then
    error "package.json não encontrado em $INSTALL_DIR"
  fi
  
  # Limpar instalações anteriores problemáticas
  if [ -d "node_modules" ]; then
    warning "Removendo node_modules antigo..."
    rm -rf node_modules
  fi
  
  if [ -f "package-lock.json" ]; then
    rm -f package-lock.json
  fi
  
  # Instalar TODAS as dependências (incluindo devDependencies para build)
  local npm_log="${TMPDIR:-/tmp}/fazai-npm-$$.log"
  if npm install --silent > "$npm_log" 2>&1; then
    success "Dependências instaladas ($(ls node_modules | wc -l) pacotes)"

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
  
  # Verificar arquivos necessários
  if [ ! -f "tsconfig.json" ]; then
    error "tsconfig.json não encontrado em $INSTALL_DIR. Repositório incompleto?"
  fi
  
  if [ ! -f "tsup.config.js" ]; then
    error "tsup.config.js não encontrado em $INSTALL_DIR. Repositório incompleto?"
  fi
  
  # Limpar build anterior
  if [ -d "dist" ]; then
    rm -rf dist
  fi
  
  # Build com output
  local build_log="${TMPDIR:-/tmp}/fazai-build-$$.log"
  npm run build > "$build_log" 2>&1
  local build_status=$?
  
  # Verificar se dist/app.cjs foi criado (arquivo principal, não stderr)
  if [ ! -f "dist/app.cjs" ]; then
    error "Build falhou: dist/app.cjs não foi criado. Verifique $build_log"
  fi
  
  if [ $build_status -eq 0 ]; then
    local dist_size=$(du -h dist/app.cjs | cut -f1)
    success "Build concluído (dist/app.cjs: $dist_size)"
    rm -f "$build_log"
  else
    warning "Build teve avisos mas arquivo foi criado. Verifique $build_log"
  fi
}

# Criar ponto de entrada no PATH
create_entry_point() {
  info "Criando ponto de entrada em /usr/local/bin/fazai..."
  
  local entry_point="/usr/local/bin/fazai"
  local target_executable="/opt/fazai/bin/fazai"

  if [ "$EUID" -ne 0 ] && ! sudo -n true 2>/dev/null; then
    fail "Permissão de superusuário (sudo) é necessária para criar o link em ${entry_point}"
  fi
  
  info "Garantindo que o alvo '${target_executable}' seja executável..."
  sudo chmod +x "$target_executable"

  info "Criando link simbólico: ${entry_point} -> ${target_executable}"
  # Use ln -sf para forçar a sobreposição de qualquer link ou arquivo antigo
  sudo ln -sf "$target_executable" "$entry_point"
  
  # Verificar
  if [ "$(readlink -f "$entry_point")" == "$target_executable" ]; then
    success "Ponto de entrada criado com sucesso."
  else
    fail "Falha ao criar ou verificar o ponto de entrada."
  fi
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
    # Criar diretório de scripts se não existir
    sudo mkdir -p /opt/fazai/scripts

    # Copiar script
    sudo cp "$FZSAMBA_SOURCE" "$FZSAMBA_TARGET"
    sudo chmod +x "$FZSAMBA_TARGET"

    # Instalar bash completion do fzsamba
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
  # Use simple name 'fazai' to avoid duplicates
  local COMPLETION_TARGET="/etc/bash_completion.d/fazai"

  if [ -f "$COMPLETION_SOURCE" ]; then
    if [ -d /etc/bash_completion.d ]; then
      if [ "$EUID" -eq 0 ]; then
        cp "$COMPLETION_SOURCE" "$COMPLETION_TARGET"
      else
        sudo cp "$COMPLETION_SOURCE" "$COMPLETION_TARGET"
      fi
      success "Bash completion instalado em $COMPLETION_TARGET"
    else
      warning "Diretório /etc/bash_completion.d não existe. Completion não instalado."
    fi
  else
    # Tentar gerar dinamicamente usando o comando fazai completion
    if command -v fazai &> /dev/null; then
      if [ -d /etc/bash_completion.d ]; then
        info "Gerando completion dinamicamente..."
        fazai completion bash | sudo tee "$COMPLETION_TARGET" > /dev/null 2>&1
        success "Bash completion gerado e instalado"
      fi
    else
      warning "Arquivo de completion não encontrado em $COMPLETION_SOURCE"
    fi
  fi
}

# Instalar fzalias
install_fzalias_system() {
  info "Instalando fzalias (sistema de aliases global)..."

  if [ -f "$INSTALL_DIR/scripts/fzalias" ]; then
    if [ "$EUID" -eq 0 ]; then
      bash "$INSTALL_DIR/scripts/fzalias" install
      success "fzalias instalado"
    else
      sudo bash "$INSTALL_DIR/scripts/fzalias" install
      success "fzalias instalado"
    fi
  else
    warning "Script fzalias não encontrado em $INSTALL_DIR/scripts/"
  fi

  # Injetar source no /etc/bashrc (Fedora/RHEL) ou /etc/bash.bashrc (Debian/Ubuntu)
  info "Configurando carregamento automático de aliases..."

  local BASHRC_FILE=""
  if [ -f /etc/bashrc ]; then
    BASHRC_FILE="/etc/bashrc"
  elif [ -f /etc/bash.bashrc ]; then
    BASHRC_FILE="/etc/bash.bashrc"
  fi

  if [ -n "$BASHRC_FILE" ]; then
    # Verifica se já tem a linha
    if ! grep -q "source /etc/fazai/fzalias" "$BASHRC_FILE" 2>/dev/null; then
      if [ "$EUID" -eq 0 ]; then
        echo -e "\n# FazAI aliases\n[ -f /etc/fazai/fzalias ] && source /etc/fazai/fzalias" >> "$BASHRC_FILE"
      else
        echo -e "\n# FazAI aliases\n[ -f /etc/fazai/fzalias ] && source /etc/fazai/fzalias" | sudo tee -a "$BASHRC_FILE" > /dev/null
      fi
      success "Aliases serão carregados automaticamente em novas sessões"
    else
      success "Carregamento automático de aliases já configurado"
    fi
  else
    warning "Não foi possível configurar carregamento automático (bashrc não encontrado)"
  fi
}

# Configurar fazai.conf
setup_config() {
  local user_config="$HOME/.config/fazai/fazai.conf"
  local system_config="/etc/fazai/fazai.conf"

  # Configuração do usuário
  if [ -f "$user_config" ]; then
    warning "Configuração do usuário já existe: $user_config"
    echo ""
    read -p "Deseja reconfigurar API keys? [s/N]: " reconfig
    if [[ "$reconfig" =~ ^[Ss]$ ]]; then
      configure_api_keys "$user_config"
    fi
  else
    info "Criando configuração do usuário..."
    create_config_file "$user_config"
    success "Config do usuário criada: $user_config"
    echo ""
    configure_api_keys "$user_config"
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

# Configurar API keys interativamente
configure_api_keys() {
  local config_file="$1"
  
  echo -e "\n${CYAN}═══════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}║  Configuração de API Keys                           ║${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}\n"
  
  echo -e "${YELLOW}Escolha qual provider de IA deseja configurar:${NC}"
  echo -e "  ${BLUE}1.${NC} OpenRouter (GRÁTIS: Qwen3 Coder 480B) - Recomendado"
  echo -e "  ${BLUE}2.${NC} Ollama (Local ou Remoto)"
  echo -e "  ${BLUE}3.${NC} Ambos (OpenRouter + Ollama)"
  echo -e "  ${BLUE}4.${NC} Pular (configurar manualmente depois)"
  echo ""
  
  read -p "Opção [1-4]: " provider_choice
  
  case "$provider_choice" in
    1)
      echo ""
      echo -e "${CYAN}OpenRouter:${NC}"
      echo -e "→ Acesse: ${BLUE}https://openrouter.ai/keys${NC}"
      echo -e "→ ${GREEN}FREE tier:${NC} qwen/qwen3-coder:free (Qwen3 Coder 480B A35B)"
      echo -e "→ Crie uma conta e gere sua API key"
      echo ""
      read -p "Cole sua API key (sk-or-v1-...): " openrouter_key
      if [ -n "$openrouter_key" ]; then
        sed -i "s|^OPENROUTER_API_KEY=.*|OPENROUTER_API_KEY=$openrouter_key|" "$config_file"
        sed -i "s|^# OPENROUTER_API_KEY=.*|OPENROUTER_API_KEY=$openrouter_key|" "$config_file"
        sed -i "s|^DEFAULT_MODEL=.*|DEFAULT_MODEL=qwen/qwen3-coder:free|" "$config_file"
        sed -i "s|^# DEFAULT_MODEL=.*|DEFAULT_MODEL=qwen/qwen3-coder:free|" "$config_file"
        success "OpenRouter configurado! Modelo: qwen/qwen3-coder:free"
      fi
      ;;
    2)
      echo ""
      echo -e "${CYAN}Ollama (Remoto):${NC}"
      configure_ollama
      ;;
    3)
      echo ""
      echo -e "${CYAN}OpenRouter + Ollama:${NC}"
      echo ""
      read -p "Cole sua API key OpenRouter (sk-or-v1-...): " openrouter_key
      if [ -n "$openrouter_key" ]; then
        sed -i "s|^OPENROUTER_API_KEY=.*|OPENROUTER_API_KEY=$openrouter_key|" "$config_file"
        sed -i "s|^# OPENROUTER_API_KEY=.*|OPENROUTER_API_KEY=$openrouter_key|" "$config_file"
        sed -i "s|^DEFAULT_MODEL=.*|DEFAULT_MODEL=qwen/qwen3-coder:free|" "$config_file"
        sed -i "s|^# DEFAULT_MODEL=.*|DEFAULT_MODEL=qwen/qwen3-coder:free|" "$config_file"
        sed -i "s|^FAST_MODEL=.*|FAST_MODEL=ollama/gptoss-20b|" "$config_file"
        sed -i "s|^# FAST_MODEL=.*|FAST_MODEL=ollama/gptoss-20b|" "$config_file"
        success "OpenRouter configurado!"
      fi
      echo ""
      configure_ollama
      ;;
    4)
      warning "API keys não configuradas - edite ~/.config/fazai/fazai.conf manualmente"
      ;;
    *)
      warning "Opção inválida - API keys não configuradas"
      ;;
  esac
}

# Função separada para configurar Ollama
configure_ollama() {
  echo -e "${CYAN}Ollama (Local ou Remoto):${NC}"
  echo -e "→ Local: http://localhost:11434 (padrão)"
  echo -e "→ Remoto: Configure URL personalizada se usar servidor remoto"
  local ollama_url="http://localhost:11434"
  read -p "URL do Ollama [$ollama_url]: " custom_ollama_url
  ollama_url="${custom_ollama_url:-$ollama_url}"
  
  # Testa conexão
  echo -e "${YELLOW}Testando conexão com $ollama_url...${NC}"
  if curl -s --max-time 3 "$ollama_url/api/tags" &> /dev/null; then
    sed -i "s|^OLLAMA_BASE_URL=.*|OLLAMA_BASE_URL=$ollama_url|" "$config_file"
    sed -i "s|^# OLLAMA_BASE_URL=.*|OLLAMA_BASE_URL=$ollama_url|" "$config_file"
    sed -i "s|^LOCAL_MODEL=.*|LOCAL_MODEL=ollama/gptoss-20b|" "$config_file"
    sed -i "s|^# LOCAL_MODEL=.*|LOCAL_MODEL=ollama/gptoss-20b|" "$config_file"
    success "Ollama configurado e acessível: $ollama_url (gptoss-20b)"
  else
    warning "Ollama não acessível em $ollama_url"
    echo -e "→ Se local, instale: ${CYAN}curl -fsSL https://ollama.com/install.sh | sh${NC}"
    echo -e "→ Depois rode: ${CYAN}ollama pull gptoss-20b${NC}"
    echo -e "→ Se remoto, verifique:"
    echo -e "   - Servidor está rodando?"
    echo -e "   - Firewall permite porta 11434?"
    echo -e "   - Rede local acessível?"
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
# Jules API (Google AI Coding Agent)
# ============================================
# Jules é o agente de IA do Google para mudanças de código autônomas
# Obter em: https://jules.google/settings (seção API Keys)
# Documentação: https://jules.google/docs/api/reference/
JULES_API_KEY=

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
# Local LLM (llama.cpp + Phi-3-mini)
# ============================================
# llama-server local (zero custo, privacidade total)
# Instalado automaticamente via install.sh
LLAMA_SERVER_URL=http://localhost:11430
LLAMA_TIMEOUT=10000
LLAMA_RETRIES=3
LLAMA_TEMPERATURE=0.7
LLAMA_MAX_TOKENS=2048
MODELS_LLAMA=phi3-mini

# ============================================
# Agentic Loop Safeguards
# ============================================
# Proteção contra loops infinitos no modo agêntico
AGENTIC_MAX_ITERATIONS=5
AGENTIC_TIMEOUT=120000

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

  # Modo não-interativo: tenta Docker automaticamente
  if [ -n "$FAZAI_AUTO_INSTALL" ]; then
    info "Modo auto-install: tentando Docker..."
    install_qdrant_docker && return 0
    warning "Docker falhou, tentando Podman..."
    install_qdrant_podman && return 0
    warning "Containers falharam. Qdrant não instalado."
    return 1
  fi

  # Modo interativo
  echo ""
  echo -e "${YELLOW}Qdrant não está rodando. Deseja instalar?${NC}"
  echo -e "${CYAN}1)${NC} Docker (recomendado - auto-instala se necessário)"
  echo -e "${CYAN}2)${NC} Podman (auto-instala se necessário)"
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
    warning "Docker não encontrado. Tentando instalar automaticamente..."
    
    # Detectar gerenciador de pacotes
    if command -v apt-get &> /dev/null; then
      info "Instalando Docker via apt..."
      sudo apt-get update -qq
      sudo apt-get install -y docker.io docker-compose
      sudo systemctl start docker
      sudo systemctl enable docker
      sudo usermod -aG docker "$USER" || true
      success "Docker instalado via apt!"
    elif command -v yum &> /dev/null; then
      info "Instalando Docker via yum..."
      sudo yum install -y docker
      sudo systemctl start docker
      sudo systemctl enable docker
      sudo usermod -aG docker "$USER" || true
      success "Docker instalado via yum!"
    elif command -v dnf &> /dev/null; then
      info "Instalando Docker via dnf..."
      sudo dnf install -y docker
      sudo systemctl start docker
      sudo systemctl enable docker
      sudo usermod -aG docker "$USER" || true
      success "Docker instalado via dnf!"
    else
      error "Gerenciador de pacotes não suportado. Instale Docker manualmente: https://docs.docker.com/get-docker/"
    fi
    
    # Verificar instalação
    if ! command -v docker &> /dev/null; then
      error "Falha ao instalar Docker automaticamente"
    fi
    
    warning "Docker instalado! Pode ser necessário fazer logout/login para usar sem sudo."
  fi

  info "Instalando Qdrant via Docker..."

  # Parar container existente se houver
  docker stop qdrant 2>/dev/null || true
  docker rm qdrant 2>/dev/null || true

  # Criar volume para persistência
  sudo mkdir -p /opt/fazai/qdrant_storage
  sudo chown $(whoami):$(whoami) /opt/fazai/qdrant_storage

  # Instalar systemd service
  if [ -f "$INSTALL_DIR/etc/fazai/qdrant.service" ]; then
    info "Instalando serviço systemd para Qdrant..."

    # Substituir podman por docker e configurar User/Group dinamicamente
    sudo sed 's/podman/docker/g' "$INSTALL_DIR/etc/fazai/qdrant.service" > /tmp/qdrant.service
    sudo sed -i "s/# User=fazai_user/User=$(whoami)/" /tmp/qdrant.service
    sudo sed -i "s/# Group=fazai_group/Group=$(id -gn)/" /tmp/qdrant.service
    sudo mv /tmp/qdrant.service /etc/systemd/system/qdrant.service
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

    error "Qdrant não iniciou. Verifique: sudo journalctl -u qdrant -n 50"
  else
    warning "Service file não encontrado. Instalando manualmente..."

    # Fallback para instalação manual (modo antigo)
    docker run -d \
      --name qdrant \
      --restart unless-stopped \
      -p 6333:6333 \
      -p 6334:6334 \
      -v /opt/fazai/qdrant_storage:/qdrant/storage:z \
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

    error "Qdrant não iniciou corretamente. Verifique: docker logs qdrant"
  fi
}

# Instalar Qdrant via Podman
install_qdrant_podman() {
  if ! command -v podman &> /dev/null; then
    warning "Podman não encontrado. Tentando instalar automaticamente..."
    
    # Detectar gerenciador de pacotes
    if command -v apt-get &> /dev/null; then
      info "Instalando Podman via apt..."
      sudo apt-get update -qq
      sudo apt-get install -y podman
      success "Podman instalado via apt!"
    elif command -v yum &> /dev/null; then
      info "Instalando Podman via yum..."
      sudo yum install -y podman
      success "Podman instalado via yum!"
    elif command -v dnf &> /dev/null; then
      info "Instalando Podman via dnf..."
      sudo dnf install -y podman
      success "Podman instalado via dnf!"
    else
      error "Gerenciador de pacotes não suportado. Instale Podman manualmente: https://podman.io/getting-started/installation"
    fi
    
    # Verificar instalação
    if ! command -v podman &> /dev/null; then
      error "Falha ao instalar Podman automaticamente"
    fi
  fi

  info "Instalando Qdrant via Podman..."

  # Parar container existente se houver
  podman stop qdrant 2>/dev/null || true
  podman rm qdrant 2>/dev/null || true

  # Criar volume para persistência
  sudo mkdir -p /opt/fazai/qdrant_storage
  sudo chown $(whoami):$(whoami) /opt/fazai/qdrant_storage

  # Instalar systemd service
  if [ -f "$INSTALL_DIR/etc/fazai/qdrant.service" ]; then
    info "Instalando serviço systemd para Qdrant..."

    # Copiar e configurar User/Group dinamicamente
    sudo cp "$INSTALL_DIR/etc/fazai/qdrant.service" /etc/systemd/system/qdrant.service
    sudo sed -i "s/# User=fazai_user/User=$(whoami)/" /etc/systemd/system/qdrant.service
    sudo sed -i "s/# Group=fazai_group/Group=$(id -gn)/" /etc/systemd/system/qdrant.service
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

    error "Qdrant não iniciou. Verifique: sudo journalctl -u qdrant -n 50"
  else
    warning "Service file não encontrado. Instalando manualmente..."

    # Fallback para instalação manual (modo antigo)
    podman run -d \
      --name qdrant \
      --restart unless-stopped \
      -p 6333:6333 \
      -p 6334:6334 \
      -v /opt/fazai/qdrant_storage:/qdrant/storage:z \
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

    error "Qdrant não iniciou corretamente. Verifique: podman logs qdrant"
  fi
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
  mkdir -p /opt/fazai/qdrant

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
WorkingDirectory=/opt/fazai/qdrant
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
    info "Para iniciar: cd /opt/fazai/qdrant && qdrant"
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

# =============================================================================
# LLAMA.CPP + PHI-3-MINI (Modelo Local)
# =============================================================================

# Instalar llama.cpp + Phi-3-mini
install_llama_cpp() {
  info "Verificando llama.cpp..."

  # Verificar se já está instalado
  if command -v llama-server &> /dev/null; then
    success "llama-server já instalado: $(which llama-server)"
    # Verificar modelo
    if [ -f "/opt/fazai/models/phi3/Phi-3-mini-4k-instruct-q4.gguf" ]; then
      success "Modelo Phi-3-mini já existe"
      return 0
    else
      info "llama-server instalado mas modelo não encontrado. Baixando..."
      download_phi3_model
      return $?
    fi
  fi

  echo ""
  echo -e "${YELLOW}llama.cpp não encontrado. Deseja instalar?${NC}"
  echo -e "${CYAN}Isso instalará:${NC}"
  echo -e "  - llama.cpp (compilado do fonte)"
  echo -e "  - Phi-3-mini-4k-instruct (~2.4GB)"
  echo -e "  - Serviço systemd (fazai-llama)"
  echo ""
  read -p "Instalar llama.cpp + Phi-3? [S/n]: " install_llama

  if [[ "$install_llama" =~ ^[Nn]$ ]]; then
    warning "llama.cpp não instalado. Pule esta etapa."
    return 1
  fi

  # Instalar dependências de build
  info "Instalando dependências de build..."
  if command -v dnf &> /dev/null; then
    sudo dnf install -y cmake make gcc-c++ git wget
  elif command -v apt-get &> /dev/null; then
    sudo apt-get update -qq
    sudo apt-get install -y cmake make g++ git wget
  elif command -v yum &> /dev/null; then
    sudo yum install -y cmake make gcc-c++ git wget
  else
    error "Gerenciador de pacotes não suportado. Instale cmake, make, g++, wget manualmente."
  fi

  # Clone llama.cpp
  info "Clonando llama.cpp..."
  if [ -d "/opt/fazai/llama.cpp" ]; then
    warning "Diretório llama.cpp existe. Atualizando..."
    cd /opt/fazai/llama.cpp
    git pull origin master || warning "Falha ao atualizar, usando versão atual"
  else
    git clone --depth 1 https://github.com/ggerganov/llama.cpp /opt/fazai/llama.cpp || {
      error "Falha ao clonar llama.cpp"
    }
  fi

  # Build
  info "Compilando llama.cpp (pode demorar alguns minutos)..."
  cd /opt/fazai/llama.cpp
  cmake -B build -DCMAKE_BUILD_TYPE=Release || {
    error "Falha no cmake configure"
  }
  cmake --build build --config Release -j$(nproc) || {
    error "Falha no build"
  }

  # Verificar binários
  if [ ! -f "build/bin/llama-server" ]; then
    error "Build falhou: llama-server não encontrado em build/bin/"
  fi

  # Symlink para PATH
  sudo ln -sf /opt/fazai/llama.cpp/build/bin/llama-server /usr/local/bin/llama-server
  sudo ln -sf /opt/fazai/llama.cpp/build/bin/llama-cli /usr/local/bin/llama-cli

  success "llama.cpp compilado e instalado!"
  success "Binários: llama-server, llama-cli"

  # Baixar modelo Phi-3-mini
  download_phi3_model

  # Instalar serviço systemd
  install_llama_service
}

# Baixar modelo Phi-3-mini
download_phi3_model() {
  local MODEL_DIR="/opt/fazai/models/phi3"
  # CORREÇÃO: Nome correto do arquivo no repositório oficial Microsoft
  local MODEL_FILE="Phi-3-mini-4k-instruct-q4.gguf"
  local MODEL_URL="https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf"

  info "Configurando diretório de modelos..."
  sudo mkdir -p "$MODEL_DIR"

  # Criar grupo fazai se não existir
  if ! getent group fazai > /dev/null 2>&1; then
    sudo groupadd -f fazai
  fi

  sudo chown -R root:fazai "$MODEL_DIR"
  sudo chmod -R 774 "$MODEL_DIR"

  if [ -f "$MODEL_DIR/$MODEL_FILE" ]; then
    local file_size=$(stat -c%s "$MODEL_DIR/$MODEL_FILE" 2>/dev/null || echo "0")
    if [ "$file_size" -gt 1000000000 ]; then
      success "Modelo Phi-3-mini já existe: $MODEL_DIR/$MODEL_FILE ($(numfmt --to=iec $file_size))"
      return 0
    else
      warning "Arquivo de modelo existe mas parece incompleto. Rebaixando..."
      rm -f "$MODEL_DIR/$MODEL_FILE"
    fi
  fi

  info "Baixando Phi-3-mini (~2.4GB)..."
  info "Isso pode demorar dependendo da sua conexão..."

  # Tentar download sem autenticação (modelo público)
  if wget --progress=bar:force -O "$MODEL_DIR/$MODEL_FILE" "$MODEL_URL" 2>&1; then
    local downloaded_size=$(stat -c%s "$MODEL_DIR/$MODEL_FILE" 2>/dev/null || echo "0")
    if [ "$downloaded_size" -gt 1000000000 ]; then
      success "Modelo Phi-3-mini baixado! ($(numfmt --to=iec $downloaded_size))"
      return 0
    else
      warning "Download parece incompleto. Tentando com token HuggingFace..."
      rm -f "$MODEL_DIR/$MODEL_FILE"
    fi
  else
    warning "Download falhou. Tentando com token HuggingFace..."
  fi

  # Verificar se tem token no conf
  local HF_TOKEN=""
  if [ -f "/etc/fazai/fazai.conf" ]; then
    HF_TOKEN=$(grep "^HF_TOKEN=" /etc/fazai/fazai.conf 2>/dev/null | cut -d= -f2)
  fi

  if [ -z "$HF_TOKEN" ]; then
    echo ""
    echo -e "${YELLOW}Token HuggingFace pode ser necessário para download.${NC}"
    echo -e "Obtenha em: ${CYAN}https://huggingface.co/settings/tokens${NC}"
    read -p "Cole seu token HF (ou Enter para pular): " HF_TOKEN

    if [ -n "$HF_TOKEN" ]; then
      # Salvar token no conf
      if [ -f "/etc/fazai/fazai.conf" ]; then
        if grep -q "^HF_TOKEN=" /etc/fazai/fazai.conf 2>/dev/null; then
          sudo sed -i "s|^HF_TOKEN=.*|HF_TOKEN=$HF_TOKEN|" /etc/fazai/fazai.conf
        else
          echo "HF_TOKEN=$HF_TOKEN" | sudo tee -a /etc/fazai/fazai.conf > /dev/null
        fi
        success "Token HF salvo em /etc/fazai/fazai.conf"
      fi
    fi
  fi

  if [ -n "$HF_TOKEN" ]; then
    wget --progress=bar:force --header="Authorization: Bearer $HF_TOKEN" -O "$MODEL_DIR/$MODEL_FILE" "$MODEL_URL" 2>&1 || {
      error "Falha no download do modelo. Verifique sua conexão e token."
    }
    success "Modelo Phi-3-mini baixado com token!"
  else
    warning "Download sem token falhou e nenhum token fornecido."
    warning "Baixe manualmente: $MODEL_URL"
    warning "Coloque em: $MODEL_DIR/$MODEL_FILE"
    return 1
  fi
}

# Instalar serviço systemd para llama-server
install_llama_service() {
  info "Instalando serviço systemd fazai-llama..."

  # Copiar arquivo de serviço
  if [ -f "$INSTALL_DIR/etc/fazai/fazai-llama.service" ]; then
    sudo cp "$INSTALL_DIR/etc/fazai/fazai-llama.service" /etc/systemd/system/fazai-llama.service
  else
    # Criar serviço inline se arquivo não existir
    sudo tee /etc/systemd/system/fazai-llama.service > /dev/null <<'LLAMASERVICE'
[Unit]
Description=FazAI LLaMA Server (Phi-3-mini)
Documentation=https://github.com/ggerganov/llama.cpp
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=root
Group=fazai

# Garantir permissões
ExecStartPre=/bin/mkdir -p /var/log/fazai
ExecStartPre=/bin/chown root:fazai /var/log/fazai
ExecStartPre=/bin/chmod 774 /var/log/fazai
ExecStartPre=/bin/chown -R root:fazai /opt/fazai/models
ExecStartPre=/bin/chmod -R 774 /opt/fazai/models

WorkingDirectory=/opt/fazai/models/phi3

# Comando principal - Otimizado para alta memória + NUMA
ExecStart=/usr/local/bin/llama-server \
    --model /opt/fazai/models/phi3/Phi-3-mini-4k-instruct-q4.gguf \
    --host 0.0.0.0 \
    --port 11430 \
    --ctx-size 4096 \
    --threads 8 \
    --parallel 4 \
    --mlock \
    --numa distribute \
    --log-file /var/log/fazai/llama-server.log

Restart=on-failure
RestartSec=5

LimitNOFILE=65536
LimitMEMLOCK=infinity

StandardOutput=null
StandardError=journal
SyslogIdentifier=fazai-llama

[Install]
WantedBy=multi-user.target
LLAMASERVICE
  fi

  sudo systemctl daemon-reload
  sudo systemctl enable fazai-llama

  echo ""
  read -p "Iniciar serviço fazai-llama agora? [S/n]: " start_llama
  if [[ ! "$start_llama" =~ ^[Nn]$ ]]; then
    info "Iniciando fazai-llama (carregando modelo na memória, pode demorar)..."
    sudo systemctl start fazai-llama

    # Aguardar inicialização
    info "Aguardando llama-server inicializar (até 60s)..."
    for i in {1..60}; do
      if curl -sf "http://localhost:11430/health" > /dev/null 2>&1; then
        success "fazai-llama iniciado e respondendo!"
        info "Logs: journalctl -u fazai-llama -f"
        info "Status: systemctl status fazai-llama"
        return 0
      fi
      sleep 1
      echo -n "."
    done
    echo ""
    warning "llama-server ainda não respondeu. Verifique:"
    warning "  journalctl -u fazai-llama -n 50"
  else
    success "Serviço fazai-llama instalado (não iniciado)"
    info "Para iniciar: sudo systemctl start fazai-llama"
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

# Instalar Web Interface (opcional)
install_web_interface() {
  echo ""
  info "═══════════════════════════════════════════════════════"
  info "  Interface Web FazAI (Next.js) - Opcional"
  info "  Porta padrao: 3000 (configuravel em /etc/fazai/fazai.conf)"
  info "═══════════════════════════════════════════════════════"
  echo ""

  read -p "$(echo -e ${YELLOW}"Deseja instalar a interface web? [y/N]: "${NC})" -n 1 -r
  echo

  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    info "Interface web pulada. Instale manualmente:"
    info "  cd $INSTALL_DIR/web && npm install && npm run build"
    return 0
  fi

  # Verificar se diretório web existe
  if [ ! -d "$INSTALL_DIR/web" ]; then
    warning "Diretório web/ não encontrado. Interface web não disponível."
    return 1
  fi

  info "Instalando dependências da interface web em /opt/fazai/web..."
  cd "$INSTALL_DIR/web"

  # Verificar package.json
  if [ ! -f "package.json" ]; then
    warning "package.json não encontrado em web/"
    return 1
  fi

  # Instalar dependências
  npm install || {
    warning "Falha ao instalar dependências web. Continue manualmente."
    return 1
  }

  success "Dependências web instaladas em /opt/fazai/web"

  # Criar .env se não existir
  if [ ! -f ".env" ]; then
    info "Criando arquivo .env para interface web..."
    cp .env.example .env 2>/dev/null || cat > .env <<'WEBENV'
# Qdrant Vector Database
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# FazAI CLI Agent API
NEXT_PUBLIC_API_URL=http://localhost:3000

# WebSocket for real-time logs
NEXT_PUBLIC_WS_URL=ws://localhost:3000
WEBENV
    success "Arquivo .env criado"
  fi

  # Build da aplicação
  info "Construindo interface web (Next.js)... (pode demorar)"
  npm run build || {
    warning "Falha ao construir interface web. Tente manualmente:"
    warning "  cd $INSTALL_DIR/web && npm run build"
    return 1
  }

  success "Interface web instalada e construída!"

  # Oferecer criar serviço systemd
  if [ "$EUID" -eq 0 ] || sudo -n true 2>/dev/null; then
    echo ""
    read -p "$(echo -e ${YELLOW}"Criar serviço systemd para interface web? [y/N]: "${NC})" -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
      create_web_service
    else
      info "Para criar serviço manualmente:"
      info "  sudo cp $INSTALL_DIR/etc/fazai/fazai-web@.service /etc/systemd/system/"
      info "  sudo systemctl daemon-reload"
      info "  sudo systemctl enable fazai-web@\$(whoami)"
      info "  sudo systemctl start fazai-web@\$(whoami)"
    fi
  fi

  echo ""
  info "Para iniciar manualmente:"
  info "  cd $INSTALL_DIR/web && npm run dev    # Desenvolvimento (porta 3000)"
  info "  cd $INSTALL_DIR/web && npm start      # Producao (porta 3000)"
  info ""
  info "Configurar porta em /etc/fazai/fazai.conf:"
  info "  WEB_HOST=0.0.0.0   # Interface de escuta"
  info "  WEB_PORT=3000      # Porta do servidor"
}

# Criar serviço systemd para web
create_web_service() {
  local web_user=$(whoami)

  info "Criando serviço systemd fazai-web@$web_user..."

  # Copiar arquivo de serviço template
  sudo cp "$INSTALL_DIR/etc/fazai/fazai-web@.service" /etc/systemd/system/ || {
    warning "Falha ao copiar fazai-web@.service"
    return 1
  }

  sudo systemctl daemon-reload
  sudo systemctl enable "fazai-web@$web_user" || {
    warning "Falha ao habilitar serviço"
    return 1
  }

  sudo systemctl start "fazai-web@$web_user" || {
    warning "Falha ao iniciar serviço"
    warning "Verifique logs: sudo journalctl -u fazai-web@$web_user -n 50"
    return 1
  }

  # Aguardar inicialização
  sleep 3

  # Ler porta configurada (padrao 3000)
  local web_port=3000
  if [ -f "/etc/fazai/fazai.conf" ]; then
    web_port=$(grep -E "^WEB_PORT=" /etc/fazai/fazai.conf 2>/dev/null | cut -d= -f2 || echo "3000")
    web_port=${web_port:-3000}
  fi

  if systemctl is-active --quiet "fazai-web@$web_user"; then
    success "Serviço fazai-web@$web_user criado e iniciado!"
    info "Interface web disponível em: http://localhost:${web_port}"
    info "Logs: sudo journalctl -u fazai-web@$web_user -f"
  else
    warning "Serviço criado mas não está rodando"
    info "Verifique: sudo systemctl status fazai-web@$web_user"
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
  echo -e "  ${BLUE}2.${NC} Teste o sistema de aliases:"
  echo -e "     ${CYAN}fzalias ll 'ls -lh'${NC}        # Criar alias"
  echo -e "     ${CYAN}fzalias-list${NC}               # Listar aliases"
  echo ""
  echo -e "  ${BLUE}3.${NC} Configure suas API keys:"
  echo -e "     ${CYAN}nano /etc/fazai/fazai.conf${NC}"
  echo ""
  echo -e "  ${BLUE}4.${NC} Inicie o Qdrant (se ainda não estiver rodando):"
  echo -e "     ${CYAN}docker run -d -p 6333:6333 qdrant/qdrant${NC}"
  echo ""
  echo -e "  ${BLUE}5.${NC} Crie as collections:"
  echo -e "     ${CYAN}fazai vector validate${NC}"
  echo ""
  echo -e "  ${BLUE}6.${NC} Indexe seu código fonte (Metacognição):"
  echo -e "     ${CYAN}fazai index${NC}"
  echo ""
  echo -e "  ${BLUE}7.${NC} Execute o FazAI:"
  echo -e "     ${CYAN}fazai${NC}                    # Modo admin Linux"
  echo -e "     ${CYAN}fazai --cli${NC}              # Modo CLI interativo"
  echo -e "     ${CYAN}fazai ask \"pergunta\"${NC}    # Perguntas gerais"
  echo ""
  echo -e "  ${BLUE}8.${NC} Acesse a interface web (se instalada):"
  echo -e "     ${CYAN}http://localhost:3000${NC}    # Interface web"
  echo ""
  echo -e "  ${BLUE}9.${NC} Instale servicos systemd (opcional):"
  echo -e "     ${CYAN}sudo $INSTALL_DIR/scripts/systemd/install-services.sh${NC}"
  echo ""
  echo -e "${CYAN}📖 Documentação:${NC} $INSTALL_DIR/README.md"
  echo -e "${CYAN}🐛 Issues:${NC} https://github.com/rogerluft/fazai-ng/issues"
  echo ""
  echo -e "${GREEN}Bora administrar! 🚀${NC}"
  echo ""
}

# Main
main() {
  # Dev environment check
  if [ -f "scripts/link-for-dev.sh" ]; then
    echo -e "${YELLOW}ℹ Installer detected it's running from a local repository.${C_RESET}"
    read -p "$(echo -e ${CYAN}"Do you want to set up a development environment (symlinks /opt/fazai to this repo)? [Y/n] "${C_RESET})" dev_choice
    if [[ "$dev_choice" =~ ^[Yy]$ ]] || [[ -z "$dev_choice" ]]; then
      info "Starting development environment setup..."
      sudo bash scripts/link-for-dev.sh
      success "Development environment linked successfully."
      info "The 'fazai' command is now linked to this repository."
      exit 0
    else
      info "Proceeding with standard production installation..."
    fi
  fi

  print_banner
  check_dependencies
  setup_directories
  clone_repo
  install_deps
  build_project
  create_entry_point
  setup_path
  install_fzalias_system  # Instalar sistema de aliases global
  install_fzsamba         # Instalar gerenciador Samba
  install_fazai_completion  # Instalar bash completion do fazai
  setup_config
  install_qdrant  # Instalação interativa do Qdrant
  install_llama_cpp  # Instalação llama.cpp + Phi-3-mini (modelo local)
  setup_collections
  install_web_interface  # Instalação opcional da interface web

  # Setup environment alias and variables
  if [ -f "$INSTALL_DIR/scripts/setup-env.sh" ]; then
    info "Running environment setup..."
    bash "$INSTALL_DIR/scripts/setup-env.sh"
  fi

  # Setup log directory with proper permissions
  setup_log_directory

  # Instalar systemd services (opcional)
  if [ -f "$INSTALL_DIR/scripts/systemd/install-services.sh" ]; then
    echo ""
    read -p "Instalar serviços systemd (fazai-worker, fazai-skill-seeker)? [S/n]: " install_systemd
    if [[ "$install_systemd" =~ ^[Ss]$ ]] || [[ -z "$install_systemd" ]]; then
      info "Instalando serviços systemd..."
      if [ "$EUID" -eq 0 ]; then
        bash "$INSTALL_DIR/scripts/systemd/install-services.sh"
      else
        sudo bash "$INSTALL_DIR/scripts/systemd/install-services.sh"
      fi
      success "Serviços systemd instalados"
    fi
  fi

  print_success
}

# Setup /var/log/fazai with proper permissions
setup_log_directory() {
  local LOG_DIR="/var/log/fazai"
  local CURRENT_USER="${SUDO_USER:-$USER}"

  info "Configurando diretório de logs..."

  # Check if already writable
  if [ -d "$LOG_DIR" ] && [ -w "$LOG_DIR" ]; then
    success "Diretório de logs já configurado: $LOG_DIR"
    return 0
  fi

  # Create group fazai if it doesn't exist
  if ! getent group fazai > /dev/null 2>&1; then
    if [ "$EUID" -eq 0 ]; then
      groupadd -f fazai
    else
      sudo groupadd -f fazai
    fi
  fi

  # Add current user to fazai group and setup directory
  if [ "$EUID" -eq 0 ]; then
    usermod -aG fazai "$CURRENT_USER" 2>/dev/null || true
    mkdir -p "$LOG_DIR"
    chown "$CURRENT_USER:fazai" "$LOG_DIR"
    chmod 774 "$LOG_DIR"
  else
    sudo usermod -aG fazai "$CURRENT_USER" 2>/dev/null || true
    sudo mkdir -p "$LOG_DIR"
    sudo chown "$CURRENT_USER:fazai" "$LOG_DIR"
    sudo chmod 774 "$LOG_DIR"
  fi

  success "Diretório de logs configurado: $LOG_DIR ($CURRENT_USER:fazai 774)"
  success "Usuário $CURRENT_USER adicionado ao grupo 'fazai'"
}

# Executar
main "$@"
