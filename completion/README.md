# Shell Completion para FazAI

Auto-complete para Bash e Zsh com todos os comandos, flags e modelos do Terminal FazAI.

## Instalação

### Bash

**Método 1: Sistema (requer sudo)**

```bash
sudo cp completion/fazai-completion.bash /etc/bash_completion.d/fazai
# Reinicie o terminal ou rode:
source /etc/bash_completion.d/fazai
```

**Método 2: Usuário**

```bash
# Adicionar ao ~/.bashrc
echo "source $(pwd)/completion/fazai-completion.bash" >> ~/.bashrc
source ~/.bashrc
```

### Zsh

**Método 1: Usuário (recomendado)**

```bash
# Criar diretório de completion
mkdir -p ~/.zsh/completion

# Copiar arquivo
cp completion/fazai-completion.zsh ~/.zsh/completion/_fazai

# Adicionar ao ~/.zshrc (se ainda não estiver)
echo 'fpath=(~/.zsh/completion $fpath)' >> ~/.zshrc
echo 'autoload -Uz compinit && compinit' >> ~/.zshrc

# Recarregar
source ~/.zshrc
```

**Método 2: Sistema (requer sudo)**

```bash
# Copiar para diretório do sistema
sudo cp completion/fazai-completion.zsh /usr/local/share/zsh/site-functions/_fazai

# Reconstruir cache
rm -f ~/.zcompdump
autoload -Uz compinit && compinit
```

## Funcionalidades

### Comandos Principais

```bash
fazai <TAB>
# Completa com: ask, config, completion, search, vector, import

# Ou com modelos:
# gpt4mini, gpt4o, gpt4turbo, sonnet35, haiku, llama32, qwen, mistral

# Ou com flags:
# --help, --dry-run, --cli, --debug, --verbose, etc.
```

### Comando Vector

```bash
fazai vector <TAB>
# Completa com: validate, recreate, reset

fazai vector validate --<TAB>
# Completa com: --provider, --recreate, --reset
```

### Comando Import

```bash
fazai import <TAB>
# Completa com arquivos do diretório atual

fazai import arquivo.json --<TAB>
# Completa com: --source, --recursive, -r, --no-knowledge, --no-learning

fazai import arquivo.json --source <TAB>
# Completa com: claude, chatgpt
```

### Modelos de IA

```bash
fazai <TAB>
# Completa com todos os modelos disponíveis:

# OpenAI:
#   gpt4mini    - GPT-4o-mini (padrão)
#   gpt4o       - GPT-4o
#   gpt4turbo   - GPT-4 Turbo

# Claude (Anthropic):
#   sonnet35    - Claude 3.5 Sonnet
#   haiku       - Claude 3 Haiku

# Ollama (local):
#   llama32     - Llama 3.2
#   qwen        - Qwen 2.5:7b
#   mistral     - Mistral
```

### Flags e Opções

```bash
fazai --<TAB>
# Completa com:
#   --help, -h
#   --dry-run
#   --cli
#   --debug
#   --verbose
#   --log-file
#   --auto-research
#   --yolo, -y
```

## Testar Completion

```bash
# Teste básico
fazai <TAB><TAB>
# Deve mostrar todos os comandos, modelos e flags

# Teste comando vector
fazai vector <TAB><TAB>
# Deve mostrar: validate, recreate, reset

# Teste comando import
fazai import <TAB>
# Deve completar com arquivos .json do diretório

# Teste flags
fazai --<TAB><TAB>
# Deve mostrar todas as flags disponíveis
```

## Troubleshooting

### Bash: Completion não funciona

```bash
# Verificar se bash-completion está instalado
dpkg -l | grep bash-completion  # Debian/Ubuntu
rpm -qa | grep bash-completion  # RHEL/CentOS

# Instalar se necessário
sudo apt install bash-completion   # Debian/Ubuntu
sudo yum install bash-completion   # RHEL/CentOS

# Verificar se está carregado
type _init_completion
# Deve mostrar: _init_completion is a function

# Recarregar
source /etc/bash_completion.d/fazai
```

### Zsh: Completion não funciona

```bash
# Verificar se compinit está habilitado
type compinit
# Deve mostrar: compinit is a shell function

# Verificar fpath
echo $fpath
# Deve incluir ~/.zsh/completion

# Reconstruir cache
rm -f ~/.zcompdump
autoload -Uz compinit && compinit

# Verificar se arquivo foi carregado
which _fazai
# Deve mostrar o caminho para _fazai
```

### Completion parcialmente funciona

```bash
# Limpar cache e recarregar

# Bash:
hash -r
source ~/.bashrc

# Zsh:
rehash
rm -f ~/.zcompdump
autoload -Uz compinit && compinit
```

## Desenvolvimento

Para adicionar novos comandos ou opções ao completion:

1. Editar `fazai-completion.bash` (Bash)
2. Editar `fazai-completion.zsh` (Zsh)
3. Testar com `source completion/fazai-completion.bash`
4. Commitar mudanças

### Estrutura do Completion

**Bash:**
- Função principal: `_fazai_completion()`
- Variáveis: `commands`, `models`, `opts`, etc.
- Lógica de case para cada comando
- Registro: `complete -F _fazai_completion fazai`

**Zsh:**
- Função principal: `_fazai()`
- Arrays: `commands`, `models`, `opts`
- State machine para subcomandos
- Uso de `_arguments` e `_describe`

## Licença

Mesmo que o projeto principal (Apache 2.0).
