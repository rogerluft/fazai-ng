---
name: commit-prompt-user
enabled: true
event: bash
pattern: git\s+push
action: block
---

# Confirmar Push com Usuário

Você está prestes a fazer push. Confirme com o usuário primeiro.

## Antes de Push, Pergunte:

Use o AskUserQuestion tool:

```json
{
  "questions": [{
    "question": "Posso fazer o push para o repositório remoto?",
    "header": "Push",
    "multiSelect": false,
    "options": [
      {"label": "Sim, push agora", "description": "Enviar commits para origin"},
      {"label": "Não, aguardar", "description": "Deixar para o usuário fazer manualmente"},
      {"label": "Mostrar diff primeiro", "description": "Ver o que será enviado antes de decidir"}
    ]
  }]
}
```

## Informações para Mostrar ao Usuário:

1. **Branch atual:** `git branch --show-current`
2. **Commits a enviar:** `git log origin/master..HEAD --oneline`
3. **Arquivos modificados:** `git diff --stat origin/master..HEAD`

## Se Usuário Escolher "Mostrar diff":

```bash
git log origin/master..HEAD --oneline
git diff --stat origin/master..HEAD
```

Depois pergunte novamente se pode fazer push.

**Ação:** Confirme com o usuário antes de executar git push.
