---
name: auto-push-after-commit
enabled: true
event: bash
pattern: git\s+commit
action: warn
---

# Push Automático Após Commit

Após cada commit bem-sucedido, faça push automaticamente.

## Regra

Quando um `git commit` for executado com sucesso:

1. **Verificar status:** `git status` para confirmar commit foi feito
2. **Fazer push:** `git push origin <branch> --tags`

## Comando

```bash
git push origin $(git branch --show-current) --tags
```

## Justificativa

- Commits locais sem push não têm valor para o projeto
- O repositório remoto deve estar sempre sincronizado
- Tags devem ser enviadas junto com commits

**Ação:** Sempre execute push após commit bem-sucedido.
