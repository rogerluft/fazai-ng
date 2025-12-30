# FazAI Appliance - Arquitetura Agent-Socket

**Status:** Em Desenvolvimento
**Data:** 2025-12-30
**Autor:** Claude + Roger Luft

## Decisões Tomadas

| Aspecto | Decisão | Notas |
|---------|---------|-------|
| Protocolo | JSON simples | Fácil debug, extensível |
| Autenticação | Senha via conf | AGENT_PASSWORD em fazai.conf |
| Timeout | Configurável | AGENT_TIMEOUT (default 300s) |
| Output | Real-time streaming | Via socket |
| Comandos | Sequenciais | Um por vez |
| Config | Tudo via conf | /etc/fazai/fazai.conf |

---

## Problema

FazAI tem duas necessidades conflitantes:

1. **Dependências isoladas** (Qdrant, Ollama, Node.js) → ideal para container
2. **Executar comandos no HOST** (Linux admin) → precisa sair do container

**Paradoxo:** Se containerizo tudo, comandos executam dentro do container, não no host.

---

## Solução: Agent-Socket

### Princípio

> **Host BURRO, Container INTELIGENTE**

- **Host:** Apenas um agent mínimo (~50 linhas) que escuta socket e executa comandos
- **Container:** Toda a lógica (Qdrant, Ollama, FazAI Core, modelos, configs)

### Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                         HOST (Fedora)                        │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  fazai-agent.service                                   │ │
│  │  ════════════════════                                  │ │
│  │  • PID 1 do systemd                                    │ │
│  │  • Escuta: /run/fazai/agent.sock                       │ │
│  │  • Recebe JSON: {"cmd": "apt install nginx"}          │ │
│  │  • Executa no HOST real                                │ │
│  │  • Retorna: {"exit": 0, "stdout": "...", "stderr": ""}│ │
│  │  • ~50 linhas de código                                │ │
│  └───────────────────────────┬────────────────────────────┘ │
│                              │                               │
│                    /run/fazai/agent.sock                     │
│                              │                               │
│  ┌───────────────────────────┴────────────────────────────┐ │
│  │            Container: fazai-brain                       │ │
│  │  ┌─────────────────────────────────────────────────┐   │ │
│  │  │                                                 │   │ │
│  │  │   ┌─────────┐  ┌─────────┐  ┌──────────────┐   │   │ │
│  │  │   │ Qdrant  │  │ Ollama  │  │   FazAI      │   │   │ │
│  │  │   │ :6333   │  │ :11434  │  │   Core       │   │   │ │
│  │  │   │         │  │         │  │              │   │   │ │
│  │  │   │ Vetores │  │ Phi-3   │  │ Gera comando │   │   │ │
│  │  │   │ Cache   │  │ Llama   │  │ ──────────►  │   │   │ │
│  │  │   │ Memory  │  │ Nomic   │  │ Envia p/ sock│   │   │ │
│  │  │   └─────────┘  └─────────┘  └──────────────┘   │   │ │
│  │  │                                                 │   │ │
│  │  └─────────────────────────────────────────────────┘   │ │
│  │                                                         │ │
│  │  Volume: /run/fazai montado do host                     │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Fluxo de Execução

```
Usuário                Container                    Host Agent
   │                      │                            │
   │  "instala nginx"     │                            │
   │─────────────────────►│                            │
   │                      │                            │
   │                      │ 1. Consulta Qdrant         │
   │                      │    (contexto, cache)       │
   │                      │                            │
   │                      │ 2. Consulta Ollama         │
   │                      │    (gera comando)          │
   │                      │                            │
   │                      │ 3. Valida risco            │
   │                      │                            │
   │                      │ {"cmd":"dnf install nginx"}│
   │                      │───────────────────────────►│
   │                      │     (via Unix socket)      │
   │                      │                            │
   │                      │                            │ 4. Executa
   │                      │                            │    no HOST
   │                      │                            │    REAL
   │                      │                            │
   │                      │◄───────────────────────────│
   │                      │  {"exit":0,"out":"..."}    │
   │                      │                            │
   │◄─────────────────────│                            │
   │  "nginx instalado"   │                            │
```

---

## Componentes

### 1. Host Agent (Mínimo)

**Localização:** `/opt/fazai/`

**Arquivos:**
- `fazai-agent.sh` - Loop principal
- `execute.sh` - Executor de comandos
- `fazai-agent.service` - Unit systemd

**Responsabilidades:**
- Escutar socket Unix
- Validar comandos (whitelist/blacklist)
- Executar no host real
- Retornar resultado JSON
- Logar tudo

### 2. Container Brain (Inteligente)

**Imagem:** `fazai/brain:latest`

**Contém:**
- Qdrant (vetores, cache semântico, memória)
- Ollama (Phi-3, Llama, Nomic-embed)
- FazAI Core (TypeScript compilado)
- Configurações padrão
- Modelos pré-baixados

**Volumes:**
- `/run/fazai` - Socket do agent (bind mount)
- `/data/qdrant` - Persistência Qdrant
- `/data/ollama` - Modelos Ollama
- `/etc/fazai` - Configurações

---

## Instalação

### Passo 1: Agent no Host

```bash
# One-liner
curl -sSL https://fazai.io/install-agent | sudo bash

# Ou manual
git clone https://github.com/rluft/fazai-ng
cd fazai-ng/docker/agent
sudo ./install.sh
```

### Passo 2: Brain (Container)

```bash
# Docker simples
docker run -d \
  --name fazai-brain \
  -v /run/fazai:/run/fazai \
  -v fazai-data:/data \
  -p 8080:8080 \
  fazai/brain:latest

# Ou com docker-compose
cd fazai-ng/docker
docker-compose up -d
```

---

## Segurança

### Validação de Comandos

O agent pode implementar:

1. **Whitelist de comandos seguros**
2. **Blacklist de comandos perigosos** (rm -rf /, dd, mkfs)
3. **Rate limiting**
4. **Autenticação via token**
5. **Logging completo**

### Exemplo de Validação

```bash
# Lista de comandos bloqueados
BLOCKED_PATTERNS=(
  "rm -rf /"
  "dd if="
  "mkfs"
  "> /dev/sd"
  "chmod 777 /"
)

validate_command() {
  local cmd="$1"
  for pattern in "${BLOCKED_PATTERNS[@]}"; do
    if [[ "$cmd" == *"$pattern"* ]]; then
      echo "BLOCKED"
      return 1
    fi
  done
  echo "OK"
  return 0
}
```

---

## Variações

### Multi-Host (Brain Remoto)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Host A     │     │  Host B     │     │  Host C     │
│  (Desktop)  │     │  (Server)   │     │  (Laptop)   │
│             │     │             │     │             │
│  agent.sock │     │  agent.sock │     │  agent.sock │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │ TCP/TLS
                    ┌──────┴──────┐
                    │  NAS/Cloud  │
                    │             │
                    │ fazai-brain │
                    └─────────────┘
```

### Alternativa: systemd-nspawn

Para quem prefere solução Linux-native sem Docker:

```bash
# Importar imagem
sudo machinectl pull-tar https://fazai.io/fazai-nspawn.tar.xz fazai

# Executar
sudo systemd-nspawn -M fazai \
  --bind=/run/fazai:/run/fazai \
  --network-host \
  --boot
```

---

## Comparação de Abordagens

| Aspecto | Docker + Agent | systemd-nspawn | LXD |
|---------|----------------|----------------|-----|
| Portabilidade | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| Facilidade | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Performance | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Segurança | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Ecossistema | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |

---

## Roadmap

- [ ] Implementar agent básico
- [ ] Criar Dockerfile do brain
- [ ] Testar integração socket
- [ ] Adicionar validação de comandos
- [ ] Criar docker-compose.yml
- [ ] Documentar instalação
- [ ] Testar em diferentes distros
- [ ] Implementar variante multi-host

---

## Arquivos Neste Diretório

```
docker/
├── ARCHITECTURE.md          # Este documento
├── docker-compose.yml       # Orquestração ✅
├── Dockerfile.brain         # Imagem do brain ✅
├── agent/
│   ├── fazai-agent.sh       # Loop principal ✅
│   ├── fazai-agent.service  # Unit systemd ✅
│   └── install.sh           # Instalador ✅
└── brain/
    ├── entrypoint.sh        # Entrypoint container ✅
    └── fazai.conf.default   # Config padrão ✅
```

---

## Análise de Segurança (Versão Bash)

### Vulnerabilidades Conhecidas

| Linha | Vulnerabilidade | Severidade | Descrição |
|-------|-----------------|------------|-----------|
| 85 | Timing Attack | ALTA | Comparação de senha em plaintext permite timing attack |
| 108 | Command Injection | CRÍTICA | `bash -c "$cmd"` vulnerável se cmd mal-formado |
| 62 | Pattern Bypass | ALTA | Matching simples - fácil bypass com encoding/espaços |
| 80-82 | Auth Bypass | MÉDIA | Sem senha configurada = aceita qualquer conexão |
| 220 | DoS | MÉDIA | `read -r` sem limite de tamanho de input |
| 210 | Resource Exhaustion | MÉDIA | socat fork sem rate limiting |

### Exemplos de Bypass do Bloqueio

```bash
# Bloqueado: "rm -rf /"

# Bypass 1: Base64 encoding
echo '{"cmd":"$(echo cm0gLXJmIC8= | base64 -d)"}'

# Bypass 2: Variável intermediária
echo '{"cmd":"R=/; rm -rf $R"}'

# Bypass 3: Espaços extras
echo '{"cmd":"rm  -rf  /"}'

# Bypass 4: Path absoluto
echo '{"cmd":"/bin/rm -rf /"}'

# Bypass 5: Globbing
echo '{"cmd":"rm -rf /*"}'

# Bypass 6: Alternativas
echo '{"cmd":"find / -delete"}'
```

### Requisitos para Versão C (Produção)

#### Segurança Obrigatória

| Requisito | Implementação | Prioridade |
|-----------|---------------|------------|
| Sandboxing | seccomp-bpf, landlock, ou bubblewrap | P0 |
| Capabilities | Drop ALL, keep apenas CAP_DAC_OVERRIDE se necessário | P0 |
| Constant-time auth | `CRYPTO_memcmp()` ou similar | P0 |
| Input validation | Tamanho máximo, charset whitelist | P0 |
| Rate limiting | Token bucket ou sliding window | P1 |
| Whitelist | Comandos permitidos em vez de bloqueados | P1 |
| Namespace | Clone com CLONE_NEWPID, CLONE_NEWNET para filhos | P1 |
| Resource limits | setrlimit() para CPU, mem, forks | P2 |

#### Estrutura Sugerida (C)

```c
// fazai-agent.c - Estrutura básica

#include <sys/socket.h>
#include <sys/un.h>
#include <seccomp.h>
#include <sys/capability.h>

typedef struct {
    char *socket_path;
    char *password_hash;  // Argon2 ou similar
    int timeout_sec;
    char **whitelist;     // Comandos permitidos
    int rate_limit;       // Requests por segundo
} agent_config_t;

typedef struct {
    char *id;
    char *cmd;
    char *password;
} request_t;

typedef struct {
    char *id;
    int exit_code;
    char *stdout_buf;
    char *stderr_buf;
    time_t timestamp;
} response_t;

// Funções principais
int load_config(const char *path, agent_config_t *cfg);
int validate_auth(const char *password, const char *hash);
int validate_command(const char *cmd, char **whitelist);
int sandbox_and_exec(const char *cmd, response_t *resp);
int apply_seccomp_filter(void);
void drop_capabilities(void);
```

#### Syscalls Permitidas (seccomp whitelist)

```c
// Apenas o mínimo necessário
scmp_filter_ctx ctx = seccomp_init(SCMP_ACT_KILL);
seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(read), 0);
seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(write), 0);
seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(close), 0);
seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(exit_group), 0);
seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(clone), 0);  // Para fork
seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(execve), 0); // Para exec
seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(wait4), 0);
// ... lista restritiva
seccomp_load(ctx);
```

---

## Discussão

### Decisões Tomadas

1. **Protocolo:** JSON simples ✅
2. **Autenticação:** Senha via conf ✅
3. **Timeout:** Configurável (AGENT_TIMEOUT) ✅
4. **Streaming:** Real-time ✅
5. **Múltiplos comandos:** Sequenciais ✅

### Questões Pendentes

1. **Whitelist vs Blacklist:** Migrar para whitelist na versão C?
2. **Hash de senha:** Argon2id ou bcrypt?
3. **Logging estruturado:** JSON logs para integração com ELK/Loki?
4. **Métricas:** Expor Prometheus metrics?
5. **Multi-tenancy:** Suportar múltiplos containers/usuários?

---

*Documento vivo - será atualizado conforme a discussão evolui.*
