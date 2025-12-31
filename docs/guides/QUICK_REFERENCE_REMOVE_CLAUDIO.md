# Quick Reference: Remover claudio15-11-25 do Histórico Git

## Resposta Rápida

Para remover permanentemente a pasta `claudio15-11-25` (ou qualquer outra pasta com padrão `claudio*`) do histórico Git:

### Opção 1: Script Automatizado (Recomendado)

```bash
# Modo dry-run (simulação segura)
./scripts/git-purge-folder.sh claudio15-11-25 --dry-run

# Executar de verdade
./scripts/git-purge-folder.sh claudio15-11-25

# Remover TODOS arquivos claudio*
./scripts/git-purge-folder.sh "claudio*" --glob
```

### Opção 2: Manual com git-filter-repo

```bash
# 1. Instalar git-filter-repo
pip install git-filter-repo

# 2. Remover do histórico
git filter-repo --path claudio15-11-25 --invert-paths --force

# 3. Force push
git push origin --force --all
git push origin --force --tags
```

## ⚠️ Importante

- Esta operação é **irreversível**
- Requer `git push --force`
- Colaboradores precisarão re-clonar o repositório
- Faça backup antes de executar

## Documentação Completa

Para guia detalhado com múltiplos métodos e troubleshooting:

📖 **[docs/guides/REMOVE_FROM_GIT_HISTORY.md](REMOVE_FROM_GIT_HISTORY.md)**

## Prevenção

O arquivo `.gitignore` já contém regras para evitar commits futuros:

```gitignore
claudio*
Claudio*
```

Localização: `.gitignore` linhas 188-189

## Verificação Pós-Remoção

```bash
# Verificar se foi removido
git log --all --oneline -- claudio15-11-25

# Se retornar vazio = sucesso ✓
```

---

**Versão:** 1.0.0  
**Data:** 2025-12-31  
**Autor:** FazAI Team
