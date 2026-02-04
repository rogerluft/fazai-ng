# FazAI TODO List

## 🚨 Prioridade Crítica (Pós-Jules)

### 0. Pendências da Sessão Atual (2025-12-31)
- **Ajustar timeout da AI local nos testes e ambiente**
  - Testes com AI local estão com timeout muito curto
  - Verificar vitest.config.ts e variáveis de ambiente
- **Fazer cleaner ignorar pasta `restricted/`**
  - Adicionar `restricted` aos diretórios protegidos em `genaisrc/cleaner.genai.mjs`
  - Pasta contém documentos confidenciais/avaliações

---

### 1. Implementar fzagent (Proactive Bastion)
- **Status:** Planejado
- **Descrição:** Novo agente de infraestrutura (TraumaZero + Kaseya + ZeroTrust) para monitoramento proativo.
- **Ações:**
  - Criar daemon de monitoramento de recursos (RAM, Swap, Qdrant).
  - Implementar Circuit Breaker sistêmico para proteger o Host.
  - Garantir modo de operação seguro (Safe Mode) em caso de falha de subsistemas.

### 2. Documentar Sub-Helps Faltantes
- **Status:** Aberto
- **Descrição:** Vários subcomandos não têm uma tela de `--help` dedicada.
- **Ações:**
  - Criar documentação de ajuda para:
    - `fazai ask --help`
    - `fazai alias --help`
    - `fazai vector --help`
    - `fazai index --help`
  - **Delegação:** Pode ser uma tarefa para o agente `documentation-expert` do Claude.

## 🔴 Prioridade Alta (Infraestrutura)


### 1. Remover suporte Milvus
- **Status:** Pendente
- **Descrição:** Retirar todas as referências a Milvus do código
- **Ações:**
  - Manter SOMENTE Qdrant como vector store
  - Ajustar CHANGELOG e documentação
  - Remover arquivos relacionados a Milvus
  - Atualizar testes

### 2. Refatorar instalação para links simbólicos
- **Status:** Pendente
- **Descrição:** Mudar de cópia de arquivos para symlinks relativos
- **Ações:**
  - Garantir integridade com repositório local (`git clone` + instalador)
  - Instalação via curl | bash → versão produção (não symlinks)
  - Atualizar `install.sh` e documentação
  - Testar em ambiente limpo

### 3. Revisar features vs help vs completion
- **Status:** Pendente
- **Descrição:** Garantir sincronização entre código, help e completion
- **Ações:**
  - Revisar TODAS as features/parâmetros
  - Validar `fazai --help` reflete código atual
  - Validar bash completion reflete comandos disponíveis
  - Atualizar documentação se necessário

---

## 🟡 Prioridade Média (Funcionalidades)

### 4. Integrar GPTCache
- **Status:** Pendente
- **Descrição:** Instalar e integrar GPTCache no fluxo de tarefas
- **Ações:**
  - Adicionar GPTCache como dependência
  - Integrar ao mecanismo de cache existente
  - Configurar em `fazai.conf`
  - Documentar uso

### 5. Melhorar mecanismo de fallback e aprendizado
- **Status:** Parcialmente implementado (v3.6.12-beta)
- **Descrição:** Aprimorar quebra de tarefas com aprendizado de erro/acerto
- **Ações:**
  - ✅ Fallback entre providers implementado
  - ⏳ Aprendizado com erro/acerto (histórico de tentativas)
  - ⏳ Fallbacks definidos em `/etc/fazai/fazai.conf`
  - ⏳ Métricas de sucesso por provider

### 6. Melhorar documentação profissional
- **Status:** Em progresso
- **Descrição:** Analisar e aprimorar TODA documentação
- **Ações:**
  - Usar agente `documentation-expert` para revisão
  - Verificar consistência entre README, CHANGELOG, docs/
  - Adicionar diagramas de arquitetura
  - Exemplos de uso completos

---

## 🟢 Prioridade Baixa (Novas Features)

### 7. Integração Perplexity Sonar
- **Status:** Planejado (5 prompts prontos)
- **Descrição:** Adicionar Perplexity como 6º provider
- **Prompts disponíveis:**
  1. Arquitetura de Integração Perplexity
  2. Implementação do Provider Perplexity (`src/providers/perplexity-provider.ts`)
  3. Integração com ResearchCoordinator
  4. CLI Command - `fazai ask` com Perplexity
  5. Documentação para README + Config
- **API Key:** Disponível (ver `docs/planning/TODO.md` linha 36)
- **Ações:**
  - Implementar provider seguindo padrão existente
  - Integrar ao ResearchCoordinator
  - Adicionar modelos: sonar, sonar-pro, sonar-reasoning
  - Documentar vantagens: busca web integrada

---

## ✅ Tarefas Concluídas (Histórico Recente)

### v3.6.12-beta (2025-12-17)
- ✅ **Provider Fallback Chain** - askAI.ts agora faz fallback automático entre providers
- ✅ Logs transparentes (INFO level)
- ✅ Streaming mantido na primeira tentativa

### v3.6.11-beta (2025-12-17)
- ✅ **Completion dinâmico** - Lê modelos de `/etc/fazai/fazai.conf` (zero hardcoded)
- ✅ Parser runtime com cache (~4ms)

### v3.6.10-beta (2025-12-17)
- ✅ **Security hardening** - Auto-install com sudo não-interativo
- ✅ Timeout enforcement (1s/5s/10s)
- ✅ Pre-check passwordless sudo

### Anteriores
- ✅ Bug de vírgulas em linguagem natural (2025-12-10)
- ✅ Source no bash completion após build (auto-install)
- ✅ Tarefas pendentes Jules/Gemini verificadas (nenhuma encontrada)

---

## 📋 Regras de Desenvolvimento

### ❌ PROIBIDO
- Placeholders ou substituições
- Simulações ou código hardcoded
- Qualquer tipo de mentira no código
- Commits sem testes

### ✅ OBRIGATÓRIO
- Usar agentes especializados sempre que possível
- Code review por agente parceiro para cada mudança
- Seguir orientações do `AGENTS.md`
- Atualizar CHANGELOG.md em toda mudança
- Documentar alterações

### 🔍 Antes de Finalizar Qualquer Tarefa
1. Documentar alterações (CHANGELOG.md, README.md)
2. Conferir Help (`fazai -h`, `fazai --help`)
3. Conferir e testar bash completion
4. Atualizar instalador se necessário
5. Rodar `npm test && npm run build`

---

## 🔗 Referências

- **AGENTS.md** - Orquestração multi-agente e templates de delegação
- **CLAUDE.md** - Instruções master e regras absolutas
- **CHANGELOG.md** - Histórico completo de versões
- **docs/planning/TODO.md** - Detalhes técnicos de integração Perplexity

---

**Versão Atual:** 3.6.12-beta
**Última Atualização:** 2025-12-17

## [FUTURO] Web API - 38 funções pendentes

### Memory
- getMemory, createMemory, deleteMemory, searchMemory

### Learning  
- getLearning, createLearning, deleteLearning, searchLearning

### Knowledge
- getKnowledge, createKnowledge, deleteKnowledge, searchKnowledge

### Inference
- getRules, createRule, updateRule, deleteRule, testRule

### Personality
- getPersonality, updatePersonality, getTraits, updateTrait

### Agent
- getAgentStatus, getRecentActions, controlAgent

### Samba
- getSambaStatus, testSambaConnection

---
*Adicionado: 2025-12-31 (sessão cleaner v3.14.1)*
