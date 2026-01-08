# FazAI Systemd Services

Servicos systemd para gerenciamento do FazAI como servico de sistema.

## Arquivos

| Arquivo | Descricao |
|---------|-----------|
| `fazai-worker.service` | Worker principal - processa requisicoes de IA |
| `fazai-skill-seeker.service` | Indexador de documentos (PDF, MD, TXT) |
| `fazai-worker.timer` | Timer para health check periodico |
| `fazai-health-check.service` | Servico oneshot de verificacao |
| `health-check.sh` | Script de health check |
| `install-services.sh` | Instalador automatizado |

## Instalacao Rapida

```bash
# Instalar todos os servicos
sudo ./install-services.sh

# Verificar status
sudo ./install-services.sh --status

# Ver logs em tempo real
sudo ./install-services.sh --logs
```

## Comandos Uteis

```bash
# Status dos servicos
systemctl status fazai-worker
systemctl status fazai-skill-seeker

# Logs
journalctl -u fazai-worker -f
journalctl -u fazai-skill-seeker -f

# Reiniciar
sudo systemctl restart fazai-worker

# Parar
sudo systemctl stop fazai-worker

# Desabilitar inicio automatico
sudo systemctl disable fazai-worker
```

## Configuracao

O arquivo `/etc/fazai/fazai.env` contem as variaveis de ambiente:

```bash
# Conexoes
QDRANT_URL=http://localhost:6333
OLLAMA_URL=http://localhost:11434

# API Keys (preencher conforme necessario)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
```

## Health Check

Execute manualmente:

```bash
# Saida colorida
./health-check.sh

# Saida JSON
./health-check.sh --json

# Modo silencioso (apenas codigo de saida)
./health-check.sh --quiet
```

## Desinstalacao

```bash
sudo ./install-services.sh --uninstall
```

## Requisitos

- systemd
- FazAI instalado em `/opt/fazai`
- Node.js 18+
- Qdrant rodando (recomendado)
- Ollama rodando (recomendado)
