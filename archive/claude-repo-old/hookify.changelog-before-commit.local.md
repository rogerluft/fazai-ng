---
name: changelog-before-commit
enabled: false
event: bash
pattern: git\s+commit
action: block
---

# CHANGELOG Obrigatório

Você está fazendo um commit mas precisa verificar o CHANGELOG.

## Checklist Obrigatório:

1. **CHANGELOG.md** atualizado com as mudanças desta versão?
2. **Versão no package.json** incrementada se necessário?
3. **Data da versão** correta no CHANGELOG?

## Formato esperado no CHANGELOG:

```markdown
## [X.Y.Z-beta] - YYYY-MM-DD

### Features
- Descrição da feature

### Fixes
- Descrição do fix

### Documentation
- O que foi documentado
```

**Ação:** Verifique o CHANGELOG.md antes de prosseguir com o commit.
