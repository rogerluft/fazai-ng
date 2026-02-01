#!/bin/bash
# FAZAI - Testes de Execução
# Rodar como root: sudo ./real-world-exec.sh

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

LOG=tests/real-world-exec.log
FAZAI=./bin/fazai
export FAZAI_CONFIG_PATH=/etc/fazai/fazai.conf

TOTAL=0
PASSOU=0
FALHOU=0

mkdir -p tests
echo "=== TESTES $(date) ===" > $LOG

test_fazai() {
    DESC=$1
    PROMPT=$2
    TIMEOUT=${3:-120}
    
    TOTAL=$((TOTAL + 1))
    
    echo ""
    echo -e "${CYAN}[$TOTAL] $DESC${NC}"
    echo -e "${YELLOW}$PROMPT${NC}"
    
    echo "" >> $LOG
    echo "=== $TOTAL: $DESC ===" >> $LOG
    
    START=$(date +%s)
    timeout ${TIMEOUT}s $FAZAI --debug -y $PROMPT >> $LOG 2>&1
    EXIT=$?
    END=$(date +%s)
    DUR=$((END - START))
    
    if [ $EXIT -eq 0 ]; then
        echo -e "${GREEN}PASSOU${NC} (${DUR}s)"
        PASSOU=$((PASSOU + 1))
    elif [ $EXIT -eq 124 ]; then
        echo -e "${RED}TIMEOUT${NC}"
        FALHOU=$((FALHOU + 1))
    else
        echo -e "${RED}FALHOU${NC} ($EXIT)"
        FALHOU=$((FALHOU + 1))
    fi
}

clear
echo ""
echo "FAZAI - TESTES DE EXECUCAO"
echo "=========================="
echo "Log: tail -f $LOG"
echo ""

# TESTES

test_fazai "Listar arquivos" "liste os arquivos do diretorio atual"

test_fazai "Uso de disco" "mostre uso de disco"

test_fazai "Info sistema" "mostre info do sistema operacional"

test_fazai "Pergunta Fazai" "ask o que e fazai"

test_fazai "Pergunta nome" "ask qual seu nome"

test_fazai "Portas abertas" "liste portas abertas e crie scripts /tmp/fwclose.sh e /tmp/fwopen.sh"

test_fazai "Config Samba" "leia /etc/samba/smb.conf e mostre compartilhamentos"

# RESUMO

echo ""
echo "=========================="
echo "TOTAL:  $TOTAL"
echo -e "PASSOU: ${GREEN}$PASSOU${NC}"
echo -e "FALHOU: ${RED}$FALHOU${NC}"
echo ""

if [ $FALHOU -eq 0 ]; then
    echo -e "${GREEN}TUDO OK${NC}"
else
    echo -e "${RED}$FALHOU FALHARAM${NC}"
fi

echo ""
exit $FALHOU
