# CLAUDE.md

Este arquivo fornece orientações ao Claude Code (claude.ai/code) ao trabalhar com código neste repositório.

## Visão Geral do Projeto

FazAI (v3.0-RC) é uma ferramenta de administração Linux alimentada por IA (originalmente um fork do Mandark). É um CLI TypeScript leve (~80kb compilado) que converte linguagem natural em comandos Linux seguros e conscientes do contexto, com capacidades inteligentes de pesquisa e chat interativo.

**Capacidades Principais:**
- **Modo Admin Linux** (padrão): Linguagem natural para comandos Linux com avaliação de risco
- **Modo CLI Interativo**: Interface de chat com memória persistente e comandos `/exec`
- **Modo Ask**: Perguntas gerais de IA e consultas de código
- **Camada de Pesquisa**: Integração MCP Context7 com fallback para busca web
- **Vector Store**: Suporte Qdrant/Milvus para memória e base de conhecimento

**Recursos Principais:**
- Suporte multi-modelo de IA (Claude, GPT, Ollama)
- Sistema de segurança com 5 camadas e avaliação automática de risco
- Modo dry-run para simulação de comandos
- Comandos de rollback automáticos
- Coleta de contexto consciente do sistema
- Memória persistente de conversação
- Auto-build ao detectar mudanças no código

O projeto é projetado para ser executado via `npx fazai` sem instalação ou compilado localmente.

---

## Build e Desenvolvimento

### Sistema de Build

```bash
# Compilar o projeto
npm run build
# Usa tsup para empacotar src/app.ts em dist/app.cjs

# Modo desenvolvimento (com hot reload via tsx)
npm run dev

# Iniciar versão compilada
npm run start
```

**Configuração de Build** (tsup.config.js):
- Entrada: `src/app.ts`
- Saída: `dist/app.cjs` (CommonJS, minificado)
- Target: Node.js 18.17.0+
- Formato: Bundle em arquivo único

**Recurso de Auto-Build** (bin/fazai.js:26-81):
- O launcher CLI detecta automaticamente mudanças no código-fonte
- Executa `npm run build` antes de iniciar se `src/` for mais recente que `dist/app.cjs`
- Rastreia metadados de build em `.fazai-build-meta.json`
- Desabilite com `export FAZAI_AUTO_BUILD=0`
- Pula auto-build se não estiver em ambiente de desenvolvimento (sem `src/`, `package.json` ou `node_modules/`)

### Testar o Pacote Compilado

```bash
npm link
fazai --help
```

### Estrutura do Projeto

```
fazai-ng/
├── src/
│   ├── app.ts                 # Ponto de entrada principal, parsing de argumentos CLI
│   ├── config.ts              # Sistema flexível de busca de arquivo de configuração
│   ├── logger.ts              # Log centralizado com saída para arquivo
│   ├── models.ts              # Definições de modelos de IA (Claude, GPT, Ollama)
│   ├── apiKeyUtils-fazai.ts   # Gerenciamento de chaves de API
│   │
│   ├── linux-admin.ts         # Conversão de linguagem natural → comando Linux
│   ├── linux-executor.ts      # Execução de comandos com verificações de segurança
│   ├── linux-prompt.ts        # Prompts do sistema para admin Linux
│   ├── system-info.ts         # Coleta de contexto do sistema (OS, distro, serviços)
│   ├── types-linux.ts         # Definições de tipos para comandos Linux
│   │
│   ├── cli-mode.ts            # Modo chat CLI interativo
│   ├── memory.ts              # Histórico persistente de conversação
│   ├── askAI.ts               # Handler de perguntas gerais à IA
│   ├── askPrompt.ts           # Prompts para modo ask
│   │
│   ├── research.ts            # Camada de orquestração de pesquisa
│   ├── vector-store.ts        # Suporte a banco de dados vetorial Qdrant/Milvus
│   └── mcp/
│       ├── client.ts          # Cliente MCP para consultas Context7
│       ├── context7.ts        # Adapter Context7 (HTTP/command)
│       └── server.ts          # Servidor HTTP opcional compatível com MCP
│
├── bin/
│   └── fazai.js               # Launcher CLI com auto-build
├── dist/
│   └── app.cjs                # Bundle compilado
├── tests/
│   └── call-ai.test.ts        # Estrutura básica de testes
├── context/                   # Arquivos de contexto do projeto (manifesto Codex, etc.)
├── beta/                      # Recursos experimentais (Gmail MCP, framework GenAI)
├── fazai.conf                 # Arquivo de configuração do usuário
└── package.json
```

---

## Arquitetura Principal

### Ponto de Entrada e Modos de Operação

**Entrada Principal:** src/app.ts

A aplicação opera em cinco modos distintos:

1. **Modo Admin Linux** (padrão): Converte linguagem natural para comandos Linux seguros
   - Ativado por: `fazai` ou `fazai [apelido-do-modelo]`
   - Usa: linux-admin.ts, linux-executor.ts, system-info.ts

2. **Modo CLI Interativo**: Interface de chat com execução de comandos
   - Ativado por: `fazai --cli`
   - Usa: cli-mode.ts, memory.ts, research.ts
   - Recursos: Histórico persistente de conversação, comandos `/exec`, auto-complete

3. **Modo Ask**: Perguntas gerais à IA sem execução de comandos
   - Ativado por: `fazai ask "pergunta"`
   - Usa: askAI.ts, askPrompt.ts

4. **Modo Research**: Busca manual de contexto/web
   - Ativado por: `fazai search "consulta"`
   - Usa: research.ts, mcp/client.ts

5. **Gerenciamento de Vector Store**: Validar/criar coleções vetoriais
   - Ativado por: `fazai vector [validate|recreate]`
   - Usa: vector-store.ts

---

## Componentes Principais

### 1. Sistema de Configuração (src/config.ts)

Busca flexível de arquivo de configuração com múltiplos caminhos de pesquisa:

**Ordem de Busca:**
1. Variável de ambiente `FAZAI_CONFIG_PATH` (caminho explícito)
2. Diretório de trabalho atual (`./fazai.conf`)
3. Diretório do script e diretório pai
4. `~/.config/fazai/fazai.conf` (localização preferida)
5. `~/fazai.conf` (fallback)

**Formato do Arquivo de Configuração** (`fazai.conf`):
```ini
# Chaves dos Provedores de IA
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
OPENAI_API_KEY=sk-xxxxx
OLLAMA_BASE_URL=http://localhost:11434

# Pesquisa MCP Context7
MCP_CONTEXT7_URL=http://localhost:7700/context7/search
MCP_CONTEXT7_COMMAND=context7 --json --query "{query}"
MCP_CONTEXT7_API_KEY=seu_token

# Fallback de Busca Web
WEB_SEARCH_PROVIDER=duckduckgo
FAZAI_DISABLE_RESEARCH=false
FAZAI_RESEARCH_ON_FAILURE=true

# Vector Store (Qdrant/Milvus)
VECTOR_PROVIDER=qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=sua_chave
VECTOR_DIMENSION=1536
VECTOR_DISTANCE=Cosine

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/fazai/fazai.log
```

**Funções Principais:**
- `getConfigValue(key: string)`: Ler um valor de configuração
- `setConfigValue(key: string, value: string)`: Escrever um valor de configuração
- `listConfigEntries()`: Listar todas as entradas de configuração
- `getConfigFilePath()`: Obter o caminho do arquivo de configuração resolvido

### 2. Sistema de Logging (src/logger.ts)

Logging centralizado com saída para arquivo e controle de nível:

**Níveis de Log:** `error`, `warn`, `info`, `debug`

**Configuração:**
- Ambiente: `FAZAI_LOG_LEVEL`, `FAZAI_LOG_FILE`
- Arquivo de config: `LOG_LEVEL`, `LOG_FILE_PATH`
- Padrão: nível `info`, `/var/log/fazai/fazai.log` (fallback para `./fazai.log`)

**Uso:**
```typescript
import { logger } from "./logger";

logger.info("Mensagem informativa");
logger.warn("Mensagem de aviso");
logger.error("Mensagem de erro");
logger.debug("Mensagem de debug");
```

**Recursos:**
- Remoção automática de cores ANSI para saída em arquivo
- Fallback gracioso se o diretório de log não for gravável
- Suporta saída colorida no console via chalk
- Aviso único se criação do arquivo de log falhar

### 3. Modo Admin Linux (src/linux-admin.ts, src/linux-executor.ts)

Converte linguagem natural para comandos Linux seguros e conscientes do contexto.

**Fluxo:**
1. **Coleta de Contexto do Sistema** (src/system-info.ts):
   - OS, distribuição, versão do kernel
   - Detecção de gerenciador de pacotes
   - Serviços ativos (systemd/init)
   - Interfaces de rede
   - Uso de disco, memória

2. **Geração de Comandos por IA** (src/linux-admin.ts):
   - Faz streaming de comandos dos modelos de IA
   - Retorna `LinuxCommand[]` com avaliação de risco

3. **Avaliação de Risco**:
   - `CRITICAL`: Operações destrutivas (ex: `rm -rf /`, `mkfs`, `dd`)
   - `HIGH`: Modificações do sistema (ex: `apt remove`, `systemctl disable`)
   - `MEDIUM`: Reinícios de serviço, edições de arquivo
   - `LOW`: Operações somente leitura

4. **Verificações de Segurança** (src/linux-executor.ts):
   - Pattern matching para comandos perigosos
   - Validação pré-execução
   - Confirmação do usuário baseada no nível de risco
   - Comandos de rollback opcionais

5. **Integração de Pesquisa**:
   - IA pode solicitar pesquisa antes da execução (`researchNeeded: true`)
   - Pesquisa de fallback automática em caso de falha de comando
   - Usa MCP Context7 ou busca web (DuckDuckGo)

**Definição de Tipo** (src/types-linux.ts):
```typescript
type LinuxCommand = {
  command: string;
  explanation: string;
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  rollbackCommand?: string;
  safetyChecks?: string[];
  researchNeeded?: boolean;
  researchQuery?: string;
  researchReason?: string;
};
```

### 4. Modo CLI Interativo (src/cli-mode.ts)

Interface de chat com memória persistente e execução de comandos.

**Recursos:**
- Conversação em linguagem natural com IA
- Histórico persistente de conversação (armazenado em `~/.fazai/`)
- Histórico de comandos com navegação via setas ↑/↓
- Auto-complete para comandos slash
- Comando `/exec` para tarefas de admin Linux

**Comandos Slash:**
- `/help` - Mostra comandos disponíveis
- `/exec <tarefa>` - Converte linguagem natural para comandos Linux e executa
- `/exec '''tarefa multi-linha'''` - Input de tarefa multi-linha
- `/history` - Mostra histórico de comandos
- `/history clear` - Limpa histórico persistente
- `/memory clear` - Limpa memória de conversação
- `/quit` ou `/exit` - Sai do modo CLI

**Gerenciamento de Memória** (src/memory.ts):
- Histórico de conversação armazenado em `~/.fazai/conversation.json`
- Histórico de comandos armazenado em `~/.fazai/history.txt`
- Últimas 10 interações da conversação usadas como contexto
- Funções: `loadConversationHistory()`, `appendConversationEntry()`, etc.

### 5. Camada de Pesquisa (src/research.ts, src/mcp/)

Orquestração inteligente de pesquisa com MCP Context7 e fallback para busca web.

**Coordenador de Pesquisa** (src/research.ts):
- Lida com pesquisa pré-execução (quando IA solicita contexto)
- Pesquisa automática em caso de falha (quando comandos falham)
- Configurável via `fazai.conf` ou variáveis de ambiente

**Integração MCP Context7** (src/mcp/):
- `client.ts`: Cliente MCP leve
- `context7.ts`: Adapter para endpoints HTTP ou comandos locais
- `server.ts`: Servidor HTTP opcional expondo pesquisa FazAI como endpoint MCP

**Fluxo de Pesquisa:**
1. IA solicita pesquisa: `{ researchNeeded: true, researchQuery: "...", researchReason: "..." }`
2. Tenta MCP Context7 (HTTP ou comando)
3. Fallback para busca web (DuckDuckGo)
4. Exibe resultados com título, trecho, URL

**Configuração:**
```ini
MCP_CONTEXT7_URL=http://localhost:7700/context7/search
MCP_CONTEXT7_COMMAND=context7 --json --query "{query}"
WEB_SEARCH_PROVIDER=duckduckgo
FAZAI_DISABLE_RESEARCH=false
FAZAI_RESEARCH_ON_FAILURE=true
```

### 6. Suporte a Vector Store (src/vector-store.ts)

Integração com Qdrant e Milvus/Zilliz para memória e base de conhecimento.

**Coleções:**
- `fazai_memory`: Histórico de conversação, contexto do usuário, histórico de execução
- `fazai_kb`: Soluções Linux, inferências validadas, base de conhecimento

**Campos do Schema:**
- Memory: `conversation_id`, `message_id`, `role`, `timestamp`, `content`, `summary`, `tags`
- KB: `slug`, `title`, `summary`, `category`, `scope`, `linux_distribution`, `component`, `commands`, `source`, `confidence`, `tags`

**Uso:**
```bash
fazai vector validate                    # Verifica se coleções existem
fazai vector recreate --provider qdrant  # Remove e recria
```

**Configuração:**
```ini
VECTOR_PROVIDER=qdrant  # ou milvus
VECTOR_DIMENSION=1536
VECTOR_DISTANCE=Cosine  # ou Euclid, Dot

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=sua_chave

# Milvus/Zilliz
MILVUS_ADDRESS=localhost:19530
MILVUS_USERNAME=root
MILVUS_PASSWORD=Milvus
MILVUS_TOKEN=seu_token
MILVUS_SSL=false
```

### 7. Sistema de Modelos de IA (src/models.ts)

Suporte multi-provedor de modelos de IA.

**Modelos Disponíveis:**

| Provedor | Apelido | Nome do Modelo | Caso de Uso |
|----------|---------|----------------|-------------|
| OpenAI | `gpt4mini` | gpt-4o-mini | Padrão, rápido e barato |
| OpenAI | `gpt4o` | gpt-4o | Mais recente, mais capaz |
| OpenAI | `gpt4turbo` | gpt-4-turbo | Alta performance |
| Anthropic | `sonnet35` | claude-3-5-sonnet-latest | Mais inteligente |
| Anthropic | `haiku` | claude-3-haiku-20240307 | Rápido e barato |
| Ollama | `llama32` | llama3.2 | Local, privado |
| Ollama | `qwen` | qwen2.5:7b | Local, modelo Qwen |
| Ollama | `mistral` | mistral | Local, modelo Mistral |

**Seleção de Modelo:**
```bash
fazai                  # Usa gpt4mini (padrão)
fazai sonnet35         # Usa Claude 3.5 Sonnet
fazai llama32          # Usa Ollama Llama 3.2
```

**Estrutura do Modelo:**
```typescript
type Model = {
  name: string;
  provider: "anthropic" | "openai" | "ollama";
  nickName: string;
};
```

---

## Fluxos de Trabalho Comuns

### Adicionar um Novo Provedor de IA

1. Adicione entrada de modelo em `src/models.ts`:
   ```typescript
   {
     name: "nome-do-novo-modelo",
     provider: "novo-provedor",
     nickName: "apelido",
   }
   ```

2. Atualize o sistema de tipos para incluir o novo provedor:
   ```typescript
   type Provider = "anthropic" | "openai" | "ollama" | "novo-provedor";
   ```

3. Implemente lógica do provedor em `src/linux-admin.ts` ou `src/askAI.ts`:
   - Adicione verificação de chave API
   - Implemente handler de resposta em streaming
   - Retorne objetos `LinuxCommand` ou chunks de texto

4. Adicione configuração específica do provedor em `fazai.conf.example`

### Modificar Níveis de Segurança

Padrões de segurança são definidos em `src/linux-executor.ts`:

```typescript
// Adicionar novo padrão crítico
const CRITICAL_PATTERNS = [
  /rm\s+-rf\s+\//,
  /dd\s+if=.*\s+of=\/dev\//,
  // Adicione novo padrão aqui
];

// Modificar lógica de avaliação de risco
if (CRITICAL_PATTERNS.some(pattern => pattern.test(command))) {
  return "CRITICAL";
}
```

### Adicionar Novos Comandos/Modos CLI

1. Parse novas flags na função main de `src/app.ts` (por volta da linha 200-300):
   ```typescript
   if (args.includes("--novo-modo")) {
     // Lidar com novo modo
     return;
   }
   ```

2. Adicione à função `displayHelp()` em `src/app.ts`

3. Crie handler específico do modo (ex: `src/novo-modo.ts`)

4. Atualize documentação README.md e CLAUDE.md

### Estender Capacidades de Pesquisa

1. Adicione novo provedor de pesquisa em `src/research.ts`:
   ```typescript
   private async tryNewProvider(query: string): Promise<ResearchResult | null> {
     // Implemente lógica do novo provedor
   }
   ```

2. Atualize `performResearch()` para incluir novo provedor na cadeia de fallback

3. Adicione opções de configuração em `fazai.conf`

---

## Detalhes Importantes de Implementação

### Ordem de Busca de Configuração

O sistema de configuração (src/config.ts:15-76) busca em múltiplas localizações:

1. **Caminho explícito**: variável de ambiente `FAZAI_CONFIG_PATH`
2. **Diretório atual**: `./fazai.conf`
3. **Diretório do script**: `<diretório-do-script>/fazai.conf` e `<diretório-do-script>/../fazai.conf`
4. **Config do usuário**: `~/.config/fazai/fazai.conf` (preferido)
5. **Diretório home**: `~/fazai.conf` (fallback)

Ao escrever, usa o primeiro caminho existente ou padrão para `~/.config/fazai/fazai.conf`.

### Comportamento do Logger

O logger (src/logger.ts:39-159):
- Inicializa automaticamente ao importar
- Sempre grava em arquivo (com ANSI removido)
- Só exibe no console se limiar de nível for atingido
- Lida graciosamente com falhas de escrita (avisa uma vez, depois falha silenciosamente)
- Suporta override dinâmico de nível via `initLogger({ levelOverride })`

### Segurança na Execução de Comandos

O executor (src/linux-executor.ts) tem 5 camadas de segurança:

1. **Pattern Matching**: Detecção baseada em regex de comandos perigosos
2. **Avaliação de Risco**: Nível de risco fornecido pela IA (LOW/MEDIUM/HIGH/CRITICAL)
3. **Verificações de Segurança**: Comandos de validação pré-execução
4. **Confirmação do Usuário**: Obrigatória para HIGH e CRITICAL (com prompts mais fortes para CRITICAL)
5. **Rollback**: Comando de rollback opcional para operações reversíveis

**Modo dry-run**: Simula todos os comandos sem executar (`fazai --dry-run`)

### Persistência de Memória

Arquivos de memória (src/memory.ts) são armazenados em `~/.fazai/`:
- `conversation.json`: Array de entradas `{ role, content, timestamp }`
- `history.txt`: Histórico de comandos separado por nova linha

**Limites:**
- Modo CLI carrega últimas 10 interações da conversação como contexto
- Histórico de comandos mantém últimas 100 entradas no readline

### Lógica de Auto-Build

O launcher (bin/fazai.js:26-81) reconstrói automaticamente quando:
- Arquivos fonte em `src/` são mais recentes que `dist/app.cjs`
- Metadados de build em `.fazai-build-meta.json` indicam obsolescência
- `FAZAI_AUTO_BUILD` não está definido como `0`

**Metadados de build** (`.fazai-build-meta.json`):
```json
{
  "builtAt": 1234567890000,
  "srcMTime": 1234567890000
}
```

### Integração de Pesquisa

Pesquisa é disparada em dois cenários:

1. **Pré-execução** (src/research.ts:54-68):
   - IA define `researchNeeded: true` no JSON do comando
   - Coordenador executa pesquisa antes da confirmação do comando
   - Exibe resultados para o usuário

2. **Fallback em caso de falha** (src/research.ts:70-80):
   - Comando falha com código de saída não-zero
   - Habilitado via `FAZAI_RESEARCH_ON_FAILURE=true`
   - Busca automaticamente contexto do erro

**Desabilitando pesquisa:**
```ini
FAZAI_DISABLE_RESEARCH=true
```

---

## Testes

Atualmente cobertura mínima de testes. Veja tests/call-ai.test.ts para estrutura de testes.

**Executando testes:**
```bash
# Nenhum script de teste definido ainda
# TODO: Adicionar suite de testes
```

---

## Estilo de Código e Convenções

- **ES Modules**: Usa `import`/`export` por todo código
- **TypeScript**: Tipagem estrita, tipos de retorno explícitos preferidos
- **Async/Await**: Prefira `async/await` em vez de callbacks
- **Tratamento de Erros**: Blocos try-catch com mensagens de erro informativas
- **Logging**: Use `logger` centralizado de `src/logger.ts`
- **Acesso à Config**: Sempre use `getConfigValue()` de `src/config.ts`
- **Chalk**: Use para saída colorida no terminal
- **Inquirer**: Use para prompts interativos
- **Zod**: Use para validação de tipos em runtime (embora não extensivamente usado ainda)

**Convenções de Nomenclatura:**
- Arquivos: `kebab-case.ts`
- Classes: `PascalCase`
- Funções: `camelCase`
- Constantes: `UPPER_SNAKE_CASE`
- Tipos/Interfaces: `PascalCase`

**Comprimento de Linha**: Mantenha linhas razoáveis (~80-120 caracteres onde prático)

---

## Contexto e Filosofia do Projeto

FazAI é parte do projeto "Codex // Andarilho", com a missão de curar os desafios da humanidade através de tecnologia consciente e segura.

**Princípios de Design:**
- **Segurança em Primeiro Lugar**: Múltiplas camadas de proteção antes da execução
- **Transparência**: Mostra raciocínio, comandos e riscos claramente
- **Consciente do Contexto**: Coleta e usa informações do sistema inteligentemente
- **Extensível**: Fácil de adicionar novos provedores de IA, fontes de pesquisa, regras de segurança
- **Controle do Usuário**: Modo dry-run, confirmações, comandos de rollback

**Arquivos Principais:**
- `context/codex-manifesto.md`: Filosofia e missão do projeto
- `context/andarilho-context.md`: Contexto do projeto para interações com Claude
- `scripts/start-codex.sh`: Launcher com identidade do projeto

---

## Referência Rápida

### Localizações de Arquivos

- **Entrada principal**: `src/app.ts`
- **Configuração**: `fazai.conf` (veja ordem de busca de config)
- **Logs**: `/var/log/fazai/fazai.log` (ou `./fazai.log`)
- **Memória**: `~/.fazai/conversation.json`, `~/.fazai/history.txt`
- **Saída do build**: `dist/app.cjs`
- **Metadados do build**: `.fazai-build-meta.json`

### Funções Principais

- **Config**: `getConfigValue(key)`, `setConfigValue(key, value)` em src/config.ts
- **Logging**: `logger.info()`, `logger.warn()`, `logger.error()`, `logger.debug()` em src/logger.ts
- **Info do Sistema**: `collectSystemInfo()` em src/system-info.ts
- **Pesquisa**: `ResearchCoordinator.research(query)` em src/research.ts
- **Memória**: `loadConversationHistory()`, `appendConversationEntry()` em src/memory.ts

### Variáveis de Ambiente

- `FAZAI_CONFIG_PATH`: Sobrescrever localização do arquivo de config
- `FAZAI_LOG_LEVEL`: Sobrescrever nível de log (error/warn/info/debug)
- `FAZAI_LOG_FILE`: Sobrescrever caminho do arquivo de log
- `FAZAI_AUTO_BUILD`: Definir como `0` para desabilitar auto-build
- `FAZAI_DISABLE_RESEARCH`: Definir como `true` para desabilitar pesquisa
- `FAZAI_RESEARCH_ON_FAILURE`: Definir como `true` para habilitar pesquisa em falha
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`: Chaves de provedores de IA
- `OLLAMA_BASE_URL`: URL do servidor Ollama
- `VECTOR_PROVIDER`, `QDRANT_URL`, `MILVUS_ADDRESS`: Config de vector store

### Comandos CLI

```bash
fazai                           # Modo Admin Linux (padrão)
fazai --cli                     # Modo CLI interativo
fazai ask "pergunta"            # Fazer uma pergunta à IA
fazai search "consulta"         # Pesquisa manual
fazai vector validate           # Validar coleções vetoriais
fazai config                    # Mostrar chaves API configuradas
fazai completion                # Mostrar sugestões de auto-complete
fazai --dry-run                 # Simular sem executar
fazai --debug                   # Habilitar logging de debug
fazai --help                    # Mostrar ajuda
```

---

## Recursos Adicionais

- **README.md**: Documentação voltada ao usuário, instruções de instalação
- **QUICK-START.md**: Guia de início rápido para novos usuários
- **TODO.md**: Roadmap do projeto e tarefas pendentes
- **CHANGELOG.md**: Histórico de versões e mudanças
- **AGENTS.md**: Informações sobre agentes de IA e padrões
- **docs/ROADMAP.md**: Visão de longo prazo do projeto
