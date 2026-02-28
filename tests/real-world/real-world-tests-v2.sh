#!/bin/bash
#
# FazAI Real-World Tests v2
# Executa queries reais contra o pipeline completo (Agent SDK + RAG + GPTCache)
# Usa --yolo para bypass de permissões (execução autônoma)
#

LOG="tests/real-world.log"
mkdir -p tests
echo "=== TESTES $(date) ===" > "$LOG"
PASS=0
FAIL=0
FAZAI="/opt/fazai/bin/fazai"

echo "FAZAI TESTES REAL-WORLD"
echo "======================="
echo ""

# ─── Queries via injector (Agent SDK pipeline) ────────────────

echo "[1] Listar arquivos e organizar"
if $FAZAI --yolo "liste os arquivos do diretorio atual, crie um novo diretorio com o nome do mes atual e copie somente os arquivos que contem a letra: a para a pasta que foi criada com o nome do mes criada" 2>&1 | tee -a "$LOG"; then
    PASS=$((PASS+1))
    echo "  ✓ PASS"
else
    FAIL=$((FAIL+1))
    echo "  ✗ FAIL"
fi
echo ""

echo "[2] Uso de disco"
if $FAZAI --yolo "mostre quanto de disco esta sendo usado, relacione cada particao ao seu ponto de montagem no arquivo /tmp/relatorio-de-montagem.txt" 2>&1 | tee -a "$LOG"; then
    PASS=$((PASS+1))
    echo "  ✓ PASS"
else
    FAIL=$((FAIL+1))
    echo "  ✗ FAIL"
fi
echo ""

echo "[3] Info sistema"
if $FAZAI --yolo "mostre informacoes do sistema operacional, detalhada sem usar o comando uname" 2>&1 | tee -a "$LOG"; then
    PASS=$((PASS+1))
    echo "  ✓ PASS"
else
    FAIL=$((FAIL+1))
    echo "  ✗ FAIL"
fi
echo ""

# ─── Queries via app.js (ask = chat simples) ──────────────────

echo "[4] Ask - eficiencia"
if $FAZAI ask "Explique porque fazer as coisas da maneira certa na primeira vez é mais eficiente do que ter retrabalho e detalhe." 2>&1 | tee -a "$LOG"; then
    PASS=$((PASS+1))
    echo "  ✓ PASS"
else
    FAIL=$((FAIL+1))
    echo "  ✗ FAIL"
fi
echo ""

echo "[5] Ask - melhor modelo"
if $FAZAI ask "Na sua opiniao, qual eh o melhor modelo (peso inferenciador, etc.) para atuar como um administrador de sistemas linux?" 2>&1 | tee -a "$LOG"; then
    PASS=$((PASS+1))
    echo "  ✓ PASS"
else
    FAIL=$((FAIL+1))
    echo "  ✗ FAIL"
fi
echo ""

# ─── Mais queries via injector ────────────────────────────────

echo "[6] Script ASCII date"
if $FAZAI --yolo "faca um bash script que imprime a data e a hora em formato desenho ascii e salve em /tmp/fzascii_dates.sh caso ja tenha, escolha outro nome aleatorio" 2>&1 | tee -a "$LOG"; then
    PASS=$((PASS+1))
    echo "  ✓ PASS"
else
    FAIL=$((FAIL+1))
    echo "  ✗ FAIL"
fi
echo ""

echo "[7] Medicao de IOPS"
if $FAZAI --yolo "Faca a medicao de iops em 1 minuto" 2>&1 | tee -a "$LOG"; then
    PASS=$((PASS+1))
    echo "  ✓ PASS"
else
    FAIL=$((FAIL+1))
    echo "  ✗ FAIL"
fi
echo ""

# ─── Resultado ────────────────────────────────────────────────

echo "======================="
echo "RESULTADO: $PASS PASS / $FAIL FAIL (de 7)"
echo "======================="
echo ""
echo "Log completo: $LOG"

exit $FAIL
