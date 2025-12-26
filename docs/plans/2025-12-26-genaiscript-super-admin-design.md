# GenAIScript Super Administrador Agêntico - Design Document

**Data**: 2025-12-26
**Versão**: 1.0
**Autor**: Claude Opus 4.5 (Claudio) + Roger Luft (Roginho)
**Status**: Em revisão

---

## 1. Visão Geral

### 1.1 Objetivo
Transformar o FazAI CLI em um **Super Administrador de Sistemas Agêntico** usando GenAIScript da Microsoft, sem necessidade de grandes LLMs locais ou custos de API.

### 1.2 Princípios
- **Zero Custo**: Ollama local, sem APIs pagas obrigatórias
- **Local-First**: Funciona 100% offline
- **Simplicidade**: Evitar complexidades desnecessárias
- **Pragmatismo**: Usar o que já funciona (REST API do Qdrant)

---

## 2. Arquitetura Simplificada

```
┌─────────────────────────────────────────────────────────────┐
│                    FAZAI SUPER ADMIN                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CLI (TypeScript)                                           │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              GenAIScript Engine                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │  defTool()  │  │ defAgent()  │  │  runPrompt  │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│       │                                                     │
│       ├──────────────────┬──────────────────┐              │
│       ▼                  ▼                  ▼              │
│  ┌─────────┐       ┌─────────┐       ┌─────────┐          │
│  │ Ollama  │       │ Qdrant  │       │  Bash   │          │
│  │  phi3   │       │REST API │       │ Native  │          │
│  │ (local) │       │ (local) │       │         │          │
│  └─────────┘       └─────────┘       └─────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Por que NÃO usar MCP para Qdrant?

**CORREÇÃO IMPORTANTE**: Você está absolutamente certo!

O Qdrant já oferece 3 formas de acesso:
1. **REST API** (HTTP) - Simples, universal
2. **gRPC** - Alta performance
3. **@qdrant/js-client-rest** - SDK TypeScript

**MCP seria complexidade desnecessária** porque:
- Adiciona camada extra de comunicação
- Requer servidor MCP rodando
- Overhead de serialização/deserialização
- O SDK já faz tudo que precisamos

**Solução correta**: Usar diretamente o `@qdrant/js-client-rest` que já está instalado!

```typescript
// SIMPLES - direto com SDK existente
import { QdrantClient } from "@qdrant/js-client-rest";

const client = new QdrantClient({ url: "http://localhost:6333" });

// Busca direta
const results = await client.search("fazai_learning", {
    vector: embedding,
    limit: 5
});
```

### 2.2 Sobre "Custos"

**CORREÇÃO**: Não existe custo obrigatório!

- **Ollama**: Gratuito, local
- **Qdrant**: Gratuito, local (self-hosted)
- **GenAIScript**: Open source, gratuito
- **Perplexity**: OPCIONAL, só se quiser pesquisa web

A menção a "$5/1M tokens" era apenas informativa para caso alguém QUEIRA usar Perplexity. **Não é necessário**.

---

## 3. Componentes Detalhados

### 3.1 GenAIScript - O que é e como usar

GenAIScript é uma linguagem de scripting da Microsoft para orquestrar LLMs.

**Arquivo**: `genaisrc/fazai-core.genai.mjs`

```javascript
// Configuração básica
script({
    title: "FazAI Core",
    model: "ollama:phi3",      // Modelo local gratuito
    temperature: 0.7,
    maxTokens: 4096
})

// Definir contexto
$`Você é o FazAI, um administrador de sistemas Linux expert.
Você tem acesso a ferramentas para executar comandos e buscar conhecimento.`
```

### 3.2 defTool - Definindo Ferramentas

`defTool` permite que o LLM chame funções TypeScript/JavaScript.

**Sintaxe**:
```javascript
defTool(
    "nome_da_ferramenta",           // ID único
    "Descrição do que faz",         // LLM usa isso para decidir quando chamar
    {                               // Schema dos parâmetros (JSON Schema)
        param1: { type: "string", description: "..." },
        param2: { type: "number", default: 10 }
    },
    async (args) => {               // Função que executa
        // Lógica aqui
        return "resultado como string"
    }
)
```

**Exemplo Real - Busca no Qdrant**:
```javascript
import { QdrantClient } from "@qdrant/js-client-rest";
import { createEmbeddingService } from "../src/services/embeddings.js";

const qdrant = new QdrantClient({ url: "http://localhost:6333" });
const embedder = await createEmbeddingService();

defTool(
    "qdrant_search",
    "Busca semântica nas collections do FazAI (memory, learning, kb, inference)",
    {
        query: {
            type: "string",
            description: "Texto para buscar"
        },
        collection: {
            type: "string",
            enum: ["fazai_memory", "fazai_learning", "fazai_kb", "fazai_inference"],
            default: "fazai_learning"
        },
        limit: {
            type: "number",
            default: 5
        }
    },
    async ({ query, collection, limit }) => {
        const embedding = await embedder.generate(query);

        const results = await qdrant.search(collection, {
            vector: embedding,
            limit: limit,
            with_payload: true
        });

        return JSON.stringify(results.map(r => ({
            score: r.score,
            content: r.payload?.content || "N/A"
        })), null, 2);
    }
)
```

**Exemplo Real - Executar Comando Bash**:
```javascript
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

defTool(
    "bash_exec",
    "Executa comando bash no sistema. Use com cuidado.",
    {
        command: {
            type: "string",
            description: "Comando bash para executar"
        },
        timeout: {
            type: "number",
            default: 30000,
            description: "Timeout em ms"
        }
    },
    async ({ command, timeout }) => {
        // Lista de comandos perigosos bloqueados
        const dangerous = ["rm -rf /", "mkfs", "dd if=", "> /dev/"];
        if (dangerous.some(d => command.includes(d))) {
            return "ERRO: Comando bloqueado por segurança";
        }

        try {
            const { stdout, stderr } = await execAsync(command, {
                timeout,
                maxBuffer: 1024 * 1024 // 1MB
            });
            return stdout || stderr || "Comando executado sem output";
        } catch (error) {
            return `ERRO: ${error.message}`;
        }
    }
)
```

### 3.3 defAgent - Definindo Agentes Autônomos

`defAgent` cria um "sub-LLM" especializado com ferramentas específicas.

**Sintaxe**:
```javascript
defAgent(
    "nome_do_agente",               // ID (vira agent_nome)
    "Descrição curta",              // Quando o LLM deve chamar este agente
    "System prompt detalhado...",   // Personalidade e instruções
    {
        tools: ["tool1", "tool2"],  // Ferramentas que este agente pode usar
        model: "ollama:phi3"        // Modelo (opcional, herda do script)
    }
)
```

**Exemplo Real - Agente SysAdmin**:
```javascript
defAgent(
    "sysadmin",
    "Especialista em administração Linux. Use para comandos de sistema, logs, serviços.",
    `Você é um especialista em administração de sistemas Linux.

SUAS CAPACIDADES:
- Verificar status de serviços (systemctl status)
- Analisar logs (journalctl, /var/log/)
- Monitorar recursos (free, df, top)
- Gerenciar processos (ps, kill)
- Verificar conectividade (ping, curl, ss)

REGRAS:
- NUNCA execute comandos destrutivos sem confirmação
- Sempre explique o que vai fazer ANTES de fazer
- Prefira comandos read-only quando possível
- Se não souber, diga "não sei" em vez de inventar

Responda a query do usuário usando as ferramentas disponíveis.`,
    {
        tools: ["bash_exec", "file_read"]
    }
)
```

**Exemplo Real - Agente de Conhecimento**:
```javascript
defAgent(
    "knowledge",
    "Busca e gerencia conhecimento nas collections Qdrant. Use para perguntas sobre o sistema.",
    `Você gerencia o conhecimento do FazAI.

COLLECTIONS DISPONÍVEIS:
- fazai_memory: Memórias de conversas passadas
- fazai_learning: Aprendizados e insights
- fazai_kb: Knowledge base (documentação)
- fazai_inference: Regras de inferência

WORKFLOW:
1. Receba uma pergunta
2. Busque nas collections relevantes
3. Sintetize uma resposta
4. Se aprender algo novo, salve em fazai_learning

FUSION SCORING:
- learning: 40% (peso maior)
- kb: 30%
- memory: 20%
- inference: 10%`,
    {
        tools: ["qdrant_search", "qdrant_upsert"]
    }
)
```

### 3.4 Como os Agentes se Comunicam

Quando você define um agente com `defAgent("sysadmin", ...)`, ele vira uma ferramenta chamada `agent_sysadmin` que o LLM principal pode chamar.

```javascript
// Script principal
script({
    title: "FazAI Main",
    model: "ollama:phi3",
    tools: ["agent_sysadmin", "agent_knowledge"]  // Agentes como ferramentas
})

// O LLM principal decide automaticamente qual agente chamar
$`O usuário perguntou: "qual o status do serviço nginx?"
Analise e use o agente apropriado para responder.`
```

**Fluxo**:
```
Usuário ──► LLM Principal ──► Decide: "isso é sysadmin"
                                  │
                                  ▼
                           agent_sysadmin
                                  │
                                  ├──► bash_exec("systemctl status nginx")
                                  │
                                  ▼
                           Retorna resultado
                                  │
                                  ▼
                           LLM Principal formata resposta
                                  │
                                  ▼
                             Usuário
```

---

## 4. Estrutura de Arquivos Proposta

```
genaisrc/
├── fazai-core.genai.mjs        # Script principal
├── fazai-sysadmin.genai.mjs    # Agente sysadmin standalone
├── fazai-knowledge.genai.mjs   # Agente conhecimento standalone
├── reflect.genai.mjs           # Reflexão autônoma
├── skill-seeker.genai.mjs      # Auto-geração de skills
│
└── tools/
    ├── qdrant-tools.mjs        # Ferramentas Qdrant (já existe)
    ├── bash-tools.mjs          # Ferramentas bash
    ├── api-tools.mjs           # Ferramentas para APIs externas
    └── learning-tools.mjs      # Ferramentas de aprendizado
```

---

## 5. Exemplos Completos

### 5.1 Script Completo: fazai-core.genai.mjs

```javascript
/**
 * FazAI Core - Loop Agêntico Principal
 * Usa Ollama local (phi3) + Qdrant REST API
 * ZERO CUSTO - tudo local
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { createEmbeddingService } from "../src/services/embeddings.js";

// Configuração
script({
    title: "FazAI Core",
    description: "Super Administrador Agêntico",
    model: "ollama:phi3",
    temperature: 0.7,
    maxTokens: 4096,
    timeout: 120000
})

// Inicialização
const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL || "http://localhost:6333"
});
const embedder = await createEmbeddingService();

// ============================================
// FERRAMENTAS BASE
// ============================================

defTool(
    "qdrant_search",
    "Busca semântica com fusion scoring nas collections FazAI",
    {
        query: { type: "string", description: "Texto para buscar" },
        limit: { type: "number", default: 5 }
    },
    async ({ query, limit }) => {
        const embedding = await embedder.generate(query);

        // Fusion scoring em paralelo
        const weights = {
            fazai_learning: 0.40,
            fazai_kb: 0.30,
            fazai_memory: 0.20,
            fazai_inference: 0.10
        };

        const searches = Object.entries(weights).map(async ([coll, weight]) => {
            try {
                const results = await qdrant.search(coll, {
                    vector: embedding,
                    limit: limit,
                    with_payload: true
                });
                return results.map(r => ({
                    source: coll.replace("fazai_", ""),
                    score: r.score,
                    fusedScore: r.score * weight,
                    content: r.payload?.content?.substring(0, 200) || "N/A"
                }));
            } catch {
                return [];
            }
        });

        const allResults = (await Promise.all(searches)).flat();
        allResults.sort((a, b) => b.fusedScore - a.fusedScore);

        return JSON.stringify(allResults.slice(0, limit), null, 2);
    }
)

defTool(
    "qdrant_save_insight",
    "Salva novo conhecimento/insight na collection learning",
    {
        content: { type: "string", description: "Conteúdo do insight" },
        category: {
            type: "string",
            enum: ["error_fix", "pattern", "optimization", "insight"],
            default: "insight"
        }
    },
    async ({ content, category }) => {
        const embedding = await embedder.generate(content);

        await qdrant.upsert("fazai_learning", {
            wait: true,
            points: [{
                id: Date.now(),
                vector: embedding,
                payload: {
                    content,
                    category,
                    source: "agentic_loop",
                    timestamp: new Date().toISOString()
                }
            }]
        });

        return `Insight salvo com sucesso: [${category}] ${content.substring(0, 50)}...`;
    }
)

defTool(
    "bash_exec",
    "Executa comando bash com proteções de segurança",
    {
        command: { type: "string", description: "Comando para executar" }
    },
    async ({ command }) => {
        const blocked = ["rm -rf /", "mkfs", "dd if=/dev", ":(){ :|:& };:"];
        if (blocked.some(b => command.includes(b))) {
            return "BLOQUEADO: Comando potencialmente destrutivo";
        }

        const result = await host.exec(command, { timeout: 30000 });
        return result.stdout || result.stderr || "(sem output)";
    }
)

// ============================================
// AGENTES ESPECIALIZADOS
// ============================================

defAgent(
    "sysadmin",
    "Administrador Linux - use para status de serviços, logs, recursos",
    `Você é um expert em Linux.

Comandos úteis:
- systemctl status/start/stop/restart <service>
- journalctl -u <service> -n 50
- free -h, df -h, top -bn1
- ps aux | grep <processo>

SEMPRE explique o que vai fazer antes de executar.`,
    { tools: ["bash_exec"] }
)

defAgent(
    "knowledge",
    "Gerente de conhecimento - use para perguntas e aprendizado",
    `Você gerencia o conhecimento do FazAI.

Collections:
- learning: Aprendizados (40% peso)
- kb: Knowledge base (30% peso)
- memory: Memórias (20% peso)
- inference: Inferências (10% peso)

Busque antes de responder. Salve insights importantes.`,
    { tools: ["qdrant_search", "qdrant_save_insight"] }
)

// ============================================
// PROMPT PRINCIPAL
// ============================================

// Variável de entrada
const query = env.vars.query || "status do sistema"

$`Você é o FazAI, um Super Administrador de Sistemas inteligente.

QUERY DO USUÁRIO: ${query}

INSTRUÇÕES:
1. Analise a query
2. Decida qual agente usar (sysadmin ou knowledge)
3. Execute e retorne resultado formatado
4. Se aprender algo novo, salve como insight

Responda de forma clara e concisa.`
```

### 5.2 Executando o Script

```bash
# Via npx
npx genaiscript run fazai-core --vars "query=qual o status do nginx?"

# Via npm script (adicionar ao package.json)
npm run genai -- fazai-core --vars "query=como otimizar o postgresql?"

# Com verbose
npx genaiscript run fazai-core --vars "query=listar processos" --verbose
```

### 5.3 Integrando com CLI existente

No `src/commands/agent.ts`:

```typescript
import { runGenAIScript } from "../agentic/genai-runner.js";

export async function agentLoop(query: string, options: AgentOptions) {
    const result = await runGenAIScript({
        script: "fazai-core.genai.mjs",
        vars: { query },
        model: options.model || "ollama:phi3",
        timeout: options.timeout || 120000,
        verbose: options.verbose
    });

    if (result.success) {
        console.log(result.output);
    } else {
        console.error("Erro:", result.error);
    }

    return result;
}
```

---

## 6. Complexidades Desnecessárias EVITADAS

### 6.1 ❌ MCP Server para Qdrant
**Por que evitar**: SDK REST já faz tudo, MCP adiciona overhead.
**Solução**: Usar `@qdrant/js-client-rest` diretamente.

### 6.2 ❌ APIs Pagas Obrigatórias
**Por que evitar**: Custo recorrente, dependência externa.
**Solução**: Ollama local com phi3/qwen2.

### 6.3 ❌ Múltiplos MCP Servers Federados
**Por que evitar**: Complexidade de orquestração, debugging difícil.
**Solução**: Um script GenAIScript com múltiplos defTool.

### 6.4 ❌ Router Inteligente Local/Cloud
**Por que evitar**: Over-engineering para fase inicial.
**Solução**: Usar só local. Cloud é OPCIONAL futuro.

### 6.5 ❌ Fine-tuning de Modelos
**Por que evitar**: Requer dados, GPU, tempo.
**Solução**: Prompts bem escritos + RAG com Qdrant.

---

## 7. Comparativo: Antes vs Depois

### Antes (TypeScript Puro)
```typescript
// Código procedural, manual
async function handleQuery(query: string) {
    const embedding = await embedder.generate(query);
    const results = await qdrant.search("fazai_learning", { vector: embedding });
    // Processar manualmente...
    // Decidir manualmente o que fazer...
    // Formatar manualmente...
}
```

### Depois (GenAIScript)
```javascript
// LLM decide autonomamente
defTool("search", "...", schema, searchFn);
defAgent("knowledge", "...", "...", { tools: ["search"] });

$`Responda: ${query}` // LLM faz o resto
```

**Ganho**: O LLM decide QUANDO e COMO usar as ferramentas.

---

## 8. Próximos Passos

1. [ ] Revisar este documento com Roginho
2. [ ] Implementar ferramentas base (qdrant, bash)
3. [ ] Implementar agentes (sysadmin, knowledge)
4. [ ] Testar com queries reais
5. [ ] Documentar aprendizados

---

## 9. Referências

- [GenAIScript Docs](https://microsoft.github.io/genaiscript/)
- [GenAIScript GitHub](https://github.com/microsoft/genaiscript)
- [Qdrant REST API](https://qdrant.tech/documentation/quick-start/)
- [Ollama](https://ollama.ai/)

---

**Revisado por**: _Pendente revisão do Roginho_
**Aprovado**: _Pendente_
