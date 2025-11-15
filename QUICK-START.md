# 🚀 FazAI v3.1-beta - Guia Rápido de Início

**Terminal Administrador Linux com IA Autônoma**  
*AutoGPT · Genkit · RAG · Vector Store Qdrant*

---

## ⚡ Instalação em 1 Comando

### 🎯 Instalador Automático (Recomendado)

```bash
curl -fsSL https://raw.githubusercontent.com/rogerluft/fazai-ng/master/install.sh | bash
```

**O instalador irá:**
- ✅ Verificar e instalar dependências
- ✅ Clonar e compilar o projeto
- ✅ Configurar executável global (`fazai`)
- ✅ Instalar Qdrant (Docker/Podman/Binário) interativamente
- ✅ Configurar API keys interativamente
- ✅ Instalar Bash/Zsh completion
- ✅ Criar diretórios de sistema

### 🔄 Instalação Manual (Desenvolvedores)

```bash
# 1. Clonar repositório
git clone https://github.com/rogerluft/fazai-ng
cd fazai-ng

# 2. Instalar dependências
npm install

# 3. Build
npm run build

# 4. Link global
npm link

# 5. Verificar
fazai --help
```

---

## 🎯 Primeiros Passos

### 1️⃣ Inicie o Qdrant (Vector Store)

```bash
# Docker (recomendado)
docker run -d -p 6333:6333 -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage:z \
  qdrant/qdrant

# OU Podman
podman run -d -p 6333:6333 -p 6334:6334 \
  -v ./qdrant_storage:/qdrant/storage:z \
  qdrant/qdrant

# Verificar
curl http://localhost:6333
```

### 2️⃣ Configure API Keys

```bash
# Editar configuração
nano ~/.config/fazai/fazai.conf
```

**Mínimo necessário:**
```ini
# Claude (Recomendado)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# OU OpenAI
OPENAI_API_KEY=sk-xxxxx

# OU Ollama (Local/Gratuito)
OLLAMA_BASE_URL=http://localhost:11434

# Qdrant
VECTOR_PROVIDER=qdrant
QDRANT_URL=http://localhost:6333
```

### 3️⃣ Criar Collections Qdrant

```bash
fazai vector validate
```

### 4️⃣ Teste!

```bash
# Modo ask (perguntas gerais - seguro)
fazai ask "Como configurar nginx?"

# Modo admin com dry-run (simula sem executar)
fazai --dry-run

# Modo CLI interativo
fazai --cli
```

---

## 📖 Exemplos de Uso

### 🔍 Modo Ask (Perguntas - Seguro)

```bash
# Perguntas sobre Linux/Redes
fazai ask "Como configurar nginx como proxy reverso?"
fazai ask "Diferença entre systemctl e service?"
fazai ask "Melhores práticas para hardening SSH?"

# Com modelo específico
fazai ask "Explicar iptables" haiku      # Claude Haiku (rápido)
fazai ask "Kubernetes" sonnet35          # Claude Sonnet (inteligente)
fazai ask "Docker swarm" gpt4o           # GPT-4o
fazai ask "Tutorial nginx" llama32       # Llama 3.2 local
```

### 🖥️ Modo Admin (Comandos Linux)

```bash
# Dry-run - Simula sem executar (SEGURO)
fazai --dry-run
fazai --dry-run haiku

# Admin real - EXECUTA comandos (ATENÇÃO!)
fazai
fazai sonnet35

# Exemplos de tarefas:
"instalar e configurar nginx como proxy reverso"
"verificar uso de disco e limpar cache antigo"
"configurar firewall ufw para web server"
"criar usuário admin com sudo e SSH keys"
"fazer backup de /var/www com timestamp"
```

### 💬 Modo CLI Interativo

```bash
fazai --cli

# Comandos disponíveis:
/help                           # Lista comandos
/exec instalar docker           # Executa tarefa admin
/history                        # Histórico de comandos
/history clear                  # Limpa histórico
/memory clear                   # Limpa memória contextual
/quit                           # Sair

# Multi-linha:
/exec '''
  configurar nginx ssl
  para dominio exemplo.com
  com lets encrypt
'''
```

### 📊 Vector Store e Importação

```bash
# Validar collections
fazai vector validate

# Recriar collections
fazai vector recreate --provider qdrant

# Importar conversas do Claude Desktop
fazai import --source ~/Library/Application\ Support/Claude/claude_desktop_config.sqlite

# Importar conversas do ChatGPT Desktop
fazai import --source ~/Library/Application\ Support/ChatGPT/conversations.db

# Ver configuração
fazai config
```

---

## 🎯 Modelos Disponíveis

### Claude (Anthropic) - Recomendado
| Nickname | Modelo | Custo | Quando Usar |
|----------|--------|-------|-------------|
| `sonnet35` | Claude 3.5 Sonnet | Médio | **Default** - Tarefas complexas, multi-serviços |
| `haiku` | Claude Haiku | Baixo | Tarefas rápidas, comandos simples |

**Obter API Key:** [console.anthropic.com](https://console.anthropic.com) - $5 grátis

### OpenAI (GPT)
| Nickname | Modelo | Custo | Quando Usar |
|----------|--------|-------|-------------|
| `gpt4o` | GPT-4o | Médio | Tarefas complexas, análises |
| `gpt4mini` | GPT-4o Mini | Baixo | Rápido e econômico |
| `gpt4turbo` | GPT-4 Turbo | Alto | Máxima capacidade |

**Obter API Key:** [platform.openai.com](https://platform.openai.com)

### Ollama (Local/Gratuito) - 100% Privado
| Nickname | Modelo | Requisitos | Quando Usar |
|----------|--------|------------|-------------|
| `llama32` | Llama 3.2 (Meta) | 8GB RAM | Uso geral local |
| `qwen` | Qwen 2.5:7b (Alibaba) | 8GB RAM | Performance local |
| `mistral` | Mistral 7B | 8GB RAM | Leve e rápido |

**Setup:**
```bash
# Instalar Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Baixar modelos
ollama pull llama3.2
ollama pull qwen2.5:7b
ollama pull mistral

# Configurar no fazai.conf
echo "OLLAMA_BASE_URL=http://localhost:11434" >> ~/.config/fazai/fazai.conf
```

---

## 🔧 Configuração Avançada

### Pesquisa Assistida (MCP Context7 + Web)

Adicione ao `~/.config/fazai/fazai.conf`:

```ini
# MCP Context7 (servidor local de contexto)
MCP_CONTEXT7_URL=http://localhost:7700/context7/search
MCP_CONTEXT7_API_KEY=seu_token_opcional

# OU comando local
MCP_CONTEXT7_COMMAND=context7 --json --query "{query}"

# Fallback web (DuckDuckGo)
WEB_SEARCH_PROVIDER=duckduckgo

# Desabilitar pesquisas (modo offline)
FAZAI_DISABLE_RESEARCH=true
```

### Collections Qdrant Especializadas

O FazAI usa 5 collections para RAG e memória:

1. **`fazai_personality`** - Expertise técnica e estilo
2. **`fazai_memory`** - Histórico operacional
3. **`fazai_learning`** - Aprendizado (erros/soluções)
4. **`fazai_kb`** - Base de conhecimento Linux/Redes
5. **`fazai_inference`** - Políticas e regras operacionais

**Gerenciar:**
```bash
fazai vector validate              # Criar/validar collections
fazai vector recreate --provider qdrant  # Recriar do zero
```

### Bash/Zsh Completion

Instalado automaticamente pelo instalador. Para instalação manual:

```bash
# Bash
fazai completion > ~/.local/share/bash-completion/completions/fazai
source ~/.bashrc

# Zsh
fazai completion > ~/.local/share/zsh/site-functions/_fazai
source ~/.zshrc
```

---

## ⚠️ Segurança e Boas Práticas

### 🛡️ Sistema de Segurança 5 Camadas

1. **Pattern Matching** - Bloqueia comandos destrutivos conhecidos
2. **Avaliação de Risco** - Análise automática (CRITICAL/HIGH/MEDIUM/LOW)
3. **Safety Checks** - Validações pré-execução pela IA
4. **Rollback Automático** - Comandos reversíveis com undo
5. **Dry-Run Mode** - Sempre teste primeiro!

### ✅ Recomendações

- ✅ **SEMPRE** use `--dry-run` para testar primeiro
- ✅ Revise comandos antes de confirmar
- ✅ Comece com tarefas simples e seguras
- ✅ Mantenha backups atualizados
- ✅ Use modo `ask` para aprender sem riscos

### ❌ Evite

- ❌ Executar comandos sem revisar
- ❌ Confirmar ações CRITICAL sem entender
- ❌ Usar em produção sem testar em staging
- ❌ Desabilitar confirmações de segurança

---

## 🆘 Problemas Comuns

### ❌ "API key não encontrada"

```bash
# Verificar se arquivo existe
cat ~/.config/fazai/fazai.conf

# Recriar configuração
cp ~/.fazai/fazai.conf.example ~/.config/fazai/fazai.conf
nano ~/.config/fazai/fazai.conf
```

### ❌ "Qdrant não conecta"

```bash
# Verificar se está rodando
curl http://localhost:6333

# Iniciar Qdrant
docker run -d -p 6333:6333 qdrant/qdrant

# Ver logs
docker logs $(docker ps -q --filter ancestor=qdrant/qdrant)
```

### ❌ "fazai: command not found"

```bash
# Adicionar ao PATH
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Verificar instalação
which fazai
fazai --version
```

### ❌ "Build failed" ou "Module not found"

```bash
# Reinstalar dependências
cd ~/.fazai
rm -rf node_modules package-lock.json
npm install
npm run build

# Verificar Node.js
node --version  # Deve ser 18+
```

### ❌ "Collections não criadas"

```bash
# Verificar Qdrant
curl http://localhost:6333/collections

# Recriar collections
fazai vector recreate --provider qdrant

# Validar
fazai vector validate
```

---

## 📚 Próximos Passos

1. ✅ **Explore o modo ask** - Aprenda sem riscos
2. ✅ **Teste com --dry-run** - Veja os comandos sem executar
3. ✅ **Configure Ollama** - Use modelos locais gratuitamente
4. ✅ **Importe conversas** - Reutilize conhecimento anterior
5. ✅ **Leia o manual completo** - `MANUAL.md` tem tudo detalhado

---

## 🔗 Links Úteis

- 📖 **Documentação completa:** [README.md](README.md)
- 📘 **Manual detalhado:** [MANUAL.md](MANUAL.md)  
- 🤝 **Como contribuir:** [CONTRIBUTING.md](CONTRIBUTING.md)
- 🐛 **Reportar problemas:** [GitHub Issues](https://github.com/rogerluft/fazai-ng/issues)
- 💬 **Discussões:** [GitHub Discussions](https://github.com/rogerluft/fazai-ng/discussions)

---

**FazAI v3.1-beta** - Bora administrar! 🚀
