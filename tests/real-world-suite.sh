#!/bin/bash

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

LOG_FILE="tests/real-world-output.log"
FAZAI_BIN="./bin/fazai"
# -y (yolo mode) skips confirmation prompts for batch/automated testing

# Limpa log anterior
echo "=== SUÍTE DE TESTES REAIS FAZAI NG (V2.1) ===" > $LOG_FILE
echo "Data: $(date)" >> $LOG_FILE
echo "------------------------------------------------" >> $LOG_FILE

run_test() {
    local desc="$1"
    local cmd="$2"
    
    echo -e "\n${BLUE}[TESTE] $desc${NC}" | tee -a $LOG_FILE
    echo "CMD: $cmd" >> $LOG_FILE
    
    START=$(date +%s%N)
    
    # Execução (eval para processar pipes e redirecionamentos)
    eval "$cmd" >> $LOG_FILE 2>&1
    EXIT_CODE=$?
    
    END=$(date +%s%N)
    DURATION=$(( ($END - $START) / 1000000 ))

    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✅ SUCESSO (${DURATION}ms)${NC}"
        echo "RESULT: SUCCESS" >> $LOG_FILE
    else
        echo -e "${RED}❌ ERRO (Exit Code: $EXIT_CODE)${NC}"
        echo "RESULT: ERROR (Code $EXIT_CODE)" >> $LOG_FILE
    fi
    echo "------------------------------------------------" >> $LOG_FILE
}

# === GRUPO 1: CONHECIMENTO & RAG (ASK) ===
echo -e "\n${YELLOW}=== GRUPO 1: CONHECIMENTO & RAG ===${NC}"
run_test "Ask: Função Bash" "$FAZAI_BIN ask 'como se faz uma funcao em bash?'"
run_test "Ask: Definição Kernel" "$FAZAI_BIN ask 'o que eh kernel?'"
# Novos Testes
run_test "Ask: Diferença TCP/UDP" "$FAZAI_BIN ask 'qual a diferença tecnica entre tcp e udp em uma frase?'"
run_test "Ask: Inode Concept" "$FAZAI_BIN ask 'explique o conceito de inode para um leigo'"
run_test "Ask: Sort Files" "$FAZAI_BIN ask 'comando para listar arquivos por tamanho decrescente'"

# === GRUPO 2: EXECUÇÃO & ARQUIVOS (EXEC) ===
echo -e "\n${YELLOW}=== GRUPO 2: EXECUÇÃO & ARQUIVOS ===${NC}"
run_test "Exec: Script Contagem" "$FAZAI_BIN -y 'gere um script em bash que conte ate 10 e salve em /tmp/cont10.sh'"
# Validação
if [ -f /tmp/cont10.sh ]; then echo "   🔎 Arquivo criado com sucesso."; else echo "   ❌ Falha na criação do arquivo."; fi

run_test "Exec: Contagem Tela" "$FAZAI_BIN -y 'conte ate 10 exibindo os numeros na tela'"

# Dependência Implícita 1: Instalar -> Rodar -> Salvar
run_test "Dep: Tree Package" "sudo $FAZAI_BIN -y 'instale o pacote tree se nao existir e gere a arvore do diretorio /etc/default salvando em /tmp/etc_tree.txt'"
if [ -f /tmp/etc_tree.txt ]; then echo "   🔎 Árvore gerada com sucesso."; else echo "   ❌ Falha na dependência tree."; fi

# Dependência Implícita 2: Criar Dir -> Compactar -> Listar
run_test "Dep: Backup Tar" "$FAZAI_BIN -y 'crie um diretorio /tmp/backup_test, compacte a pasta /var/log/apt (use sudo se precisar) para dentro dele como apt_logs.tar.gz e liste o conteudo do tar'"

# Dependência Implícita 3: Script Python -> Executar -> Validar
run_test "Dep: Fibonacci Python" "$FAZAI_BIN -y 'crie um script python /tmp/fibo.py que imprima a sequencia fibonacci ate 50, execute ele para testar'"

# === GRUPO 3: ADMINISTRAÇÃO (SUDO REQUIRED) ===
echo -e "\n${YELLOW}=== GRUPO 3: ADMINISTRAÇÃO (SUDO) ===${NC}"
run_test "Admin: Samba Shares" "sudo $FAZAI_BIN -y 'mostre os compartilhamentos do samba'"
run_test "Admin: Listar Processos" "$FAZAI_BIN -y 'liste os processos em execucao ordenados por memoria'"
run_test "Admin: Criar Usuário+Email" "sudo $FAZAI_BIN -y 'crie o usuario faz001 com a senha andarilho e mande um email ficticio para log'"

# === GRUPO 4: MONITORAMENTO & LONGA DURAÇÃO ===
echo -e "\n${YELLOW}=== GRUPO 4: MONITORAMENTO ===${NC}"
echo -e "\n[TESTE] Monitor Logs SSH (10s timeout)" | tee -a $LOG_FILE
# Timeout espera sucesso (124)
timeout 10s sudo $FAZAI_BIN -y "monitore os logs deste servidor e envie um alerta 'SSH EVENT' para todos usuarios logados a cada evento ssh" >> $LOG_FILE 2>&1
if [ $? -eq 124 ]; then echo -e "${GREEN}✅ SUCESSO (Rodou e manteve vivo)${NC}"; else echo -e "${RED}❌ ERRO (Crashou)${NC}"; fi

# === GRUPO 5: CRAWLER & SEARCH ===
echo -e "\n${YELLOW}=== GRUPO 5: CRAWLER & SEARCH ===${NC}"
run_test "Search: Latest Kernel" "$FAZAI_BIN search 'latest linux kernel stable version'"
run_test "Search: Best Practices SSH" "$FAZAI_BIN search 'best practices ssh hardening ubuntu 24.04'"

# === GRUPO 6: INTERATIVO (--CLI) ===
echo -e "\n${YELLOW}=== GRUPO 6: MODO INTERATIVO ===${NC}"
# Injeta comandos no stdin do modo interativo
INPUT_CLI="/help\n/ask qual a capital da frança?\n/search nodejs lts version\n/exec ls -la /tmp | head -n 5\n/exit\n"
echo -e "$INPUT_CLI" | $FAZAI_BIN --cli >> $LOG_FILE 2>&1
if [ $? -eq 0 ]; then echo -e "${GREEN}✅ SUCESSO (CLI Interativo)${NC}"; else echo -e "${RED}❌ ERRO (CLI Crashou)${NC}"; fi

echo -e "\n${GREEN}=== EXECUÇÃO CONCLUÍDA ===${NC}"

# Resumo
TOTAL=$(grep -c "RESULT:" $LOG_FILE 2>/dev/null || echo 0)
SUCCESS=$(grep -c "RESULT: SUCCESS" $LOG_FILE 2>/dev/null || echo 0)
FAILED=$((TOTAL - SUCCESS))
echo -e "\n${BLUE}📊 RESUMO: ${SUCCESS}/${TOTAL} testes passaram (${FAILED} falhas)${NC}"
echo -e "Log completo: ${LOG_FILE}"

# Opcional: Auditoria com GenAIScript (se disponível)
if command -v npx &> /dev/null && [ -f "genaisrc/test-auditor.genai.mjs" ]; then
    echo "Iniciando Auditoria Automática (GenAIScript)..."
    npx genaiscript run test-auditor --vars "logfile=$LOG_FILE" 2>/dev/null || true
fi