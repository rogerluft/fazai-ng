#!/bin/bash
LOG=tests/real-world-exec.log
mkdir -p tests
echo "=== TESTES $(date) ===" > $LOG
PASS=0
FAZAI=/opt/fazai/bin/fazai --yolo

echo "FAZAI TESTES"
echo "============"

echo "[1] Listar arquivos"
$FAZAI "liste os arquivos do diretorio atual, crie um novo diretorio com o nome do mes atual e copie somente os arquivos que contem a letra: a para a pasta que foi criada com o nome do mes  criada " 2>&1 | tee -a $LOG && PASS=$((PASS+1))
echo ""

echo "[2] Uso de disco"
$FAZAI "mostre quanto de disco esta sendo usado, relacione cada particao ao seu ponto de montagem no arquivo /tmp/relatorio-de-montagem.txt" 2>&1 | tee -a $LOG && PASS=$((PASS+1))
echo ""

echo "[3] Info sistema"
$FAZAI "mostre informacoes do sistema operacional, detalhada sem usar o comando uname" 2>&1 | tee -a $LOG && PASS=$((PASS+1))
echo ""

echo "[4] Ask - o que e fazai"
$FAZAI ask "Explique porque fazer as coisas da maneira certa na primeira vez é mais eficiente do que ter retrbalho e detalhe." 2>&1 | tee -a $LOG && PASS=$((PASS+1))
echo ""

echo "[5] Ask - qual seu nome"
$FAZAI ask "Na sua opiniao, qual eh o melho modelo (peso inferenciador, et..) para atuar como um administrador de sistmaslinux?" 2>&1 | tee -a $LOG && PASS=$((PASS+1))
echo ""

echo "[6] Processos"
$FAZAI "faca um bashscript qeu imprime as o a daa e a hora em formato desenho ascii e talvez em /tmp/fzascii_dates.sh caso ja tenha, esvcolha outro noame aleatoria" 2>&1 | tee -a $LOG && PASS=$((PASS+1))
echo ""

echo "[7] Uso de memoria"
$FAZAI "Faça a medio de iops em 1m minuto" 2>&1 | tee -a $LOG && PASS=$((PASS+1))
echo ""

echo "============"
echo "PASS $PASS de 7"
echo "============"

exit $([ $PASS -eq 7 ] && echo 0 || echo 1)
