#!/bin/bash
# =============================================================================
# FazAI Brain - Entrypoint
# =============================================================================

set -e

# -----------------------------------------------------------------------------
# Configuração Inicial
# -----------------------------------------------------------------------------
echo "[FazAI Brain] Iniciando..."

# Copia config padrão se não existir
if [[ ! -f /etc/fazai/fazai.conf ]]; then
    echo "[FazAI Brain] Criando configuração padrão..."
    cp /etc/fazai/fazai.conf.default /etc/fazai/fazai.conf
fi

# Substitui variáveis de ambiente no config
envsubst < /etc/fazai/fazai.conf > /tmp/fazai.conf.tmp
mv /tmp/fazai.conf.tmp /etc/fazai/fazai.conf

# -----------------------------------------------------------------------------
# Aguarda Dependências
# -----------------------------------------------------------------------------
wait_for_service() {
    local host="$1"
    local port="$2"
    local name="$3"
    local max_attempts=30
    local attempt=1

    echo "[FazAI Brain] Aguardando $name ($host:$port)..."

    while ! curl -sf "http://$host:$port" > /dev/null 2>&1; do
        if [[ $attempt -ge $max_attempts ]]; then
            echo "[FazAI Brain] ERRO: $name não disponível após $max_attempts tentativas"
            exit 1
        fi
        echo "[FazAI Brain] $name não disponível, tentativa $attempt/$max_attempts..."
        sleep 2
        ((attempt++))
    done

    echo "[FazAI Brain] $name disponível!"
}

# Aguarda Qdrant
wait_for_service "${QDRANT_HOST:-qdrant}" "${QDRANT_PORT:-6333}" "Qdrant"

# Aguarda Ollama
wait_for_service "${OLLAMA_HOST:-ollama}" "${OLLAMA_PORT:-11434}" "Ollama"

# -----------------------------------------------------------------------------
# Verifica Agent Socket
# -----------------------------------------------------------------------------
check_agent_socket() {
    local socket="${AGENT_SOCKET:-/run/fazai/agent.sock}"

    if [[ -S "$socket" ]]; then
        echo "[FazAI Brain] Agent socket encontrado: $socket"
        return 0
    else
        echo "[FazAI Brain] AVISO: Agent socket não encontrado: $socket"
        echo "[FazAI Brain] Comandos no host não funcionarão até o agent estar ativo"
        return 0  # Não falha, apenas avisa
    fi
}

check_agent_socket

# -----------------------------------------------------------------------------
# Inicializa Modelos Ollama (se necessário)
# -----------------------------------------------------------------------------
init_ollama_models() {
    local ollama_url="http://${OLLAMA_HOST:-ollama}:${OLLAMA_PORT:-11434}"

    # Lista de modelos necessários (do conf)
    local models="${OLLAMA_MODELS:-phi3:mini,nomic-embed-text}"

    echo "[FazAI Brain] Verificando modelos Ollama..."

    IFS=',' read -ra model_list <<< "$models"
    for model in "${model_list[@]}"; do
        model=$(echo "$model" | xargs)  # trim
        if ! curl -sf "$ollama_url/api/show" -d "{\"name\":\"$model\"}" > /dev/null 2>&1; then
            echo "[FazAI Brain] Baixando modelo: $model"
            curl -sf "$ollama_url/api/pull" -d "{\"name\":\"$model\"}" || true
        else
            echo "[FazAI Brain] Modelo já disponível: $model"
        fi
    done
}

# Descomente para auto-pull de modelos
# init_ollama_models

# -----------------------------------------------------------------------------
# Executa Comando
# -----------------------------------------------------------------------------
echo "[FazAI Brain] Iniciando aplicação..."
echo "[FazAI Brain] Comando: $@"

exec "$@"
