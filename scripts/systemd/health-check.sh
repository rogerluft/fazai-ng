#!/usr/bin/env bash
# =============================================================================
# FazAI Health Check Script
# =============================================================================
# Descricao: Verifica a saude de todos os componentes do sistema FazAI
#
# Componentes verificados:
#   - Qdrant (banco de vetores)
#   - Ollama (modelos locais)
#   - FazAI Worker (servico principal)
#   - Disco (espaco disponivel)
#   - Memoria (uso atual)
#
# Uso:
#   ./health-check.sh           # Executa todas as verificacoes
#   ./health-check.sh --json    # Saida em formato JSON
#   ./health-check.sh --quiet   # Apenas codigo de saida (0=ok, 1=erro)
#
# Codigos de saida:
#   0 - Todos os componentes saudaveis
#   1 - Um ou mais componentes com problema
# =============================================================================

set -uo pipefail

# -------------------------------------------------------------------------
# Configuracoes
# -------------------------------------------------------------------------
readonly QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"
readonly OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
readonly DISK_THRESHOLD=90  # Porcentagem maxima de uso de disco
readonly MEMORY_THRESHOLD=90  # Porcentagem maxima de uso de memoria

# Modo de saida
OUTPUT_MODE="text"
QUIET=false

# Contadores de status
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARN=0

# -------------------------------------------------------------------------
# Cores (desabilitadas em modo quiet)
# -------------------------------------------------------------------------
if [[ -t 1 ]] && [[ "$QUIET" != true ]]; then
    readonly RED='\033[0;31m'
    readonly GREEN='\033[0;32m'
    readonly YELLOW='\033[0;33m'
    readonly BLUE='\033[0;34m'
    readonly NC='\033[0m'
else
    readonly RED=''
    readonly GREEN=''
    readonly YELLOW=''
    readonly BLUE=''
    readonly NC=''
fi

# -------------------------------------------------------------------------
# Funcoes de Output
# -------------------------------------------------------------------------

log_check() {
    local name="$1"
    local status="$2"
    local message="${3:-}"

    if [[ "$QUIET" == true ]]; then
        return
    fi

    case "$status" in
        ok)
            echo -e "${GREEN}[OK]${NC} $name${message:+: $message}"
            ((CHECKS_PASSED++))
            ;;
        warn)
            echo -e "${YELLOW}[WARN]${NC} $name${message:+: $message}"
            ((CHECKS_WARN++))
            ;;
        fail)
            echo -e "${RED}[FAIL]${NC} $name${message:+: $message}"
            ((CHECKS_FAILED++))
            ;;
    esac
}

log_header() {
    if [[ "$QUIET" != true ]]; then
        echo ""
        echo -e "${BLUE}=== $1 ===${NC}"
    fi
}

# -------------------------------------------------------------------------
# Funcoes de Verificacao
# -------------------------------------------------------------------------

check_qdrant() {
    log_header "Qdrant"

    local response
    local http_code

    # Tenta conectar ao Qdrant
    if response=$(curl -s -w "\n%{http_code}" --connect-timeout 5 "$QDRANT_URL/collections" 2>/dev/null); then
        http_code=$(echo "$response" | tail -n1)
        local body=$(echo "$response" | sed '$d')

        if [[ "$http_code" == "200" ]]; then
            # Conta collections
            local collections
            collections=$(echo "$body" | grep -o '"name"' | wc -l || echo "0")
            log_check "Qdrant Status" "ok" "Online ($collections collections)"

            # Verifica collections especificas do FazAI
            if echo "$body" | grep -q "fazai_"; then
                log_check "FazAI Collections" "ok" "Encontradas"
            else
                log_check "FazAI Collections" "warn" "Nenhuma collection fazai_* encontrada"
            fi
        else
            log_check "Qdrant Status" "fail" "HTTP $http_code"
        fi
    else
        log_check "Qdrant Status" "fail" "Nao conectou em $QDRANT_URL"
    fi
}

check_ollama() {
    log_header "Ollama"

    local response
    local http_code

    # Tenta conectar ao Ollama
    if response=$(curl -s -w "\n%{http_code}" --connect-timeout 5 "$OLLAMA_URL/api/tags" 2>/dev/null); then
        http_code=$(echo "$response" | tail -n1)
        local body=$(echo "$response" | sed '$d')

        if [[ "$http_code" == "200" ]]; then
            # Conta modelos instalados
            local models
            models=$(echo "$body" | grep -o '"name"' | wc -l || echo "0")
            log_check "Ollama Status" "ok" "Online ($models modelos)"

            # Verifica se tem modelo de embedding
            if echo "$body" | grep -qE "(nomic-embed|bge-|mxbai-embed)"; then
                log_check "Embedding Model" "ok" "Disponivel"
            else
                log_check "Embedding Model" "warn" "Nenhum modelo de embedding detectado"
            fi
        else
            log_check "Ollama Status" "fail" "HTTP $http_code"
        fi
    else
        log_check "Ollama Status" "fail" "Nao conectou em $OLLAMA_URL"
    fi
}

check_worker() {
    log_header "FazAI Worker"

    # Verifica se o servico esta rodando
    if systemctl is-active --quiet fazai-worker.service 2>/dev/null; then
        local pid
        pid=$(systemctl show fazai-worker.service --property=MainPID --value 2>/dev/null || echo "?")
        log_check "Worker Service" "ok" "Ativo (PID: $pid)"

        # Verifica uptime
        local uptime
        uptime=$(systemctl show fazai-worker.service --property=ActiveEnterTimestamp --value 2>/dev/null || echo "")
        if [[ -n "$uptime" ]]; then
            log_check "Worker Uptime" "ok" "Desde: $uptime"
        fi
    else
        log_check "Worker Service" "fail" "Inativo"
    fi

    # Verifica skill-seeker
    if systemctl is-active --quiet fazai-skill-seeker.service 2>/dev/null; then
        log_check "Skill Seeker" "ok" "Ativo"
    else
        log_check "Skill Seeker" "warn" "Inativo"
    fi
}

check_disk() {
    log_header "Disco"

    # Verifica diretorios importantes
    local dirs=("/opt/fazai" "/var/log/fazai" "/etc/fazai")

    for dir in "${dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            local usage
            usage=$(df "$dir" 2>/dev/null | awk 'NR==2 {print $5}' | tr -d '%')

            if [[ -n "$usage" ]]; then
                if [[ "$usage" -ge "$DISK_THRESHOLD" ]]; then
                    log_check "Disco $dir" "warn" "${usage}% usado (limite: ${DISK_THRESHOLD}%)"
                else
                    log_check "Disco $dir" "ok" "${usage}% usado"
                fi
            fi
        fi
    done

    # Verifica espaco no diretorio de ingest
    if [[ -d "/etc/fazai/ingest" ]]; then
        local pending
        pending=$(find /etc/fazai/ingest -maxdepth 1 -type f 2>/dev/null | wc -l)
        if [[ "$pending" -gt 100 ]]; then
            log_check "Fila de Ingest" "warn" "$pending arquivos pendentes"
        else
            log_check "Fila de Ingest" "ok" "$pending arquivos pendentes"
        fi
    fi
}

check_memory() {
    log_header "Memoria"

    # Obtem uso de memoria do sistema
    local mem_info
    mem_info=$(free -m 2>/dev/null | awk 'NR==2')

    if [[ -n "$mem_info" ]]; then
        local total used percent
        total=$(echo "$mem_info" | awk '{print $2}')
        used=$(echo "$mem_info" | awk '{print $3}')
        percent=$((used * 100 / total))

        if [[ "$percent" -ge "$MEMORY_THRESHOLD" ]]; then
            log_check "Memoria Sistema" "warn" "${percent}% (${used}MB/${total}MB)"
        else
            log_check "Memoria Sistema" "ok" "${percent}% (${used}MB/${total}MB)"
        fi
    fi

    # Verifica memoria do processo worker
    if systemctl is-active --quiet fazai-worker.service 2>/dev/null; then
        local pid
        pid=$(systemctl show fazai-worker.service --property=MainPID --value 2>/dev/null)

        if [[ -n "$pid" ]] && [[ "$pid" != "0" ]]; then
            local rss
            rss=$(ps -o rss= -p "$pid" 2>/dev/null | awk '{print int($1/1024)}')
            if [[ -n "$rss" ]]; then
                log_check "Memoria Worker" "ok" "${rss}MB"
            fi
        fi
    fi
}

check_logs() {
    log_header "Logs Recentes"

    # Verifica erros recentes no worker
    local errors
    errors=$(journalctl -u fazai-worker --since "5 minutes ago" --priority=err --no-pager 2>/dev/null | wc -l)

    if [[ "$errors" -gt 0 ]]; then
        log_check "Erros Recentes" "warn" "$errors erros nos ultimos 5 minutos"
    else
        log_check "Erros Recentes" "ok" "Nenhum erro recente"
    fi
}

# -------------------------------------------------------------------------
# Saida JSON
# -------------------------------------------------------------------------

output_json() {
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Coleta dados
    local qdrant_status="unknown"
    local ollama_status="unknown"
    local worker_status="unknown"
    local disk_usage="0"
    local memory_usage="0"

    # Qdrant
    if curl -s --connect-timeout 2 "$QDRANT_URL/collections" >/dev/null 2>&1; then
        qdrant_status="healthy"
    else
        qdrant_status="unhealthy"
    fi

    # Ollama
    if curl -s --connect-timeout 2 "$OLLAMA_URL/api/tags" >/dev/null 2>&1; then
        ollama_status="healthy"
    else
        ollama_status="unhealthy"
    fi

    # Worker
    if systemctl is-active --quiet fazai-worker.service 2>/dev/null; then
        worker_status="healthy"
    else
        worker_status="unhealthy"
    fi

    # Memoria
    memory_usage=$(free -m 2>/dev/null | awk 'NR==2 {printf "%.0f", $3*100/$2}')

    # Disco
    disk_usage=$(df /opt/fazai 2>/dev/null | awk 'NR==2 {print $5}' | tr -d '%')

    cat << EOF
{
  "timestamp": "$timestamp",
  "status": {
    "qdrant": "$qdrant_status",
    "ollama": "$ollama_status",
    "worker": "$worker_status"
  },
  "resources": {
    "memory_percent": $memory_usage,
    "disk_percent": ${disk_usage:-0}
  },
  "healthy": $([ "$qdrant_status" = "healthy" ] && [ "$ollama_status" = "healthy" ] && [ "$worker_status" = "healthy" ] && echo "true" || echo "false")
}
EOF
}

# -------------------------------------------------------------------------
# Resumo
# -------------------------------------------------------------------------

print_summary() {
    if [[ "$QUIET" == true ]]; then
        return
    fi

    echo ""
    echo "=========================================="
    echo "              Resumo                      "
    echo "=========================================="
    echo -e "Verificacoes OK:    ${GREEN}$CHECKS_PASSED${NC}"
    echo -e "Avisos:             ${YELLOW}$CHECKS_WARN${NC}"
    echo -e "Falhas:             ${RED}$CHECKS_FAILED${NC}"
    echo "=========================================="

    if [[ "$CHECKS_FAILED" -gt 0 ]]; then
        echo -e "\nStatus: ${RED}PROBLEMAS DETECTADOS${NC}"
    elif [[ "$CHECKS_WARN" -gt 0 ]]; then
        echo -e "\nStatus: ${YELLOW}ATENCAO NECESSARIA${NC}"
    else
        echo -e "\nStatus: ${GREEN}TODOS OS SISTEMAS OK${NC}"
    fi
}

# -------------------------------------------------------------------------
# Main
# -------------------------------------------------------------------------

main() {
    # Processa argumentos
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --json)
                OUTPUT_MODE="json"
                shift
                ;;
            --quiet|-q)
                QUIET=true
                shift
                ;;
            --help|-h)
                head -30 "$0" | tail -25
                exit 0
                ;;
            *)
                shift
                ;;
        esac
    done

    # Modo JSON
    if [[ "$OUTPUT_MODE" == "json" ]]; then
        output_json
        exit 0
    fi

    # Header
    if [[ "$QUIET" != true ]]; then
        echo ""
        echo "=========================================="
        echo "      FazAI Health Check - $(date '+%Y-%m-%d %H:%M:%S')"
        echo "=========================================="
    fi

    # Executa todas as verificacoes
    check_qdrant
    check_ollama
    check_worker
    check_disk
    check_memory
    check_logs

    # Resumo
    print_summary

    # Codigo de saida
    if [[ "$CHECKS_FAILED" -gt 0 ]]; then
        exit 1
    else
        exit 0
    fi
}

main "$@"
