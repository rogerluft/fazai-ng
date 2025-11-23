# fzalias - Sistema de Aliases Global do FazAI

Gerenciador de aliases global persistente para todos os usuários do sistema.

## 🚀 Instalação

```bash
# Já instalado automaticamente pelo install.sh
# Para instalar manualmente:
sudo bash scripts/fzalias install
```

## 📖 Uso

### Criar um novo alias
```bash
# Sintaxe: definir alias diretamente no shell
alias meucomando='comando real'
```

**Exemplos:**
```bash
alias ll='ls -lha --color=auto'
alias update='sudo dnf update -y'
alias status='systemctl status'
alias logs='journalctl -xe'
```

### Listar todos os aliases
```bash
fzalias-list
```

### Remover um alias
```bash
unalias meucomando
```

## 🔧 Funcionamento

- **Arquivo:** `/etc/fazai/fzalias`
- **Carregamento:** Automático via `/etc/profile` e `/etc/bashrc`
- **Escopo:** Global (todos os usuários)
- **Persistência:** Sobrevive a reboots

## 🎯 Bash Completion

Tab completion automático para comandos `fzalias`:
- `fzalias <TAB>` - mostra comandos disponíveis (add, remove, list, etc)
- `fzalias remove <TAB>` - mostra aliases existentes

## 🗑️ Desinstalação

```bash
sudo bash scripts/fzalias uninstall
```

Remove completamente:
- `/etc/fazai/fzalias`
- Referências em `/etc/profile` e `/etc/bashrc`
- Bash completion

## 💡 Dicas

1. **Aliases pessoais** vs **Aliases globais**:
   - Pessoais: `~/.bashrc` (apenas seu usuário)
   - Globais: `/etc/fazai/fzalias` (todos os usuários)

2. **Recarregar aliases** após editar manualmente:
   ```bash
   source /etc/fazai/fzalias
   ```

3. **Ver definição de um alias**:
   ```bash
   alias meucomando
   ```

## 🔐 Segurança

- Apenas root/sudo pode modificar `/etc/fazai/fzalias`
- Todos os usuários podem usar os aliases
- Não crie aliases que sobrescrevam comandos de sistema críticos

## 🐛 Troubleshooting

**Aliases não aparecem após criar:**
```bash
source /etc/fazai/fzalias
# ou reinicie o terminal
```

**Erro de permissão:**
```bash
# Verifique permissões
ls -la /etc/fazai/fzalias
# Deve ser: -rw-r--r-- root root
```

**Ver se está carregado:**
```bash
grep -r "fzalias" /etc/profile /etc/bashrc
```
