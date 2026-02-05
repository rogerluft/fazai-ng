#!/bin/bash
#
# Script de Resolução de PRs - FazAI-NG
# Automatiza o processo de reabrir e organizar Pull Requests
#
# Uso: ./scripts/resolver-prs.sh [fase]
# Fases: reabrir, comparar, mergear, validar, tudo

set -e

REPO="rogerluft/fazai-ng"
PRS_FECHADAS=(45 51 53)
PRS_ALTA_PRIORIDADE=(40)
PRS_MEDIA_PRIORIDADE=(41 43 44 46 47 48 49)
PRS_BAIXA_PRIORIDADE=(52 54)

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
    exit 1
}

warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Verificar se gh CLI está instalado
check_gh_cli() {
    if ! command -v gh &> /dev/null; then
        error "GitHub CLI (gh) não está instalado. Instale em: https://cli.github.com/"
    fi
    
    # Verificar autenticação
    if ! gh auth status &> /dev/null; then
        error "GitHub CLI não está autenticado. Execute: gh auth login"
    fi
    
    log "✓ GitHub CLI configurado e autenticado"
}

# FASE 1: Reabrir PRs fechadas
fase_reabrir() {
    log "=== FASE 1: Reabrindo PRs Fechadas ==="
    
    for pr in "${PRS_FECHADAS[@]}"; do
        info "Verificando PR #$pr..."
        
        # Verificar se a PR está fechada
        estado=$(gh pr view "$pr" --repo "$REPO" --json state --jq '.state')
        
        if [ "$estado" = "CLOSED" ]; then
            warn "PR #$pr está fechada. Reabrindo..."
            gh pr reopen "$pr" --repo "$REPO"
            log "✓ PR #$pr reaberta com sucesso"
        elif [ "$estado" = "OPEN" ]; then
            log "✓ PR #$pr já está aberta"
        else
            error "Estado desconhecido para PR #$pr: $estado"
        fi
    done
    
    log "=== FASE 1 CONCLUÍDA ==="
}

# FASE 2: Comparar PRs potencialmente redundantes
fase_comparar() {
    log "=== FASE 2: Comparando PRs Potencialmente Redundantes ==="
    
    # Comparar SpamExperts: #45, #53 vs #54
    info "Grupo SpamExperts: Comparando #45, #53 vs #54"
    
    echo ""
    info "Arquivos modificados na PR #45:"
    gh pr diff 45 --repo "$REPO" --name-only
    
    echo ""
    info "Arquivos modificados na PR #53:"
    gh pr diff 53 --repo "$REPO" --name-only
    
    echo ""
    info "Arquivos modificados na PR #54:"
    gh pr diff 54 --repo "$REPO" --name-only
    
    echo ""
    warn "ATENÇÃO: Verifique se há sobreposição nos arquivos acima"
    warn "Se houver sobreposição, decida qual PR manter"
    
    # Comparar OPNsense: #51 vs #52
    echo ""
    info "Grupo OPNsense: Comparando #51 vs #52"
    
    echo ""
    info "Arquivos modificados na PR #51:"
    gh pr diff 51 --repo "$REPO" --name-only
    
    echo ""
    info "Arquivos modificados na PR #52:"
    gh pr diff 52 --repo "$REPO" --name-only
    
    echo ""
    warn "ATENÇÃO: Verifique se há sobreposição nos arquivos acima"
    warn "Se houver sobreposição, decida qual PR manter"
    
    log "=== FASE 2 CONCLUÍDA ==="
    echo ""
    warn "Revise os resultados acima antes de prosseguir para FASE 3"
}

# FASE 3: Mergear PRs (com confirmação)
fase_mergear() {
    log "=== FASE 3: Mergeando PRs ==="
    
    # Alta prioridade
    info "Mergeando PRs de ALTA PRIORIDADE..."
    for pr in "${PRS_ALTA_PRIORIDADE[@]}"; do
        mergear_pr "$pr" "ALTA"
    done
    
    # Média prioridade
    info "Mergeando PRs de MÉDIA PRIORIDADE..."
    for pr in "${PRS_MEDIA_PRIORIDADE[@]}"; do
        mergear_pr "$pr" "MÉDIA"
    done
    
    # Baixa prioridade
    info "Mergeando PRs de BAIXA PRIORIDADE..."
    for pr in "${PRS_BAIXA_PRIORIDADE[@]}"; do
        mergear_pr "$pr" "BAIXA"
    done
    
    log "=== FASE 3 CONCLUÍDA ==="
}

mergear_pr() {
    local pr=$1
    local prioridade=$2
    
    echo ""
    info "PR #$pr (Prioridade: $prioridade)"
    
    # Mostrar informações da PR
    gh pr view "$pr" --repo "$REPO"
    
    echo ""
    read -p "Deseja mergear a PR #$pr? (s/N): " resposta
    
    if [[ "$resposta" =~ ^[Ss]$ ]]; then
        info "Mergeando PR #$pr..."
        gh pr merge "$pr" --repo "$REPO" --squash --delete-branch
        log "✓ PR #$pr mergeada com sucesso"
        
        # Aguardar um pouco entre merges
        sleep 2
    else
        warn "PR #$pr pulada (usuário escolheu não mergear)"
    fi
}

# FASE 4: Validar master
fase_validar() {
    log "=== FASE 4: Validando Master Branch ==="
    
    # Atualizar master local
    info "Atualizando branch master..."
    git checkout master
    git pull origin master
    
    # Mostrar últimos commits
    echo ""
    info "Últimos 20 commits na master:"
    git log --oneline -20
    
    # Tentar rodar testes (se existirem)
    echo ""
    if [ -f "package.json" ]; then
        info "Verificando se há testes configurados..."
        if grep -q "\"test\"" package.json; then
            read -p "Deseja rodar os testes? (s/N): " resposta
            if [[ "$resposta" =~ ^[Ss]$ ]]; then
                npm test
            fi
        fi
    fi
    
    # Tentar build (se existir)
    echo ""
    if [ -f "package.json" ]; then
        info "Verificando se há build configurado..."
        if grep -q "\"build\"" package.json; then
            read -p "Deseja rodar o build? (s/N): " resposta
            if [[ "$resposta" =~ ^[Ss]$ ]]; then
                npm run build
            fi
        fi
    fi
    
    log "=== FASE 4 CONCLUÍDA ==="
}

# Função principal
main() {
    check_gh_cli
    
    case "${1:-help}" in
        reabrir)
            fase_reabrir
            ;;
        comparar)
            fase_comparar
            ;;
        mergear)
            fase_mergear
            ;;
        validar)
            fase_validar
            ;;
        tudo)
            fase_reabrir
            fase_comparar
            echo ""
            warn "Revise os resultados da comparação antes de continuar"
            read -p "Pressione ENTER para continuar com os merges ou CTRL+C para cancelar..."
            fase_mergear
            fase_validar
            ;;
        help|*)
            echo "Uso: $0 [fase]"
            echo ""
            echo "Fases disponíveis:"
            echo "  reabrir   - Reabrir PRs #45, #51, #53"
            echo "  comparar  - Comparar PRs potencialmente redundantes"
            echo "  mergear   - Mergear PRs abertas (com confirmação)"
            echo "  validar   - Validar branch master após merges"
            echo "  tudo      - Executar todas as fases em sequência"
            echo "  help      - Mostrar esta mensagem"
            echo ""
            echo "Exemplo:"
            echo "  $0 reabrir"
            echo "  $0 tudo"
            ;;
    esac
}

main "$@"
