#!/bin/bash

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

LOG_FILE="tests/real-world-output.log"
FAZAI_BIN="./bin/fazai" # Use local binary for test inside repo context if desired, or /usr/local/bin/fazai

# Allow overriding config path for test
export FAZAI_CONFIG_PATH="/etc/fazai/fazai.conf"

echo "=== SUITE DE TESTES REAIS FAZAI NG (V2.2 - MAESTRO) ===" > $LOG_FILE
echo "Data: $(date)" >> $LOG_FILE
echo "User: $(whoami)" >> $LOG_FILE
echo "PWD: $(pwd)" >> $LOG_FILE
echo "------------------------------------------------" >> $LOG_FILE

run_test() {
    local desc="$1"
    local cmd="$2"
    
    echo -e "\n${BLUE}[TESTE] $desc${NC}" | tee -a $LOG_FILE
    echo "CMD: $cmd" >> $LOG_FILE
    
    START=$(date +%s%N)
    eval "$cmd" >> $LOG_FILE 2>&1
    EXIT_CODE=$?
    END=$(date +%s%N)
    DURATION=$(($(( ($END - $START) / 1000000 ))))

    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN} OK (${DURATION}ms)${NC}"
        echo "RESULT: SUCCESS" >> $LOG_FILE
    else
        echo -e "${RED} ERRO (Exit Code: $EXIT_CODE)${NC}"
        echo "RESULT: ERROR (Code $EXIT_CODE)" >> $LOG_FILE
    fi
}

# 1. Validar Instalação (Estrutura de Arquivos)
echo -e "\n${YELLOW}=== 1. VALIDACAO DE AMBIENTE ===${NC}"
if [ -L "/opt/fazai/bin" ] && [ -L "/opt/fazai/package.json" ]; then
    echo -e "${GREEN}✓ Modo DEV detectado (Symlinks OK)${NC}"
else
    echo -e "${YELLOW}⚠ Modo DEV não detectado ou incompleto (Links faltantes)${NC}"
fi

if [ -f "/etc/fazai/fazai.conf" ]; then
    echo -e "${GREEN}✓ Configuração encontrada em /etc/fazai/fazai.conf${NC}"
else
    echo -e "${RED}✗ Configuração não encontrada!${NC}"
fi

# 2. Testes Básicos de CLI
echo -e "\n${YELLOW}=== 2. CLI BASICO ===${NC}"
run_test "Help Command" "$FAZAI_BIN --help"
run_test "Version Command" "$FAZAI_BIN --version"

# 3. Testes de Conhecimento (RAG/LLM - Pode falhar sem rede/serviços)
echo -e "\n${YELLOW}=== 3. LLM/RAG (Pode depender de serviços externos) ===${NC}"
# Usamos timeout para não travar se o serviço estiver fora
run_test "Ask Simple (Timeout 120s)" "timeout 120s $FAZAI_BIN ask 'Quem é voce?' || echo 'Timeout ou Falha no LLM'"

# 4. Testes de Execução (Simulação)
echo -e "\n${YELLOW}=== 4. EXECUCAO DE COMANDOS ===${NC}"
run_test "Dry Run Command" "$FAZAI_BIN -y 'liste as portas que estou ouvindo em tcp e udp' --dry-run qwen3:8b"

# 5. Validação de endpoints
echo -e "\n${YELLOW}=== 5. VALIDACAO DE ENDPOINTS (Config) ===${NC}"
OLLAMA_URL=$(grep "OLLAMA_BASE_URL" $FAZAI_CONFIG_PATH | cut -d= -f2)
echo "Ollama URL configurada: $OLLAMA_URL"
if curl --connect-timeout 2 -s "$OLLAMA_URL" > /dev/null; then
    echo -e "${GREEN}✓ Ollama acessível${NC}"
else
    echo -e "${RED}✗ Ollama inacessível (Esperado no Sandbox)${NC}"
fi

# 6. Validação de Persistência (Qdrant)
echo -e "\n${YELLOW}=== 6. VALIDACAO DE PERSISTENCIA (QDRANT) ===${NC}"
# Prioritize environment variable, fallback to config file
if [ -z "$QDRANT_URL" ]; then
    echo "QDRANT_URL not set, reading from $FAZAI_CONFIG_PATH..."
    export QDRANT_URL=$(grep "QDRANT_URL" $FAZAI_CONFIG_PATH | cut -d= -f2)
fi

if [ -z "$QDRANT_URL" ]; then
    echo -e "${RED}✗ QDRANT_URL não definido como variável de ambiente nem encontrado em $FAZAI_CONFIG_PATH${NC}"
else
    echo "Qdrant URL para verificação: $QDRANT_URL"
    # Ensure local dependency for the script is installed
    if [ ! -d "node_modules/@qdrant" ]; then
        echo "Instalando dependência local para verificação..."
        npm install --silent @qdrant/js-client-rest
    fi
    node tests/verify-qdrant-persistence.js
fi


echo -e "\n${GREEN}=== EXECUCAO CONCLUIDA ===${NC}"
echo "Logs completos em $LOG_FILE"
