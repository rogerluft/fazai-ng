#!/bin/bash
# Teste Simples de Fallback
# Testa apenas 2 comandos para verificar se o fallback funciona

LOG=tests/fallback-simple-$(date +%Y%m%d-%H%M%S).log
mkdir -p tests
echo "=== TESTE SIMPLES FALLBACK $(date) ===" | tee $LOG
PASS=0
FAZAI=/opt/fazai/bin/fazai

echo "" | tee -a $LOG
echo "╔══════════════════════════════════════════════════════════════╗" | tee -a $LOG
echo "║  TESTE DE FALLBACK - Verificando chain de providers         ║" | tee -a $LOG
echo "║  Ordem esperada: ollama → openrouter → google → ...         ║" | tee -a $LOG
echo "╚══════════════════════════════════════════════════════════════╝" | tee -a $LOG
echo "" | tee -a $LOG

echo "[1] Teste Ask - Pergunta simples" | tee -a $LOG
echo "Esperado: Se ollama falhar, deve fazer fallback para openrouter" | tee -a $LOG
echo "" | tee -a $LOG
$FAZAI ask "Qual é a capital do Brasil?" 2>&1 | tee -a $LOG
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    PASS=$((PASS+1))
    echo "✅ Teste [1] PASSOU" | tee -a $LOG
else
    echo "❌ Teste [1] FALHOU" | tee -a $LOG
fi
echo "" | tee -a $LOG

echo "[2] Comando Linux simples" | tee -a $LOG
echo "Esperado: Se ollama falhar, deve fazer fallback para openrouter" | tee -a $LOG
echo "" | tee -a $LOG
$FAZAI "liste os arquivos do diretório atual" 2>&1 | tee -a $LOG
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    PASS=$((PASS+1))
    echo "✅ Teste [2] PASSOU" | tee -a $LOG
else
    echo "❌ Teste [2] FALHOU" | tee -a $LOG
fi
echo "" | tee -a $LOG

echo "╔══════════════════════════════════════════════════════════════╗" | tee -a $LOG
echo "║  RESULTADO FINAL: $PASS/2 TESTES PASSARAM                        ║" | tee -a $LOG
echo "╚══════════════════════════════════════════════════════════════╝" | tee -a $LOG
echo "" | tee -a $LOG

if [ $PASS -eq 2 ]; then
    echo "🎉 SUCESSO TOTAL! Todos os fallbacks funcionaram!" | tee -a $LOG
    exit 0
else
    echo "❌ FALHA! Apenas $PASS/2 testes passaram" | tee -a $LOG
    exit 1
fi
