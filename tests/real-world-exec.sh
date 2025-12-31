#!/bin/bash

# =============================================================================
# REAL-WORLD EXEC TEST - Testa geração de comandos via AI
# Separado do suite principal para análise detalhada
# =============================================================================

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

LOG_FILE="tests/real-world-exec.log"
FAZAI_BIN="./bin/fazai"

# Config
export FAZAI_CONFIG_PATH="/etc/fazai/fazai.conf"

# Limpar log anterior
echo "=== TESTE DE EXECUÇÃO VIA AI - $(date) ===" > $LOG_FILE
echo "DEBUG MODE ATIVADO" >> $LOG_FILE
echo "================================================" >> $LOG_FILE

run_exec_test() {
    local desc="$1"
    local prompt="$2"
    local timeout_sec="${3:-120}"

    echo "" | tee -a $LOG_FILE
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" | tee -a $LOG_FILE
    echo -e "${BLUE}[EXEC TEST] $desc${NC}" | tee -a $LOG_FILE
    echo -e "${YELLOW}PROMPT: \"$prompt\"${NC}" | tee -a $LOG_FILE
    echo "TIMEOUT: ${timeout_sec}s" >> $LOG_FILE
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" | tee -a $LOG_FILE

    START=$(date +%s)

    # Executa com --debug SEM dry-run para ver fluxo real
    # -y para confirmar automaticamente
    timeout ${timeout_sec}s $FAZAI_BIN --debug -y "$prompt" 2>&1 | tee -a $LOG_FILE

    EXIT_CODE=${PIPESTATUS[0]}
    END=$(date +%s)
    DURATION=$((END - START))

    echo "" | tee -a $LOG_FILE
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✓ PASSOU (${DURATION}s)${NC}" | tee -a $LOG_FILE
    elif [ $EXIT_CODE -eq 124 ]; then
        echo -e "${RED}✗ TIMEOUT após ${timeout_sec}s${NC}" | tee -a $LOG_FILE
    else
        echo -e "${RED}✗ ERRO (Exit Code: $EXIT_CODE, ${DURATION}s)${NC}" | tee -a $LOG_FILE
    fi
    echo "EXIT_CODE: $EXIT_CODE" >> $LOG_FILE
}

echo -e "\n${YELLOW}=== INICIANDO TESTES DE EXEC VIA AI ===${NC}\n"
echo "Logs em tempo real: tail -f $LOG_FILE"
echo ""

# Teste 1: Comando simples - listar arquivos
run_exec_test "Listar Arquivos" "liste os arquivos do diretório atual" 120

# Teste 2: Comando com contexto - mostrar uso de disco
run_exec_test "Uso de Disco" "mostre quanto de disco está sendo usado" 120

# Teste 3: Comando de sistema - informações do sistema
run_exec_test "Info Sistema" "mostre informações do sistema operacional" 120

echo ""
echo -e "${GREEN}=== TESTES DE EXEC FINALIZADOS ===${NC}"
echo "Log completo: $LOG_FILE"
