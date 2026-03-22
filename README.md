# 🖥️ FazAI — Administrador Linux Inteligente com IA

<div align="center">

**Orquestração Multi-Agente para Administração de Sistemas Linux**
*Autonomous Agent Core · Multi-Provider LLM · RAG Local · ONNX Embeddings · Qdrant Vector Store · ECOA Architecture*

[![Version](https://img.shields.io/badge/version-3.22.0-blue.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://typescriptlang.org)
[![Tests](https://img.shields.io/badge/tests-594%20passing-brightgreen.svg)](#testes)

</div>

<h3 align="center">Agente autônomo Linux com loop orçamentário persistente, montagem inteligente de contexto antes de cada chamada LLM, registro maduro de skills com auto-discovery, e fallback multi-provider.</h3>

## O que h&aacute; de novo na v3.23 (Phase 4)

- **Claude-Import Converter** — cli subcommand `fazai agent claude-import` to ingest `.claude/SKILL.md` (YAML + Markdown) and auto-generate FazAI native `.genai.mjs` wrapper skills
- **New Gateways (Telegram + Voice)** — `telegram-bot` skill connects the AgenticLoop to a lightweight polling bot, and `voice-stt` handles 100% local Whisper STT / gTTS TTS
- **Dashboard API Routes** — dedicated routers for config (`/api/config`), system prompts CRUD (`/api/prompts`), and embedded terminal status (`/api/terminal`)

## Principais Recursos Integrados (Phases 1-3)

- **Agent Loop com Budget** — loop agêntico com limites de iteração e tokens, circuit breaker, heartbeat e sessões persistentes
- **Context Assembly** — montagem automática de contexto rico (personalidade + safety + RAG + histórico) antes de cada chamada LLM
- **Skill Registry** — registro centralizado com auto-discovery de skills no `genaisrc/`, permissões e categorias
- **CLI Agent expandido** — `fazai agent skills`, `fazai agent use <skill>`, `fazai agent budget`, `fazai agent sessions`

> **Próximo:** Phase 5 — Async Memory Freshness Injector (background worker + systemd timer para manter memórias Qdrant atualizadas)

---

## Features

### Agente Autônomo (Phases 1-3)

| Feature | Descrição |
|---------|-----------|
| **Budget Loop** | Loop agêntico com `maxIterations` + `tokenBudget` configuráveis via `fazai.conf` |
| **Circuit Breaker** | Pausa automática após N falhas consecutivas (default: 3) |
| **Heartbeat** | Log periódico de estado + métricas a cada 30s |
| **Session Persistence** | Sessões salvas em Qdrant, resume após restart |
| **Context Assembly** | Personalidade + safety rules + RAG (5 collections) + histórico + tarefa atual |
| **Skill Registry** | Auto-discovery de `genaisrc/*.genai.mjs`, permissões por nível, categorias |
| **Maestro Cleaner** | Invocado automaticamente no circuit breaker e final de loop |

### IA Multi-Provider (Config-Driven)

Providers e modelos definidos em `/etc/fazai/fazai.conf`. Fallback automático via `PROVIDER_FALLBACK_ORDER`.

| Provider | Modelos | Custo | Uso |
|----------|---------|-------|-----|
| **Ollama** | Qwen 3.5, Phi-3, Gemma 3, Llama 3.2 | Gratis | LLM local via Ollama |
| **Anthropic** | Claude Sonnet 4.5, Haiku 4.5 | Pago | Tarefas complexas |
| **Google** | Gemini 2.5 Pro, Gemini 2.5 Flash | Variavel | 1M context window |
| **OpenRouter** | 200+ modelos | Variavel | Cloud com free tier |
| **Perplexity** | Sonar Large/Small | Pago | Pesquisa online |
| **OpenAI** | GPT-4o, GPT-4 Mini | Pago | Multi-modal |

### Memoria e RAG (Arquitetura ECOA)

6 collections Qdrant especializadas com embeddings ONNX locais (BGE-base-en-v1.5, 768d):

| Collection | Proposito |
|------------|-----------|
| `fazai_personality` | Expertise tecnica e estilo de troubleshooting |
| `fazai_memory` | Historico operacional e contexto de infraestrutura |
| `fazai_learning` | Aprendizado tecnico (erros, solucoes, padroes) |
| `fazai_kb` | Base de conhecimento Linux/Redes validada |
| `fazai_inference` | Politicas de seguranca, SLAs e regras operacionais |
| `fazai_semantic_cache` | Cache semantico de respostas (TTL 1h) |

### Embeddings 100% Local

- **ONNX Runtime** com BGE-base-en-v1.5 (768d) — sem dependencia de API externa
- **Cache LRU** — economia de ~70% em processamento repetido
- **Semantic Chunking** — separadores inteligentes para indexacao
- Ollama **nao** eh usado para embeddings (apenas para inferencia LLM)

### Pesquisa Web (RAG-First)

Estrategia de pesquisa em cascata:

1. **RAG Local** — consulta Qdrant primeiro (threshold 0.6)
2. **Perplexity** — pesquisa online com raciocinio
3. **Context7** — documentacao de bibliotecas em tempo real
4. **Brave Search** — busca web geral (free tier 2000 req/mes)
5. **DuckDuckGo** — fallback para queries enciclopedicas

### Seguranca em 5 Camadas

1. **Pattern Matching** — bloqueia `rm -rf /`, `dd if=/dev/zero`, `mkfs`, etc.
2. **Avaliacao de Risco** — CRITICAL, HIGH, MEDIUM, LOW com confirmacao proporcional
3. **Safety Checks** — validacoes pre-execucao geradas pela IA
4. **Rollback Automatico** — comandos reversiveis com undo integrado
5. **Dry-Run Mode** — `fazai --dry-run` simula sem executar

---

## Instalacao

### Metodo 1: Instalador Automatico (Recomendado)

```bash
curl -fsSL https://raw.githubusercontent.com/rogerluft/fazai-ng/master/install.sh | bash
```

O instalador:
- Verifica dependencias (Node.js 18+, npm, git)
- Compila o projeto TypeScript
- Oferece instalacao do Qdrant (Docker/Podman/Binario)
- Cria configuracao interativa em `/etc/fazai/fazai.conf`
- Instala Bash/Zsh completion automaticamente
- Configura diretorios de sistema (`/etc/fazai`, `/var/log/fazai`, `/opt/fazai`)
- Valida novos flags de configuracao (AGENTIC_*, SKILL_REGISTRY_*)

### Metodo 2: Build Local

```bash
git clone https://github.com/rogerluft/fazai-ng
cd fazai-ng
npm install
npm run build
npm link
fazai --help
```

### Embeddings ONNX (qdrant-universal-injection)

```bash
# Clonar o pacote de embeddings
git clone https://github.com/rogerluft/qdrant-universal-injection
cd qdrant-universal-injection
npm install && npm run build

# Linkar no fazai-ng
cd /caminho/para/fazai-ng
npm link /caminho/para/qdrant-universal-injection
```

### Qdrant (Vector Store)

Todas as collections usam vetores de **768 dimensoes** com distancia Cosine.

```bash
# Docker (Recomendado)
docker run -d -p 6333:6333 -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage:z \
  qdrant/qdrant

# Podman
podman run -d -p 6333:6333 -p 6334:6334 \
  -v ./qdrant_storage:/qdrant/storage:z \
  qdrant/qdrant
```

---

## Uso

### Modo Admin Linux (Default)

```bash
fazai                    # Usa primeiro provider disponivel
fazai "lista portas abertas"   # Tarefa em linguagem natural
fazai --dry-run          # Simula sem executar
fazai --cli              # Modo interativo com chat
```

### Modo Ask (Consultas)

```bash
fazai ask "Como configurar nginx como proxy reverso?"
fazai ask "Melhores praticas para hardening SSH"
```

### Agente Autônomo

```bash
# Loop com budget tracking
fazai agent budget "configure samba para compartilhamento" -i 20 --token-budget 100000

# Loop agêntico nativo
fazai agent loop "como otimizar embeddings locais no DL380"

# Skills
fazai agent skills                          # Lista skills registrados (com auto-discovery)
fazai agent use cleaner --mode analyze      # Executa um skill
fazai agent use reflect                     # Executa reflexão autônoma

# Sessões
fazai agent sessions                        # Lista sessões ativas
fazai agent status <session-id>             # Status detalhado
fazai agent pause <session-id>              # Pausa sessão
fazai agent resume <session-id>             # Retoma sessão
fazai agent kill <session-id>               # Encerra sessão
```

### Modo CLI Interativo

```bash
fazai --cli

# Comandos:
/help                    # Lista comandos
/exec instalar nginx     # Executa fluxo administrativo
/history                 # Historico de comandos
/memory clear            # Limpa memoria contextual
/samba list              # Lista shares Samba
/quit                    # Encerra
```

### Samba

```bash
fazai samba list                     # Lista shares
fazai samba add /dados/compartilhado # Adiciona share
fazai samba del myshare              # Remove share
fazai samba criauser joao            # Cria usuario Unix + Samba
fazai samba criadir /dados/projetos  # Cria diretorio como share
fazai samba criagroup developers     # Cria grupo com ACLs
```

### Vector Store e Gerenciamento

```bash
fazai config                              # Ver configuracoes
fazai vector validate                     # Validar collections
fazai vector recreate --provider qdrant   # Recriar collections
fazai vector import --file conversas.json # Importar conversas
```

---

## Configuracao

Arquivo unico: **`/etc/fazai/fazai.conf`** — fonte de verdade para todas as configuracoes.

```bash
# Providers e modelos (max 3 por provider, separados por virgula)
MODELS_OLLAMA=qwen3.5,phi3:latest,gemma3:12b
MODELS_ANTHROPIC=claude-sonnet-4-5,claude-haiku-4-5
MODELS_GOOGLE=gemini-2.5-pro,gemini-2.5-flash
MODELS_OPENROUTER=qwen/qwen3-coder:free,meta-llama/llama-3.3-70b

# Ordem de fallback (providers sem API key sao ignorados)
PROVIDER_FALLBACK_ORDER=anthropic,google,openrouter,ollama

# Pesquisa web
WEB_SEARCH_PROVIDER=brave
BRAVE_SEARCH_API_KEY=sua_chave_aqui

# Ollama (servidor remoto ou local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_NUM_PREDICT=1024
OLLAMA_TEMPERATURE=0.4

# Agente Autônomo (Phase 1)
AGENTIC_MAX_ITERATIONS=5
AGENTIC_TOKEN_BUDGET=50000
AGENTIC_CIRCUIT_BREAKER_MAX_FAILURES=3
AGENTIC_HEARTBEAT_INTERVAL=30000
AGENTIC_SESSION_PERSIST=true

# Skill Registry (Phase 3)
SKILL_REGISTRY_SCAN_INTERVAL=0
GENAISRC_DIR=genaisrc

# Timeouts por provider (ms)
TIMEOUT_OLLAMA=180000
TIMEOUT_ANTHROPIC=120000
TIMEOUT_GOOGLE=90000
```

---

## Web Interface

FazAI inclui interface web Next.js 15 para administracao visual:

| Pagina | Descricao |
|--------|-----------|
| `/` | Dashboard principal com metricas |
| `/personality` | Gerenciar tracos de personalidade |
| `/memory` | Explorar memorias por role |
| `/knowledge` | Knowledge base (CRUD) |
| `/learning` | Aprendizados e estatisticas |
| `/integrations/cloudflare` | Zones, DNS, SSL, firewall, cache |
| `/integrations/opnsense` | Firewall, NAT, VPN, DHCP |
| `/integrations/spamexperts` | Dominios, quarentena, listas |
| `/samba` | Gerenciar shares Samba |

---

## Stack Tecnico

| Tecnologia | Uso |
|------------|-----|
| TypeScript 5.0 | Linguagem principal |
| Node.js 18+ | Runtime |
| Qdrant | Vector database (768d Cosine) |
| ONNX Runtime | Embeddings locais (BGE-base-en-v1.5) |
| Vitest | Testing framework |
| Husky | Git hooks (TDD enforcer) |
| Zod | Validacao de schemas |
| Next.js 15 | Web UI |
| Chalk | Cores no terminal |

---

## Integracao GitHub

```bash
fazai github auth login         # Login com PAT
fazai github user               # Info do usuario
fazai github repos              # Listar repositorios
fazai github issues owner/repo  # Listar issues
fazai github issue create owner/repo  # Criar issue
```

---

## Testes

```bash
npm test                  # Todos os testes
npm run test:unit         # Apenas unitarios
npm run test:integration  # Apenas integracao
```

O projeto usa **TDD enforcer** via pre-commit hook — commits sao bloqueados se qualquer teste falhar.

---

## Contribuindo

1. Fork o projeto
2. Clone seu fork
3. Crie uma branch (`git checkout -b feature/MinhaFeature`)
4. Faca suas mudancas
5. Commit (`git commit -m 'Add: MinhaFeature'`) — TDD enforced!
6. Push e abra um Pull Request

---

## Licenca

**[Apache License 2.0](LICENSE)**

Copyright (c) 2024-2026 Roger Luft — roger@rogerluft.com.br

---

## Aviso

FazAI executa comandos reais no seu sistema. Sempre:
- Use `--dry-run` para testar primeiro
- Revise comandos antes de confirmar
- Tenha backups dos dados importantes

**FazAI nao se responsabiliza por dados perdidos ou sistemas danificados.**

---

<div align="center">

**[Changelog](CHANGELOG.md) · [Issues](https://github.com/rogerluft/fazai-ng/issues) · [Discussions](https://github.com/rogerluft/fazai-ng/discussions)**

</div>
