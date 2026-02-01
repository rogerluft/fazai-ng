#!/bin/bash
LOG=tests/real-world-exec.log
mkdir -p tests
echo "=== TESTES $(date) ===" > $LOG
PASS=0
FAZAI=/opt/fazai/bin/fazai

echo "FAZAI TESTES"
echo "============"

echo "[1] Listar arquivos"
$FAZAI "liste os arquivos do diretorio atual" 2>&1 | tee -a $LOG && PASS=$((PASS+1))
echo ""

echo "[2] Uso de disco"
$FAZAI "mostre quanto de disco esta sendo usado" 2>&1 | tee -a $LOG && PASS=$((PASS+1))
echo ""

echo "[3] Info sistema"
$FAZAI "mostre informacoes do sistema operacional" 2>&1 | tee -a $LOG && PASS=$((PASS+1))
echo ""

echo "[4] Ask - o que e fazai"
$FAZAI ask "o que e fazai" 2>&1 | tee -a $LOG && PASS=$((PASS+1))
echo ""

echo "[5] Ask - qual seu nome"
$FAZAI ask "qual seu nome" 2>&1 | tee -a $LOG && PASS=$((PASS+1))
echo ""

echo "[6] Processos"
$FAZAI "mostre os processos em execucao" 2>&1 | tee -a $LOG && PASS=$((PASS+1))
echo ""

echo "[7] Uso de memoria"
$FAZAI "mostre quanto de memoria esta sendo usado" 2>&1 | tee -a $LOG && PASS=$((PASS+1))
echo ""

echo "============"
echo "PASS $PASS de 7"
echo "============"

exit $([ $PASS -eq 7 ] && echo 0 || echo 1)
