#!/bin/bash
# Script de Execução das Tasks com Jules
# Projeto: FazAI - Refatoração APIs Dashboard
# Data: 2025-12-17

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  FazAI - Execução de Tasks com Jules"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Diretório do projeto
PROJECT_DIR="/home/rluft/fazai-ng"
cd "$PROJECT_DIR"

# Função para executar task com Jules
execute_task() {
    local task_num=$1
    local task_file="/tmp/jules-task-${task_num}.txt"
    local task_name=$2
    local priority=$3

    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${priority} Task ${task_num}: ${task_name}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    if [ ! -f "$task_file" ]; then
        echo -e "${RED}❌ Arquivo não encontrado: $task_file${NC}"
        return 1
    fi

    echo -e "${YELLOW}📋 Conteúdo da task:${NC}"
    echo ""
    cat "$task_file"
    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    echo ""

    # Perguntar se deve continuar
    read -p "Executar esta task com Jules? (s/N): " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        echo -e "${YELLOW}⏭️  Task ${task_num} pulada${NC}"
        return 0
    fi

    echo ""
    echo -e "${GREEN}🚀 Executando Jules...${NC}"
    echo ""

    # Opção 1: Jules CLI direto (se disponível)
    if command -v jules &> /dev/null; then
        echo -e "${BLUE}Usando Jules CLI...${NC}"
        cat "$task_file" | jules
        JULES_EXIT=$?
    else
        # Opção 2: Instruções manuais
        echo -e "${YELLOW}Jules CLI não disponível. Siga estas instruções:${NC}"
        echo ""
        echo "1. Abra Jules (interface web ou CLI)"
        echo "2. Copie o conteúdo acima"
        echo "3. Cole no Jules e envie"
        echo "4. Aguarde o plano do Jules"
        echo "5. Aprove o plano quando apresentado"
        echo "6. Aguarde execução completa"
        echo ""
        read -p "Pressione ENTER quando Jules concluir a task..."
        JULES_EXIT=0
    fi

    if [ $JULES_EXIT -ne 0 ]; then
        echo -e "${RED}❌ Jules falhou na Task ${task_num}${NC}"
        return 1
    fi

    echo ""
    echo -e "${GREEN}✅ Task ${task_num} concluída pelo Jules${NC}"
    echo ""

    # Code Review
    echo -e "${YELLOW}🔍 Iniciando Code Review...${NC}"
    echo ""

    read -p "Executar code-reviewer agent? (S/n): " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        echo -e "${BLUE}Executando code-reviewer...${NC}"
        echo ""
        echo "Use o seguinte prompt no code-reviewer:"
        echo ""
        echo "  Revise as mudanças da Task ${task_num}: ${task_name}"
        echo ""
        read -p "Pressione ENTER quando code review estiver completo..."
    fi

    echo ""
    echo -e "${GREEN}✅ Task ${task_num} COMPLETA (implementação + review)${NC}"
    echo ""
}

# Menu principal
echo "Escolha a task para executar:"
echo ""
echo "  1) Task 1: Dashboard API Status (3h) 🔴"
echo "  2) Task 2: Cloudflare Integration (10-11h) 🔴"
echo "  3) Task 3: SpamExperts Manager (16-18h) 🟡"
echo "  4) Task 4: OPNsense Manager (19-22h) 🟢"
echo "  5) Executar TODAS em sequência (48-54h total)"
echo "  6) Status das tasks"
echo "  0) Sair"
echo ""
read -p "Opção: " option

case $option in
    1)
        execute_task 1 "Dashboard API Status" "${RED}🔴 URGENTE${NC}"
        ;;
    2)
        execute_task 2 "Cloudflare Integration" "${RED}🔴 URGENTE${NC}"
        ;;
    3)
        execute_task 3 "SpamExperts Manager" "${YELLOW}🟡 MÉDIA${NC}"
        ;;
    4)
        execute_task 4 "OPNsense Manager" "${GREEN}🟢 MÉDIA-BAIXA${NC}"
        ;;
    5)
        echo ""
        echo -e "${BLUE}Executando TODAS as tasks em sequência...${NC}"
        echo ""
        execute_task 1 "Dashboard API Status" "${RED}🔴 URGENTE${NC}" && \
        execute_task 2 "Cloudflare Integration" "${RED}🔴 URGENTE${NC}" && \
        execute_task 3 "SpamExperts Manager" "${YELLOW}🟡 MÉDIA${NC}" && \
        execute_task 4 "OPNsense Manager" "${GREEN}🟢 MÉDIA-BAIXA${NC}"

        if [ $? -eq 0 ]; then
            echo ""
            echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
            echo -e "${GREEN}  ✅ TODAS AS TASKS CONCLUÍDAS COM SUCESSO!${NC}"
            echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
            echo ""
            echo "Resumo:"
            echo "  ✓ Task 1: Dashboard API Status"
            echo "  ✓ Task 2: Cloudflare Integration"
            echo "  ✓ Task 3: SpamExperts Manager"
            echo "  ✓ Task 4: OPNsense Manager"
            echo ""
            echo "Próximos passos:"
            echo "  1. Rodar: npm test"
            echo "  2. Testar CLI: /dashboard, /cloudflare, /spamexperts, /opnsense"
            echo "  3. Verificar CHANGELOG.md"
            echo "  4. Git push quando satisfeito"
        fi
        ;;
    6)
        echo ""
        echo "Status das Tasks:"
        echo ""
        echo "Task 1: Dashboard API Status"
        echo "  Status: Pendente"
        echo "  Arquivo: /tmp/jules-task-1.txt"
        echo "  Detalhes: .claude/tasks/task-1-dashboard-api-status.md"
        echo ""
        echo "Task 2: Cloudflare Integration"
        echo "  Status: Pendente"
        echo "  Arquivo: /tmp/jules-task-2.txt"
        echo "  Detalhes: .claude/tasks/task-2-cloudflare-ui-integration.md"
        echo ""
        echo "Task 3: SpamExperts Manager"
        echo "  Status: Pendente"
        echo "  Arquivo: /tmp/jules-task-3.txt"
        echo "  Detalhes: .claude/tasks/task-3-spamexperts-manager.md"
        echo ""
        echo "Task 4: OPNsense Manager"
        echo "  Status: Pendente"
        echo "  Arquivo: /tmp/jules-task-4.txt"
        echo "  Detalhes: .claude/tasks/task-4-opnsense-manager.md"
        echo ""
        ;;
    0)
        echo ""
        echo "Saindo..."
        exit 0
        ;;
    *)
        echo ""
        echo -e "${RED}Opção inválida${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Execução finalizada${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
