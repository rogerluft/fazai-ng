# FazAI Services Documentation

Este documento explica como usar os serviços systemd do FazAI v3.20+.

> **Documentação relacionada:**
> - [Arquitetura de Servidores](../architecture/SERVERS_ARCHITECTURE.md) — visão geral dos 3 servidores
> - [Daemon](DAEMON.md) — gateway HTTP/WS para integração externa
> - [Dashboard](DASHBOARD.md) — API REST para gerenciamento
> - [Web UI](WEB_UI.md) — interface visual Next.js

## 📦 Serviços Disponíveis

### 1. **fazai.service** - CLI Agent (Terminal Interativo)
Executa o FazAI em modo CLI (`--cli`) como daemon systemd.

### 2. **fazai-daemon.service** - Daemon HTTP/WS
Gateway HTTP/WebSocket para integração com clientes externos (Telegram, OpenClaw).
Porta padrão: 18789. Instalação via `sudo fazai install-daemon`.

### 3. **fazai-web@.service** - Web Interface (Next.js)
Executa a interface web Next.js em modo produção (porta 3300).
Template service — suporta múltiplos usuários (`fazai-web@user`).

### 4. **qdrant.service** - Vector Database
Executa o Qdrant vector database (criado automaticamente pelo install.sh).

> **Nota**: O Dashboard (`fazai dashboard start`) **não** possui service systemd.
> Roda via CLI diretamente. Veja [DASHBOARD.md](DASHBOARD.md).

---

## 🚀 Instalação

### Automática (via install.sh)
```bash
curl -fsSL https://raw.githubusercontent.com/rogerluft/fazai-ng/master/install.sh | bash
```

O instalador irá:
- ✅ Instalar e configurar Qdrant
- ✅ Criar serviço `qdrant.service` automaticamente
- ✅ Oferecer instalação da web interface (opcional)
- ✅ Criar serviço `fazai-web.service` se solicitado

### Manual
```bash
# Copiar arquivos de serviço
sudo cp etc/fazai/fazai.service /etc/systemd/system/
sudo cp etc/fazai/fazai-web@.service /etc/systemd/system/

# Instalar daemon (gera service automaticamente)
sudo fazai install-daemon

# Recarregar systemd
sudo systemctl daemon-reload
```

---

## 🎯 Uso dos Serviços

### **fazai.service** (CLI Agent)

#### Habilitar e Iniciar
```bash
# Habilitar para usuário específico
sudo systemctl enable fazai@username
sudo systemctl start fazai@username

# Exemplo para usuário "rluft"
sudo systemctl enable fazai@rluft
sudo systemctl start fazai@rluft
```

#### Status e Logs
```bash
# Ver status
sudo systemctl status fazai@rluft

# Ver logs em tempo real
sudo journalctl -u fazai@rluft -f

# Ver últimas 100 linhas
sudo journalctl -u fazai@rluft -n 100
```

#### Parar e Desabilitar
```bash
sudo systemctl stop fazai@rluft
sudo systemctl disable fazai@rluft
```

---

### **fazai-daemon.service** (HTTP/WS Gateway)

#### Instalar
```bash
# Instalação automática (gera service, habilita e inicia)
sudo fazai install-daemon
```

#### Gerenciar
```bash
# Status
systemctl status fazai-daemon

# Iniciar/Parar/Reiniciar
sudo systemctl start fazai-daemon
sudo systemctl stop fazai-daemon
sudo systemctl restart fazai-daemon

# Habilitar/Desabilitar no boot
sudo systemctl enable fazai-daemon
sudo systemctl disable fazai-daemon
```

#### Logs
```bash
journalctl -u fazai-daemon -f
journalctl -u fazai-daemon -n 100
```

#### Verificar
```bash
curl http://localhost:18789/health
```

> **Detalhes completos**: Veja [DAEMON.md](DAEMON.md)

---

### **fazai-web@.service** (Web Interface)

#### Habilitar e Iniciar
```bash
# Habilitar para usuário específico
sudo systemctl enable fazai-web@username
sudo systemctl start fazai-web@username

# Exemplo para usuário "rluft"
sudo systemctl enable fazai-web@rluft
sudo systemctl start fazai-web@rluft
```

#### Status e Logs
```bash
# Ver status
sudo systemctl status fazai-web@rluft

# Ver logs em tempo real
sudo journalctl -u fazai-web@rluft -f

# Ver últimas 50 linhas
sudo journalctl -u fazai-web@rluft -n 50
```

#### Acessar Interface
```bash
# Abrir no navegador (porta padrão 3300, configurável via WEB_PORT)
http://localhost:3300
```

> **Detalhes completos**: Veja [WEB_UI.md](WEB_UI.md)

#### Parar e Desabilitar
```bash
sudo systemctl stop fazai-web@rluft
sudo systemctl disable fazai-web@rluft
```

---

### **qdrant.service** (Vector Database)

#### Gerenciar Serviço
```bash
# Status
sudo systemctl status qdrant

# Iniciar/Parar
sudo systemctl start qdrant
sudo systemctl stop qdrant
sudo systemctl restart qdrant

# Logs
sudo journalctl -u qdrant -f
```

#### Verificar Qdrant
```bash
# Via curl
curl http://localhost:6333/collections

# Via fazai
fazai vector validate
```

---

## ⚙️ Configuração

### Variáveis de Ambiente

Os serviços carregam variáveis de `/etc/fazai/fazai.conf` (configuração centralizada).

**Variáveis relevantes para serviços:**
```ini
# Provider fallback chain
PROVIDER_FALLBACK_ORDER=google,ollama,openrouter,anthropic

# API Keys
ANTHROPIC_API_KEY=sk-ant-xxxxx
GEMINI_API_KEY=AIzaSy-xxxxx
OPENROUTER_API_KEY=sk-or-v1-xxxxx

# Modelos por provider
MODELS_OLLAMA=qwen2.5:7b
MODELS_GOOGLE=gemini-2.5-flash,gemini-2.5-pro
MODELS_ANTHROPIC=claude-sonnet-4-5

# Qdrant
QDRANT_URL=http://localhost:6333

# Daemon
FAZAI_DAEMON_PORT=18789

# Dashboard (não é systemd, mas relevante)
DASHBOARD_PORT=3000
DASHBOARD_HOST=localhost

# Web UI
WEB_HOST=0.0.0.0
WEB_PORT=3300
WEB_UI_USERNAME=admin
WEB_UI_PASSWORD=senha_segura
```

### Editar Configuração
```bash
sudo nano /etc/fazai/fazai.conf

# Reiniciar serviços após mudanças
sudo systemctl restart fazai@$USER
sudo systemctl restart fazai-daemon
sudo systemctl restart fazai-web@$USER
```

---

## 🔐 Segurança

### Hardening Aplicado

Ambos serviços incluem:
- ✅ `NoNewPrivileges=true` - Impede escalada de privilégios
- ✅ `PrivateTmp=true` - /tmp isolado por serviço
- ✅ `ProtectSystem=strict` - Sistema de arquivos protegido
- ✅ `ProtectHome=read-only` - Home read-only (exceto paths específicos)
- ✅ `ReadWritePaths` definidos explicitamente

### Permissões

Os serviços rodam como usuário específico (não root):
```systemd
User=%i  # %i = username do systemctl enable fazai@username
```

### Diretórios com Escrita
```bash
# fazai.service pode escrever em:
/home/USERNAME/.fazai
/home/USERNAME/.config/fazai
/var/log/fazai

# fazai-web.service pode escrever em:
/home/USERNAME/.fazai/web/.next
```

---

## 🐛 Troubleshooting

### Serviço Não Inicia

**1. Verificar logs:**
```bash
sudo journalctl -u fazai@$USER -n 100 --no-pager
sudo journalctl -u fazai-web@$USER -n 100 --no-pager
```

**2. Verificar arquivo de config:**
```bash
cat ~/.config/fazai/fazai.conf
# Verificar se API keys estão configuradas
```

**3. Verificar binário:**
```bash
# CLI
ls -la ~/.local/bin/fazai
~/.local/bin/fazai --help

# Web
cd ~/.fazai/web
ls -la .next/
npm run build  # Rebuildar se necessário
```

**4. Verificar dependências:**
```bash
# Qdrant rodando?
curl http://localhost:6333/collections

# Node.js instalado?
node --version  # Deve ser >= 18
```

### Permissões

Se houver erro de permissão:
```bash
# Ajustar ownership
sudo chown -R $USER:$USER ~/.fazai
sudo chown -R $USER:$USER ~/.config/fazai

# Ajustar permissões
chmod +x ~/.local/bin/fazai
chmod 600 ~/.config/fazai/fazai.conf  # Proteger API keys
```

### Porta em Uso

Se porta 3000 já estiver em uso:
```bash
# Editar porta no serviço
sudo systemctl edit fazai-web@$USER

# Adicionar:
[Service]
Environment=PORT=3001

# Reiniciar
sudo systemctl restart fazai-web@$USER
```

### Logs Cheios

Limpar logs antigos:
```bash
# Limpar logs de um serviço específico
sudo journalctl --vacuum-time=7d -u fazai@$USER
sudo journalctl --vacuum-time=7d -u fazai-web@$USER

# Limpar todos logs antigos do sistema
sudo journalctl --vacuum-time=30d
```

---

## 📊 Monitoramento

### Status Geral
```bash
# Todos serviços FazAI
systemctl list-units 'fazai*' --all

# Apenas ativos
systemctl list-units 'fazai*'
```

### Recursos (CPU/Memory)
```bash
# Uso de recursos por serviço
systemd-cgtop
# Pressione 'q' para sair

# Uso específico
systemctl status fazai@$USER | grep Memory
systemctl status fazai-daemon | grep Memory
systemctl status fazai-web@$USER | grep Memory
```

### Uptime
```bash
# Tempo desde último start
systemctl show fazai@$USER -p ActiveEnterTimestamp
systemctl show fazai-daemon -p ActiveEnterTimestamp
systemctl show fazai-web@$USER -p ActiveEnterTimestamp
```

---

## 🔄 Atualizações

### Atualizar FazAI

```bash
cd ~/.fazai
git pull origin master
npm install
npm run build

# Se interface web instalada
cd web
npm install
npm run build

# Reiniciar serviços
sudo systemctl restart fazai@$USER
sudo systemctl restart fazai-web@$USER
```

### Atualizar Serviços systemd

```bash
# Copiar novos arquivos
cd ~/.fazai
sudo cp etc/fazai/fazai.service /etc/systemd/system/
sudo cp etc/fazai/fazai-web.service /etc/systemd/system/

# Recarregar
sudo systemctl daemon-reload

# Reiniciar
sudo systemctl restart fazai@$USER
sudo systemctl restart fazai-web@$USER
```

---

## 📚 Referências

- **Arquitetura de Servidores:** [SERVERS_ARCHITECTURE.md](../architecture/SERVERS_ARCHITECTURE.md)
- **Daemon:** [DAEMON.md](DAEMON.md)
- **Dashboard:** [DASHBOARD.md](DASHBOARD.md)
- **Web UI:** [WEB_UI.md](WEB_UI.md)
- **FazAI README:** [README.md](../README.md)
- **Quick Start:** [QUICK-START.md](QUICK-START.md)
- **OpenRouter Models:** [OPENROUTER_MODELS.md](OPENROUTER_MODELS.md)
- **systemd Docs:** https://www.freedesktop.org/software/systemd/man/

---

## ❓ FAQ

### Por que usar serviços systemd?

- ✅ Auto-restart em caso de falha
- ✅ Inicia automaticamente no boot
- ✅ Logs centralizados (journald)
- ✅ Gerenciamento via systemctl
- ✅ Isolamento e segurança

### Preciso rodar como serviço?

**Não!** Você pode usar diretamente:
```bash
fazai --cli              # CLI interativo
cd ~/.fazai/web && npm run dev  # Web interface (dev mode)
```

Os serviços são opcionais para quem quer rodar 24/7.

### Posso rodar vários usuários?

Sim! Cada usuário tem sua própria instância:
```bash
sudo systemctl enable fazai@user1
sudo systemctl enable fazai@user2
sudo systemctl enable fazai-web@user1
sudo systemctl enable fazai-web@user2
```

### Como desinstalar?

```bash
# Parar e desabilitar todos os serviços
sudo systemctl stop fazai@$USER fazai-daemon fazai-web@$USER
sudo systemctl disable fazai@$USER fazai-daemon fazai-web@$USER

# Remover arquivos de serviço
sudo rm /etc/systemd/system/fazai.service
sudo rm /etc/systemd/system/fazai-daemon.service
sudo rm /etc/systemd/system/fazai-web@.service
sudo systemctl daemon-reload

# Remover instalação (CUIDADO!)
rm -rf ~/.fazai
rm ~/.local/bin/fazai
```

---

**Versão:** FazAI v3.20+
**Atualizado:** 2026-03-18
