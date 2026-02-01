#!/bin/bash
# Script para testar OpenRouter com curl e TypeScript
# Busca configurações de /etc/fazai/fazai.conf

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=================================================="
echo "  TESTE OPENROUTER - Curl + TypeScript"
echo "=================================================="
echo ""

# Ler configurações do fazai.conf
CONF_FILE="/etc/fazai/fazai.conf"

if [ ! -f "$CONF_FILE" ]; then
    echo -e "${RED}❌ Arquivo de configuração não encontrado: $CONF_FILE${NC}"
    exit 1
fi

# Extrair API Key e Modelos
API_KEY=$(grep "^OPENROUTER_API_KEY=" "$CONF_FILE" | cut -d'=' -f2)
MODELS=$(grep "^MODELS_OPENROUTER=" "$CONF_FILE" | cut -d'=' -f2)

# Pegar primeiro modelo da lista
FIRST_MODEL=$(echo "$MODELS" | cut -d',' -f1)

echo -e "${YELLOW}📋 Configurações lidas de $CONF_FILE:${NC}"
echo "   API Key: ${API_KEY:0:20}...${API_KEY: -10}"
echo "   Modelos: $MODELS"
echo "   Primeiro modelo: $FIRST_MODEL"
echo ""

# Teste 1: CURL
echo -e "${YELLOW}[1/2] Testando com CURL...${NC}"
echo ""

CURL_RESPONSE=$(curl -s https://openrouter.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d "{
  \"model\": \"$FIRST_MODEL\",
  \"messages\": [
    {
      \"role\": \"user\",
      \"content\": \"Responda em UMA palavra: qual é a capital do Brasil?\"
    }
  ]
}")

echo "Resposta completa do curl:"
echo "$CURL_RESPONSE" | jq '.' 2>/dev/null || echo "$CURL_RESPONSE"
echo ""

# Verificar se teve sucesso
if echo "$CURL_RESPONSE" | jq -e '.choices[0].message.content' > /dev/null 2>&1; then
    CURL_CONTENT=$(echo "$CURL_RESPONSE" | jq -r '.choices[0].message.content')
    echo -e "${GREEN}✅ CURL funcionou!${NC}"
    echo "   Resposta: $CURL_CONTENT"
else
    echo -e "${RED}❌ CURL falhou!${NC}"
    ERROR_MSG=$(echo "$CURL_RESPONSE" | jq -r '.error.message' 2>/dev/null || echo "Erro desconhecido")
    echo "   Erro: $ERROR_MSG"
fi
echo ""

# Teste 2: TypeScript/Node.js
echo -e "${YELLOW}[2/2] Testando com TypeScript (Node.js + fetch)...${NC}"
echo ""

cat > /tmp/test-openrouter.mjs << 'EOF'
const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL;

async function testOpenRouter() {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": MODEL,
        "messages": [
          {
            "role": "user",
            "content": "Responda em UMA palavra: qual é a capital do Brasil?"
          }
        ]
      })
    });

    const data = await response.json();

    if (data.choices && data.choices[0]) {
      console.log("✅ TypeScript/Node.js funcionou!");
      console.log("   Resposta:", data.choices[0].message.content);
      return true;
    } else if (data.error) {
      console.log("❌ TypeScript/Node.js falhou!");
      console.log("   Erro:", data.error.message);
      return false;
    }
  } catch (error) {
    console.log("❌ Exceção no TypeScript/Node.js!");
    console.log("   Erro:", error.message);
    return false;
  }
}

testOpenRouter();
EOF

OPENROUTER_API_KEY="$API_KEY" OPENROUTER_MODEL="$FIRST_MODEL" node /tmp/test-openrouter.mjs

echo ""
echo "=================================================="
echo "  TESTE COMPLETO"
echo "=================================================="
