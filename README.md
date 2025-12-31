# 🖥️ FazAI v3.14.1 - Terminal Admin Linux com IA Autônoma

<div align="center">

**Administrador de Sistemas Linux Senior + Redes**
*GenAIScript · llama.cpp · RAG Multi-Collection · Vector Store Qdrant · ECOA Architecture*

[![Version](https://img.shields.io/badge/version-3.14.1-blue.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-CC%20BY%204.0-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://typescriptlang.org)

</div>

<h3 align="center">Terminal inteligente que converte linguagem natural em comandos Linux seguros, com memória operacional, aprendizado contínuo, LLM local gratuito e pesquisa assistida.</h3>

---

## 🌟 O que há de novo na v3.14

### 🧹 Maestro Cleaner (v3.14.1)
- **Faxineiro Semântico** - detecta e arquiva código obsoleto
- Análise de imports órfãos e tecnologias deprecadas
- Modo seguro: nunca deleta, apenas move para `archive/`
- GenAIScript agent com 6 tools especializados
- `fazai cleaner [--exec] [--dry-run]`

### 🛡️ Validação de Comandos (v3.14.1)
- **Bloqueia opções desconhecidas** antes de enviar à IA
- Evita desperdício de tokens com comandos inválidos
- Mensagem clara: "Use 'fazai --help' para ver opções"

### 🔄 Migração Jarvis→FazAI (v3.14.0)
- **Jarvis completamente deprecado**
- Referências legadas removidas do código
- Documentação unificada sob marca FazAI
- Build migrado para ESM (ECMAScript Modules)

---

## 🌟 Features

### 🧠 Inteligência e Memória
- **6 Collections Qdrant Especializadas** para RAG e memória operacional
  - `fazai_personality` - Expertise técnica e estilo de troubleshooting
  - `fazai_memory` - Histórico operacional e contexto de infraestrutura
  - `fazai_learning` - Aprendizado técnico (erros, soluções, padrões)
  - `fazai_kb` - Base de conhecimento Linux/Redes validada
  - `fazai_inference` - Políticas de segurança, SLAs e regras operacionais
  - `fazai_semantic_cache` - Cache semântico de respostas (TTL 1h)

### 🤖 IA Multi-Provider (Fallback Chain)

**Ordem de prioridade:** `llama → ollama → openrouter → anthropic → openai → google`

| Provider | Modelos | Custo | Uso |
|----------|---------|-------|-----|
| **llama.cpp** | Phi-3-mini | Grátis | LLM local, privado, offline |
| **Ollama** | Llama 3.2, Qwen, Mistral | Grátis | LLM local via Ollama |
| **OpenRouter** | 200+ modelos | Variável | Cloud com free tier |
| **Anthropic** | Claude Sonnet, Haiku | Pago | Tarefas complexas |
| **OpenAI** | GPT-4o, GPT-4 Mini | Pago | Multi-modal |
| **Google** | Gemini 2.0/2.5 | Variável | 1M context window |

### 🛡️ Segurança em 5 Camadas
- **Pattern Matching**: Bloqueia comandos destrutivos conhecidos
- **Avaliação de Risco**: Análise automática (CRITICAL, HIGH, MEDIUM, LOW)
- **Safety Checks**: Validações pré-execução geradas pela IA
- **Rollback Automático**: Comandos reversíveis com undo integrado
- **Modo Dry-Run**: Simule sem executar nada

### 🔍 RAG-First Research
- **Consulta local primeiro**: RAG com threshold 0.6 antes de APIs externas
- **Fallback inteligente**: Perplexity → Context7 → DuckDuckGo
- **Cache semântico**: Evita re-processamento de queries similares

### 🎯 Universal Local Embedder
- **Zero Padding Automático**: Normaliza embeddings de 768d → 1536d
- **100% Local**: Usa Ollama nomic-embed-text (sem custos de API)
- **Cache LRU**: Economia de ~70% em processamento repetido
- **Semantic Chunking**: Separadores inteligentes para indexação

### 💬 Modo CLI Interativo
- **Chat persistente** com memória contextual entre sessões
- **Comandos especiais**: `/exec`, `/history`, `/memory`, `/samba`, `/help`
- **Histórico navegável**: Setas ↑/↓ e auto-complete
- **Bash completion**: Instalação automática para Bash e Zsh

---

## 🚀 Instalação

### Método 1: Instalador Automático (Recomendado)

```bash
curl -fsSL https://raw.githubusercontent.com/rogerluft/fazai-ng/master/install.sh | bash
```

O instalador irá:
- ✅ Verificar dependências (Node.js 18+, npm, git, cmake, g++)
- ✅ Clonar e compilar o projeto
- ✅ **Compilar llama.cpp** e baixar modelo Phi-3-mini (~2.4GB)
- ✅ **Configurar serviço systemd** `fazai-llama`
- ✅ Oferecer instalação do Qdrant (Docker/Podman/Binário)
- ✅ Criar arquivo de configuração interativo
- ✅ Instalar Bash/Zsh completion automaticamente
- ✅ Configurar diretórios de sistema (`/etc/fazai`, `/var/log/fazai`, `/opt/fazai`)

### Método 2: Build Local

```bash
git clone https://github.com/rogerluft/fazai-ng
cd fazai-ng
npm install
npm run build
npm link
fazai --help
```

### Instalação do llama.cpp (Opcional)

Se preferir instalar manualmente:

```bash
# 1. Compilar llama.cpp
git clone https://github.com/ggerganov/llama.cpp /opt/fazai/llama.cpp
cd /opt/fazai/llama.cpp
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j$(nproc)

# 2. Baixar modelo Phi-3-mini
mkdir -p /opt/fazai/models/phi3
wget -O /opt/fazai/models/phi3/Phi-3-mini-4k-instruct-q4.gguf \
  "https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf"

# 3. Criar symlinks
sudo ln -sf /opt/fazai/llama.cpp/build/bin/llama-server /usr/local/bin/llama-server
sudo ln -sf /opt/fazai/llama.cpp/build/bin/llama-cli /usr/local/bin/llama-cli

# 4. Instalar serviço
sudo cp etc/fazai/fazai-llama.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fazai-llama

# 5. Verificar
curl http://localhost:11430/health
```

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

---

## 📖 Uso

### Modo Admin Linux (Default)

```bash
# Iniciar FazAI (usa primeiro provider disponível)
fazai

# Com modelo específico
fazai phi3           # Phi-3-mini local (llama.cpp) - GRÁTIS
fazai llama32        # Llama 3.2 local (Ollama)
fazai qwen           # Qwen3 Coder (OpenRouter free)
fazai sonnet         # Claude Sonnet (Anthropic)
fazai gpt4o          # GPT-4o (OpenAI)

# Modo simulação (visualizar sem executar)
fazai --dry-run

# Modo CLI interativo com chat e memória persistente
fazai --cli
```

### Modo CLI Interativo

```bash
fazai --cli

# Comandos disponíveis:
/help                    # Lista todos os comandos
/exec instalar nginx     # Executa fluxo administrativo
/history                 # Mostra histórico de comandos
/history clear           # Limpa histórico
/memory clear            # Limpa memória contextual
/samba list              # Lista shares Samba
/quit ou /exit          # Encerra o CLI

# Suporta texto multi-linha:
/exec '''
  configurar nginx como proxy reverso
  para porta 3000 com SSL
'''
```

### Comandos Samba

```bash
# Listar compartilhamentos
fazai samba list               # Lista todos os shares Samba

# Adicionar diretório existente
fazai samba add /dados/compartilhado  # Adiciona diretório como share

# Remover share (com confirmação)
fazai samba del myshare        # Remove share do smb.conf

# Criar usuário com acesso Samba
fazai samba criauser joao      # Cria usuário Unix + Samba (interativo)

# Criar diretório como share
fazai samba criadir /dados/projetos  # Cria dir + configura share

# Criar grupo com permissões
fazai samba criagroup developers  # Cria grupo + aplica ACLs
```

### Modo Ask (Consultas e Dúvidas)

```bash
fazai ask "Como configurar nginx como proxy reverso?"
fazai ask "Diferença entre systemctl e service?"
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

# Auto-complete Bash/Zsh
fazai completion
```

---

## 🔧 Configuração

### Arquivo de Configuração (`/etc/fazai/fazai.conf`)

```bash
# ============================================
# FAZAI v3.14.1 - Configuração
# ============================================

# --- Local LLM (llama.cpp + Phi-3-mini) ---
LLAMA_SERVER_URL=http://localhost:11430
LLAMA_TIMEOUT=10000
LLAMA_RETRIES=3
LLAMA_TEMPERATURE=0.7
LLAMA_MAX_TOKENS=2048
MODELS_LLAMA=phi3-mini

# --- Ollama (Local) ---
OLLAMA_BASE_URL=http://localhost:11434
MODELS_OLLAMA=llama3.2,qwen2.5,mistral

# --- OpenRouter (Cloud - Free Tier) ---
OPENROUTER_API_KEY=sk-or-v1-xxxxx
MODELS_OPENROUTER=qwen/qwen3-coder:free,google/gemini-2.0-flash-exp:free

# --- Anthropic Claude ---
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
MODELS_ANTHROPIC=claude-3-5-sonnet-latest,claude-3-haiku-20240307

# --- OpenAI ---
OPENAI_API_KEY=sk-xxxxx
MODELS_OPENAI=gpt-4o,gpt-4o-mini

# --- Google Gemini ---
GOOGLE_API_KEY=xxxxx
MODELS_GOOGLE=gemini-2.0-flash-exp

# --- Vector Store (Qdrant) ---
VECTOR_PROVIDER=qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
VECTOR_DIMENSION=1536
VECTOR_DISTANCE=cosine

# --- Research ---
FAZAI_DISABLE_RESEARCH=false
FAZAI_RESEARCH_ON_FAILURE=true
WEB_SEARCH_PROVIDER=duckduckgo

# --- Agentic Loop Safeguards ---
AGENTIC_MAX_ITERATIONS=5
AGENTIC_TIMEOUT=120000

# --- Logs ---
LOG_LEVEL=info
```

---

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
- **LOW**: Executa direto

### 3. Safety Checks
IA gera verificações pré-execução:
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

---

## 🧪 Testes de Integração Reais

O FazAI-NG inclui uma suíte de testes de ponta a ponta para garantir a robustez e a inteligência agêntica. Estes testes simulam cenários reais de uso, interagindo diretamente com o sistema e as IAs.

### Executando a Suíte de Testes

1.  **Gere os Testes:** Execute o script principal para rodar todos os cenários e capturar logs brutos:
    ```bash
    ./tests/real-world-suite.sh
    ```
    *(Este script requer permissões de sudo para alguns testes administrativos).*

2.  **Auditoria Automática:** Após a execução, o script chama automaticamente o auditor agêntico para analisar os resultados e o estado do sistema (Qdrant, Cache, Personalidade):
    ```bash
    genaiscript run qa-reporter
    ```

### Relatório de Erros

O auditor gerará um relatório detalhado em `${LOG_FILE}` indicando falhas, prováveis causas e sugestões de correção.

### Contribuição de Testes

Para adicionar novos cenários de teste, crie um novo bloco de `run_test` no script `tests/real-world-suite.sh` e um novo prompt no `genaisrc/qa-reporter.genai.mjs` para análise, se necessário.



## 🗂️ Estrutura do Projeto

```
/home/rluft/fazai-ng/          # Repositório desenvolvimento
├── src/                        # Código fonte TypeScript
│   ├── app.ts                  # CLI principal
│   ├── models.ts               # Definição de modelos (FONTE!)
│   ├── providers/              # Providers de IA
│   │   ├── llama.ts            # llama.cpp local
│   │   ├── ollama.ts           # Ollama local
│   │   └── ...                 # OpenRouter, Anthropic, OpenAI, Google
│   └── services/               # Serviços (cache, embeddings)
├── scripts/                    # Scripts de build e instalação
├── completion/                 # Arquivos de completion gerados
├── tests/                      # Testes (vitest)
├── docs/                       # Documentação
├── etc/fazai/                  # Configurações de sistema
│   ├── fazai.conf              # Configuração principal
│   └── fazai-llama.service     # Serviço systemd
└── package.json

/opt/fazai/                     # Instalação produção
├── llama.cpp/                  # llama.cpp compilado
└── models/phi3/                # Modelo Phi-3-mini

/etc/fazai/fazai.conf           # Configuração sistema
/var/log/fazai/                 # Logs do sistema
```

---

## 📦 Stack Técnico

- **TypeScript 5.0** - Tipagem estática
- **Node.js 18+** - Runtime
- **llama.cpp** - LLM local (Phi-3-mini)
- **Qdrant** - Vector database
- **Vitest** - Testing framework
- **Husky** - Git hooks (TDD enforcer)
- **Anthropic/OpenAI SDK** - IA APIs
- **Inquirer** - Prompts interativos
- **Chalk** - Cores no terminal
- **Zod** - Validação de schemas

---

## 🔗 Integração GitHub

```bash
# Login com Personal Access Token
fazai github auth login

# Informações de usuário
fazai github user

# Gerenciar repositórios
fazai github repos
fazai github repo owner/repo
fazai github fork owner/repo
fazai github star owner/repo

# Issues
fazai github issues owner/repo
fazai github issue create owner/repo
```

---

## 🛠️ Manutenção e Ferramentas

### Remover Pasta do Histórico Git

Para remover permanentemente uma pasta ou arquivo do histórico completo do Git:

```bash
# Usando script automatizado
./scripts/git-purge-folder.sh claudio15-11-25

# Com dry-run (simulação)
./scripts/git-purge-folder.sh "claudio*" --glob --dry-run
```

**Documentação completa**: [docs/guides/REMOVE_FROM_GIT_HISTORY.md](docs/guides/REMOVE_FROM_GIT_HISTORY.md)

**⚠️ Aviso**: Esta é uma operação destrutiva que requer `git push --force` e pode afetar colaboradores.

---

## 🤝 Contribuindo

Contribuições são muito bem-vindas! Consulte o [Guia de Contribuição](CONTRIBUTING.md).

### Início Rápido

1. Fork o projeto
2. Clone seu fork
3. Crie uma branch (`git checkout -b feature/MinhaFeature`)
4. Faça suas mudanças
5. Commit (`git commit -m 'Add: MinhaFeature'`) - TDD enforced!
6. Push para a branch
7. Abra um Pull Request

---

## 📄 Licença

**[Creative Commons Attribution 4.0 International (CC BY 4.0)](LICENSE)**

Copyright (c) 2024-2025 Roger Luft - roger@rogerluft.com.br

Você é livre para compartilhar e adaptar este material para qualquer finalidade,
inclusive comercial, desde que atribua o crédito apropriado.

---

## 🙏 Agradecimentos

Agradecimento especial a [Hrishi Olickel](https://github.com/hrishioa) pelo projeto
[Mandark](https://github.com/hrishioa/mandark) que serviu de inspiração inicial.

---

## ⚠️ Aviso

FazAI executa comandos reais no seu sistema. Sempre:
- Use `--dry-run` para testar primeiro
- Revise comandos antes de confirmar
- Tenha backups dos dados importantes
- Entenda o que cada comando faz

**FazAI não se responsabiliza por dados perdidos ou sistemas danificados.**

---

<div align="center">

⭐ **Se FazAI te ajudou, deixe uma estrela!**

**[Changelog](CHANGELOG.md) · [Issues](https://github.com/rogerluft/fazai-ng/issues) · [Discussions](https://github.com/rogerluft/fazai-ng/discussions)**

</div>
