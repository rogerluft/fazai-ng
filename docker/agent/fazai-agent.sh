#!/bin/bash
# =============================================================================
# FazAI Host Agent - Executa comandos do container no HOST
# =============================================================================
# Localização: /opt/fazai/fazai-agent.sh
# Instalação: sudo cp docker/agent/* /opt/fazai/ && sudo systemctl enable fazai-agent
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuração (carrega do conf)
# -----------------------------------------------------------------------------
FAZAI_CONF="${FAZAI_CONF:-/etc/fazai/fazai.conf}"

# Defaults (sobrescritos pelo conf)
AGENT_SOCKET="/run/fazai/agent.sock"
AGENT_PASSWORD=""
AGENT_LOG="/var/log/fazai-agent.log"
AGENT_TIMEOUT=300
AGENT_BLOCKED_PATTERNS="rm -rf /,dd if=/dev,mkfs,> /dev/sd,chmod 777 /,:(){ :|:& };:"

# Carrega conf se existir
load_config() {
    if [[ -r "$FAZAI_CONF" ]]; then
        # Extrai variáveis AGENT_* do conf
        while IFS='=' read -r key value; do
            case "$key" in
                AGENT_SOCKET) AGENT_SOCKET="$value" ;;
                AGENT_PASSWORD) AGENT_PASSWORD="$value" ;;
                AGENT_LOG) AGENT_LOG="$value" ;;
                AGENT_TIMEOUT) AGENT_TIMEOUT="$value" ;;
                AGENT_BLOCKED_PATTERNS) AGENT_BLOCKED_PATTERNS="$value" ;;
            esac
        done < <(grep '^AGENT_' "$FAZAI_CONF" 2>/dev/null | sed 's/^AGENT_/AGENT_/')
    fi
}

# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------
log() {
    local level="$1"
    shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" >> "$AGENT_LOG"
}

log_info() { log "INFO" "$@"; }
log_warn() { log "WARN" "$@"; }
log_error() { log "ERROR" "$@"; }

# -----------------------------------------------------------------------------
# Validação de Comandos
# -----------------------------------------------------------------------------
validate_command() {
    local cmd="$1"

    # Converte patterns em array
    IFS=',' read -ra patterns <<< "$AGENT_BLOCKED_PATTERNS"

    for pattern in "${patterns[@]}"; do
        if [[ "$cmd" == *"$pattern"* ]]; then
            log_warn "BLOCKED command matching pattern '$pattern': $cmd"
            echo "BLOCKED"
            return 1
        fi
    done

    echo "OK"
    return 0
}

# -----------------------------------------------------------------------------
# Autenticação
# -----------------------------------------------------------------------------
authenticate() {
    local provided_password="$1"

    # Se não há senha configurada, aceita tudo (desenvolvimento)
    if [[ -z "$AGENT_PASSWORD" ]]; then
        log_warn "No password configured - accepting all connections"
        return 0
    fi

    if [[ "$provided_password" == "$AGENT_PASSWORD" ]]; then
        return 0
    fi

    log_error "Authentication failed"
    return 1
}

# -----------------------------------------------------------------------------
# Execução de Comando (com streaming)
# -----------------------------------------------------------------------------
execute_command() {
    local cmd="$1"
    local request_id="$2"

    log_info "[$request_id] Executing: $cmd"

    # Executa com timeout e captura stdout/stderr separados
    local tmp_stdout=$(mktemp)
    local tmp_stderr=$(mktemp)
    local exit_code=0

    # Executa com streaming para o socket
    if timeout "$AGENT_TIMEOUT" bash -c "$cmd" > "$tmp_stdout" 2> "$tmp_stderr"; then
        exit_code=0
    else
        exit_code=$?
    fi

    local stdout=$(cat "$tmp_stdout")
    local stderr=$(cat "$tmp_stderr")

    rm -f "$tmp_stdout" "$tmp_stderr"

    log_info "[$request_id] Exit code: $exit_code"

    # Retorna JSON
    jq -nc \
        --arg id "$request_id" \
        --arg stdout "$stdout" \
        --arg stderr "$stderr" \
        --argjson exit "$exit_code" \
        --argjson ts "$(date +%s)" \
        '{
            id: $id,
            exit: $exit,
            stdout: $stdout,
            stderr: $stderr,
            timestamp: $ts
        }'
}

# -----------------------------------------------------------------------------
# Handler de Requisição
# -----------------------------------------------------------------------------
handle_request() {
    local request="$1"

    # Parse JSON
    local cmd=$(echo "$request" | jq -r '.cmd // empty')
    local password=$(echo "$request" | jq -r '.password // empty')
    local request_id=$(echo "$request" | jq -r '.id // "unknown"')

    # Validações
    if [[ -z "$cmd" ]]; then
        jq -nc '{error: "Missing cmd field", exit: 1}'
        return
    fi

    if ! authenticate "$password"; then
        jq -nc '{error: "Authentication failed", exit: 401}'
        return
    fi

    local validation=$(validate_command "$cmd")
    if [[ "$validation" == "BLOCKED" ]]; then
        jq -nc --arg cmd "$cmd" '{error: "Command blocked by security policy", cmd: $cmd, exit: 403}'
        return
    fi

    # Executa
    execute_command "$cmd" "$request_id"
}

# -----------------------------------------------------------------------------
# Cleanup
# -----------------------------------------------------------------------------
cleanup() {
    log_info "Agent shutting down"
    rm -f "$AGENT_SOCKET"
    exit 0
}

# -----------------------------------------------------------------------------
# Main Loop
# -----------------------------------------------------------------------------
main() {
    load_config

    trap cleanup SIGTERM SIGINT EXIT

    # Cria diretório do socket
    mkdir -p "$(dirname "$AGENT_SOCKET")"
    rm -f "$AGENT_SOCKET"

    log_info "FazAI Agent starting"
    log_info "Socket: $AGENT_SOCKET"
    log_info "Timeout: ${AGENT_TIMEOUT}s"
    log_info "Blocked patterns: $AGENT_BLOCKED_PATTERNS"

    # Verifica dependências
    if ! command -v socat &> /dev/null; then
        log_error "socat not found - please install: dnf install socat"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        log_error "jq not found - please install: dnf install jq"
        exit 1
    fi

    log_info "Agent ready, listening on $AGENT_SOCKET"

    # Loop principal com socat
    while true; do
        socat UNIX-LISTEN:"$AGENT_SOCKET",fork,mode=660 EXEC:"$0 --handle-request",nofork 2>> "$AGENT_LOG" || true
        sleep 1
    done
}

# -----------------------------------------------------------------------------
# Entry Point
# -----------------------------------------------------------------------------
if [[ "${1:-}" == "--handle-request" ]]; then
    # Modo handler (chamado pelo socat)
    read -r request
    handle_request "$request"
else
    # Modo daemon
    main
fi
