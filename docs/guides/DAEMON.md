# FazAI Daemon

Gateway HTTP/WebSocket leve para integração do FazAI com sistemas externos.

**Versão:** v3.19+
**Atualizado:** 2026-03-18
**Fonte:** `src/commands/daemon.ts` (78 linhas)

---

## Visão Geral

O Daemon é um servidor HTTP/WS minimalista que expõe o FazAI para clientes externos como bots Telegram, a TUI OpenClaw Gateway, ou qualquer automação que precise enviar mensagens ao FazAI.

Diferente do Dashboard (API REST completa para gerenciamento de collections), o Daemon é um **ponto de entrada leve** focado em receber mensagens e futuramente roteá-las ao AgentOrchestrator.

### Daemon vs Dashboard

| Aspecto | Daemon | Dashboard |
|---------|--------|-----------|
| **Foco** | Receber mensagens de clientes | Gerenciar knowledge/agents |
| **Protocolo** | HTTP + WebSocket | HTTP REST |
| **Porta** | 18789 | 3000 |
| **Middleware** | Nenhum (express.json apenas) | CORS, rate limit, logger, error handler |
| **Endpoints** | 2 (`/health`, `/api/message`) | 20+ (collections, search, agent, skills, samba) |
| **Systemd** | `fazai-daemon.service` | N/A |
| **Bind** | `0.0.0.0` (todas interfaces) | `localhost` (padrão) |

---

## Quick Start

### Iniciar manualmente

```bash
# Iniciar o daemon (foreground)
fazai daemon

# Sinônimo
fazai serve
```

O daemon escuta em `0.0.0.0:18789` por padrão e permanece ativo até ser interrompido com `Ctrl+C` ou `SIGTERM`.

### Verificar se está rodando

```bash
curl http://localhost:18789/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "service": "fazai-daemon",
  "time": 1710720000000
}
```

---

## Endpoints HTTP

### GET /health

Health check simples.

```bash
curl http://localhost:18789/health
```

**Resposta:**
```json
{
  "status": "ok",
  "service": "fazai-daemon",
  "time": 1710720000000
}
```

### POST /api/message

Envia uma mensagem ao daemon para processamento.

```bash
curl -X POST http://localhost:18789/api/message \
  -H "Content-Type: application/json" \
  -d '{"text": "configure nginx", "from": "telegram-bot"}'
```

**Body:**
```json
{
  "text": "mensagem a processar",
  "from": "identificador do cliente"
}
```

**Resposta:**
```json
{
  "status": "queued"
}
```

> **Nota:** Atualmente o endpoint registra a mensagem no log e retorna `queued`. O roteamento para o AgentOrchestrator será implementado em versão futura.

---

## Protocolo WebSocket

O daemon implementa um servidor WebSocket compatível com o protocolo OpenClaw Gateway.

### Conectar

```javascript
const ws = new WebSocket('ws://localhost:18789');

ws.onopen = () => {
  console.log('Conectado ao Fazai Daemon');
};
```

### Mensagens Suportadas

#### Ping/Pong

```javascript
// Enviar
ws.send(JSON.stringify({ type: 'ping' }));

// Receber
// { "type": "pong", "time": 1710720000000 }
```

#### Message/Ack

```javascript
// Enviar
ws.send(JSON.stringify({
  type: 'message',
  id: 'msg-001',
  text: 'configure firewall for web server'
}));

// Receber
// { "type": "ack", "id": "msg-001" }
```

### Eventos WebSocket

| Evento | Direção | Descrição |
|--------|---------|-----------|
| `ping` | Cliente → Daemon | Verificar se daemon está vivo |
| `pong` | Daemon → Cliente | Resposta ao ping com timestamp |
| `message` | Cliente → Daemon | Enviar mensagem para processar |
| `ack` | Daemon → Cliente | Confirma recebimento da mensagem |

---

## Configuração

Variável em `/etc/fazai/fazai.conf`:

```bash
FAZAI_DAEMON_PORT=18789    # Porta HTTP/WS (padrão: 18789)
```

O daemon lê a porta via `getConfigValue('FAZAI_DAEMON_PORT')`. Se não definida, usa `18789`.

---

## Instalação como Serviço Systemd

### Instalar automaticamente

```bash
sudo fazai install-daemon
```

Esse comando (`src/commands/install-daemon.ts`):
1. Detecta o binário do fazai via `which fazai`
2. Cria `/etc/systemd/system/fazai-daemon.service`
3. Executa `systemctl daemon-reload`
4. Habilita o serviço para iniciar no boot
5. Inicia o serviço imediatamente

### Service file gerado

```ini
[Unit]
Description=Fazai AI Assistant Daemon
After=network.target

[Service]
Type=simple
User=<seu-usuario>
ExecStart=/usr/local/bin/fazai daemon
Restart=on-failure
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=fazai-daemon
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

> **Nota**: O `User` é detectado automaticamente via `$SUDO_USER` ou `$USER`.

---

## Gerenciamento via Systemctl

### Comandos básicos

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

### Logs

```bash
# Logs em tempo real
journalctl -u fazai-daemon -f

# Últimas 100 linhas
journalctl -u fazai-daemon -n 100

# Logs desde o último boot
journalctl -u fazai-daemon -b
```

---

## Casos de Uso

### 1. Bot Telegram

Um bot Telegram pode enviar mensagens de usuários para o daemon via HTTP:

```python
import requests

def send_to_fazai(text, user_id):
    requests.post('http://localhost:18789/api/message', json={
        'text': text,
        'from': f'telegram:{user_id}'
    })
```

### 2. OpenClaw Gateway

A TUI OpenClaw conecta via WebSocket para comunicação bidirecional:

```javascript
const ws = new WebSocket('ws://fazai-host:18789');
ws.send(JSON.stringify({ type: 'message', id: '1', text: 'status' }));
```

### 3. Automação com cron

```bash
# Enviar relatório diário
0 8 * * * curl -X POST http://localhost:18789/api/message \
  -H "Content-Type: application/json" \
  -d '{"text":"gerar relatório diário","from":"cron"}'
```

---

## Shutdown Graceful

O daemon trata `SIGTERM` e `SIGINT` para shutdown limpo:
- Fecha o servidor HTTP/WS
- Aguarda conexões pendentes
- Sai com código 0

```bash
# Parar manualmente
kill -SIGTERM $(pgrep -f "fazai daemon")

# Ou via systemd
sudo systemctl stop fazai-daemon
```

---

## Troubleshooting

### Porta em uso

```bash
# Verificar quem usa a porta
sudo lsof -ti:18789

# Usar porta alternativa
# Em /etc/fazai/fazai.conf:
FAZAI_DAEMON_PORT=18790
```

### Daemon não inicia via systemd

```bash
# Verificar logs
journalctl -u fazai-daemon -n 50 --no-pager

# Verificar binário
which fazai

# Reinstalar service
sudo fazai install-daemon
```

### WebSocket não conecta

- Verifique se o firewall permite a porta 18789
- O daemon faz bind em `0.0.0.0` (todas interfaces) por padrão
- Qdrant usa apenas IPv4 (`127.0.0.1`), IPv6 (`::1`) falha — o daemon é similar

---

## Documentação Relacionada

- [Arquitetura de Servidores](../architecture/SERVERS_ARCHITECTURE.md)
- [Dashboard API](DASHBOARD.md)
- [Serviços Systemd](SERVICES.md)
- [Web UI](WEB_UI.md)
