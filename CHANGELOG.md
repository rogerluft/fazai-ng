# FazAI Changelog

## [3.4.1-beta] - 2025-12-04

### Added
- **Personality Import Script** (`scripts/import-personality.ts`)
  - Extrai traços de personalidade de conversas Claude Desktop (`conversations.json`)
  - Gera embeddings REAIS usando Ollama local (não mais vetores zero)
  - Popula collection `fazai_personality` com metadados estruturados
  - Detecta expertise técnica (linux, networking, docker, security, monitoring)
  - Identifica estilos de comunicação (metódico, prático, técnico)
  - Extrai abordagens de resolução de problemas (sequencial, flexível)
  - Uso: `npx tsx scripts/import-personality.ts ./conversations.json`

### Changed
- **Embeddings Service** (`src/services/embeddings.ts`)
  - Smart Ollama model detection: verifica se modelo existe antes de usar
  - Fallback automático: `mxbai-embed-large` (1024 dim) → `nomic-embed-text` (768 dim) → OpenAI
  - Evita erros silenciosos quando modelo preferido não está disponível
  - Log informativo mostrando qual modelo e dimensão estão sendo usados

### Fixed
- **Dimension Mismatch**: Corrigido problema onde serviço de embeddings selecionava Ollama
  mesmo sem o modelo `mxbai-embed-large`, causando erros de dimensão no Qdrant
- **Zero Vectors**: Personality data agora usa embeddings reais em vez de `Array(1536).fill(0)`

### Technical
- Collection `fazai_personality` recriada com 768 dimensões (nomic-embed-text)
- 13 traços de personalidade importados de 113 conversas históricas
- Embeddings gerados via Ollama local (sem dependência de OpenAI)

## [3.4.0-beta] - 2025-11-29

### Added
- **Gemini 3 Preview Feature**:
  - Introduced a new "Gemini 3" model (`gemini3`) as a preview feature, pointing to the latest `gemini-1.5-pro-latest` model.
  - Added an `ENABLE_PREVIEW_FEATURES=true` flag in `fazai.conf` to activate preview models and features.
  - Implemented an "Auto" mode for model selection. When no model is specified and preview features are enabled, `fazai` will automatically default to `gemini3`.
  - Updated the model list in the help text to a new, more descriptive format that appears when preview features are enabled.
  - Added new built-in model definitions for `gemini-2.5-pro` (`pro`), `gemini-2.5-flash` (`flash`), and `gemini-2.5-flash-lite` (`flash-lite`).

### Changed
- **Consistency Matrix Compliance**: All relevant layers updated for the new feature:
  - **Help text** (`src/app.ts`): Now dynamically displays the new model menu.
  - **Bash completion** (`completion/fazai-completion.bash`): Added `gemini3`, `pro`, `flash`, and `flash-lite`.
  - **Config file** (`fazai.conf.example`): Added `ENABLE_PREVIEW_FEATURES` flag.
  - **Model Definitions** (`src/models.ts`): Updated to include new models and preview logic.
  - **Changelog** (`CHANGELOG.md`): This entry.

## [3.3.1-beta] - 2025-11-29

### Changed
- **Architecture Consolidation**: Refactored the installation and sync process to enforce a single, canonical point of entry for the `fazai` executable.
  - `install.sh` now creates a robust symbolic link (`/usr/local/bin/fazai`) instead of a brittle wrapper script, ensuring updates to the launcher script in `/opt/fazai/bin` are automatically reflected.
  - The `fazai sync` command is now the official method for updating the global installation from a development repository, replacing all manual `cp` workflows. Its logic was corrected to properly sync the `bin/` directory and remove incorrect internal symlink creation.
  - Redundant launcher scripts were deprecated in favor of a single, canonical launcher (`/opt/fazai/bin/fazai`). A new consolidation script (`scripts/consolidate-fazai.sh`) was created to help users clean up old, redundant executables.
  - An environment setup script (`scripts/setup-env.sh`) was created and integrated into the build, install, and runtime processes to manage aliases (`repo`), environment variables (`FAZAI_REPO`), and log permissions automatically.

### Documentation
- **`SYNC_WORKFLOW.md`**: Overhauled to reflect the new `fazai sync`-centric workflow and the single-point-of-entry architecture. All manual `cp` instructions were replaced.
- **`CHANGELOG.md`**: Added this entry to document the consolidation.

## [3.3.0-beta] - 2025-11-18

### Added
- **Integração GitHub** (`src/github-auth.ts`, `src/commands/github.ts`)
  - Autenticação via Personal Access Token (PAT)
  - Gerenciamento de repositórios (listar, informações detalhadas)
  - Operações com issues (listar, criar)
  - Operações com repositórios (fork, star, listar favoritos)
  - Comando `fazai github` com subcommands: `auth`, `user`, `repos`, `repo`, `issues`, `issue`, `fork`, `star`, `starred`, `pr`
  - Integração com Octokit SDK (REST API oficial do GitHub)
  - Configuração via `GITHUB_TOKEN` em `/etc/fazai/fazai.conf`
  - Padrão de singleton seguindo arquitetura existente

- **Integração Google Gemini via Cloudflare** (`src/cloudflare-gemini.ts`)
  - Suporte a modelos: `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`
  - Endpoints OpenAI-compatível via Cloudflare Workers (gemini-cli-openai)
  - Suporte a streaming de respostas
  - Contexto massivo (1M tokens)
  - Integração com OpenAI SDK
  - Configuração via `GEMINI_WORKER_URL` em `/etc/fazai/fazai.conf`
  - Padrão de singleton seguindo arquitetura existente

- **Dependência**: `@octokit/rest` ^21.0.2 para operações GitHub

- **Documentação atualizada** (`README.md`)
  - Seção "🔗 Integração GitHub" com autenticação, configuração e exemplos de comandos
  - Seção "☁️ Integração Google Gemini via Cloudflare" com setup e características
  - Guia para obter Personal Access Tokens (GitHub)
  - Instruções para deploy de gemini-cli-openai em Cloudflare Workers

- **Bash Completion atualizado** (`completion/fazai-completion.bash`)
  - Adicionado comando `github` à lista de comandos
  - Subcommands: `auth`, `user`, `repos`, `repo`, `issues`, `issue`, `fork`, `star`, `starred`, `pr`, `help`
  - Nested completion para `auth` (login/logout/status)
  - Nested completion para `issue` (create)

- **Configuração estendida** (`fazai.conf.example`)
  - Seção "GITHUB INTEGRATION" (linhas 75-88)
  - Seção "CLOUDFLARE GEMINI INTEGRATION" (linhas 52-73)
  - Documentação de scopes necessários para GitHub
  - Exemplos de setup para Cloudflare Workers

### Changed
- **Consistency Matrix Compliance**: Todas as 6 camadas mantidas em sincronismo
  1. Help text (src/app.ts - adicionado github command)
  2. Bash completion (completion/fazai-completion.bash)
  3. Config file (fazai.conf.example)
  4. Installer (install.sh)
  5. Documentation (README.md)
  6. Changelog (este arquivo)
- **Versão**: Atualizada para 3.3.0-beta em todos os arquivos
  - README.md header
  - completion/fazai-completion.bash

### Technical
- Dependência nova: `@octokit/rest` ^21.0.2
- Padrão arquitetural: Classes singleton seguindo `CloudflareAuth` e `CloudflareGeminiClient`
- Configuração centralizada em `/etc/fazai/fazai.conf` com fallback para env vars
- Integração completa com sistema existente de modelos e providers

## [3.2.0-beta] - 2025-11-18

### Added
- **Config-Driven Model Architecture** (`src/models.ts`)
  - Modelos agora são carregados de `/etc/fazai/fazai.conf` (fonte de verdade)
  - Máximo 3 modelos por provedor (organização clara)
  - Fallback automático para built-in defaults se config não disponível
  - Suporta: Ollama, OpenRouter, OpenAI, Anthropic, Google
  - Novos campos: `description` para melhor UX

- **Configuration Entries** (`fazai.conf.example` e `/etc/fazai/fazai.conf`)
  - `MODELS_OLLAMA=model1,model2,model3` (local, max 3)
  - `MODELS_OPENROUTER=model1,model2,model3` (cloud, max 3)
  - `MODELS_OPENAI=model1,model2,model3` (cloud, max 3)
  - `MODELS_ANTHROPIC=model1,model2,model3` (cloud, max 3)
  - `MODELS_GOOGLE=model1,model2,model3` (cloud, max 3)

- **Updated Documentation**
  - README.md: Nova seção "🎯 Modelos Disponíveis (Config-Driven)" com tabelas por provider
  - Exemplos claros de como usar cada modelo por nickname
  - Documentação de como configurar modelos em `/etc/fazai/fazai.conf`
  - Links para obter API keys de cada provider

- **Bash Completion** (`completion/fazai-completion.bash`)
  - Atualizado para refletir nicknames: gptoss, llama32, llama31, qwen, llama33, gemini, gpt4o, gpt4mini, sonnet, haiku
  - Comentários indicando provedor de cada modelo

### Changed
- **Consistency Matrix Compliance**: Todas as 6 camadas mantidas em sincronismo
  1. Help text (src/app.ts)
  2. Bash completion (completion/fazai-completion.bash)
  3. Config file (fazai.conf.example, /etc/fazai/fazai.conf)
  4. Installer (install.sh - já menciona modelos)
  5. Documentation (README.md)
  6. Changelog (este arquivo)

## [3.1.1-beta] - 2025-11-17

### Added
- **fzalias Integration**: Sistema de aliases global multidistro
  - Gerenciador de aliases para todos os usuários (`/etc/fazai/fzalias`)
  - Suporte Debian/Ubuntu e RedHat/Fedora/Rocky
  - Comando `fzalias` para adicionar/listar/remover aliases em runtime
  - Integração com bash completion do sistema
  - Instalação automática via `install.sh`
  - Documentação em README.md (seção "Sistema de Aliases Global")
- **Google Gemini Native API Integration** (`src/linux-admin.ts`, `src/askAI.ts`)
  - Suporte nativo via `@google/generative-ai` SDK
  - 3 novos modelos: `gemini2flash`, `gemini15pro`, `gemini15flash`
  - Free tier: 15 req/min, 1500 req/day
  - Streaming de respostas com parse JSON robusto
  - Configuração via `GOOGLE_API_KEY` ou `GEMINI_API_KEY` no `fazai.conf`
  - Documentação completa em `docs/GEMINI_INTEGRATION.md`
- **Sacred Coding Protocols** consolidados em `AGENTS.md` (seção 🔒 Sacred Coding Protocols)
  - Consistency Matrix: 6 items obrigatórios (help, completion, config, installer, docs, changelog)
  - Proibição de placeholders e código half-documented
  - Feature Addition Protocol com 9 steps obrigatórios
- **Comando `sync`**: Sincroniza alterações do repositório para `/opt/fazai`
  - Build automático antes de sync
  - Validação de integridade (tamanho de arquivos)
  - Reinicia serviços automaticamente
  - Suporta `--dry-run` e `--verbose`
  - Detecta `$SUDO_USER` para encontrar repo do usuário real
- **Integração Cloudflare**: Gerenciamento completo via API (`src/commands/cloudflare.ts`)
  - `fazai cloudflare zones`: Listar todas as zonas
  - `fazai cloudflare dns list <zoneId>`: Listar registros DNS
  - `fazai cloudflare dns create <zoneId> <type> <name> <content> [proxied]`: Criar DNS
  - `fazai cloudflare dns delete <zoneId> <recordId>`: Deletar DNS
  - `fazai cloudflare workers list`: Listar Cloudflare Workers
  - `fazai cloudflare cache purge <zoneId>`: Limpar cache de zona
  - `fazai cloudflare ssl get <zoneId>`: Ver configuração SSL
  - `fazai cloudflare ssl set <zoneId> <mode>`: Alterar modo SSL (off/flexible/full/strict)
- **Bash Completion atualizado**: Inclui `sync` e `cloudflare` commands com subcommands
- **Configurações Cloudflare** no `fazai.conf.example` (linhas 89-101):
  - `CLOUDFLARE_API_TOKEN` (recomendado - scoped permissions)
  - `CLOUDFLARE_API_KEY` + `CLOUDFLARE_EMAIL` (legacy - global permissions)
  - `CLOUDFLARE_ACCOUNT_ID` (opcional - para account-level operations)
- **Configurações Gemini** preparadas para integração futura (linhas 103-110)

### Changed
- **Repository cleanup**: Removidos 16.390 linhas de código obsoleto
  - Deletado `beta/` (Python framework - postponed)
  - Deletado `.claude/`, `CLAUDE.md` (session artifacts)
  - Deletado `AUDIT*.md` (4 arquivos consolidados)
  - Deletado `CODING_PROTOCOLS.md` (movido para AGENTS.md)
  - Deletado `TODO.md` (completed items)
- **Commands organization**: Movido para `src/commands/` (cloudflare.ts, sync.ts)
- **Instalação centralizada**: Tudo em `/opt/fazai`, sem symlinks em `/usr/local/bin`
- **PATH configuração**: Usa `export PATH="/opt/fazai/bin:$PATH"` em vez de symlinks
- **Help message**: Atualizado com novos comandos `sync` e `cloudflare`
- **Completion**: Sincronizado com features atuais
- **Workflow de desenvolvimento**: Repo (`~/fazai-ng`) → Build → Sync → `/opt/fazai`

### Fixed
- **Ollama model mapping**: `gptoss-20b` → `gpt-oss:20b` (nome correto no servidor)
- **OpenRouter integration**: Adiciona `HTTP-Referer` header obrigatório
- **Web service paths**: Corrige `WorkingDirectory` para `/opt/fazai/web`
- **Build validation**: Usa exit code em vez de stderr
- **Log permissions**: Usa `~/.cache/fazai/` em vez de `/tmp/`
- **Config consistency**: `fazai.conf.example` reflete todas as features atuais
- **Import paths**: Corrige relative imports em `src/commands/`

## [Unreleased] - 2025-11-17

### Added
- **Comando `sync`**: Sincroniza alterações do repositório para `/opt/fazai`
  - Build automático antes de sync
  - Validação de integridade (tamanho de arquivos)
  - Reinicia serviços automaticamente
  - Suporta `--dry-run` e `--verbose`
- **Integração Cloudflare**: Gerenciamento completo via API
  - `fazai cf zones`: Listar zonas
  - `fazai cf dns list <zoneId>`: Gerenciar DNS
  - `fazai cf workers`: Gerenciar Cloudflare Workers
  - `fazai cf purge <zoneId>`: Limpar cache
  - `fazai cf analytics <zoneId>`: Ver estatísticas
- **Protocolos de Codificação**: Documento `CODING_PROTOCOLS.md` estabelecendo regras sagradas
- **Bash Completion atualizado**: Inclui `sync` e `cloudflare` commands
- **Configurações Cloudflare** no `fazai.conf.example`:
  - `CLOUDFLARE_API_TOKEN` (recomendado)
  - `CLOUDFLARE_API_KEY` + `CLOUDFLARE_EMAIL` (legacy)
  - `CLOUDFLARE_ACCOUNT_ID`
- **Configurações Gemini** preparadas para integração futura

### Changed
- **Instalação centralizada**: Tudo em `/opt/fazai`, sem symlinks em `/usr/local/bin`
- **PATH configuração**: Usa `export PATH="/opt/fazai/bin:$PATH"` em vez de symlinks
- **Help message**: Atualizado com novos comandos `sync` e `cloudflare`
- **Completion**: Sincronizado com features atuais
- **Workflow de desenvolvimento**: Repo (`~/fazai-ng`) → Build → Sync → `/opt/fazai`

### Fixed
- **Ollama model mapping**: `gptoss-20b` → `gpt-oss:20b` (nome correto no servidor)
- **OpenRouter integration**: Adiciona `HTTP-Referer` header obrigatório
- **Web service paths**: Corrige `WorkingDirectory` para `/opt/fazai/web`
- **Build validation**: Usa exit code em vez de stderr
- **Log permissions**: Usa `~/.cache/fazai/` em vez de `/tmp/`
- **Config consistency**: `fazai.conf.example` reflete todas as features atuais

### Documentation
- **CODING_PROTOCOLS.md**: Regras imutáveis de desenvolvimento
- **SYNC_WORKFLOW.md**: Atualizado com novo fluxo de trabalho
- **README.md**: Documentação completa de instalação e uso
- **QUICK-START.md**: Guia rápido atualizado

## [3.1.0-beta] - 2025-11-14

### Added
- **Arquitetura Terminal FazAI** com 5 collections Qdrant especializadas
- **Importador de conversas** (Claude Desktop + ChatGPT Desktop → Qdrant)
  - Comando: `fazai import <file> --source=<claude|chatgpt>`
  - Extração automática de conhecimento técnico para fazai_kb
  - Extração de padrões de aprendizado para fazai_learning
  - Suporte a importação recursiva de diretórios
- **Instalador completo** com instalação do Qdrant (Docker/Podman/Binário)
- **Manual completo** (MANUAL.md) com 700+ linhas e 8 casos de uso reais
- **Bash completion** (Bash + Zsh) para todos os comandos e flags
- **Suite de testes reais** com Vitest (sem mocks)
  - Integration tests com Qdrant real
  - Unit tests para sistema de configuração
  - Coverage support
- **Collections Qdrant:**
  - fazai_personality - Expertise e estilo de troubleshooting
  - fazai_memory - Histórico operacional
  - fazai_learning - Aprendizado técnico
  - fazai_kb - Base de conhecimento Linux/Redes (RAG)
  - fazai_inference - Políticas de segurança e SLAs

### Changed
- **Sistema de configuração** prioriza `/etc/fazai/fazai.conf` (config do sistema)
- **Installer** agora cria diretórios de sistema (/etc/fazai, /var/log/fazai)
- **Collections renomeadas:** jarvis_* → fazai_*
- **Foco especializado:** Administrador Linux Senior + Redes

### Removed
- Milvus completamente removido
- Dependência `@zilliz/milvus2-sdk-node`
- Todas as referências a "jarvis" (exceto em documentação histórica)

### Technical
- Dependência adicionada: `@qdrant/js-client-rest` ^1.15.1
- Dependências de teste: `vitest` ^4.0.9, `@vitest/ui` ^4.0.9
- Scripts npm: test, test:unit, test:integration, test:watch, test:ui, test:coverage
- Build size: 656KB
- TypeScript strict mode
- Zero placeholders ou mocks

## [3.0.0-rc] - 2025-10-17

- Reorganizado projeto para suceder a versão anterior (arquivada sob `~/deprecated`).
- Introduzido modo CLI interativo com memória contextual persistente e histórico de comandos compartilhado entre sessões.
- Integrado pesquisa híbrida através do Context7 remoto com fallback web para contextualizar execuções problemáticas.
- Atualizados prompts e utilidades (`cli-mode`, `memory`, `research`) para suportar conversação contínua e automação `/exec`.
- Ajustado `.gitignore` para proteger arquivos sensíveis (`fazai.conf`, diretório `~/.fazai`) e evitar vazamento de chaves.

