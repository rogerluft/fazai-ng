# FazAI Consolidation Plan - v3.12.0

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Limpeza do codebase, consolidação Qdrant, e documentação ECOA

**Architecture:** Manter 6 collections Qdrant (remover semantic_cache do Qdrant), arquivar código órfão, implementar hook TDD

**Tech Stack:** TypeScript, Qdrant, Vitest, Claude Hooks

---

## Fase 1: Documentação ECOA (PRIORIDADE ALTA)

**Owner:** Roginho (manual)
**Ação:** Copiar documentação ECOA de https://fcc.rogerluft.com.br para docs/

### Task 1.1: Criar docs/ECOA.md
- Copiar conteúdo completo do site
- Formatar para Markdown
- Adicionar link no README.md

---

## Fase 2: Limpeza Codebase (JULES)

**Owner:** Jules via Gemini
**Arquivos identificados para ação:**

### DELETAR (sem valor):
```
scripts/fzsamba.dump           # Dump de debug
scripts/my-smbdfe80790f.pp     # SELinux temp
scripts/my-smbdfe80790f.te     # SELinux temp
docs/BUGS_LOGS.tmp             # Temp file
```

### ARQUIVAR (mover para archive/):
```
src/services/tactical-brain.ts      # Órfão - experimento abandonado
src/research/query-analyzer.ts      # Órfão - stub não usado
src/services/api-status-checker.ts  # Órfão - substituído por resilience-orchestrator
```

### REVISAR (análise humana):
```
scripts/backup-code.sh              # Documentar ou integrar
scripts/backup-qdrant.sh            # Documentar ou integrar
scripts/cleanup-qdrant-backups.sh   # Documentar ou integrar
scripts/link-for-dev.sh             # Mover para docs/DEVELOPMENT.md
scripts/recreate-collections.sh     # Integrar como `fazai qdrant recreate`
scripts/consolidate-fazai.sh        # Avaliar propósito
scripts/setup0_selinux_roles.sh     # Documentar ou arquivar
scripts/setup1_patch.sh             # Documentar ou arquivar
scripts/setup2_patch.sh             # Documentar ou arquivar
```

---

## Fase 3: Consolidação Qdrant (CLAUDE + AGENTES)

**Owner:** Claude Code com agentes especializados

### Estrutura Final (6 collections):

| Collection | Propósito | Weight neural-flow |
|------------|-----------|-------------------|
| `personality` | Identidade única | 0.0 (load on startup) |
| `memory` | Histórico conversacional | 0.20 |
| `learning` | Padrões auto-aprendidos | 0.40 |
| `kb` | Conhecimento documentado | 0.30 |
| `inference` | Regras do usuário | 0.10 |
| `source` | Meta-análise código | N/A |

### Task 3.1: Refatorar semantic-cache.ts
**Ação:** Remover dependência Qdrant, manter apenas Map em-memory

```typescript
// ANTES: Qdrant + Map fallback
// DEPOIS: Apenas Map em-memory (mais simples, mais rápido)
```

**Arquivos:**
- Modify: `src/services/semantic-cache.ts`
- Modify: `src/vector-store.ts` (remover schema semantic_cache)

### Task 3.2: Atualizar vector-store.ts
**Ação:** Remover `fazai_semantic_cache` de COLLECTION_SCHEMAS

### Task 3.3: Validar neural-flow.ts
**Ação:** Confirmar que weights estão corretos (já estão)

---

## Fase 4: Hook TDD (CLAUDE)

**Owner:** Claude Code

### Task 4.1: Criar hook pre-edit
**Arquivo:** `.claude/hooks/tdd-enforcer.sh`

```bash
#!/bin/bash
# Hook: Antes de editar arquivo .ts, verificar se teste existe
FILE="$1"
if [[ "$FILE" == *.ts && "$FILE" != *.test.ts ]]; then
  TEST_FILE="${FILE%.ts}.test.ts"
  if [[ ! -f "$TEST_FILE" ]]; then
    echo "⚠️ TDD: Crie $TEST_FILE antes de modificar $FILE"
  fi
fi
```

### Task 4.2: Documentar em AGENTS.md
**Ação:** Adicionar seção sobre TDD enforcement

### Task 4.3: Documentar em CLAUDE.md
**Ação:** Adicionar regra de TDD

---

## Fase 5: Recuperar Versionamento (INVESTIGAÇÃO)

**Owner:** Claude Code

### Task 5.1: Investigar git log
```bash
git log --oneline --all | grep -E "3\.[6-9]|3\.1[0-1]"
```

### Task 5.2: Documentar gap
**Ação:** Se houve perda, documentar em CHANGELOG.md como "histórico perdido"

---

## Fase 6: Validação Final

### Checklist:
- [ ] ECOA.md criado em docs/
- [ ] Arquivos deletados/arquivados
- [ ] semantic-cache refatorado
- [ ] Hook TDD funcionando
- [ ] Versionamento documentado
- [ ] npm run build passa
- [ ] npm test passa (450+ testes)
- [ ] CHANGELOG.md atualizado

---

## Delegação de Tarefas

| Fase | Owner | Ferramenta |
|------|-------|-----------|
| 1. ECOA Docs | Roginho | Manual |
| 2. Limpeza | Jules | Gemini → Jules |
| 3. Qdrant | Claude | Agentes (backend-architect) |
| 4. Hook TDD | Claude | Local |
| 5. Versionamento | Claude | git log |
| 6. Validação | Claude | npm scripts |

---

## Priorização

1. **CRÍTICO:** Fase 1 (ECOA) - Conhecimento institucional em risco
2. **ALTO:** Fase 3 (Qdrant) - Simplificação arquitetural
3. **MÉDIO:** Fase 2 (Limpeza) - Dívida técnica
4. **MÉDIO:** Fase 4 (TDD) - Prevenção de bugs
5. **BAIXO:** Fase 5 (Versioning) - Histórico

---

**Estimativa:** 2-3 sessões de trabalho
**Versão Target:** v3.12.0
