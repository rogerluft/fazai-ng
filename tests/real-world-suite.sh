#!/bin/bash

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

LOG_FILE="tests/real-world-output.log"
FAZAI_BIN="./bin/fazai"

# Limpa log anterior e prepara cabecalho
echo "=== SUITE DE TESTES REAIS FAZAI NG (V2.2 - MAESTRO) ===" > $LOG_FILE
echo "Data: $(date)" >> $LOG_FILE
echo "Ambiente: $(uname -a)" >> $LOG_FILE
echo "------------------------------------------------" >> $LOG_FILE

run_test() {
    local desc="$1"
    local cmd="$2"
    
    echo -e "\n${BLUE}[TESTE] $desc${NC}" | tee -a $LOG_FILE
    echo "CMD: $cmd" >> $LOG_FILE
    
    START=$(date +%s%N)
    
    # Execucao (eval para processar pipes e redirecionamentos)
    eval "$cmd" >> $LOG_FILE 2>&1
    EXIT_CODE=$?
    
    END=$(date +%s%N)
    DURATION=$(($(( ($END - $START) / 1000000 )))))

    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN} OK (${DURATION}ms)${NC}"
        echo "RESULT: SUCCESS" >> $LOG_FILE
    else
        echo -e "${RED} ERRO (Exit Code: $EXIT_CODE)${NC}"
        echo "RESULT: ERROR (Code $EXIT_CODE)" >> $LOG_FILE
    fi
    echo "------------------------------------------------" >> $LOG_FILE
}

# === GRUPO 1: CONHECIMENTO E RAG (ASK) ===
echo -e "\n${YELLOW}=== GRUPO 1: CONHECIMENTO E RAG ===${NC}"
run_test "Ask: Funcao Bash" "$FAZAI_BIN ask 'como se faz uma funcao em bash?'"
run_test "Ask: Definicao Kernel" "$FAZAI_BIN ask 'o que eh kernel?'"
run_test "Ask: Brute Force Protection" "$FAZAI_BIN ask 'Como proteger um servidor contra ataques de forca bruta?'"
run_test "Ask: Command lsof" "$FAZAI_BIN ask 'O que eh o comando lsof e como usa-lo para ver portas?'"
run_test "Ask: RAID Comparison" "$FAZAI_BIN ask 'Explique a diferenca tecnica fundamental entre RAID 1 e RAID 5'"

# === GRUPO 2: EXECUCAO E ARQUIVOS (EXEC) ===
echo -e "\n${YELLOW}=== GRUPO 2: EXECUCAO E ARQUIVOS ===${NC}"
run_test "Exec: Script Contagem" "$FAZAI_BIN -y 'gere um script em bash que conte ate 10 e salve em /tmp/cont10.sh'"

# Dependencia Implicita: Gnuplot (Instalar -> Gerar Dados -> Plotar)
run_test "Dep: CPU Graph (Gnuplot)" "sudo $FAZAI_BIN -y 'instale a ferramenta gnuplot, colete o uso de cpu atual via mpstat ou top e use o gnuplot para gerar um grafico simples em /tmp/cpu_usage.png'"
if [ -f /tmp/cpu_usage.png ]; then echo -e "${CYAN}   [VERIFICACAO] Grafico gerado com sucesso.${NC}" | tee -a $LOG_FILE; else echo -e "${RED}   [VERIFICACAO] Falha ao gerar grafico.${NC}" | tee -a $LOG_FILE; fi

# Logica Condicional: Espaco em Disco
run_test "Exec: Disk Alert Logic" "$FAZAI_BIN -y 'verifique o espaco em disco e se algum disco estiver acima de 80% gere um log em /tmp/disk_alert.txt com a lista de culpados'"

# Analise de Logs do Sistema
run_test "Exec: Login Report" "sudo $FAZAI_BIN -y 'analise as sessoes de login recentes e gere um relatorio em /tmp/login_report.txt filtrando por IPs externos'"

# === GRUPO 3: ADMINISTRACAO (SUDO) ===
echo -e "\n${YELLOW}=== GRUPO 3: ADMINISTRACAO ===${NC}"
run_test "Admin: Samba Management" "sudo $FAZAI_BIN -y 'mostre os compartilhamentos do samba e verifique se o servico smbd esta ativo'"

# === GRUPO 4: MONITORAMENTO ===
echo -e "\n${YELLOW}=== GRUPO 4: MONITORAMENTO ===${NC}"
timeout 15s sudo $FAZAI_BIN -y "monitore os logs deste servidor e envie um alerta 'SSH ACCESS' para todos os terminais via wall cada vez que houver um login ssh" >> $LOG_FILE 2>&1
if [ $? -eq 124 ]; then echo -e "${GREEN} OK (Monitoramento iniciado)${NC}"; else echo -e "${RED} ERRO (Monitoramento falhou em 15s)${NC}"; fi

# === GRUPO 5: CRAWLER E SEARCH ===
echo -e "\n${YELLOW}=== GRUPO 5: CRAWLER E SEARCH ===${NC}"
run_test "Search: CVE Ubuntu" "$FAZAI_BIN search 'current critical security vulnerabilities for ubuntu 24.04'"
run_test "Search: Docker Release" "$FAZAI_BIN search 'latest stable docker engine release notes and features'"

# === GRUPO 6: INTERATIVO (--CLI) ===
echo -e "\n${YELLOW}=== GRUPO 6: MODO INTERATIVO ===${NC}"
INPUT_CLI="/help\n/ask como funciona o bit swapping?\n/search linux kernel 6.12 features\n/exec free -h\n/exit\n"
echo -e "$INPUT_CLI" | $FAZAI_BIN --cli >> $LOG_FILE 2>&1
if [ $? -eq 0 ]; then echo -e "${GREEN} OK (Interacao CLI Completa)${NC}"; else echo -e "${RED} ERRO (CLI crashou durante interacao)${NC}"; fi

echo -e "\n${GREEN}=== EXECUCAO CONCLUIDA ===${NC}"
echo -e "${YELLOW}Iniciando Auditoria Agentica Automatica...${NC}"

# Automacao da Auditoria
genaiscript run test-auditor --vars "logfile=$LOG_FILE"