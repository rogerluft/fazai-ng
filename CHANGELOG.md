# FazAI Changelog

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

