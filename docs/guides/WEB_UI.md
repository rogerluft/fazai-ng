# FazAI Web UI

Interface web visual para administração do FazAI, construída com Next.js 15.

**Versão:** v3.20+
**Atualizado:** 2026-03-18
**Fonte:** `web/`

---

## Visão Geral

A Web UI é uma aplicação Next.js 15 com App Router que oferece interface gráfica para:
- Visualizar e gerenciar personality, memory, knowledge, learning e source code
- Dashboard visual com métricas do agente
- Administrar regras de inferência
- Gerenciar compartilhamentos Samba
- Integrações com serviços externos (Cloudflare, OPNsense, SpamExperts)

### Stack Tecnológico

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Next.js | 15.x | Framework (App Router, SSR) |
| React | 18.x | UI Library |
| TypeScript | 5.5+ | Type safety |
| Tailwind CSS | 3.4+ | Estilização |
| TanStack React Query | 5.50+ | Data fetching/cache |
| Zustand | 4.4+ | State management |
| Axios | 1.7+ | HTTP client |
| Recharts | 2.12+ | Gráficos |
| Lucide React | 0.373+ | Ícones |
| Radix UI | - | Componentes acessíveis |

---

## Instalação

### Pré-requisitos

- Node.js >= 18
- npm ou yarn
- Qdrant rodando em `localhost:6333` (para dados reais)

### Build

```bash
cd web/

# Instalar dependências
npm install

# Build de produção
NODE_ENV=production npm run build

# Iniciar em produção
npm start

# Ou modo desenvolvimento (com hot reload)
npm run dev
```

### Desenvolvimento vs Produção

| Aspecto | `npm run dev` | `npm start` |
|---------|---------------|-------------|
| Hot reload | Sim | Não |
| Otimização | Não | Sim (bundle, minify) |
| Source maps | Completo | Produção |
| Porta padrão | 3000 | 3000 (ou `WEB_PORT`) |
| Uso | Desenvolvimento local | Servidor de produção |

---

## Configuração

Variáveis em `/etc/fazai/fazai.conf`:

```bash
# Rede
WEB_HOST=0.0.0.0                 # Bind address (padrão: 0.0.0.0)
WEB_PORT=3300                    # Porta (padrão: 3000, recomendado: 3300)

# Autenticação
WEB_UI_USERNAME=admin            # Usuário de login
WEB_UI_PASSWORD=senha_segura     # Senha (mín. 6 caracteres)

# Backend API (Dashboard)
NEXT_PUBLIC_API_URL=http://localhost:3000  # URL do Dashboard API
```

> **Nota**: A Web UI consome o Dashboard como backend via `NEXT_PUBLIC_API_URL`. Certifique-se de que o Dashboard esteja rodando antes de usar funcionalidades que dependem dele.

---

## Systemd Service

### Arquivo: `etc/fazai/fazai-web@.service`

Template service para múltiplos usuários:

```ini
[Unit]
Description=FazAI Web Interface (Next.js)
Documentation=https://github.com/rogerluft/fazai-ng
After=network.target qdrant.service
Wants=qdrant.service

[Service]
Type=simple
User=%i
WorkingDirectory=/opt/fazai/web
Environment=NODE_ENV=production
Environment=PATH=/usr/bin:/usr/local/bin
EnvironmentFile=-/etc/fazai/fazai.conf
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=fazai-web
NoNewPrivileges=true
PrivateTmp=false

[Install]
WantedBy=multi-user.target
```

### Instalar

```bash
# Copiar service file
sudo cp etc/fazai/fazai-web@.service /etc/systemd/system/

# Recarregar systemd
sudo systemctl daemon-reload

# Habilitar para seu usuário
sudo systemctl enable fazai-web@$USER

# Iniciar
sudo systemctl start fazai-web@$USER
```

### Gerenciar

```bash
# Status
sudo systemctl status fazai-web@$USER

# Logs em tempo real
journalctl -u fazai-web@$USER -f

# Parar
sudo systemctl stop fazai-web@$USER

# Desabilitar
sudo systemctl disable fazai-web@$USER
```

### Múltiplos usuários

```bash
sudo systemctl enable fazai-web@user1
sudo systemctl enable fazai-web@user2
```

---

## Estrutura de Páginas

```
web/app/
├── (dashboard)/                    # Layout group com sidebar
│   ├── layout.tsx                  # Layout compartilhado
│   ├── page.tsx                    # Dashboard principal (home)
│   ├── personality/page.tsx        # Gerenciar personality traits
│   ├── memory/page.tsx             # Explorar memórias
│   ├── knowledge/page.tsx          # Knowledge base
│   ├── learning/page.tsx           # Aprendizados
│   ├── inference/page.tsx          # Regras de inferência
│   ├── source/page.tsx             # Source code indexado
│   ├── samba/page.tsx              # Samba shares
│   └── integrations/
│       ├── cloudflare/page.tsx     # Cloudflare zones/DNS
│       ├── opnsense/page.tsx       # OPNsense firewall
│       └── spamexperts/page.tsx    # SpamExperts anti-spam
├── error.tsx                       # Error boundary
├── global-error.tsx                # Global error boundary
├── not-found.tsx                   # 404 page
└── layout.tsx                      # Root layout
```

### Páginas disponíveis

| Página | Path | Descrição |
|--------|------|-----------|
| Dashboard | `/` | Métricas do agente, status, ações recentes |
| Personality | `/personality` | Gerenciar traços de personalidade |
| Memory | `/memory` | Buscar e explorar memórias por role |
| Knowledge | `/knowledge` | CRUD da knowledge base |
| Learning | `/learning` | Visualizar aprendizados, estatísticas |
| Inference | `/inference` | Regras de inferência (CRUD + teste) |
| Source | `/source` | Source code indexado |
| Samba | `/samba` | Gerenciar shares, usuários, grupos |
| Cloudflare | `/integrations/cloudflare` | Zones, DNS, SSL, firewall, cache |
| OPNsense | `/integrations/opnsense` | Firewall, NAT, VPN, DHCP, interfaces |
| SpamExperts | `/integrations/spamexperts` | Domínios, quarentena, listas, relatórios |

---

## API Routes (Next.js)

A Web UI possui suas próprias API routes que fazem proxy ou acesso direto a serviços:

### Core FazAI

| Route | Método | Descrição | Status |
|-------|--------|-----------|--------|
| `/api/health` | GET | Health check | Funcional |
| `/api/personality` | GET | Listar personality | Funcional |
| `/api/personality/traits` | POST/PUT | Criar/atualizar trait | Funcional |
| `/api/personality/traits/[name]` | DELETE | Remover trait | Funcional |
| `/api/memory/search` | POST | Buscar memórias | Mock |
| `/api/memory/by-role/[role]` | GET | Memórias por role | Mock |
| `/api/knowledge` | GET | Listar knowledge | Mock |
| `/api/knowledge/[slug]` | GET/DELETE | Knowledge por slug | Mock |
| `/api/learning` | GET | Listar learning | Mock |
| `/api/learning/stats` | GET | Estatísticas | Mock |
| `/api/rules` | GET/POST | Listar/criar regras | Mock |
| `/api/rules/[ruleId]` | PUT/DELETE | Atualizar/deletar regra | Mock |
| `/api/source` | GET | Source code | Funcional |
| `/api/agent/status` | GET | Status do agente | Mock |
| `/api/agent/pause` | POST | Pausar agente | Funcional |
| `/api/agent/resume` | POST | Resumir agente | Funcional |
| `/api/agent/stop` | POST | Parar agente | Funcional |
| `/api/agent/actions` | GET | Ações recentes | Mock |

### Samba

| Route | Método | Descrição | Status |
|-------|--------|-----------|--------|
| `/api/samba/shares` | GET/POST | Listar/criar shares | Funcional |
| `/api/samba/shares/[name]` | DELETE | Remover share | Funcional |
| `/api/samba/status` | GET | Status smb/nmb | Funcional |
| `/api/samba/restart` | POST | Reiniciar serviços | Funcional |
| `/api/samba/users` | POST | Criar usuário (info) | Funcional |
| `/api/samba/groups` | POST | Criar grupo (info) | Funcional |

### Cloudflare

| Route | Método | Descrição |
|-------|--------|-----------|
| `/api/integrations/cloudflare/zones` | GET | Listar zones |
| `/api/integrations/cloudflare/zones/[zoneId]/dns` | GET/POST | Gerenciar DNS records |
| `/api/integrations/cloudflare/zones/[zoneId]/dns/[recordId]` | PUT/DELETE | CRUD DNS record |
| `/api/integrations/cloudflare/zones/[zoneId]/firewall` | GET/POST | Regras de firewall |
| `/api/integrations/cloudflare/zones/[zoneId]/ssl` | GET/PUT | Configuração SSL |
| `/api/integrations/cloudflare/zones/[zoneId]/analytics` | GET | Analytics da zone |
| `/api/integrations/cloudflare/zones/[zoneId]/cache/purge` | POST | Purge de cache |

### OPNsense

| Route | Método | Descrição |
|-------|--------|-----------|
| `/api/integrations/opnsense/system/status` | GET | Status do sistema |
| `/api/integrations/opnsense/interfaces` | GET | Listar interfaces |
| `/api/integrations/opnsense/firewall` | GET/POST | Regras de firewall |
| `/api/integrations/opnsense/firewall/[uuid]` | PUT/DELETE | CRUD regra |
| `/api/integrations/opnsense/firewall/apply` | POST | Aplicar regras |
| `/api/integrations/opnsense/nat` | GET/POST | Regras NAT |
| `/api/integrations/opnsense/nat/[uuid]` | PUT/DELETE | CRUD NAT |
| `/api/integrations/opnsense/nat/apply` | POST | Aplicar NAT |
| `/api/integrations/opnsense/vpn` | GET | Listar VPNs |
| `/api/integrations/opnsense/vpn/[ikeid]/connect` | POST | Conectar VPN |
| `/api/integrations/opnsense/vpn/[ikeid]/disconnect` | POST | Desconectar VPN |
| `/api/integrations/opnsense/dhcp/leases` | GET | Leases DHCP |

### SpamExperts

| Route | Método | Descrição |
|-------|--------|-----------|
| `/api/integrations/spamexperts/domains` | GET | Listar domínios |
| `/api/integrations/spamexperts/domains/[domain]` | GET | Detalhes domínio |
| `/api/integrations/spamexperts/quarantine/[domain]` | GET | Quarentena por domínio |
| `/api/integrations/spamexperts/quarantine/[messageId]` | GET/DELETE | Gerenciar mensagem |
| `/api/integrations/spamexperts/quarantine/[messageId]/release` | POST | Liberar mensagem |
| `/api/integrations/spamexperts/lists/[type]` | GET/POST | Listas (whitelist/blacklist) |
| `/api/integrations/spamexperts/lists/[type]/[entry]` | DELETE | Remover de lista |
| `/api/integrations/spamexperts/reports/[domain]` | GET | Relatórios |

---

## Status de Implementação

### Funcional (dados reais)
- Personality (CRUD via Dashboard backend)
- Source code (via Dashboard backend)
- Samba shares (via `fzsamba` script)
- Agent pause/resume/stop
- Health check

### Mock (retorna dados vazios/estáticos)
- Agent status (`getAgentStatus()` retorna valores hardcoded)
- Memory search/by-role
- Knowledge CRUD
- Learning/stats
- Rules CRUD
- Recent actions

> **Contexto**: Muitas funcionalidades do `web/lib/api.ts` retornam `Promise.resolve([])` ou dados mock. Isso indica que a Web UI foi projetada antes das APIs do Dashboard estarem completas. À medida que o Dashboard evolui, esses mocks devem ser substituídos por chamadas reais.

### Integrações externas
- **Cloudflare**: Funcional (requer `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_EMAIL`, `CLOUDFLARE_ACCOUNT_ID`)
- **OPNsense**: Funcional (requer `OPNSENSE_API_URL`, `OPNSENSE_API_KEY`, `OPNSENSE_API_SECRET`)
- **SpamExperts**: Funcional (requer `SPAMEXPERTS_API_URL`, `SPAMEXPERTS_USERNAME`, `SPAMEXPERTS_PASSWORD`)

---

## Relação com Dashboard Backend

A Web UI usa o Dashboard como backend principal:

```typescript
// web/lib/api.ts
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
  timeout: 10000,
});
```

**Fluxo:**
```
Browser → Web UI (:3300) → Dashboard API (:3000) → Qdrant/Ollama/GenAIScript
```

Para funcionalidades que não passam pelo Dashboard (integrações), a Web UI tem suas próprias API routes que acessam os serviços diretamente:

```
Browser → Web UI (:3300) → API Route Next.js → Cloudflare/OPNsense/SpamExperts API
```

---

## Troubleshooting

### Build falha

```bash
cd web/
npm run type-check    # Verificar erros de tipo
npm run lint          # Verificar lint
npm run build         # Tentar build novamente
```

### Porta em uso

```bash
# Alterar porta em /etc/fazai/fazai.conf
WEB_PORT=3301

# Ou via systemd override
sudo systemctl edit fazai-web@$USER
# [Service]
# Environment=PORT=3301
```

### Dados não aparecem

1. Verificar se Dashboard está rodando: `curl http://localhost:3000/health`
2. Verificar se Qdrant está rodando: `curl http://127.0.0.1:6333/collections`
3. Verificar `NEXT_PUBLIC_API_URL` no ambiente
4. Muitas APIs retornam dados mock — ver seção "Status de Implementação"

### Service não inicia

```bash
journalctl -u fazai-web@$USER -n 50 --no-pager

# Verificar se build existe
ls -la /opt/fazai/web/.next/

# Rebuild se necessário
cd /opt/fazai/web && npm run build
```

---

## Documentação Relacionada

- [Arquitetura de Servidores](../architecture/SERVERS_ARCHITECTURE.md)
- [Dashboard API](DASHBOARD.md)
- [Daemon](DAEMON.md)
- [Serviços Systemd](SERVICES.md)
