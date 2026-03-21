# Delegação de Tasks para Jules

**Data:** 2025-12-17
**Orquestrador:** Claude Code
**Executor:** Jules (Google AI Software Engineer)
**Projeto:** FazAI - Refatoração de APIs Dashboard e Cloudflare

---

## Contexto Geral

O projeto FazAI possui interfaces visuais (UI) que atualmente usam métodos MOCK em vez de APIs reais. Algumas APIs têm managers implementados mas não são usados. As tasks abaixo refatoram essa arquitetura para usar APIs reais.

**Análise Completa:** Realizada pelo agente fullstack-developer (relatório disponível internamente)

---

## 🎯 Ordem de Execução (Sequencial)

### Task 1: Fix Dashboard API Status (3h) 🔴 URGENTE
**Arquivo:** `/tmp/jules-task-1.txt`
**Prioridade:** Alta - resolve verificação incorreta de status
**Executar:** PRIMEIRO

### Task 2: Integrar CloudflareUI com Manager (10-11h) 🔴 URGENTE
**Arquivo:** `/tmp/jules-task-2.txt`
**Prioridade:** Alta - resolve "Cloudflare não funciona"
**Executar:** SEGUNDO (após Task 1)

### Task 3: Criar SpamExpertsManager (16-18h) 🟡 MÉDIA
**Arquivo:** `/tmp/jules-task-3.txt`
**Prioridade:** Média - nova implementação completa
**Executar:** TERCEIRO (após Task 2)

### Task 4: Criar OPNsenseManager (19-22h) 🟢 MÉDIA-BAIXA
**Arquivo:** `/tmp/jules-task-4.txt`
**Prioridade:** Média-Baixa - nova implementação completa
**Executar:** QUARTO (após Task 3)

---

## 📋 Instruções para Delegação

### Opção A: Jules CLI
```bash
# Task 1
cat /tmp/jules-task-1.txt | jules

# Aguardar conclusão e aprovação, depois:
cat /tmp/jules-task-2.txt | jules

# E assim por diante...
```

### Opção B: Jules Web Interface
1. Copiar conteúdo de `/tmp/jules-task-1.txt`
2. Colar na interface do Jules
3. Aguardar plano e aprovar
4. Aguardar execução
5. Repetir para tasks 2, 3, 4

### Opção C: Sessões Paralelas (se Jules suportar)
Jules pode rodar tasks paralelas. Se disponível:
- Task 1 + Task 2 (relacionadas - fazer sequencial)
- Task 3 + Task 4 (independentes - podem ser paralelas)

---

## 🔍 Revisão com Code Reviewer

**IMPORTANTE:** Após Jules completar cada task, revisar com code-reviewer agent:

```bash
# Após Task 1
npx claude-code-templates@latest --agent=development-tools/code-reviewer --yes
# Prompt: "Revise as mudanças da Task 1: Dashboard API Status"

# Após Task 2
# Prompt: "Revise as mudanças da Task 2: CloudflareUI integration"

# E assim por diante...
```

---

## 📊 Estimativas Totais

| Componente | Horas | Status |
|------------|-------|--------|
| Task 1: Dashboard | 3h | Pendente |
| Task 2: Cloudflare | 10-11h | Pendente |
| Task 3: SpamExperts | 16-18h | Pendente |
| Task 4: OPNsense | 19-22h | Pendente |
| **TOTAL** | **48-54h** | **0/4 completas** |

---

## ✅ Critérios de Sucesso Global

1. **Dashboard** mostra status real das APIs (não mais 401/offline falso)
2. **Cloudflare** UI funciona com dados reais (sem mocks)
3. **SpamExperts** UI funciona com dados reais (sem mocks)
4. **OPNsense** UI funciona com dados reais (sem mocks)
5. **Testes** passando (npm test)
6. **CHANGELOG.md** atualizado com v3.6.14, v3.6.15, v3.6.16
7. **Commits** descritivos para cada task

---

## 🚨 Regras Importantes

1. **PROIBIDO** manter métodos mock após refatoração
2. **OBRIGATÓRIO** deletar seções mock comentadas como "TODO"
3. **OBRIGATÓRIO** usar tipos TypeScript (sem `any`)
4. **OBRIGATÓRIO** tratamento de erro graceful
5. **FLEXIBILIDADE** total para melhorias funcionais/visuais/prevenir bugs

---

## 📁 Arquivos de Referência

**Tasks Detalhadas:**
- `/home/rluft/fazai-ng/.claude/tasks/task-1-dashboard-api-status.md`
- `/home/rluft/fazai-ng/.claude/tasks/task-2-cloudflare-ui-integration.md`
- `/home/rluft/fazai-ng/.claude/tasks/task-3-spamexperts-manager.md`
- `/home/rluft/fazai-ng/.claude/tasks/task-4-opnsense-manager.md`

**Tasks Resumidas (para Jules):**
- `/tmp/jules-task-1.txt`
- `/tmp/jules-task-2.txt`
- `/tmp/jules-task-3.txt`
- `/tmp/jules-task-4.txt`

**Relatório de Análise:**
- Disponível no histórico do agente fullstack-developer (a06d493)

---

## 🔄 Workflow Recomendado

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Jules recebe Task 1                                      │
│    ↓                                                         │
│ 2. Jules analisa, apresenta plano (set_plan)                │
│    ↓                                                         │
│ 3. Aprovação do plano                                       │
│    ↓                                                         │
│ 4. Jules executa, roda testes, faz commit                   │
│    ↓                                                         │
│ 5. Code-reviewer revisa mudanças                            │
│    ↓                                                         │
│ 6. Se aprovado → Task 2                                     │
│    Se problemas → Jules corrige                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 Notas Finais

- **Credenciais:** Todas as chaves de API estão em `/etc/fazai/fazai.conf`, `~/.env`, ou `/root/.env`
- **Testes:** Rodar `npm test` e testar manualmente no CLI após cada task
- **Documentação:** Jules deve atualizar CHANGELOG.md e fazer commit descritivo
- **Flexibilidade:** Jules tem total liberdade para melhorias arquiteturais, visuais, e prevenção de bugs

---

**Orquestrador:** Claude Code
**Status:** Tasks preparadas e prontas para delegação
**Próximo Passo:** Executar Task 1 com Jules
