# 🖥️ FazAI v3.6.22-beta - Terminal Admin Linux com IA Autônoma

<div align="center">

**Administrador de Sistemas Linux Senior + Redes**
*AutoGPT · Genkit · RAG · Vector Store Qdrant*

</div>

<h3 align="center">Terminal inteligente que converte linguagem natural em comandos Linux seguros, com memória operacional, aprendizado contínuo e pesquisa assistida.</h3>

---

## 🆕 Mudanças Recentes (v3.6.20-22)

| Recurso                    | Status      | Versão  | Descrição                                          |
|----------------------------|-------------|---------|-----------------------------------------------------|
| **Web Interface Next.js**  | ✅ Aplicado | v3.6.21 | Interface web migrada para Next.js 15 App Router   |
| **Unified Build System**   | ✅ Aplicado | v3.6.21 | Build CLI + Web unificado, auth HTTP Basic         |
| **Config Unification**     | ✅ Aplicado | v3.6.22 | Variáveis web unificadas (WEB_HOST, WEB_PORT)      |
| **Cloudflare Integration** | ✅ Aplicado | v3.6.17 | 5 métodos novos, 8 interfaces, mocks removidos     |
| **SpamExperts Manager**    | ✅ Aplicado | v3.6.18 | Arquivo criado (169L), axios integrado, 11 métodos |
| **OPNsense Manager**       | ✅ Aplicado | v3.6.19 | Arquivo criado (241L), 15 métodos, IPsec VPN       |

**Destaques:**
- 🌐 **Interface Web Completa**: Next.js 15 com App Router, Server Components
- 🔐 **Autenticação HTTP Basic**: Credenciais em fazai.conf, middleware robusto
- 🏗️ **Build Unificado**: npm run build:all compila CLI + Web em sequência
- 🎯 **3 APIs Reais Integradas**: Cloudflare, SpamExperts, OPNsense
- 🗑️ **372 linhas de mocks removidas**: código real substituiu simulações

---

## 🌟 Features

### 🧠 Inteligência e Memória
- **6 Collections Qdrant Especializadas** para RAG e memória operacional
  - `fazai_personality` - Expertise técnica e estilo de troubleshooting
  - `fazai_memory` - Histórico operacional e contexto de infraestrutura
  - `fazai_learning` - Aprendizado técnico (erros, soluções, padrões)
  - `fazai_kb` - Base de conhecimento Linux/Redes validada
  - `fazai_inference` - Políticas de segurança, SLAs e regras operacionais
  - `fazai_semantic_cache` - **NOVO**: Cache semântico com similarity search

### 🤖 IA Multi-Modelo com Fallback Automático
- **Claude** (Anthropic): Sonnet 3.5, Haiku - Tarefas complexas e rápidas
- **GPT** (OpenAI): GPT-4o, GPT-4 Turbo, GPT-4 Mini
- **Ollama** (Local): Llama 3.2, Qwen 2.5, Mistral - 100% privado e gratuito
- **OpenRouter**: Acesso a 100+ modelos open-source (muitos free)
- **Perplexity**: Modelos com pesquisa web integrada

### 📊 Dashboard API Status com Credenciais Reais (NEW v3.6.14)
- **Verificação Autenticada**: Status real das APIs usando credenciais dos Managers
- **6 Providers Suportados**: Cloudflare, OpenAI, Anthropic, Google, Ollama, Perplexity
- **5 Estados Possíveis**: online, degraded, offline, not_configured, unauthorized
- **Thresholds Inteligentes**: <1s=online, 1-3s=degraded, >3s=offline
- **Timeout Protection**: 5s timeout com graceful degradation
- **Exemplo**:
  ```bash
  $ fazai /dashboard
  ✅ Cloudflare: online (234ms)
  ✅ OpenAI: online (891ms)
  ⚠️  Google: degraded (2.1s)
  ❌ Anthropic: unauthorized (invalid key)
  ⚙️  Perplexity: not_configured
  ```

### 🛡️ Security Hardening (NEW v3.6.15)
- **CORS Protection**: Whitelist-based origins (DNS rebinding prevention)
- **Config Validation**: Input sanitization (command injection prevention)
- **Zero TypeScript `any`**: Full type safety enforcement
- **Hostname Validation**: Regex-based `/^[a-zA-Z0-9.-]+$/`
- **Port Range Check**: 1024-65535 validation (non-root safe)

### 🌐 Interface Web - Monitoramento e Integrações (NEW v3.6.21-22)
- **Framework**: Next.js 15 com App Router e React Server Components
- **Autenticação**: HTTP Basic Auth via middleware (credenciais em fazai.conf)
- **Páginas Disponíveis**:
  - `/integrations/cloudflare` - Gerenciamento Cloudflare (DNS, Firewall, SSL, Cache)
  - `/integrations/spamexperts` - SpamExperts (Quarentena, Domínios, Relatórios)
  - `/integrations/opnsense` - OPNsense (Firewall, NAT, VPN, DHCP, Status)
- **Configuração**:
  - `WEB_HOST=0.0.0.0` - Interface de escuta (todas as interfaces)
  - `WEB_PORT=3000` - Porta do servidor web
  - `WEB_UI_USERNAME=admin` - Usuário para autenticação
  - `WEB_UI_PASSWORD=senha_segura` - Senha para autenticação
- **Acesso**: http://localhost:3000 (configurável em `/etc/fazai/fazai.conf`)
- **Build**: npm run build:all (CLI + Web) ou npm run build:web (somente Web)
- **Deploy**: Systemd service disponível em `etc/fazai/fazai-web@.service`

### 🔄 Provider Fallback Chain (v3.6.12)
- **Resiliência Automática**: Se um provider falha, tenta próximo automaticamente
- **Cadeia Inteligente**: ollama → openrouter → anthropic → openai → google
- **Equivalência de Modelos**: Mapeia modelo equivalente ao fazer fallback
- **Logs Transparentes**: INFO level mostra cada tentativa e motivo do fallback
- **Zero Downtime**: Mesmo com Ollama offline, comandos continuam funcionando
- **Exemplo**:
  ```bash
  $ fazai ask "what is 2+2?" -m qwen2.5:7b
  ⚠️  ollama failed: ECONNREFUSED
  🔄 Falling back to openrouter...
  📝 Using equivalent model: qwen/qwen3-coder:free
  ✅ Fallback successful
  4
  ```

### 🛡️ Segurança em 5 Camadas
- **Pattern Matching**: Bloqueia comandos destrutivos conhecidos
- **Avaliação de Risco**: Análise automática (CRITICAL, HIGH, MEDIUM, LOW)
- **Safety Checks**: Validações pré-execução geradas pela IA
- **Rollback Automático**: Comandos reversíveis com undo integrado
- **Modo Dry-Run**: Simule sem executar nada

### 🔍 Pesquisa Assistida
- **MCP Context7**: Integração com servidor de contexto local
- **SPA Support (NEW)**: Scraping de Single Page Applications via Playwright (DevDocs)
- **Fallback Web**: DuckDuckGo automático quando precisa de mais informação
- **Importação de Conversas**: Claude/ChatGPT Desktop → Vector Store

### 💬 Modo CLI Interativo
- **Chat persistente** com memória contextual entre sessões
- **Comandos especiais**: `/exec`, `/history`, `/memory`, `/cache`, `/help`
- **Cache Semântico**: Reutiliza respostas de queries similares (não apenas idênticas)
- **Histórico navegável**: Setas ↑/↓ e auto-complete
- **Bash completion**: Instalação automática em `/etc/bash_completion.d/` ao buildar

### ⚡ Cache Semântico Inteligente (NEW v3.5.1)
- **Similarity Search**: Encontra respostas de queries similares, não só idênticas
- **Hit Rate Tracking**: Monitora eficiência do cache (hits vs misses)
- **Automatic Eviction**: LRU + TTL para gerenciamento automático
- **Performance**: Cache HIT ~50ms vs Provider ~2-5s
- **CLI Commands**: `/cache` (stats), `/cache clear`
- **Zero Config**: Funciona automaticamente com Qdrant + embeddings existentes

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

# Build apenas CLI
npm run build

# Build CLI + Web Interface
npm run build:all

# Link para usar globalmente
npm link
fazai --help
```

#### Comandos de Build Disponíveis

- `npm run build` - Compila apenas o CLI (TypeScript → dist/app.cjs)
- `npm run build:all` - Compila CLI + Interface Web (sequencial)
- `npm run build:web` - Compila apenas Interface Web (Next.js)
- `npm run dev` - Modo desenvolvimento CLI (tsx watch)
- `npm run dev:web` - Modo desenvolvimento Web (Next.js dev server)
- `npm run start:web` - Inicia Web em modo produção

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

---

## 🌐 Interface Web FazAI (v3.6.21-22)

A Interface Web FazAI oferece acesso visual às integrações de infraestrutura através de um dashboard Next.js moderno e responsivo.

### Configuração da Interface Web

**Arquivo de Configuração** (`/etc/fazai/fazai.conf` ou `~/.config/fazai/fazai.conf`):

```bash
# ============================================
# WEB INTERFACE - Interface Web Next.js
# ============================================

# Interface de escuta (0.0.0.0 = todas as interfaces, localhost = apenas local)
WEB_HOST=0.0.0.0

# Porta do servidor web (padrão: 3000)
WEB_PORT=3000

# Credenciais de autenticação HTTP Basic
WEB_UI_USERNAME=admin
WEB_UI_PASSWORD=sua_senha_segura_aqui

# IMPORTANTE: Altere a senha padrão em produção!
# Gere senha forte: openssl rand -base64 32
```

### Instalação e Build

```bash
# Instalar dependências web
cd /opt/fazai/web
npm install

# Build da interface web
npm run build

# Iniciar em modo desenvolvimento
npm run dev

# Iniciar em modo produção
npm start
```

### Deploy com Systemd

O FazAI inclui um serviço systemd para rodar a interface web em produção:

```bash
# Copiar arquivo de serviço
sudo cp /opt/fazai/etc/fazai/fazai-web@.service /etc/systemd/system/

# Habilitar e iniciar serviço (substituir usuario pelo seu usuário)
sudo systemctl daemon-reload
sudo systemctl enable fazai-web@usuario
sudo systemctl start fazai-web@usuario

# Verificar status
sudo systemctl status fazai-web@usuario

# Ver logs
sudo journalctl -u fazai-web@usuario -f
```

### Autenticação

A interface web utiliza **HTTP Basic Authentication** para proteger o acesso:

- **Middleware**: `web/middleware.ts` valida credenciais em todas as rotas `/api/integrations/*`
- **Credenciais**: Carregadas dinamicamente de `/etc/fazai/fazai.conf`
- **Headers**: `Authorization: Basic <base64(username:password)>`
- **Frontend**: Helper `web/lib/api-client.ts` injeta automaticamente as credenciais

**Testando autenticação via curl:**

```bash
# Com credenciais (substituir admin:senha pelos valores do fazai.conf)
curl -u admin:senha http://localhost:3000/api/integrations/cloudflare/zones

# Sem credenciais (retorna 401 Unauthorized)
curl http://localhost:3000/api/integrations/cloudflare/zones
```

### Páginas Disponíveis

#### 1. Cloudflare Integration (`/integrations/cloudflare`)

Gerenciamento completo da infraestrutura Cloudflare:

- **Zonas DNS**: Listagem de domínios configurados
- **Registros DNS**: Criar, editar e deletar registros (A, AAAA, CNAME, MX, TXT)
- **Regras de Firewall**: Visualizar e gerenciar regras de segurança
- **Configurações SSL/TLS**: Modos (Off, Flexible, Full, Strict)
- **Cache**: Limpar cache (purge all ou por arquivos específicos)
- **Analytics**: Requisições, bandwidth, ameaças bloqueadas (últimas 24h)

**Requisitos de Configuração:**
```bash
CLOUDFLARE_API_KEY=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id  # Opcional
```

#### 2. SpamExperts Integration (`/integrations/spamexperts`)

Gerenciamento anti-spam e quarentena de emails:

- **Domínios Protegidos**: Adicionar/remover proteção de domínios
- **Quarentena**: Visualizar, liberar ou deletar emails bloqueados
- **Relatórios**: Estatísticas de spam (total, bloqueado, limpo, quarentena)
- **Whitelist/Blacklist**: Gerenciar listas de remetentes permitidos/bloqueados
- **Configurações**: Threshold de spam, retenção de quarentena

**Requisitos de Configuração:**
```bash
SPAMEXPERTS_API_URL=https://api.antispamcloud.com/
SPAMEXPERTS_API_KEY=your_api_key_here
# OU autenticação via username/password:
SPAMEXPERTS_USERNAME=your_username
SPAMEXPERTS_PASSWORD=your_password
```

#### 3. OPNsense Integration (`/integrations/opnsense`)

Gerenciamento de firewall e rede OPNsense:

- **Regras de Firewall**: Criar, editar e deletar regras (LAN, WAN, etc)
- **Port Forwarding (NAT)**: Configurar redirecionamentos de porta
- **VPN IPsec**: Listar túneis, conectar/desconectar
- **Interfaces de Rede**: Status, IPs, MACs, velocidade
- **DHCP Leases**: Leases ativos, IPs, MACs, hostnames
- **Status do Sistema**: Uptime, CPU, memória, temperatura, disco
- **Serviços**: Reiniciar serviços (nginx, unbound, dhcpd, etc)

**Requisitos de Configuração:**
```bash
OPNSENSE_API_URL=https://opnsense.local
OPNSENSE_API_KEY=your_api_key_here
OPNSENSE_API_SECRET=your_api_secret_here
OPNSENSE_SSL_VERIFY=false  # Desabilitar verificação SSL (dev/lab)
```

### Acesso Remoto

Para acessar a interface web de outros dispositivos na rede:

```bash
# 1. Configurar WEB_HOST para aceitar conexões externas
WEB_HOST=0.0.0.0

# 2. Liberar porta no firewall
sudo ufw allow 3000/tcp

# 3. Acessar via IP da máquina
http://192.168.1.100:3000
# ou via hostname
http://servidor.local:3000
```

### Segurança

**Recomendações de Segurança:**

1. **Altere as credenciais padrão** em produção
2. **Use HTTPS** com reverse proxy (nginx, Caddy, Traefik)
3. **Configure firewall** para limitar acesso à porta 3000
4. **Rotate senhas** periodicamente
5. **Use senha forte** (gere com: `openssl rand -base64 32`)

**Exemplo de Reverse Proxy com Nginx:**

```nginx
server {
    listen 443 ssl http2;
    server_name fazai.example.com;

    ssl_certificate /etc/letsencrypt/live/fazai.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fazai.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Troubleshooting

**Porta já em uso:**
```bash
# Verificar processos usando porta 3000
sudo lsof -i :3000
sudo netstat -tulpn | grep :3000

# Alterar porta em fazai.conf
WEB_PORT=8080
```

**Credenciais não funcionam:**
```bash
# Verificar configuração
grep -E "^WEB_UI_(USERNAME|PASSWORD)=" /etc/fazai/fazai.conf

# Testar credenciais via curl
curl -u admin:senha http://localhost:3000/api/integrations/cloudflare/zones
```

**Build falha:**
```bash
# Limpar cache e rebuildar
cd /opt/fazai/web
rm -rf .next node_modules
npm install
npm run build
```

---

## 🚀 Como Usar as Novas Integrações (v3.6.17-19)

### ☁️ Cloudflare Integration (v3.6.17)

**Configuração** (`/etc/fazai/fazai.conf`):
```bash
CLOUDFLARE_API_KEY=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id  # Opcional
```

**Comandos disponíveis:**
```bash
fazai cloudflare              # Menu principal Cloudflare
fazai cf                      # Alias para cloudflare
```

**Exemplos práticos:**

1. **Gerenciar Zonas DNS:**
```bash
# Listar todas as zonas
fazai cloudflare
# > Zonas DNS

# Visualizar registros DNS de uma zona
# > Registros DNS > Digite Zone ID
```

2. **Adicionar Registro DNS:**
```bash
# No menu Cloudflare:
# > Registros DNS > Adicionar Registro
# Tipo: A
# Nome: app
# Conteúdo: 192.168.1.100
# Proxied: Sim
```

3. **Gerenciar Firewall:**
```bash
# No menu Cloudflare:
# > Firewall
# Lista regras ativas com ações (allow/block/challenge)
```

4. **Configurar SSL/TLS:**
```bash
# No menu Cloudflare:
# > SSL/TLS
# Modos disponíveis: off, flexible, full, strict
# Mostra data de última modificação
```

5. **Limpar Cache:**
```bash
# No menu Cloudflare:
# > Cache > Limpar Todo Cache
# Confirmação obrigatória para segurança
```

6. **Visualizar Analytics:**
```bash
# No menu Cloudflare:
# > Analytics > Digite Zone ID
# Mostra: Requests, Bandwidth, Threats Blocked, Page Views (últimas 24h)
# Formatação automática de números e bytes
```

**Métodos da API disponíveis:**
- `listZones()` - Lista zonas DNS
- `listDNSRecords(zoneId)` - Lista registros de uma zona
- `createDNSRecord(zoneId, record)` - Adiciona registro DNS
- `deleteDNSRecord(zoneId, recordId)` - Remove registro
- `listFirewallRules(zoneId)` - Lista regras de firewall
- `getSSLSettings(zoneId)` - Obtém configurações SSL/TLS
- `updateSSLMode(zoneId, mode)` - Atualiza modo SSL
- `purgeCache(zoneId, options)` - Limpa cache
- `getAnalytics(zoneId)` - Obtém estatísticas

---

### 📧 SpamExperts Manager (v3.6.18)

**Configuração** (`/etc/fazai/fazai.conf`):
```bash
SPAMEXPERTS_API_URL=https://api.antispamcloud.com/
SPAMEXPERTS_API_KEY=your_api_key_here

# OU autenticação via username/password:
SPAMEXPERTS_USERNAME=your_username
SPAMEXPERTS_PASSWORD=your_password
```

**Comandos disponíveis:**
```bash
fazai spamexperts             # Menu principal SpamExperts
```

**Exemplos práticos:**

1. **Gerenciar Domínios Protegidos:**
```bash
# Listar domínios protegidos
fazai spamexperts
# > Domínios

# Adicionar domínio
# > Domínios > Adicionar
# Domain: example.com
# Destination: mail.example.com
```

2. **Visualizar Quarentena:**
```bash
# Ver emails em quarentena
# > Quarentena > Digite domínio
# Lista: messageId, subject, sender, date, score

# Liberar email bloqueado
# > Quarentena > Liberar > Digite messageId

# Deletar email permanentemente
# > Quarentena > Deletar > Digite messageId
```

3. **Relatórios de Spam:**
```bash
# Ver estatísticas
# > Relatórios > Digite domínio
# Mostra: total emails, spam blocked, clean delivered, quarantined
```

4. **Gerenciar Whitelist/Blacklist:**
```bash
# Adicionar à whitelist
# > Whitelist/Blacklist > Whitelist > Adicionar
# Email: friend@example.com

# Adicionar à blacklist
# > Whitelist/Blacklist > Blacklist > Adicionar
# Email: spam@badsite.com

# Remover da lista
# > Whitelist/Blacklist > Whitelist > Remover
```

5. **Configurações do Sistema:**
```bash
# Ver configurações atuais
# > Configurações
# Mostra: spam threshold, quarantine retention, etc.
```

**Métodos da API disponíveis:**
- `listDomains()` - Lista domínios protegidos
- `addDomain(domain, destination)` - Adiciona proteção a domínio
- `removeDomain(domain)` - Remove proteção
- `listQuarantine(domain)` - Lista emails em quarentena
- `releaseMessage(messageId)` - Libera email da quarentena
- `deleteMessage(messageId)` - Deleta email permanentemente
- `getReport(domain)` - Obtém relatório de estatísticas
- `listList(type)` - Lista whitelist/blacklist
- `addToList(type, entry)` - Adiciona à lista
- `removeFromList(type, entry)` - Remove da lista
- `getSettings()` / `updateSettings()` - Gerencia configurações

---

### 🔥 OPNsense Manager (v3.6.19)

**Configuração** (`/etc/fazai/fazai.conf`):
```bash
OPNSENSE_API_URL=https://opnsense.local
OPNSENSE_API_KEY=your_api_key_here
OPNSENSE_API_SECRET=your_api_secret_here
OPNSENSE_SSL_VERIFY=false  # Desabilitar verificação SSL (dev/lab)
```

**Comandos disponíveis:**
```bash
fazai opnsense                # Menu principal OPNsense
```

**Exemplos práticos:**

1. **Gerenciar Regras de Firewall:**
```bash
# Listar regras de firewall
fazai opnsense
# > Firewall

# Adicionar regra
# > Firewall > Adicionar Regra
# Interface: LAN
# Source: 192.168.1.0/24
# Destination: any
# Port: 443
# Action: pass (ou block/reject)
# Description: Allow HTTPS from LAN

# Deletar regra
# > Firewall > Deletar Regra > Digite UUID da regra

# Aplicar mudanças pendentes
# > Firewall > Aplicar Mudanças
```

2. **Configurar Port Forwarding (NAT):**
```bash
# Listar regras de NAT
# > NAT / Port Forwarding

# Adicionar redirecionamento
# > NAT > Adicionar Port Forward
# Interface: WAN
# Protocol: TCP
# External Port: 8080
# Internal IP: 192.168.1.10
# Internal Port: 80
# Description: Redirect HTTP to internal server

# Aplicar mudanças de NAT
# > NAT > Aplicar Mudanças
```

3. **Gerenciar VPN IPsec:**
```bash
# Listar túneis IPsec
# > VPN

# Conectar VPN
# > VPN > Conectar > Digite IKE ID do túnel

# Desconectar VPN
# > VPN > Desconectar > Digite IKE ID
```

4. **Visualizar Interfaces de Rede:**
```bash
# Listar interfaces
# > Interfaces
# Mostra: name, ipv4, ipv6, mac, status, speed
```

5. **DHCP Leases Ativos:**
```bash
# Ver leases DHCP
# > DHCP Leases
# Lista: IP, MAC, hostname, lease start/end
```

6. **Status do Sistema:**
```bash
# Verificar status
# > Status do Sistema
# Mostra: uptime, CPU, memory, temperature, disk usage
```

**Métodos da API disponíveis:**
- `listFirewallRules()` - Lista regras de firewall
- `addFirewallRule(rule)` - Adiciona regra
- `deleteFirewallRule(uuid)` - Remove regra
- `applyFirewallChanges()` - Aplica mudanças pendentes
- `listNATRules()` - Lista regras de port forwarding
- `addPortForward(rule)` - Adiciona redirecionamento
- `deletePortForward(uuid)` - Remove port forward
- `applyNATChanges()` - Aplica mudanças de NAT
- `listVPNTunnels()` - Lista túneis IPsec
- `connectVPN(ikeid)` / `disconnectVPN(ikeid)` - Controla VPN
- `listInterfaces()` - Lista interfaces de rede
- `listDHCPLeases()` - Lista leases DHCP ativos
- `getSystemStatus()` - Obtém status do sistema
- `restartService(service)` - Reinicia serviço

---

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

### Perplexity (Cloud)
```bash
# MODELS_PERPLEXITY=llama-3-sonar-small-32k-online,llama-3-sonar-large-32k-online
# PERPLEXITY_API_KEY=pplx-xxxxx
```
| Nickname    | Modelo                             | Velocidade | Custo | Quando Usar                   |
|-------------|------------------------------------|------------|-------|-------------------------------|
| `sonar`     | llama-3-sonar-small-32k-online     | Muito Rápido | Baixo | Tarefas rápidas com pesquisa   |
| `sonar-pro` | llama-3-sonar-large-32k-online     | Rápido     | Médio | Tarefas complexas com pesquisa|
| `sonar-reasoning` | llama-3-sonar-large-32k-reasoning | Rápido     | Médio | Tarefas com raciocínio        |
| `sonar-reasoning` | llama-3-sonar-large-32k-reasoning | Rápido     | Médio | Tarefas com raciocínio        |

**API Key**: https://www.perplexity.ai/settings/api
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

#### Perplexity
1. Acesse [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api)
2. Crie uma conta e gere uma API key
3. Cole no `fazai.conf`: `PERPLEXITY_API_KEY=pplx-xxxxx`

**Modelos:** Sonar (pesquisa), Sonar Pro (pesquisa avançada), Sonar Reasoning (raciocínio)

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
