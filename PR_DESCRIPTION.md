# Terminal Jarvis: Arquitetura autônoma com Genkit + RAG (5 collections Qdrant)

## 🤖 Terminal Jarvis - Arquitetura de Agente Autônomo

Transição completa do FazAI para **Terminal Jarvis**: CLI de administração Linux com capacidades autônomas via AutoGPT + Genkit.

### 🎯 Arquitetura

```
Terminal Jarvis + AutoGPT
    ↓
Genkit Plugins (Anthropic, Mistral, OpenAI)
    ↓
Qdrant Vector Store (RAG)
    ↓
5 Collections Especializadas
```

### ✨ Novas Collections Qdrant

**1. `jarvis_personality`** - Personalidade do agente
- Traits, valores, estilo de comunicação
- Intensidade e contexto de aplicação

**2. `jarvis_memory`** - Memória de longo prazo
- Conversas e ações autônomas
- Contexto emocional detectado
- Score de importância

**3. `jarvis_learning`** - Aprendizado contínuo
- Erros, acertos e padrões descobertos
- Contador de aplicações bem-sucedidas
- Confiança na lição aprendida

**4. `jarvis_kb`** - Base de conhecimento (RAG)
- Soluções Linux e redes validadas
- Comandos e procedures
- Categorização por distro/componente

**5. `jarvis_inference`** - Regras manuais
- Decisões explícitas do usuário
- Políticas e condições customizadas
- Priorização de execução

### 🔄 Breaking Changes

- ❌ **Remove Milvus/Zilliz** completamente
- ✅ **Qdrant exclusivo** como vector store
- 🔄 Collections renomeadas: `fazai_*` → `jarvis_*`

### 📝 Documentação

- CLAUDE.md atualizado em PT-BR
- Arquitetura completa documentada
- 5 modos de operação detalhados
- Schema completo de todas as collections

### 🗑️ Removido

- Dependência `@zilliz/milvus2-sdk-node`
- 410+ linhas de código Milvus
- Providers "milvus" e "zilliz"

### 📦 Mudanças

- **3 arquivos alterados**: CLAUDE.md, package.json, vector-store.ts
- **+690 linhas**, **-412 linhas**

### 🚀 Próximos Passos

- [ ] Integração Genkit plugins
- [ ] GPTCache para performance
- [ ] Zero Trust wrappers
- [ ] Interface web de monitoramento
- [ ] Autonomous agent loops

---

**Referências originais mantidas:**
- Fork de Mandark (Hrishi Olickel) - Apache 2.0
- Documentação original citada

**Nova documentação:** CC BY 4.0

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---

## Para criar o PR:

```bash
gh pr create --title "Terminal Jarvis: Arquitetura autônoma com Genkit + RAG (5 collections Qdrant)" \
  --body-file PR_DESCRIPTION.md \
  --head claude/claude-md-mhz9jvk4tyerueu5-016SKNYEgrr5T6KU5XkgNy7F
```

Ou acesse: https://github.com/rogerluft/fazai-ng/compare/claude/claude-md-mhz9jvk4tyerueu5-016SKNYEgrr5T6KU5XkgNy7F
