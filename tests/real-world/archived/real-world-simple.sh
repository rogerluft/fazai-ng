#!/bin/bash
LOG=tests/real-world-simple.log
mkdir -p tests
echo "=== TESTES SIMPLES $(date) ===" > $LOG
PASS=0

echo "FAZAI TESTES SIMPLES"
echo "===================="

echo "[1] Listar arquivos"
./bin/fazai "liste os arquivos do diretorio atual" 2>&1 | tee -a $LOG && PASS=$((PASS+1))
echo ""

echo "[2] Uso de disco"
./bin/fazai "mostre quanto de disco esta sendo usado" 2>&1 | tee -a $LOG && PASS=$((PASS+1))
echo ""

echo "[3] Info sistema"
./bin/fazai "mostre informacoes do sistema operacional" 2>&1 | tee -a $LOG && PASS=$((PASS+1))
echo ""

echo "[4] Ask - o que e fazai"
./bin/fazai ask "o que e fazai" 2>&1 | tee -a $LOG && PASS=$((PASS+1))
echo ""

echo "[5] Ask - qual seu nome"
./bin/fazai ask "qual seu nome" 2>&1 | tee -a $LOG && PASS=$((PASS+1))
echo ""

echo "===================="
echo "PASS $PASS de 5"
echo "===================="

[ $PASS -eq 5 ] && exit 0 || exit 1
