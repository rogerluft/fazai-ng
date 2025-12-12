# 📝 FazAI Alias System

Sistema integrado de gerenciamento de aliases bash globais e persistentes.

---

## 📖 Overview

O sistema de aliases do FazAI permite criar, gerenciar e remover aliases bash que são:

- **Globais**: Disponíveis para todos os usuários
- **Persistentes**: Sobrevivem a reinicializações
- **Centralizados**: Armazenados em `/etc/fazai/fzalias`
- **Seguros**: Validação de comandos perigosos
- **Com Backup**: Backup automático antes de mudanças

---

## 🚀 Quick Start

### Criar Alias

```bash
# Sintaxe completa
fazai alias <nome> <comando>

# Exemplos
fazai alias ll 'ls -lah --color=auto'
fazai alias update 'sudo apt update && sudo apt upgrade -y'
fazai alias logs 'tail -f /var/log/messages'
fazai alias gs 'git status'
fazai alias dc 'docker-compose'
fazai alias k 'kubectl'
```

### Listar Aliases

```bash
fazai alias list
# ou
fazai alias ls

# Saída:
# 📝 FazAI Global Aliases (6)
# ────────────────────────────────────────────────────────
# dc     → docker-compose
# gs     → git status
# k      → kubectl
# ll     → ls -lah --color=auto
# logs   → tail -f /var/log/messages
# update → sudo apt update && sudo apt upgrade -y
# ────────────────────────────────────────────────────────
```

### Remover Alias

```bash
fazai alias remove <nome>
# ou
fazai alias rm <nome>
# ou
fazai alias delete <nome>

# Exemplo
fazai alias remove logs
# ✓ Alias 'logs' removed successfully
```

### Ver Detalhes de um Alias

```bash
fazai alias show <nome>

# Exemplo
fazai alias show ll

# Saída:
# 📝 Alias: ll
# ────────────────────────────────────────────────────────
# Command: ls -lah --color=auto
# ────────────────────────────────────────────────────────
```

---

## 🔄 Compatibilidade fzalias

O comando standalone `fzalias` continua funcionando como atalho:

```bash
# Sintaxe tradicional (ainda funciona)
fzalias tm 'tail -f /var/log/messages'
fzalias list
fzalias remove tm

# Equivale a
fazai alias tm 'tail -f /var/log/messages'
fazai alias list
fazai alias remove tm
```

**Nota**: O `fzalias` é um wrapper que internamente chama `fazai alias`.

---

## ⚙️ Funcionalidades

### 1. Validação de Comandos Perigosos

O sistema detecta automaticamente comandos potencialmente perigosos:

```bash
fazai alias danger 'rm -rf /'
# ⚠  Dangerous command detected!
#    Command: rm -rf /
# ✗ Dangerous command detected. Use --force to override (not recommended)
```

Comandos perigosos detectados:
- `rm -rf /` (delete root)
- `rm -rf ~/` (delete home)
- `dd if=... of=/dev/...` (disk operations)
- `mkfs.*` (format filesystem)
- Fork bombs

### 2. Backup Automático

Antes de cada modificação, um backup é criado:

```bash
/etc/fazai/backups/
├── fzalias.2025-12-12T14-30-00-000Z.bak
├── fzalias.2025-12-12T15-45-00-000Z.bak
└── fzalias.2025-12-12T16-20-00-000Z.bak
```

- Mantém os últimos 10 backups
- Backups mais antigos são automaticamente removidos

### 3. Autocomplete

O bash completion oferece sugestões inteligentes:

```bash
fazai alias <TAB>
# Mostra: list ls show remove rm delete + aliases existentes

fazai alias remove <TAB>
# Mostra apenas aliases existentes

fazai alias show <TAB>
# Mostra apenas aliases existentes
```

---

## 📁 Estrutura de Arquivos

```
/etc/fazai/
├── fzalias                      # Arquivo principal de aliases
├── backups/                     # Backups automáticos
│   ├── fzalias.*.bak
│   └── ...
└── fazai.conf                   # Config do FazAI
```

### Formato do Arquivo

```bash
# FazAI Global Aliases
# Managed by fazai alias command
# Last updated: 2025-12-12T12:00:00.000Z

alias ll='ls -lah --color=auto'
alias update='sudo apt update && sudo apt upgrade -y'
alias logs='tail -f /var/log/messages'
alias gs='git status'
alias dc='docker-compose'
alias k='kubectl'
```

---

## 🔐 Permissões

- **Arquivo**: `/etc/fazai/fzalias` (modo 644, root:root)
- **Diretório**: `/etc/fazai/` (modo 755, root:root)
- **Backups**: `/etc/fazai/backups/` (modo 755, root:root)

**Nota**: Criar/modificar aliases **não requer sudo**. O arquivo é world-writable de forma controlada.

---

## 💡 Exemplos Práticos

### Aliases de Sistema

```bash
# Monitoramento
fazai alias mem 'free -h'
fazai alias cpu 'top -b -n 1 | head -20'
fazai alias disk 'df -h'
fazai alias procs 'ps aux | head -20'

# Logs
fazai alias syslog 'tail -f /var/log/syslog'
fazai alias kern 'tail -f /var/log/kern.log'
fazai alias auth 'tail -f /var/log/auth.log'
```

### Aliases de Git

```bash
fazai alias gs 'git status'
fazai alias ga 'git add'
fazai alias gc 'git commit -m'
fazai alias gp 'git push'
fazai alias gl 'git log --oneline -10'
fazai alias gd 'git diff'
```

### Aliases de Docker

```bash
fazai alias dps 'docker ps'
fazai alias di 'docker images'
fazai alias dlog 'docker logs -f'
fazai alias dex 'docker exec -it'
fazai alias dc 'docker-compose'
fazai alias dcu 'docker-compose up -d'
fazai alias dcd 'docker-compose down'
```

### Aliases de Kubernetes

```bash
fazai alias k 'kubectl'
fazai alias kgp 'kubectl get pods'
fazai alias kgs 'kubectl get svc'
fazai alias kgd 'kubectl get deploy'
fazai alias klog 'kubectl logs -f'
fazai alias kex 'kubectl exec -it'
```

### Aliases de Rede

```bash
fazai alias ports 'netstat -tulanp'
fazai alias listening 'ss -tulpn'
fazai alias myip 'curl -s ifconfig.me'
fazai alias ping4 'ping -c 4'
```

---

## 🔧 Troubleshooting

### Problema: Alias não funciona após criação

**Solução**: Carregue o arquivo no shell atual:
```bash
source /etc/fazai/fzalias
```

Ou reinicie o terminal.

### Problema: "Permission denied"

**Solução**: Verifique permissões do arquivo:
```bash
sudo chmod 644 /etc/fazai/fzalias
sudo chown root:root /etc/fazai/fzalias
```

### Problema: Alias não aparece na lista

**Solução**: Verifique se o arquivo existe:
```bash
cat /etc/fazai/fzalias
```

Se não existir, crie o primeiro alias:
```bash
fazai alias test 'echo test'
```

### Problema: Completions não funcionam

**Solução**: Reinstale os completions:
```bash
sudo cp completion/fazai-completion.bash /etc/bash_completion.d/fazai
source /etc/bash_completion.d/fazai
```

---

## 🆚 Comparação com Métodos Tradicionais

### ~/.bashrc (Tradicional)

```bash
# Cada usuário precisa adicionar manualmente
echo "alias ll='ls -lah'" >> ~/.bashrc
source ~/.bashrc
```

**Problemas**:
- ❌ Não global (cada usuário precisa configurar)
- ❌ Difícil sincronizar entre usuários
- ❌ Sem backup automático
- ❌ Sem validação de segurança

### FazAI Alias (Moderno)

```bash
fazai alias ll 'ls -lah --color=auto'
```

**Vantagens**:
- ✅ Global (todos os usuários)
- ✅ Persistente
- ✅ Backup automático
- ✅ Validação de segurança
- ✅ Gerenciamento centralizado

---

## 📊 Estatísticas

```bash
# Ver quantidade de aliases
fazai alias list | head -1
# 📝 FazAI Global Aliases (25)

# Buscar alias específico
grep "docker" /etc/fazai/fzalias

# Ver histórico de modificações (via backups)
ls -lt /etc/fazai/backups/
```

---

## 🚀 Integração com Shell

### Carregamento Automático

O arquivo `/etc/fazai/fzalias` deve ser sourced automaticamente em:

```bash
# /etc/profile.d/fazai.sh
if [ -f /etc/fazai/fzalias ]; then
    source /etc/fazai/fzalias
fi
```

Isso garante que todos os aliases estejam disponíveis para todos os usuários.

### Verificação

```bash
# Verificar se aliases estão carregados
alias ll
# alias ll='ls -lah --color=auto'

# Ver todos os aliases
alias
```

---

## 🎯 Best Practices

### 1. Use Nomes Curtos e Memoráveis
```bash
✅ fazai alias ll 'ls -lah'
❌ fazai alias list_all_with_hidden 'ls -lah'
```

### 2. Agrupe Aliases por Categoria
```bash
# Git
fazai alias gs 'git status'
fazai alias ga 'git add'
fazai alias gc 'git commit -m'

# Docker
fazai alias dps 'docker ps'
fazai alias di 'docker images'
```

### 3. Documente Aliases Complexos
```bash
# No arquivo você pode adicionar comentários
# Backup completo do sistema
alias backup='rsync -avz --delete /home/ /backup/home/'
```

### 4. Evite Sobrescrever Comandos do Sistema
```bash
❌ fazai alias ls 'ls -lah'    # Sobrescreve comando nativo
✅ fazai alias ll 'ls -lah'    # Usa alias distinto
```

### 5. Use Aspas para Comandos Complexos
```bash
✅ fazai alias update 'sudo apt update && sudo apt upgrade -y'
❌ fazai alias update sudo apt update && sudo apt upgrade -y  # Erro de parsing
```

---

## 🔗 Links Relacionados

- [Quick Start Guide](QUICK-START.md)
- [Manual Completo](MANUAL.md)
- [FazAI Configuration](../../fazai.conf.example)

---

**Última Atualização**: 2025-12-12
**Versão**: 3.5.3-beta
