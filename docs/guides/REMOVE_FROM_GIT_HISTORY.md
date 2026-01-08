# Guia: Remover Pasta Permanentemente do Histórico Git

## Visão Geral

Este guia explica como remover permanentemente uma pasta ou arquivo do histórico completo do Git, incluindo todos os commits anteriores.

## ⚠️ AVISOS IMPORTANTES

1. **Operação Irreversível**: Remover do histórico Git é uma operação destrutiva
2. **Requer Force Push**: Você precisará fazer `git push --force` 
3. **Afeta Colaboradores**: Todos que clonaram o repo precisarão re-clonar ou fazer `git pull --rebase`
4. **Backup Recomendado**: Faça backup do repositório antes de prosseguir

## Método 1: git filter-repo (Recomendado)

### Instalação

```bash
# Ubuntu/Debian
sudo apt-get install git-filter-repo

# macOS
brew install git-filter-repo

# Python pip
pip install git-filter-repo
```

### Uso

```bash
# 1. Faça backup
git clone --mirror https://github.com/usuario/repo.git repo-backup

# 2. Entre no repositório
cd /caminho/para/seu/repo

# 3. Remova a pasta do histórico
git filter-repo --path claudio15-11-25 --invert-paths --force

# Ou para remover todas as pastas que começam com "claudio"
git filter-repo --path-glob 'claudio*' --invert-paths --force

# 4. Force push (cuidado!)
git push origin --force --all
git push origin --force --tags
```

## Método 2: git filter-branch (Legacy)

```bash
# 1. Faça backup
cp -r .git .git-backup

# 2. Remova do histórico
git filter-branch --force --index-filter \
  'git rm -r --cached --ignore-unmatch claudio15-11-25' \
  --prune-empty --tag-name-filter cat -- --all

# 3. Limpe referências
git for-each-ref --format='delete %(refname)' refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 4. Force push
git push origin --force --all
git push origin --force --tags
```

## Método 3: BFG Repo-Cleaner (Mais Rápido)

```bash
# 1. Instale BFG
# Download de: https://rtyley.github.io/bfg-repo-cleaner/
# Ou: brew install bfg

# 2. Clone mirror
git clone --mirror https://github.com/usuario/repo.git

# 3. Execute BFG
cd repo.git
bfg --delete-folders claudio15-11-25

# Ou para remover por padrão
bfg --delete-folders "{claudio*,Claudio*}"

# 4. Limpe e push
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push
```

## Caso de Uso: FazAI

### Remover "claudio15-11-25"

```bash
# Opção A: Usando script automatizado
./scripts/git-purge-folder.sh claudio15-11-25

# Opção B: Manual com git filter-repo
git filter-repo --path claudio15-11-25 --invert-paths --force
git push origin --force --all
```

### Remover Todos Arquivos "claudio*"

```bash
# Com git filter-repo
git filter-repo --path-glob 'claudio*' --invert-paths --force
git filter-repo --path-glob 'Claudio*' --invert-paths --force

# Force push
git push origin --force --all
git push origin --force --tags
```

## Pós-Remoção

### Para Colaboradores

Todos que clonaram o repo devem:

```bash
# Opção 1: Re-clonar (mais simples)
cd ..
rm -rf fazai-ng
git clone https://github.com/rogerluft/fazai-ng.git

# Opção 2: Reset local (avançado)
git fetch origin
git reset --hard origin/main  # ou sua branch principal
git clean -fdx
```

### Verificar Remoção

```bash
# Verificar se a pasta ainda existe no histórico
git log --all --full-history --oneline -- claudio15-11-25

# Se retornar vazio, a remoção foi bem-sucedida
```

### Reduzir Tamanho do Repositório

```bash
# Limpar objetos órfãos
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Verificar tamanho
du -sh .git
```

## Prevenção: .gitignore

Adicione ao `.gitignore` para evitar commits futuros:

```gitignore
# Arquivos temporários claudio
claudio*
Claudio*
```

**Nota**: O FazAI já tem essas regras no `.gitignore` (linhas 188-189).

## Troubleshooting

### Erro: "refusing to merge unrelated histories"

```bash
git pull origin main --allow-unrelated-histories --rebase
```

### Erro: "protected branch"

Desabilite temporariamente a proteção da branch no GitHub:
1. Settings → Branches → Branch protection rules
2. Desabilite temporariamente
3. Execute o force push
4. Reative a proteção

### Erro: "cannot lock ref"

```bash
git remote prune origin
git fetch --all --prune
```

## Referências

- [git-filter-repo Documentation](https://github.com/newren/git-filter-repo)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [Git Documentation - filter-branch](https://git-scm.com/docs/git-filter-branch)

## Autor

**FazAI Team**
**Data**: 2025-12-31
**Versão**: 1.0.0
