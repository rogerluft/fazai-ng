# FazAI Services Documentation

Este documento explica como usar os serviços systemd do FazAI v3.1-beta.

## 📦 Serviços Disponíveis

### 1. **fazai.service** - CLI Agent (Terminal Interativo)
Executa o FazAI em modo CLI (`--cli`) como daemon systemd.

### 2. **fazai-web.service** - Web Interface (Next.js)
Executa a interface web Next.js em modo produção (porta 3000).

### 3. **qdrant.service** - Vector Database
Executa o Qdrant vector database (criado automaticamente pelo install.sh).

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
sudo cp etc/fazai/fazai-web.service /etc/systemd/system/

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

### **fazai-web.service** (Web Interface)

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
# Abrir no navegador
http://localhost:3000
```

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

Os serviços carregam variáveis de:
```bash
/home/USERNAME/.config/fazai/fazai.conf
```

**Exemplo de fazai.conf:**
```ini
# OpenRouter (recomendado)
OPENROUTER_API_KEY=sk-or-v1-xxxxx

# Ou APIs diretas
OPENAI_API_KEY=sk-xxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Modelos configuráveis
DEFAULT_MODEL=openai/gpt-4o-mini
COMPLEX_MODEL=anthropic/claude-3.5-sonnet
FAST_MODEL=anthropic/claude-3-haiku
LOCAL_MODEL=ollama/llama3.2
PREFER_LOCAL=false

# Qdrant
QDRANT_URL=http://localhost:6333
```

### Editar Configuração
```bash
nano ~/.config/fazai/fazai.conf

# Reiniciar serviços após mudanças
sudo systemctl restart fazai@$USER
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
systemctl status fazai-web@$USER | grep Memory
```

### Uptime
```bash
# Tempo desde último start
systemctl show fazai@$USER -p ActiveEnterTimestamp
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

- **FazAI README:** [README.md](../README.md)
- **Quick Start:** [QUICK-START.md](../QUICK-START.md)
- **OpenRouter Models:** [OPENROUTER_MODELS.md](../OPENROUTER_MODELS.md)
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
# Parar e desabilitar
sudo systemctl stop fazai@$USER fazai-web@$USER
sudo systemctl disable fazai@$USER fazai-web@$USER

# Remover arquivos de serviço
sudo rm /etc/systemd/system/fazai.service
sudo rm /etc/systemd/system/fazai-web.service
sudo systemctl daemon-reload

# Remover instalação (CUIDADO!)
rm -rf ~/.fazai
rm ~/.local/bin/fazai
```

---

**Versão:** FazAI v3.1-beta  
**Atualizado:** 2024-11-15
