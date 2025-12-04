# 🖥️ FazAI v3.3-beta - Terminal Admin Linux com IA Autônoma

<div align="center">

**Administrador de Sistemas Linux Senior + Redes**  
*AutoGPT · Genkit · RAG · Vector Store Qdrant*

</div>

<h3 align="center">Terminal inteligente que converte linguagem natural em comandos Linux seguros, com memória operacional, aprendizado contínuo e pesquisa assistida.</h3>

---

## 🌟 Features

### 🧠 Inteligência e Memória
- **5 Collections Qdrant Especializadas** para RAG e memória operacional
  - `fazai_personality` - Expertise técnica e estilo de troubleshooting
  - `fazai_memory` - Histórico operacional e contexto de infraestrutura
  - `fazai_learning` - Aprendizado técnico (erros, soluções, padrões)
  - `fazai_kb` - Base de conhecimento Linux/Redes validada
  - `fazai_inference` - Políticas de segurança, SLAs e regras operacionais

### 🤖 IA Multi-Modelo
- **Claude** (Anthropic): Sonnet 3.5, Haiku - Tarefas complexas e rápidas
- **GPT** (OpenAI): GPT-4o, GPT-4 Turbo, GPT-4 Mini
- **Ollama** (Local): Llama 3.2, Qwen 2.5, Mistral - 100% privado e gratuito

### 🛡️ Segurança em 5 Camadas
- **Pattern Matching**: Bloqueia comandos destrutivos conhecidos
- **Avaliação de Risco**: Análise automática (CRITICAL, HIGH, MEDIUM, LOW)
- **Safety Checks**: Validações pré-execução geradas pela IA
- **Rollback Automático**: Comandos reversíveis com undo integrado
- **Modo Dry-Run**: Simule sem executar nada

### 🔍 Pesquisa Assistida
- **MCP Context7**: Integração com servidor de contexto local
- **Fallback Web**: DuckDuckGo automático quando precisa de mais informação
- **Importação de Conversas**: Claude/ChatGPT Desktop → Vector Store

### 💬 Modo CLI Interativo
- **Chat persistente** com memória contextual entre sessões
- **Comandos especiais**: `/exec`, `/history`, `/memory`, `/help`
- **Histórico navegável**: Setas ↑/↓ e auto-complete
- **Bash completion**: Instalação automática para Bash e Zsh

## 🚀 Instalação

### Método 1: Instalador Automático (Recomendado)

```bash
curl -fsSL https://raw.githubusercontent.com/rogerluft/fazai-ng/master/install.sh | bash
```

O instalador irá:
- ✅ Verificar dependências (Node.js 18+, npm, git)
- ✅ Clonar e compilar o projeto
- ✅ Criar symlinks em `~/.local/bin/fazai`
- ✅ Oferecer instalação do Qdrant (Docker/Podman/Binário)
- ✅ Criar arquivo de configuração interativo
- ✅ Instalar Bash/Zsh completion automaticamente
- ✅ Configurar diretórios de sistema (`/etc/fazai`, `/var/log/fazai`)

### Método 2: Via NPX (Teste Rápido)
```bash
npx fazai
```
*Nota: Vector Store e recursos avançados requerem instalação completa.*

### Método 3: Build Local

```bash
git clone https://github.com/rogerluft/fazai-ng
cd fazai-ng
npm install
npm run build
npm link
fazai --help
```

#### Auto-build para Desenvolvimento
O launcher detecta alterações em `src/` e executa `npm run build` automaticamente.
- Desabilitar: `export FAZAI_AUTO_BUILD=0`
- Forçar rebuild: `rm -rf dist && npm run build`

### Instalação do Qdrant (Vector Store)

**Docker (Recomendado):**
```bash
docker run -d -p 6333:6333 -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage:z \
  qdrant/qdrant
```

**Podman:**
```bash
podman run -d -p 6333:6333 -p 6334:6334 \
  -v ./qdrant_storage:/qdrant/storage:z \
  qdrant/qdrant
```

**Binário Standalone:**
```bash
curl -O https://github.com/qdrant/qdrant/releases/download/v1.8.0/qdrant-x86_64-unknown-linux-gnu.tar.gz
tar -xzf qdrant-*.tar.gz && cd qdrant
./qdrant
```

## 📖 Uso

### Modo Admin Linux (Default)

```bash
# Iniciar FazAI
fazai

# Com modelo específico
fazai haiku          # Claude Haiku (rápido e econômico)
fazai sonnet35       # Claude 3.5 Sonnet (default, mais inteligente)
fazai gpt4o          # GPT-4o (OpenAI)
fazai llama32        # Llama 3.2 local (Ollama)

# Modo simulação (visualizar sem executar)
fazai --dry-run

# Modo CLI interativo com chat e memória persistente
fazai --cli
```

### Modo CLI Interativo

O modo `fazai --cli` oferece um ambiente de chat completo:

```bash
fazai --cli

# Comandos disponíveis:
/help                    # Lista todos os comandos
/exec instalar nginx     # Executa fluxo administrativo
/history                 # Mostra histórico de comandos
/history clear           # Limpa histórico
/memory clear            # Limpa memória contextual
/quit ou /exit          # Encerra o CLI

# Suporta texto multi-linha:
/exec '''
  configurar nginx como proxy reverso
  para porta 3000 com SSL
'''
```

**Features do modo CLI:**
- ✅ Memória contextual persistente entre sessões
- ✅ Histórico navegável com setas ↑/↓
- ✅ Auto-complete para comandos iniciados com `/`
- ✅ Suporte a texto multi-linha com `'''`

### Exemplos de Tarefas Administrativas

```bash
> O que você precisa fazer?

# Instalação e Configuração
"instalar e configurar nginx como proxy reverso para porta 3000"
"configurar firewall ufw para permitir apenas portas 22, 80, 443"
"criar usuário admin com permissões sudo e chaves SSH"

# Monitoramento e Diagnóstico
"verificar uso de disco e limpar arquivos temporários antigos"
"analisar logs do sistema em busca de erros críticos"
"verificar status de todos os serviços e reiniciar os que falharam"

# Backup e Manutenção
"fazer backup do diretório /var/www em /backup com timestamp"
"atualizar sistema e reiniciar se necessário"
"verificar integridade do raid e enviar relatório"

# Redes e Segurança
"configurar fail2ban para proteger SSH"
"analisar conexões de rede ativas e identificar anomalias"
"configurar iptables para bloquear tráfego suspeito"
```

### Modo Ask (Consultas e Dúvidas)

```bash
fazai ask "Como configurar nginx como proxy reverso?"
fazai ask "Diferença entre systemctl e service?"
fazai ask "Explicar como funciona iptables com exemplos"
fazai ask "Melhores práticas para hardening SSH"
```

### Gerenciamento e Vector Store

```bash
# Listar configurações e API keys
fazai config

# Ver ajuda completa
fazai --help

# Comandos do Vector Store
fazai vector validate              # Validar collections
fazai vector recreate --provider qdrant  # Recriar collections
fazai vector import --file conversas.json  # Importar conversas

# Importar conversas Claude/ChatGPT Desktop
fazai import --source ~/Library/Application\ Support/Claude/claude_desktop_config.sqlite
fazai import --source ~/Library/Application\ Support/ChatGPT/conversations.db

# Auto-complete Bash/Zsh
fazai completion
```

### Importação de Conversas

O FazAI pode importar conversas históricas do Claude Desktop e ChatGPT Desktop para o Vector Store:

```bash
# Claude Desktop (SQLite)
fazai import --source ~/Library/Application\ Support/Claude/claude_desktop_config.sqlite

# ChatGPT Desktop (JSON/DB)
fazai import --source ~/Library/Application\ Support/ChatGPT/conversations.db

# Arquivo JSON customizado
fazai import --source conversas.json --format json

# Com filtros
fazai import --source claude.db --min-messages 5 --before 2024-01-01
```

**Benefícios:**
- ✅ Reutiliza conhecimento de conversas anteriores
- ✅ Alimenta collections `fazai_memory` e `fazai_kb`
- ✅ Melhora respostas contextuais futuras
- ✅ Preserva histórico operacional

### Importação de Personalidade

Para extrair e importar traços de personalidade de conversas Claude Desktop:

```bash
# Importar personalidade do conversations.json
npx tsx scripts/import-personality.ts ./conversations.json
```

O script:
- ✅ Analisa padrões de comunicação e expertise técnica
- ✅ Gera embeddings REAIS via Ollama (nomic-embed-text)
- ✅ Popula `fazai_personality` com traços categorizados
- ✅ Detecta: expertise (linux, docker, security), estilos (metódico, prático), abordagens (sequencial, flexível)

### Sistema de Aliases Global (fzalias)

O FazAI inclui o **fzalias**, um gerenciador de aliases global para todos os usuários:

```bash
# Criar alias global
fzalias ll='ls -lh --color=auto'
fzalias grep='grep --color=auto'

# Listar todos os aliases
fzalias

# Remover alias
fzalias ll=

# Desinstalar completamente
sudo fzalias uninstall
```

**Características:**
- ✅ **Multidistro**: Funciona em Debian/Ubuntu e RedHat/Fedora/Rocky
- ✅ **Global**: Aliases disponíveis para todos os usuários
- ✅ **Persistente**: Sobrevive a reinicializações
- ✅ **Bash completion**: Integração com tab completion do sistema
- ✅ **Fácil gerenciamento**: Adicione/remova aliases em runtime

**Arquivos:**
- `/etc/fazai/fzalias` - Função e aliases globais
- `/etc/bash.bashrc` ou `/etc/bashrc` - Source automático

### Configuração do Vector Store (Qdrant)

**Arquivo de configuração** (`/etc/fazai/fazai.conf` ou `/etc/fazai/fazai.conf`):

```bash
# Vector Store (Qdrant)
VECTOR_PROVIDER=qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=                    # Opcional para instância local

# Configurações de Embedding
VECTOR_DIMENSION=1536              # Dimensão dos embeddings
VECTOR_DISTANCE=cosine             # cosine, euclid, dot

# Collections (criadas automaticamente)
# fazai_personality, fazai_memory, fazai_learning, fazai_kb, fazai_inference
```

**Validar e recriar collections:**
```bash
fazai vector validate              # Verifica se collections existem
fazai vector recreate --provider qdrant  # Recria com schema correto
```

### Pesquisa Assistida (MCP Context7 + Web)

O FazAI pode buscar informações automaticamente quando precisa de mais contexto:

**Configuração** (`fazai.conf`):
```bash
# MCP Context7 (Servidor HTTP)
MCP_CONTEXT7_URL=http://localhost:7700/context7/search
MCP_CONTEXT7_API_KEY=seu_token_opcional

# OU Comando Local
MCP_CONTEXT7_COMMAND=context7 --json --query "{query}"

# Fallback Web (DuckDuckGo)
WEB_SEARCH_PROVIDER=duckduckgo

# Desabilitar pesquisas (modo offline)
FAZAI_DISABLE_RESEARCH=true
```

**Funcionamento:**
1. IA detecta necessidade de mais informação (`researchNeeded=true`)
2. Tenta MCP Context7 primeiro (se configurado)
3. Fallback para busca web se Context7 falhar
4. Exibe resultados com título, resumo e URL
5. Usa informações para gerar resposta mais precisa

**Casos de uso:**
- ✅ Comandos falharam e precisa de troubleshooting
- ✅ Configuração específica de distribuição Linux
- ✅ Versões atualizadas de pacotes
- ✅ Documentação de ferramentas recentes

## 🔗 Integração GitHub

O FazAI pode gerenciar repositórios GitHub, issues, forks e stars através de uma CLI integrada:

### Autenticação GitHub

```bash
# Login com Personal Access Token
fazai github auth login

# Verificar status de autenticação
fazai github auth status

# Logout
fazai github auth logout
```

**Configuração** (`fazai.conf`):
```bash
# GitHub Personal Access Token
GITHUB_TOKEN=ghp_seu_token_aqui

# Scopes necessários:
# - repo (controle total de repositórios privados)
# - read:user (ler dados de perfil)
# - public_repo (acessar repositórios públicos)
```

**Obter token:**
1. Acesse https://github.com/settings/tokens
2. Crie novo token com scopes: `repo`, `read:user`, `public_repo`
3. Cole em `GITHUB_TOKEN` no `fazai.conf`

### Comandos GitHub

```bash
# Informações de usuário
fazai github user              # Mostra perfil autenticado

# Gerenciar repositórios
fazai github repos             # Listar seus repositórios
fazai github repo owner/repo   # Informações detalhadas de um repo

# Operações com repositórios
fazai github fork owner/repo   # Fazer fork de repositório
fazai github star owner/repo   # Marcar repositório como favorito
fazai github starred           # Listar repositórios favoritados

# Gerenciar issues
fazai github issues owner/repo # Listar issues abertas
fazai github issue create owner/repo  # Criar nova issue

# Pull requests (em desenvolvimento)
fazai github pr                # Criar/gerenciar pull requests
```

## ☁️ Integração Google Gemini via Cloudflare

O FazAI suporta integração com Google Gemini através de Cloudflare Workers, oferecendo acesso aos modelos mais avançados via endpoint OpenAI-compatível:

### Modelos Disponíveis

- **gemini-2.5-pro** - Modelo mais potente (1M tokens context, 65K max output)
- **gemini-2.5-flash** - Modelo rápido (1M tokens context, 65K max output)
- **gemini-2.5-flash-lite** - Modelo leve (1M tokens context, 65K max output)

### Setup

1. **Deploy gemini-cli-openai para Cloudflare Workers:**
   ```bash
   # Siga as instruções em: https://github.com/GewoonJaap/gemini-cli-openai
   # Ou use sua própria instância do Cloudflare Worker
   ```

2. **Configurar em `fazai.conf`:**
   ```bash
   # URL do Cloudflare Worker (obrigatório)
   GEMINI_WORKER_URL=https://seu-worker.seu-subdomain.workers.dev

   # API Key opcional (para autenticação)
   OPENAI_API_KEY=sua_api_key_opcional
   ```

3. **Usar os modelos:**
   ```bash
   # Listar modelos disponíveis
   fazai --help

   # Usar Gemini como modelo padrão (se configurado)
   fazai "sua pergunta aqui"
   ```

### Características

- ✅ Endpoint OpenAI-compatível (integra-se com OpenAI SDK)
- ✅ Suporte a streaming de respostas
- ✅ Contexto muito grande (1M tokens)
- ✅ Implantação global via Cloudflare Edge
- ✅ Gratuito ou baixo custo (via Cloudflare)

### Referência

- Projeto: [gemini-cli-openai](https://github.com/GewoonJaap/gemini-cli-openai)
- Documentação: https://github.com/GewoonJaap/gemini-cli-openai#readme

## 🛡️ Sistema de Segurança

FazAI possui **5 camadas de proteção**:

### 1. Pattern Matching
Bloqueia comandos conhecidamente perigosos:
- `rm -rf /` (destruição de sistema)
- `dd if=/dev/zero` (sobrescrever disco)
- `mkfs`, `fdisk`, `wipefs` (formatar disco)
- `chmod 777 -R /` (permissões inseguras)

### 2. Avaliação de Risco Automática
- **CRITICAL**: Prompt forte, default=não, exige confirmação explícita
- **HIGH**: Confirmação obrigatória
- **MEDIUM**: Confirmação normal
- **LOW**: Executa direto (ou confirma dependendo da flag)

### 3. Safety Checks
Claude gera verificações pré-execução:
- "Verificar se nginx está instalado"
- "Checar se porta 80 está livre"
- "Confirmar que há espaço em disco"

### 4. Rollback Automático
Comandos reversíveis incluem comando de rollback:
```json
{
  "command": "systemctl stop nginx",
  "rollbackCommand": "systemctl start nginx"
}
```

### 5. Dry-Run Mode
```bash
fazai --dry-run
```
Simula tudo sem executar, perfeito para testar.

## 🔧 Como Funciona

1. **Coleta de Sistema**: FazAI analisa seu sistema (OS, distribuição, kernel, serviços ativos, gerenciador de pacotes, etc.)
2. **Você descreve a tarefa**: Em português ou qualquer linguagem natural
3. **Claude gera comandos**: Com estrutura JSON completa (comando, risco, rollback, checks)
4. **Validação de segurança**: Pattern matching + avaliação de risco
5. **Confirmação interativa**: Baseada no nível de risco
6. **Execução com streaming**: Você vê o output em tempo real
7. **Histórico**: Todas as execuções são registradas

## 📋 Exemplo de Execução

```bash
$ fazai

🖥️  FAZAI - MODO ADMINISTRADOR LINUX
Administração inteligente de sistemas Linux

Modelo: sonnet35 (claude-3-5-sonnet-latest)

✅ API key configurada (anthropic)
Coletando informações do sistema...
✅ Sistema analisado

O que você precisa fazer? instalar nginx

🔧 Comando 1:
┌─────────────────────────────────────────────┐
│ Atualizar lista de pacotes                  │
└─────────────────────────────────────────────┘
Comando: apt update
Risco: LOW
Executar? [Y/n] y

✅ Sucesso
...

🔧 Comando 2:
┌─────────────────────────────────────────────┐
│ Instalar nginx                              │
└─────────────────────────────────────────────┘
Comando: apt install -y nginx
Risco: MEDIUM
Rollback: apt remove -y nginx
Executar? [Y/n] y

✅ Sucesso
...

✅ 3 comandos processados

📋 Histórico:
  1. ✅ apt update
  2. ✅ apt install -y nginx
  3. ✅ systemctl enable nginx

⭐ FAZAI - Administração Linux com IA
```

## 🎯 Modelos Disponíveis (Config-Driven)

Os modelos são **carregados de `/etc/fazai/fazai.conf`** (máx 3 por provedor).
Cada provedor pode ser customizado adicionando modelos separados por vírgula.

### Ollama (Local - Privado)
```bash
MODELS_OLLAMA=gptoss-20b,llama3.2,llama3.1
```
| Nickname | Modelo | Velocidade | Custo | Quando Usar |
|----------|--------|-----------|-------|-------------|
| `gptoss` | gpt-oss:20b | Variável | Grátis | Local, RTX 3050 8GB (recomendado) |
| `llama32` | llama3.2:latest | Variável | Grátis | 100% privado, multi-modal |
| `llama31` | llama3.1:latest | Variável | Grátis | Raciocínio complexo |

**Configuração**: `OLLAMA_BASE_URL=http://192.168.0.101:11434`

### OpenRouter (Cloud - 200+ Modelos)
```bash
MODELS_OPENROUTER=qwen/qwen3-coder:free,meta-llama/llama-3.3-70b,google/gemini-2.0-flash-exp:free
OPENROUTER_API_KEY=sk-or-v1-xxxxx
```
| Nickname | Modelo | Velocidade | Custo | Quando Usar |
|----------|--------|-----------|-------|-------------|
| `qwen` | qwen/qwen3-coder:free | Rápido | **GRÁTIS** | Tarefas complexas, free tier |
| `llama33` | meta-llama/llama-3.3-70b | Rápido | Paid | Raciocínio, instrução |
| `gemini` | google/gemini-2.0-flash-exp:free | Rápido | **GRÁTIS** | Multi-modal, video/audio |

**API Key**: https://openrouter.ai/keys (free tier disponível!)

### OpenAI (Cloud - GPT)
```bash
# MODELS_OPENAI=gpt-4o,gpt-4o-mini
# OPENAI_API_KEY=sk-xxxxx
```
| Nickname | Modelo | Velocidade | Custo | Quando Usar |
|----------|--------|-----------|-------|-------------|
| `gpt4o` | gpt-4o | Rápido | Médio | Tarefas complexas, multi-modal |
| `gpt4mini` | gpt-4o-mini | Muito Rápido | Baixo | Tarefas simples, custo eficiente |

**API Key**: https://platform.openai.com/api-keys

### Anthropic Claude (Cloud)
```bash
# MODELS_ANTHROPIC=claude-3-5-sonnet-latest,claude-3-haiku-20240307
# ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
```
| Nickname | Modelo | Velocidade | Custo | Quando Usar |
|----------|--------|-----------|-------|-------------|
| `sonnet` | claude-3-5-sonnet-latest | Rápido | Médio | Tarefas complexas (default) |
| `haiku` | claude-3-haiku-20240307 | Muito Rápido | Baixo | Tarefas simples, rápido |

**API Key**: https://console.anthropic.com/

### Google Gemini (Cloud - via OpenRouter ou nativo)
```bash
# MODELS_GOOGLE=gemini-2.0-flash-exp,gemini-1.5-pro
# GEMINI_API_KEY=xxxxx (opcional, use OpenRouter para free tier)
```

### Como Configurar Modelos

Edite `/etc/fazai/fazai.conf`:

```bash
# Máximo 3 modelos por provedor
MODELS_OLLAMA=gptoss-20b,llama3.2,llama3.1
MODELS_OPENROUTER=qwen/qwen3-coder:free,meta-llama/llama-3.3-70b,google/gemini-2.0-flash-exp:free
MODELS_OPENAI=gpt-4o,gpt-4o-mini
MODELS_ANTHROPIC=claude-3-5-sonnet-latest,claude-3-haiku-20240307
```

### Usar Modelos

```bash
# Modelo primeiro no config (padrão)
fazai

# Especificar modelo por nickname
fazai qwen                    # OpenRouter Qwen3 Coder
fazai llama32                 # Ollama Llama 3.2
fazai gpt4o                   # OpenAI GPT-4o
fazai sonnet                  # Anthropic Claude Sonnet

# Com tarefa em uma linha
fazai qwen "instalar nginx"
```

## 🔑 Configuração de API Keys

### Método 1: Instalador Interativo (Recomendado)

Durante a instalação, o FazAI pedirá suas API keys e criará o arquivo de configuração automaticamente.

### Método 2: Arquivo fazai.conf

Copie e edite o arquivo de exemplo:

```bash
cp fazai.conf.example /etc/fazai/fazai.conf
nano /etc/fazai/fazai.conf
```

**Exemplo de configuração completa:**
```bash
# ============================================
# FAZAI v3.3-beta - Configuração
# ============================================

# --- APIs de IA ---
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
OPENAI_API_KEY=sk-xxxxx
OLLAMA_BASE_URL=http://localhost:11434

# --- Vector Store (Qdrant) ---
VECTOR_PROVIDER=qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
VECTOR_DIMENSION=1536
VECTOR_DISTANCE=cosine

# --- Pesquisa MCP Context7 ---
MCP_CONTEXT7_URL=http://localhost:7700/context7/search
MCP_CONTEXT7_API_KEY=
# MCP_CONTEXT7_COMMAND=context7 --json --query "{query}"

# --- Fallback Web ---
WEB_SEARCH_PROVIDER=duckduckgo
FAZAI_DISABLE_RESEARCH=false

# --- Logs e Configuração ---
FAZAI_CONFIG_PATH=/etc/fazai/fazai.conf
LOG_LEVEL=info
```

### Método 3: Variáveis de Ambiente

```bash
export ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
export OPENAI_API_KEY=sk-xxxxx
export VECTOR_PROVIDER=qdrant
export QDRANT_URL=http://localhost:6333
fazai
```

### Obter API Keys

#### Anthropic Claude (Recomendado)
1. Acesse [console.anthropic.com](https://console.anthropic.com)
2. Crie conta (ganha $5 grátis para testar)
3. Gere uma API key em "API Keys"
4. Cole no `fazai.conf`: `ANTHROPIC_API_KEY=sk-ant-api03-xxxxx`

**Modelos:** Claude 3.5 Sonnet (inteligente), Claude Haiku (rápido e econômico)

#### OpenAI GPT
1. Acesse [platform.openai.com](https://platform.openai.com)
2. Vá em "API Keys" e crie uma nova key
3. Cole no `fazai.conf`: `OPENAI_API_KEY=sk-xxxxx`

**Modelos:** GPT-4o, GPT-4 Turbo, GPT-4 Mini

#### Ollama (Local/Gratuito)
1. Instale Ollama: [ollama.com](https://ollama.com)
2. Baixe um modelo:
   ```bash
   ollama pull llama3.2    # Llama 3.2 (Meta)
   ollama pull qwen2.5:7b  # Qwen 2.5 (Alibaba)
   ollama pull mistral     # Mistral 7B
   ```
3. Configure URL se não for localhost:
   ```bash
   OLLAMA_BASE_URL=http://192.168.1.100:11434
   ```

**Vantagens:** 100% local, gratuito, privado, sem limites

## 🛰️ Servidor MCP Embutido (Opcional)

Deseja compartilhar a camada de pesquisa do FazAI com outras ferramentas que falam MCP? Você pode subir um microservidor HTTP:

```ts
import { ResearchCoordinator } from "./src/research";
import { MCPServer } from "./src/mcp/server";

const research = new ResearchCoordinator();
const server = new MCPServer({ researchCoordinator: research, port: 7700 });
await server.start();
```

O endpoint `POST /context7/search` aceitará `{ "query": "..." }` e retornará os mesmos resultados exibidos pelo CLI (incluindo fallback web se configurado).

## 💬 Modo CLI Interativo

O modo `fazai --cli` oferece:
- Chat natural com memória contextual persistente (mantém as últimas interações entre sessões)
- Comandos especiais:
  - `/help` — lista as opções disponíveis
  - `/exec ...` — executa fluxos administrativos a partir de linguagem natural (suporta `'''texto'''`)
  - `/history` — exibe o histórico persistente de entradas
- `/history clear` — limpa esse histórico
- `/memory clear` — limpa a memória contextual gravada
- `/quit` ou `/exit` — encerra o modo CLI
- Histórico navegável com setas ↑/↓ e auto-complete para comandos iniciados com `/`

### Script de inicialização “Codex // Andarilho”

Para iniciar o FazAI com a marca registrada do projeto e exibir o contexto do **Andarilho dos Véus** antes do CLI:

```bash
```

O script:
- Mostra o banner “Codex // Andarilho”;
- Exibe o conteúdo de `context/andarilho-context.md` (personalize conforme desejar);
- Garante que o build exista (`dist/app.cjs`);
- Lança o `fazai --cli`.

## 🛠️ Desenvolvimento

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/fazai.git
cd fazai

# Instale dependências
npm install

# Desenvolvimento (com hot reload)
npm run dev

# Build para produção
npm run build

# Testar build
npm link
fazai
```

## 📦 Stack Técnico

- **TypeScript** - Tipagem estática
- **Anthropic Claude API** - IA conversacional
- **Inquirer** - Prompts interativos
- **Chalk** - Cores no terminal
- **Zod** - Validação de schemas
- **Node.js 18+** - Runtime

## 🤝 Contribuindo

Contribuições são muito bem-vindas! Para informações detalhadas sobre como contribuir, obter acesso ao repositório, resolver problemas de permissão e seguir os padrões do projeto, consulte nosso [Guia de Contribuição](CONTRIBUTING.md).

### Início Rápido

1. **Se você não tem acesso de escrita**: Fork o projeto primeiro
2. Clone seu fork ou o repositório original
3. Crie uma branch (`git checkout -b feature/MinhaFeature`)
4. Faça suas mudanças seguindo os [padrões de código](CONTRIBUTING.md#padrões-de-código)
5. Commit suas mudanças (`git commit -m 'Add: MinhaFeature'`)
6. Push para a branch (`git push origin feature/MinhaFeature`)
7. Abra um Pull Request

### Problemas de Permissão?

Se você receber um erro `Permission denied` ao fazer push, consulte a seção [Como Obter Acesso ao Repositório](CONTRIBUTING.md#como-obter-acesso-ao-repositório) no guia de contribuição para soluções detalhadas.

## 📄 Licença

- **Código**: [Apache License 2.0](LICENSE) (mantendo os termos do fork Mandark original)
- **Documentação, prompts e materiais de apoio**: [Creative Commons Attribution 4.0 International](LICENSE-CC-BY-4.0.md)

Consulte o arquivo [`NOTICE`](NOTICE) para detalhes de atribuição e histórico do projeto.

## 🙏 Créditos

FazAI deriva de [Mandark](https://github.com/hrishioa/mandark) por Hrishi Olickel. Este projeto mantém todos os créditos e direitos previstos pela licença Apache-2.0 original, adicionando documentação e adaptações específicas para administração Linux sob CC BY 4.0.

## ⚠️ Aviso

FazAI executa comandos reais no seu sistema. Sempre:
- Use `--dry-run` para testar primeiro
- Revise comandos antes de confirmar
- Tenha backups dos dados importantes
- Entenda o que cada comando faz

**FazAI não se responsabiliza por dados perdidos ou sistemas danificados.**

---

⭐ **Se FazAI te ajudou, deixe uma estrela!**
