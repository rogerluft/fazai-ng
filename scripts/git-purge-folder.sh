#!/usr/bin/env bash
# =============================================================================
# git-purge-folder.sh - Remove pasta permanentemente do histórico Git
# =============================================================================
# 
# Uso:
#   ./scripts/git-purge-folder.sh <path-to-remove> [--dry-run]
#
# Exemplos:
#   ./scripts/git-purge-folder.sh claudio15-11-25
#   ./scripts/git-purge-folder.sh "claudio*" --dry-run
#   ./scripts/git-purge-folder.sh Claudio* --glob
#
# Autor: FazAI Team
# Data: 2025-12-31
# =============================================================================

set -euo pipefail

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções de log
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Função de ajuda
show_help() {
    cat << EOF
${BLUE}git-purge-folder.sh${NC} - Remove pasta permanentemente do histórico Git

${YELLOW}USO:${NC}
    $0 <path-to-remove> [options]

${YELLOW}OPÇÕES:${NC}
    --dry-run       Simula a remoção sem fazer alterações
    --glob          Trata o path como padrão glob (ex: claudio*)
    --help, -h      Mostra esta ajuda

${YELLOW}EXEMPLOS:${NC}
    $0 claudio15-11-25
    $0 "claudio*" --glob --dry-run
    $0 restricted/secrets

${YELLOW}AVISOS:${NC}
    ⚠️  Esta operação é IRREVERSÍVEL
    ⚠️  Requer 'git push --force' após execução
    ⚠️  Todos colaboradores precisarão re-clonar o repositório

${YELLOW}PRÉ-REQUISITOS:${NC}
    - git-filter-repo instalado
    - Backup do repositório recomendado

EOF
}

# Verifica argumentos
if [[ $# -eq 0 ]] || [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    show_help
    exit 0
fi

PATH_TO_REMOVE="$1"
DRY_RUN=false
USE_GLOB=false

# Parse opções
shift
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --glob)
            USE_GLOB=true
            shift
            ;;
        *)
            log_error "Opção desconhecida: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
done

# Verifica se estamos em um repositório Git
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    log_error "Não estamos em um repositório Git"
    exit 1
fi

# Verifica se git-filter-repo está instalado
if ! command -v git-filter-repo &> /dev/null; then
    log_error "git-filter-repo não encontrado"
    echo ""
    echo "Instale com:"
    echo "  ${GREEN}sudo apt-get install git-filter-repo${NC}  # Ubuntu/Debian"
    echo "  ${GREEN}brew install git-filter-repo${NC}          # macOS"
    echo "  ${GREEN}pip install git-filter-repo${NC}           # Python pip"
    exit 1
fi

# Verifica se há mudanças não commitadas
if ! git diff-index --quiet HEAD --; then
    log_error "Há mudanças não commitadas no repositório"
    echo "Por favor, commit ou stash suas mudanças antes de continuar"
    exit 1
fi

# Banner de confirmação
echo ""
log_warning "═══════════════════════════════════════════════════════════════"
log_warning "  ATENÇÃO: OPERAÇÃO DESTRUTIVA"
log_warning "═══════════════════════════════════════════════════════════════"
echo ""
log_info "Path a remover: ${YELLOW}${PATH_TO_REMOVE}${NC}"
log_info "Modo glob: ${YELLOW}${USE_GLOB}${NC}"
log_info "Dry-run: ${YELLOW}${DRY_RUN}${NC}"
echo ""

if [[ "$DRY_RUN" == false ]]; then
    log_warning "Esta ação irá:"
    echo "  • Remover '${PATH_TO_REMOVE}' de TODO o histórico Git"
    echo "  • Reescrever TODOS os commits"
    echo "  • Requer 'git push --force'"
    echo "  • Colaboradores terão que re-clonar o repositório"
    echo ""
    
    read -p "Você tem certeza? Digite 'sim' para continuar: " -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Ss][Ii][Mm]$ ]]; then
        log_info "Operação cancelada pelo usuário"
        exit 0
    fi
    
    # Criar backup automático
    BACKUP_DIR=".git-backup-$(date +%Y%m%d-%H%M%S)"
    log_info "Criando backup em ${BACKUP_DIR}..."
    cp -r .git "$BACKUP_DIR"
    log_success "Backup criado"
fi

# Construir comando git-filter-repo
FILTER_REPO_CMD="git-filter-repo --force --invert-paths"

if [[ "$USE_GLOB" == true ]]; then
    FILTER_REPO_CMD="$FILTER_REPO_CMD --path-glob '$PATH_TO_REMOVE'"
else
    FILTER_REPO_CMD="$FILTER_REPO_CMD --path '$PATH_TO_REMOVE'"
fi

# Executar
echo ""
log_info "Executando: ${FILTER_REPO_CMD}"
echo ""

if [[ "$DRY_RUN" == true ]]; then
    log_warning "DRY-RUN MODE: Comando que seria executado:"
    echo "  ${GREEN}${FILTER_REPO_CMD}${NC}"
    echo ""
    log_info "Para executar de verdade, remova --dry-run"
else
    # Executar filter-repo
    eval "$FILTER_REPO_CMD"
    
    if [[ $? -eq 0 ]]; then
        log_success "Remoção do histórico concluída com sucesso!"
        echo ""
        log_info "Próximos passos:"
        echo ""
        echo "  1. Verificar se a remoção foi bem-sucedida:"
        echo "     ${GREEN}git log --all --oneline -- '$PATH_TO_REMOVE'${NC}"
        echo "     (deve retornar vazio)"
        echo ""
        echo "  2. Force push para o remote:"
        echo "     ${GREEN}git push origin --force --all${NC}"
        echo "     ${GREEN}git push origin --force --tags${NC}"
        echo ""
        echo "  3. Notificar colaboradores para re-clonar o repositório"
        echo ""
        echo "  4. Limpar objetos órfãos (opcional):"
        echo "     ${GREEN}git reflog expire --expire=now --all${NC}"
        echo "     ${GREEN}git gc --prune=now --aggressive${NC}"
        echo ""
        log_warning "Backup disponível em: ${BACKUP_DIR}"
    else
        log_error "Erro durante a remoção"
        if [[ -d "$BACKUP_DIR" ]]; then
            log_info "Restaurando backup..."
            rm -rf .git
            mv "$BACKUP_DIR" .git
            log_success "Backup restaurado"
        fi
        exit 1
    fi
fi

echo ""
log_success "Script concluído"
