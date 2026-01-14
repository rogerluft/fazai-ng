# FazAI v3.12.0 - Pendências para Próxima Sessão

**Data:** 2025-12-28
**Commit Atual:** 2e8e8f1 (v3.12.0)
**Testes:** 458 passando, 5 skipped

---

## Fases Concluídas (1-5, 8)

| Fase | Descrição | Status |
|------|-----------|--------|
| 1 | ECOA Docs | ✅ Documentado em docs/ |
| 2 | Limpeza codebase | ✅ 4 órfãos arquivados |
| 3 | Cache semântico híbrido | ✅ In-memory + normalize.ts |
| 4 | Hook TDD enforcer | ✅ Husky + pre-commit |
| 5 | Versionamento | ✅ Gap investigado OK |
| 8 | Documentação + commit | ✅ v3.12.0 committed |

---

## Fases Pendentes

### Fase 6: Testes Adicionais

**Objetivo:** Aumentar cobertura de testes em áreas críticas

**Candidatos a testar:**
1. `src/linux-admin.ts` - Gerador de comandos (core)
2. `src/askAI.ts` - Orquestrador de providers
3. `src/services/samba.ts` - Wrapper fzsamba
4. `src/dashboard/` - REST API Dashboard
5. `src/genai/fazai-core.genai.mjs` - GenAIScript agentic

**Métricas atuais:**
- 30 test files
- 458 tests passing
- 5 skipped (archived modules)

**Sugestão:** Focar em `linux-admin.ts` e `askAI.ts` (alto impacto)

---

### Fase 7: Interface Web

**Objetivo:** Melhorar dashboard web

**Candidatos:**
1. Página Samba no dashboard (já tem rota `/api/samba`)
2. Visualização de cache semântico
3. Métricas de testes em tempo real
4. Status de collections Qdrant

**Stack atual:**
- Express.js backend (`src/dashboard/`)
- React frontend (`web/`)
- API REST em `/api/*`

---

## Arquivos-Chave Criados/Modificados

```
# Novos
src/utils/normalize.ts           # Query normalizer (38 testes)
tests/utils/normalize.test.ts    # Testes normalização
.husky/pre-commit                # TDD Enforcer hook

# Refatorados
src/services/semantic-cache.ts   # 690→470 linhas (in-memory)

# Arquivados (em archive/)
archive/api-status-checker.ts
archive/tactical-brain.ts
archive/query-analyzer.ts
archive/tests/tactical-brain.test.ts
archive/tests/web-crawler.test.ts
```

---

## Decisões de Design v3.12.0

1. **Cache Semântico**: In-memory Map + cosine similarity (0.90 threshold)
2. **Normalização**: Médio (lowercase + trim + stopwords PT)
3. **TDD Hook**: Full test suite no pre-commit (não lint-staged parcial)
4. **Arquivamento**: Código órfão preservado em archive/ (não deletado)

---

## Comandos Úteis

```bash
# Rodar testes
npm test

# Build
npm run build

# Verificar help
fazai --help
fazai samba --help

# Verificar completion
source /etc/bash_completion.d/fazai-completion.bash
fazai <TAB>

# Bypass TDD hook (emergência)
git commit --no-verify -m "emergency fix"
```

---

## Próximos Passos Sugeridos

1. **Fase 6**: Criar testes para `linux-admin.ts` (core do sistema)
2. **Fase 7**: Implementar página Samba no dashboard web
3. **Opcional**: Adicionar coverage report ao CI/CD
4. **Opcional**: Melhorar stopwords PT no normalize.ts

---

**Gerado por:** Claude Opus 4.5
**Sessão:** Consolidação v3.11.1 → v3.12.0
