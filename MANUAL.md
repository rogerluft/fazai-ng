# 📖 Manual Completo - Terminal FazAI v3.1-beta

**Administrador de Sistemas Linux Senior + Redes**
AutoGPT · Genkit · RAG · Vector Store Qdrant

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Instalação](#instalação)
3. [Configuração](#configuração)
4. [Modos de Operação](#modos-de-operação)
5. [Casos de Uso Reais](#casos-de-uso-reais)
6. [Importação de Conversas](#importação-de-conversas)
7. [Vector Store e RAG](#vector-store-e-rag)
8. [Troubleshooting](#troubleshooting)
9. [Boas Práticas](#boas-práticas)
10. [API e Integrações](#api-e-integrações)

---

## 🎯 Visão Geral

Terminal FazAI é uma ferramenta de administração Linux alimentada por IA que converte linguagem natural em comandos seguros e conscientes do contexto. Especializado em infraestrutura, redes e troubleshooting.

### Características Principais

- ✅ **5 Collections Qdrant** para RAG e memória operacional
- ✅ **Multi-modelo IA** (Claude, GPT, Ollama)
- ✅ **Sistema de segurança com 5 camadas**
- ✅ **Importação de conversas** (Claude/ChatGPT Desktop)
- ✅ **Pesquisa MCP Context7** com fallback web
- ✅ **Modo dry-run** para simulação
- ✅ **Auto-rollback** de comandos destrutivos

### Collections Especializadas

1. **fazai_personality** - Expertise técnica, estilo de troubleshooting
2. **fazai_memory** - Histórico operacional e contexto de infraestrutura
3. **fazai_learning** - Aprendizado técnico (erros/soluções/padrões)
4. **fazai_kb** - Base de conhecimento Linux/Redes (RAG)
5. **fazai_inference** - Políticas de segurança, SLAs, regras operacionais

---

## 🚀 Instalação

### Método 1: Instalador Automático (Recomendado)

```bash
curl -fsSL https://raw.githubusercontent.com/rogerluft/fazai-ng/master/install.sh | bash
```

O instalador irá:
1. Verificar dependências (Node.js 18+, npm, git)
2. Clonar o repositório
3. Compilar o projeto
4. Criar symlinks em `~/.local/bin/fazai`
5. Configurar PATH
6. Oferecer instalação do Qdrant (Docker/Podman/Binário)
7. Criar arquivo de configuração
8. Criar diretórios de sistema (/etc/fazai, /var/log/fazai)

### Método 2: Manual

```bash
# Clonar repositório
git clone https://github.com/rogerluft/fazai-ng
cd fazai-ng

# Instalar dependências
npm install

# Build
npm run build

# Symlink
mkdir -p ~/.local/bin
ln -s $(pwd)/bin/fazai.js ~/.local/bin/fazai
chmod +x ~/.local/bin/fazai

# Adicionar ao PATH
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Configurar
mkdir -p ~/.config/fazai
cp fazai.conf.example ~/.config/fazai/fazai.conf
nano ~/.config/fazai/fazai.conf
```

### Instalação do Qdrant

O installer oferece 3 opções:

#### Opção 1: Docker (Recomendado)

```bash
docker run -d \
  --name fazai-qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v $HOME/.fazai/qdrant_storage:/qdrant/storage:z \
  qdrant/qdrant:latest
```

#### Opção 2: Podman

```bash
podman run -d \
  --name fazai-qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v $HOME/.fazai/qdrant_storage:/qdrant/storage:z \
  qdrant/qdrant:latest
```

#### Opção 3: Binário Nativo

```bash
# Baixar
wget https://github.com/qdrant/qdrant/releases/download/v1.7.4/qdrant-x86_64-unknown-linux-musl.tar.gz
tar -xzf qdrant-x86_64-unknown-linux-musl.tar.gz
sudo mv qdrant /usr/local/bin/

# Criar serviço systemd
sudo tee /etc/systemd/system/qdrant.service > /dev/null <<EOF
[Unit]
Description=Qdrant Vector Database
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$HOME/.fazai/qdrant
ExecStart=/usr/local/bin/qdrant
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now qdrant
```

---

## ⚙️ Configuração

### Arquivos de Configuração

O FazAI busca configuração em múltiplos caminhos (em ordem de prioridade):

1. `$FAZAI_CONFIG_PATH` (variável de ambiente)
2. **`/etc/fazai/fazai.conf`** (configuração do sistema - **PRIORIDADE**)
3. `./fazai.conf` (diretório atual)
4. `<diretório-do-script>/fazai.conf`
5. `~/.config/fazai/fazai.conf` (recomendado para usuário)
6. `~/fazai.conf` (fallback)

### Estrutura do fazai.conf

```ini
# ============================================
# AI Providers (configure pelo menos um)
# ============================================

# Anthropic Claude (recomendado para admin Linux/redes)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# OpenAI GPT
OPENAI_API_KEY=sk-xxxxx

# Ollama (local/gratuito)
OLLAMA_BASE_URL=http://localhost:11434

# ============================================
# Vector Store (Qdrant)
# ============================================
VECTOR_PROVIDER=qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
VECTOR_DIMENSION=1536
VECTOR_DISTANCE=Cosine

# ============================================
# MCP Context7 Research
# ============================================
MCP_CONTEXT7_URL=http://localhost:7700/context7/search
MCP_CONTEXT7_COMMAND=context7 --json --query "{query}"
MCP_CONTEXT7_API_KEY=
WEB_SEARCH_PROVIDER=duckduckgo
FAZAI_DISABLE_RESEARCH=false
FAZAI_RESEARCH_ON_FAILURE=true

# ============================================
# Logging
# ============================================
LOG_LEVEL=info  # error, warn, info, debug
LOG_FILE_PATH=/var/log/fazai/fazai.log
```

### Obter API Keys

**Anthropic Claude:**
1. Acesse https://console.anthropic.com/
2. Crie uma conta
3. Vá em API Keys
4. Copie a chave para `ANTHROPIC_API_KEY`

**OpenAI GPT:**
1. Acesse https://platform.openai.com/api-keys
2. Faça login
3. Crie uma nova key
4. Copie para `OPENAI_API_KEY`

**Ollama (Local):**
```bash
# Instalar Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Baixar modelos
ollama pull llama3.2
ollama pull qwen2.5:7b
ollama pull mistral

# Configurar
OLLAMA_BASE_URL=http://localhost:11434
```

### Validar Configuração

```bash
# Mostrar chaves configuradas
fazai config

# Validar collections Qdrant
fazai vector validate

# Testar conexão
curl http://localhost:6333/collections
```

---

## 🎮 Modos de Operação

### 1. Modo Admin Linux (Padrão)

Converte linguagem natural para comandos Linux seguros.

```bash
# Usar modelo padrão (gpt4mini)
fazai

# Usar modelo específico
fazai sonnet35    # Claude 3.5 Sonnet (mais inteligente)
fazai haiku       # Claude Haiku (rápido/barato)
fazai llama32     # Ollama Llama 3.2 (local)
```

**Fluxo:**
1. Digite sua tarefa em linguagem natural
2. IA coleta contexto do sistema
3. Gera comandos com avaliação de risco
4. Você confirma (ou não) a execução
5. Comandos são executados
6. Rollback disponível se aplicável

**Exemplo:**

```
$ fazai
> listar todos os serviços ativos no systemd e filtrar os que falharam

🔍 Coletando informações do sistema...
✅ Sistema: Ubuntu 22.04 LTS
✅ Kernel: 5.15.0-97-generic
✅ Gerenciador de pacotes: apt
✅ Init: systemd

📋 Comandos gerados:

┌──────────────────────────────────────────────────────────────┐
│ Comando 1/2                                        Risco: LOW │
├──────────────────────────────────────────────────────────────┤
│ systemctl list-units --type=service --state=active          │
│                                                              │
│ Explicação:                                                  │
│ Lista todos os serviços ativos gerenciados pelo systemd      │
│                                                              │
│ Rollback: N/A (comando read-only)                           │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Comando 2/2                                        Risco: LOW │
├──────────────────────────────────────────────────────────────┤
│ systemctl list-units --type=service --state=failed          │
│                                                              │
│ Explicação:                                                  │
│ Filtra apenas os serviços que falharam                       │
│                                                              │
│ Rollback: N/A (comando read-only)                           │
└──────────────────────────────────────────────────────────────┘

Executar comandos? [S/n]:
```

### 2. Modo Dry-Run (Simulação)

Simula comandos sem executar. Ideal para testar ou learning.

```bash
fazai --dry-run
```

**Exemplo:**

```
$ fazai --dry-run
> reiniciar nginx e verificar status

📋 Comandos gerados (DRY-RUN - não serão executados):

┌──────────────────────────────────────────────────────────────┐
│ Comando 1/2                                     Risco: MEDIUM │
├──────────────────────────────────────────────────────────────┤
│ sudo systemctl restart nginx                                 │
│                                                              │
│ Explicação:                                                  │
│ Reinicia o serviço nginx com systemd                         │
│                                                              │
│ Rollback: sudo systemctl restart nginx                       │
└──────────────────────────────────────────────────────────────┘

🔍 [DRY-RUN] Comando NÃO foi executado (modo simulação)
```

### 3. Modo CLI Interativo

Interface de chat com histórico persistente e comando `/exec`.

```bash
fazai --cli
```

**Comandos especiais:**

- `/help` - Mostrar comandos disponíveis
- `/exec <tarefa>` - Executar tarefa de admin Linux
- `/exec '''tarefa multi-linha'''` - Input multi-linha
- `/history` - Mostrar histórico
- `/history clear` - Limpar histórico
- `/memory clear` - Limpar memória de conversação
- `/quit` ou `/exit` - Sair

**Exemplo:**

```
$ fazai --cli

╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   Terminal FazAI v3.1-beta - Modo CLI Interativo         ║
║   Administrador Linux Senior + Redes                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

Digite /help para comandos especiais ou /quit para sair.
Histórico de conversação persistente em ~/.fazai/conversation.json

Você: como configurar nginx como proxy reverso para nodejs?

FazAI: Para configurar Nginx como proxy reverso para Node.js, siga estes passos:

1. **Criar arquivo de configuração do site**

```nginx
# /etc/nginx/sites-available/meuapp
server {
    listen 80;
    server_name meudominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

2. **Habilitar o site**

```bash
sudo ln -s /etc/nginx/sites-available/meuapp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Deseja que eu execute esses comandos? Use `/exec` para isso.

Você: /exec criar configuração nginx para proxy reverso nodejs na porta 3000

📋 Executando tarefa de admin Linux...

[Comandos serão gerados e executados como no modo admin normal]
```

### 4. Modo Ask

Perguntas gerais à IA sem execução de comandos.

```bash
fazai ask "sua pergunta aqui"
```

**Exemplo:**

```bash
# Explicações técnicas
fazai ask "qual a diferença entre systemctl e service?"

# Troubleshooting conceitual
fazai ask "por que meu servidor fica sem memória?"

# Boas práticas
fazai ask "como otimizar performance de servidor web nginx?"
```

### 5. Modo Search

Pesquisa manual via MCP Context7 ou web.

```bash
fazai search "sua consulta"
```

**Exemplo:**

```bash
# Pesquisar soluções
fazai search "nginx 502 bad gateway"

# Pesquisar documentação
fazai search "docker compose networking"
```

### 6. Modo Vector (Qdrant)

Gerenciamento de collections vetoriais.

```bash
# Validar collections (criar se não existirem)
fazai vector validate

# Recriar todas as collections (APAGA DADOS!)
fazai vector recreate

# Forçar provider específico
fazai vector validate --provider qdrant
```

---

## 💼 Casos de Uso Reais

### Caso 1: Troubleshooting de Serviço Falhando

**Cenário:** Nginx não está respondendo.

```bash
$ fazai
> nginx não está respondendo, diagnosticar o problema

# FazAI irá:
# 1. Verificar se nginx está rodando
# 2. Checar logs de erro
# 3. Validar configuração
# 4. Verificar porta 80/443
# 5. Sugerir solução
```

**Comandos gerados:**

```bash
systemctl status nginx
journalctl -u nginx -n 50 --no-pager
nginx -t
ss -tulpn | grep :80
ss -tulpn | grep :443
```

### Caso 2: Configuração de Firewall

**Cenário:** Abrir porta 8080 para aplicação.

```bash
$ fazai
> abrir porta 8080 no firewall para tcp

# FazAI detecta firewall (ufw/iptables/firewalld) e executa:
```

**Com UFW:**
```bash
sudo ufw allow 8080/tcp
sudo ufw status numbered
```

**Com iptables:**
```bash
sudo iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
sudo iptables-save > /etc/iptables/rules.v4
```

### Caso 3: Monitoramento de Recursos

**Cenário:** Ver quais processos consomem mais memória.

```bash
$ fazai
> listar os 10 processos que mais consomem memória

# Comandos:
ps aux --sort=-%mem | head -n 11
```

**Com análise:**
```bash
$ fazai
> analisar uso de memória e sugerir otimizações

# FazAI irá:
# 1. Mostrar uso total de RAM
# 2. Listar processos pesados
# 3. Verificar swap
# 4. Sugerir otimizações (kill processos, aumentar RAM, etc)
```

### Caso 4: Deploy de Aplicação Docker

**Cenário:** Deploy de app Node.js com Docker Compose.

```bash
$ fazai
> criar docker-compose para app nodejs com postgres e redis

# FazAI irá gerar arquivo docker-compose.yml e comandos para:
# 1. Criar Dockerfile
# 2. Criar docker-compose.yml
# 3. Build das imagens
# 4. Iniciar containers
```

### Caso 5: Backup Automatizado

**Cenário:** Configurar backup diário de banco de dados.

```bash
$ fazai
> criar script de backup do postgres executado diariamente às 2am

# FazAI irá:
# 1. Criar script de backup
# 2. Dar permissões
# 3. Adicionar ao cron
# 4. Testar execução
```

**Script gerado:**

```bash
#!/bin/bash
# /usr/local/bin/backup-postgres.sh

BACKUP_DIR="/var/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="meudb"

mkdir -p $BACKUP_DIR
pg_dump $DB_NAME | gzip > "$BACKUP_DIR/backup_${TIMESTAMP}.sql.gz"

# Manter apenas últimos 7 dias
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "Backup concluído: backup_${TIMESTAMP}.sql.gz"
```

**Cron:**
```bash
0 2 * * * /usr/local/bin/backup-postgres.sh >> /var/log/fazai/backup.log 2>&1
```

### Caso 6: Diagnóstico de Rede

**Cenário:** Servidor não consegue acessar internet.

```bash
$ fazai
> servidor não acessa internet, diagnosticar conectividade

# FazAI irá executar sequência de testes:
```

**Comandos:**

```bash
# 1. Testar interface de rede
ip addr show

# 2. Testar gateway padrão
ip route show
ping -c 4 $(ip route | grep default | awk '{print $3}')

# 3. Testar DNS
cat /etc/resolv.conf
nslookup google.com
dig google.com

# 4. Testar conectividade externa
ping -c 4 8.8.8.8
ping -c 4 google.com

# 5. Verificar firewall
sudo iptables -L -n -v
```

### Caso 7: Otimização de Performance

**Cenário:** Site lento, investigar gargalos.

```bash
$ fazai
> site está lento, analisar performance do nginx e sugerir otimizações

# FazAI irá:
# 1. Verificar worker_processes
# 2. Analisar conexões ativas
# 3. Checar uso de cache
# 4. Verificar compressão gzip
# 5. Sugerir otimizações de config
```

### Caso 8: Gestão de Certificados SSL

**Cenário:** Renovar certificado Let's Encrypt.

```bash
$ fazai
> renovar certificado ssl do let's encrypt para meudominio.com

# Comandos:
sudo certbot renew --dry-run  # Testar
sudo certbot renew            # Executar
sudo systemctl reload nginx   # Recarregar nginx
```

---

## 📥 Importação de Conversas

Importa histórico de conversas do Claude Desktop ou ChatGPT Desktop para as collections do Qdrant, permitindo RAG baseado em conhecimento prévio.

### Sintaxe

```bash
fazai import <arquivo> --source=<claude|chatgpt> [opções]
```

### Opções

- `--source=<claude|chatgpt>` - **Obrigatório**. Fonte das conversas
- `--recursive, -r` - Processar diretório recursivamente
- `--no-knowledge` - Não extrair conhecimento técnico para fazai_kb
- `--no-learning` - Não extrair padrões de aprendizado para fazai_learning

### Formatos Suportados

#### Claude Desktop Export

```json
{
  "conversations": [
    {
      "id": "conv-uuid",
      "created_at": "2025-11-14T10:00:00Z",
      "updated_at": "2025-11-14T10:30:00Z",
      "name": "Conversation title",
      "messages": [
        {
          "role": "user",
          "content": "message text",
          "created_at": "2025-11-14T10:00:00Z"
        },
        {
          "role": "assistant",
          "content": "response text",
          "created_at": "2025-11-14T10:01:00Z"
        }
      ]
    }
  ]
}
```

#### ChatGPT Desktop Export

```json
[
  {
    "id": "conv-uuid",
    "title": "Conversation title",
    "create_time": 1699900000,
    "update_time": 1699901800,
    "mapping": {
      "message_id": {
        "message": {
          "author": {"role": "user"},
          "content": {"parts": ["message text"]},
          "create_time": 1699900000
        }
      }
    }
  }
]
```

### Exemplos

#### Importar arquivo único (Claude)

```bash
fazai import ~/Downloads/claude-conversations.json --source=claude
```

#### Importar arquivo único (ChatGPT)

```bash
fazai import ~/Downloads/chatgpt-export.json --source=chatgpt
```

#### Importar diretório recursivamente

```bash
fazai import ~/backup/conversas/ --source=claude --recursive
```

#### Importar sem extração de conhecimento

```bash
fazai import conversas.json --source=claude --no-knowledge --no-learning
```

### O que é Importado

**1. fazai_memory** (todas as mensagens):
- ID da conversação
- Role (user/assistant)
- Conteúdo
- Timestamp
- Summary
- Tags
- Fonte (claude-desktop/chatgpt-desktop)

**2. fazai_kb** (conhecimento técnico extraído):
- Comandos Linux identificados
- Soluções de rede
- Configurações de sistema
- Troubleshooting steps
- Categoria (linux-general, networking, systemd, monitoring)
- Comandos executáveis

**3. fazai_learning** (padrões de aprendizado):
- Problemas → Soluções
- Erros resolvidos
- Otimizações aplicadas
- Padrões de falha
- Effectiveness score

### Resultado da Importação

```bash
$ fazai import conversas.json --source=claude

🔄 Importando conversas de claude...
Arquivo: /home/user/conversas.json
✓ Collections Qdrant verificadas
📝 Processando 15 conversas Claude
✓ Processado: conversas.json

✅ Importação concluída!

📊 Estatísticas:
  Conversas importadas: 15
  Conversas puladas: 0

📦 Inserções no Qdrant:
  fazai_memory: 287 mensagens
  fazai_kb: 42 soluções técnicas
  fazai_learning: 18 padrões de aprendizado
```

---

## 🗄️ Vector Store e RAG

### Collections Qdrant

O Terminal FazAI usa 5 collections especializadas para RAG (Retrieval-Augmented Generation):

#### 1. fazai_personality

**Propósito:** Armazenar expertise técnica e estilo de troubleshooting do admin.

**Campos:**
- `admin_name`: Nome do administrador
- `expertise_areas`: Áreas de expertise (array)
- `troubleshooting_style`: Estilo de diagnóstico
- `preferred_tools`: Ferramentas preferidas
- `response_tone`: Tom de resposta
- `risk_tolerance`: Tolerância a risco
- `automation_preference`: Preferência de automação

**Exemplo de uso:**

```bash
# A IA usa essa collection para:
# - Adaptar sugestões ao seu estilo
# - Recomendar ferramentas que você prefere
# - Ajustar tom de resposta
# - Respeitar sua tolerância a risco
```

#### 2. fazai_memory

**Propósito:** Memória operacional de longo prazo.

**Campos:**
- `conversation_id`: ID da conversa
- `message_id`: ID da mensagem
- `role`: user/assistant
- `timestamp`: Data/hora
- `content`: Conteúdo
- `summary`: Resumo
- `tags`: Tags (array)
- `infrastructure_context`: Contexto de infra (hostnames, IPs, etc)

**Exemplo de uso:**

```bash
# "Você se lembra daquele problema com nginx que tivemos semana passada?"
# - IA busca na fazai_memory por conversas antigas sobre nginx
```

#### 3. fazai_learning

**Propósito:** Aprendizado contínuo de erros e soluções.

**Campos:**
- `pattern_type`: error_resolution, optimization, best_practice
- `problem_description`: Descrição do problema
- `solution_description`: Descrição da solução
- `timestamp`: Data/hora
- `tags`: Tags
- `effectiveness`: Score de efetividade (0-1)

**Exemplo de uso:**

```bash
# Quando você resolve um erro, IA registra:
# - Problema: "Nginx retornando 502"
# - Solução: "Aumentar worker_connections"
# - Effectiveness: 0.9

# Na próxima vez que aparecer erro similar, IA sugere essa solução primeiro
```

#### 4. fazai_kb

**Propósito:** Base de conhecimento de soluções validadas.

**Campos:**
- `slug`: ID único
- `title`: Título
- `summary`: Resumo
- `category`: Categoria (linux-general, networking, etc)
- `scope`: Escopo (system, network, service, etc)
- `linux_distribution`: Distribuição
- `component`: Componente (nginx, docker, systemd, etc)
- `commands`: Comandos (array)
- `source`: Fonte
- `confidence`: Confiança (0-1)
- `tags`: Tags

**Exemplo de uso:**

```bash
# IA consulta fazai_kb quando você pede:
# "configurar nginx como load balancer"
# - Busca por category=networking, component=nginx, tags=[load-balancer]
# - Retorna solução validada com comandos prontos
```

#### 5. fazai_inference

**Propósito:** Regras operacionais, políticas e SLAs.

**Campos:**
- `rule_type`: security, sla, automation, approval
- `rule_name`: Nome da regra
- `condition`: Condição
- `action`: Ação
- `priority`: Prioridade
- `enabled`: Habilitado/desabilitado

**Exemplo de uso:**

```bash
# Exemplo de regra:
# rule_type: security
# rule_name: "Proibir rm -rf em produção"
# condition: "command.includes('rm -rf') && env == 'production'"
# action: "block"
# priority: CRITICAL

# IA sempre checará fazai_inference antes de sugerir comandos destrutivos
```

### Criar/Validar Collections

```bash
# Criar collections (se não existirem)
fazai vector validate

# Recriar todas (APAGA DADOS EXISTENTES!)
fazai vector recreate

# Ver status
curl http://localhost:6333/collections
```

### Inserir Dados Manualmente

Você pode inserir dados diretamente via API Qdrant ou criar scripts:

```typescript
import { QdrantClient } from '@qdrant/js-client-rest';

const client = new QdrantClient({ url: 'http://localhost:6333' });

// Inserir regra de segurança
await client.upsert('fazai_inference', {
  wait: true,
  points: [{
    id: 'rule-no-rm-rf-prod',
    vector: Array(1536).fill(0), // Embedding seria gerado por OpenAI/etc
    payload: {
      rule_type: 'security',
      rule_name: 'Bloquear rm -rf em produção',
      condition: 'command.includes("rm -rf") && env == "production"',
      action: 'block',
      priority: 'CRITICAL',
      enabled: true
    }
  }]
});
```

---

## 🔧 Troubleshooting

### Problema: "API key não configurada"

**Solução:**

```bash
# Verificar config
fazai config

# Adicionar manualmente
nano ~/.config/fazai/fazai.conf

# Ou deixar FazAI pedir interativamente
fazai
# (FazAI pedirá a API key se não configurada)
```

### Problema: "Qdrant não está rodando"

**Solução:**

```bash
# Verificar se está rodando
curl http://localhost:6333/collections

# Se não estiver, iniciar:

# Docker:
docker start fazai-qdrant

# Systemd:
sudo systemctl start qdrant

# Ou instalar:
curl -fsSL https://raw.githubusercontent.com/rogerluft/fazai-ng/master/install.sh | bash
# (Escolher opção de instalar Qdrant)
```

### Problema: "Permission denied ao criar /var/log/fazai"

**Solução:**

```bash
# Criar diretório com permissões corretas
sudo mkdir -p /var/log/fazai
sudo chown $(whoami):$(id -gn) /var/log/fazai
sudo chmod 775 /var/log/fazai

# Ou usar diretório alternativo
export FAZAI_LOG_FILE="$HOME/.fazai/logs/fazai.log"
```

### Problema: "Comando não encontrado: fazai"

**Solução:**

```bash
# Verificar se está no PATH
echo $PATH | grep -o "$HOME/.local/bin"

# Se não estiver, adicionar:
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Verificar symlink
ls -la ~/.local/bin/fazai

# Se não existir, recriar:
ln -s /caminho/para/fazai-ng/bin/fazai.js ~/.local/bin/fazai
chmod +x ~/.local/bin/fazai
```

### Problema: "Build falha com erro de TypeScript"

**Solução:**

```bash
# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build

# Se persistir, verificar versão Node.js
node --version  # Deve ser 18+
```

### Problema: "Importação de conversas falha"

**Solução:**

```bash
# Verificar formato do JSON
jq . conversas.json

# Verificar se Qdrant está rodando
curl http://localhost:6333/collections

# Validar collections
fazai vector validate

# Testar com arquivo pequeno
echo '{"conversations":[]}' > test.json
fazai import test.json --source=claude
```

---

## ✅ Boas Práticas

### 1. Sempre use --dry-run primeiro

Antes de executar comandos destrutivos, teste com dry-run:

```bash
# Testar primeiro
fazai --dry-run
> remover todos os containers docker parados

# Se estiver OK, executar de verdade
fazai
> remover todos os containers docker parados
```

### 2. Revise comandos HIGH/CRITICAL

FazAI marca riscos, mas sempre revise:

- ✅ **LOW** - Comandos read-only, pode executar sem medo
- ⚠️ **MEDIUM** - Modificações reversíveis, revisar antes
- 🔴 **HIGH** - Modificações do sistema, CUIDADO
- 🚨 **CRITICAL** - Operações destrutivas, REVISAR DUAS VEZES

### 3. Use rollback quando disponível

Comandos reversíveis incluem comando de rollback:

```bash
# Exemplo:
# Comando: sudo systemctl stop nginx
# Rollback: sudo systemctl start nginx

# Se algo der errado, execute o rollback!
```

### 4. Mantenha backup das configs

Antes de modificar arquivos críticos:

```bash
fazai
> fazer backup de /etc/nginx/nginx.conf antes de modificar

# FazAI irá sugerir:
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup-$(date +%Y%m%d)
```

### 5. Use logs para auditoria

Todos os comandos são logados:

```bash
# Ver logs
tail -f /var/log/fazai/fazai.log

# Buscar comandos executados
grep "Executando comando" /var/log/fazai/fazai.log
```

### 6. Configure regras de segurança

Use `fazai_inference` para políticas:

```typescript
// Exemplo: Bloquear alterações em produção sem aprovação
{
  rule_type: 'approval',
  rule_name: 'Mudanças em produção requerem aprovação',
  condition: 'env == "production" && risk >= "HIGH"',
  action: 'require_approval',
  priority: 'HIGH'
}
```

### 7. Import conversas regularmente

Importe histórico de conversas para melhorar RAG:

```bash
# Semanalmente
fazai import ~/claude-exports/week-$(date +%U).json --source=claude
```

### 8. Valide collections periodicamente

```bash
# Mensalmente
fazai vector validate

# Se houver mudanças no schema, recriar
fazai vector recreate  # CUIDADO: apaga dados!
```

---

## 🔌 API e Integrações

### MCP Context7

FazAI integra com Context7 via MCP para pesquisa contextual:

**Configuração:**

```ini
# HTTP endpoint
MCP_CONTEXT7_URL=http://localhost:7700/context7/search
MCP_CONTEXT7_API_KEY=seu_token

# OU comando local
MCP_CONTEXT7_COMMAND=context7 --json --query "{query}"
```

**Uso:**

```bash
# Pesquisa manual
fazai search "nginx load balancing"

# Pesquisa automática (quando IA precisa de contexto)
fazai
> configurar load balancer nginx com ssl

# FazAI irá:
# 1. Detectar que precisa de contexto adicional
# 2. Fazer query no Context7
# 3. Usar resultados para gerar comandos melhores
```

### Webhook/API (Futuro)

Em desenvolvimento - versões futuras terão API REST:

```bash
# Planejado para v3.2+
POST /api/v1/execute
{
  "task": "listar serviços ativos",
  "model": "sonnet35",
  "dry_run": false
}
```

### Integrações Planejadas

- [ ] Prometheus metrics export
- [ ] Grafana dashboard
- [ ] Slack notifications
- [ ] PagerDuty alerts
- [ ] Terraform provider
- [ ] Ansible module

---

## 📊 Logs e Debugging

### Níveis de Log

```bash
# Error (apenas erros)
LOG_LEVEL=error fazai

# Warn (erros + avisos)
LOG_LEVEL=warn fazai

# Info (padrão - informações gerais)
LOG_LEVEL=info fazai

# Debug (tudo, incluindo detalhes internos)
LOG_LEVEL=debug fazai
# OU
fazai --debug
```

### Arquivo de Log

**Padrão:** `/var/log/fazai/fazai.log`

**Fallback:** `./fazai.log` (se /var/log/fazai não for gravável)

**Override:**

```bash
# Via env
FAZAI_LOG_FILE=/tmp/fazai.log fazai

# Via flag
fazai --log-file /tmp/fazai.log

# Via config
LOG_FILE_PATH=/custom/path/fazai.log
```

### Analisar Logs

```bash
# Tempo real
tail -f /var/log/fazai/fazai.log

# Últimas 100 linhas
tail -n 100 /var/log/fazai/fazai.log

# Buscar erros
grep ERROR /var/log/fazai/fazai.log

# Buscar comandos executados hoje
grep "$(date +%Y-%m-%d)" /var/log/fazai/fazai.log | grep "Executando"

# Ver estatísticas
grep -c "Executando comando" /var/log/fazai/fazai.log
```

---

## 📞 Suporte e Comunidade

### Reportar Bugs

GitHub Issues: https://github.com/rogerluft/fazai-ng/issues

### Documentação Adicional

- **README.md** - Visão geral e quick start
- **CLAUDE.md** - Documentação técnica para IA
- **CHANGELOG.md** - Histórico de mudanças

### Contribuir

Pull requests são bem-vindos! Veja CONTRIBUTING.md (em desenvolvimento).

---

## 📜 Licença

Este projeto é um fork do [Mandark](https://github.com/original/mandark) sob Apache 2.0.

**Código original (Mandark):** Apache License 2.0
**Documentação FazAI:** Creative Commons BY 4.0

---

## 🎓 Apêndice

### Modelos de IA Disponíveis

| Provedor | Apelido | Nome do Modelo | Custo | Caso de Uso |
|----------|---------|----------------|-------|-------------|
| OpenAI | `gpt4mini` | gpt-4o-mini | $ | Padrão, rápido, barato |
| OpenAI | `gpt4o` | gpt-4o | $$$ | Mais recente, inteligente |
| OpenAI | `gpt4turbo` | gpt-4-turbo | $$ | Alta performance |
| Anthropic | `sonnet35` | claude-3-5-sonnet | $$$ | Mais inteligente |
| Anthropic | `haiku` | claude-3-haiku | $ | Rápido, barato |
| Ollama | `llama32` | llama3.2 | GRÁTIS | Local, privado |
| Ollama | `qwen` | qwen2.5:7b | GRÁTIS | Local, Qwen |
| Ollama | `mistral` | mistral | GRÁTIS | Local, Mistral |

### Comandos Rápidos

```bash
# Admin Linux
fazai                              # Modo padrão (gpt4mini)
fazai sonnet35                     # Usar Claude Sonnet
fazai --dry-run                    # Modo simulação

# CLI Interativo
fazai --cli                        # Abrir chat

# Perguntas
fazai ask "pergunta"               # Pergunta geral

# Pesquisa
fazai search "query"               # Pesquisa manual

# Vector Store
fazai vector validate              # Validar collections
fazai vector recreate              # Recriar (APAGA DADOS)

# Import
fazai import file.json --source=claude     # Importar conversas

# Config
fazai config                       # Mostrar API keys

# Help
fazai --help                       # Ajuda
```

### Variáveis de Ambiente

```bash
# Config
FAZAI_CONFIG_PATH=/path/to/fazai.conf

# Logging
FAZAI_LOG_LEVEL=debug
FAZAI_LOG_FILE=/path/to/log

# Build
FAZAI_AUTO_BUILD=0  # Desabilitar auto-build

# Research
FAZAI_DISABLE_RESEARCH=true
FAZAI_RESEARCH_ON_FAILURE=true

# API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OLLAMA_BASE_URL=http://localhost:11434

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=...
```

---

**Versão do Manual:** 3.1.0-beta
**Última atualização:** 2025-11-14
**Autor:** Terminal FazAI Team

Para mais informações, acesse: https://github.com/rogerluft/fazai-ng
