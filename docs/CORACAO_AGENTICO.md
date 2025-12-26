# Coração Agêntico FazAI v3.9.0

**Implementado em**: 2025-12-26
**Sessão**: Claudio (Opus 4.5) + Roginho
**Status**: MVP Funcionando ✅

---

## 1. O que foi Implementado

O **Coração Agêntico** é o núcleo de inteligência do FazAI que permite:
- Busca semântica com fusion scoring em múltiplas collections
- Loop iterativo com reflexão e autocorreção
- Salvamento automático de insights
- Dual implementation (TypeScript nativo + GenAIScript)

---

## 2. Arquivos Criados

### 2.1 Núcleo Agêntico

| Arquivo | Descrição |
|---------|-----------|
| `src/agentic/agentic-loop.ts` | Loop agêntico nativo TypeScript |
| `src/agentic/genai-runner.ts` | Executor GenAIScript com retry |

### 2.2 GenAI Scripts

| Arquivo | Descrição |
|---------|-----------|
| `genaisrc/fazai-core.genai.mjs` | Loop principal GenAIScript |
| `genaisrc/reflect.genai.mjs` | Reflexão autônoma |
| `genaisrc/skill-seeker.genai.mjs` | Detector de gaps (placeholder) |
| `genaisrc/tools/qdrant-tools.mjs` | Toolkit Qdrant |

### 2.3 Comando CLI

| Arquivo | Descrição |
|---------|-----------|
| `src/commands/agent.ts` | Subcomandos: loop, run, reflect, native, scripts, status |

### 2.4 Hookify Rules (10 regras)

| Arquivo | Trigger |
|---------|---------|
| `hookify.changelog-before-commit.local.md` | Antes de git commit |
| `hookify.code-reviewer.local.md` | Após edições de código |
| `hookify.commit-prompt.local.md` | Mensagem de commit |
| `hookify.completion-on-command-change.local.md` | Mudança em commands/ |
| `hookify.help-sync-check.local.md` | Antes de finalizar |
| `hookify.install-sh-sync.local.md` | Mudança em install.sh |
| `hookify.readme-on-feature.local.md` | Nova feature |
| `hookify.run-real-tests.local.md` | Bloqueia testes fake |
| `hookify.source-indexer.local.md` | Indexação código |
| `hookify.systemctl-check.local.md` | Comandos systemctl |

---

## 3. Arquitetura do Loop Agêntico

```
┌─────────────────────────────────────────────────────────────┐
│                    LOOP AGÊNTICO                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. QUERY ───────────────────────────────────────────────►  │
│       │                                                     │
│       ▼                                                     │
│  2. MULTI-SEARCH (paralelo)                                 │
│       ├── fazai_memory    (peso 0.20)                       │
│       ├── fazai_learning  (peso 0.40)  ◄── MAIOR PESO      │
│       ├── fazai_kb        (peso 0.30)                       │
│       └── fazai_inference (peso 0.10)                       │
│       │                                                     │
│       ▼                                                     │
│  3. FUSION SCORING                                          │
│       fusedScore = score × weight                           │
│       │                                                     │
│       ▼                                                     │
│  4. REFLEXÃO                                                │
│       ├── Avaliar produtividade                             │
│       ├── Calcular confiança                                │
│       └── Decidir se continua                               │
│       │                                                     │
│       ▼                                                     │
│  5. DECISÃO                                                 │
│       ├── Suficiente? ──► Finalizar                         │
│       └── Insuficiente? ──► Voltar para 2 (max 5x)         │
│       │                                                     │
│       ▼                                                     │
│  6. SALVAR INSIGHT (se enableLearning=true)                 │
│       │                                                     │
│       ▼                                                     │
│  7. OUTPUT FORMATADO                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Código Principal

### 4.1 AgenticLoop Class (`src/agentic/agentic-loop.ts`)

```typescript
export class AgenticLoop {
    private client: QdrantClient;
    private embeddingService: Awaited<ReturnType<typeof createEmbeddingService>> | null;
    private config: Required<AgenticConfig>;

    constructor(config: AgenticConfig = {}) {
        this.client = new QdrantClient({ url: QDRANT_URL });
        this.config = {
            maxIterations: config.maxIterations ?? 5,
            enableReflection: config.enableReflection ?? true,
            enableLearning: config.enableLearning ?? true,
            verbose: config.verbose ?? false,
            minContextItems: config.minContextItems ?? 3,
            timeout: config.timeout ?? 120000,
        };
    }

    async init(): Promise<void> {
        this.embeddingService = await createEmbeddingService();
    }

    async multiSearch(query: string): Promise<ContextItem[]> {
        const embedding = await this.embeddingService.generate(query);
        // Busca paralela em 4 collections com fusion scoring
        // ...
    }

    async run(query: string): Promise<AgenticState> {
        await this.init();
        // Loop com max 5 iterações
        // Reflexão a cada iteração
        // Salva insights ao final
    }
}
```

### 4.2 Fusion Weights

```typescript
const FUSION_WEIGHTS = {
    memory: 0.20,    // Memórias de conversas
    learning: 0.40,  // Aprendizados (MAIOR PESO)
    kb: 0.30,        // Knowledge base
    inference: 0.10, // Regras de inferência
};
```

### 4.3 Interfaces

```typescript
interface AgenticState {
    query: string;
    context: ContextItem[];
    actions: AgenticAction[];
    reflections: Reflection[];
    insights: Insight[];
    iteration: number;
    maxIterations: number;
    startTime: number;
}

interface ContextItem {
    source: string;      // "memory" | "learning" | "kb" | "inference"
    content: string;
    score: number;       // Score original do Qdrant
    fusedScore: number;  // score × weight
}

interface Reflection {
    iteration: number;
    wasProductive: boolean;
    keyInsight: string;
    shouldContinue: boolean;
    confidence: number;
}
```

---

## 5. Bugs Corrigidos

### 5.1 `import.meta.url` em CJS Bundle

**Problema**: `import.meta.url` é undefined quando o código é compilado para CommonJS.

**Erro**:
```
TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string
```

**Solução** (`genai-runner.ts`):
```typescript
// ANTES (quebrado)
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = join(__dirname, "../..");

// DEPOIS (funcionando)
const PROJECT_ROOT = process.env.FAZAI_PROJECT_ROOT || process.cwd();
```

### 5.2 `createEmbeddingService()` é Async

**Problema**: A função retorna `Promise<EmbeddingService>`, não `EmbeddingService`.

**Erro**:
```
this.embeddingService.init is not a function
```

**Solução** (`agentic-loop.ts`):
```typescript
// ANTES (quebrado)
private embeddingService: ReturnType<typeof createEmbeddingService> | null;
this.embeddingService = createEmbeddingService();
await this.embeddingService.init();

// DEPOIS (funcionando)
private embeddingService: Awaited<ReturnType<typeof createEmbeddingService>> | null;
this.embeddingService = await createEmbeddingService();
// Não precisa de .init() - já está pronto
```

### 5.3 Método `.embed()` não existe

**Problema**: A interface `EmbeddingService` usa `.generate()`, não `.embed()`.

**Erro**:
```
this.embeddingService.embed is not a function
```

**Solução** (`agentic-loop.ts`):
```typescript
// ANTES (quebrado)
const embedding = await this.embeddingService.embed(query);

// DEPOIS (funcionando)
const embedding = await this.embeddingService.generate(query);
```

### 5.4 Hookify Python Imports

**Problema**: Scripts Python do hookify usavam import incorreto.

**Erro**:
```
Hookify import error: No module named 'hookify'
```

**Solução** (arquivos em `~/.claude/plugins/cache/claude-plugins-official/hookify/`):
```python
# ANTES (quebrado)
from hookify.core.config_loader import load_rules
from hookify.core.rule_engine import RuleEngine

# DEPOIS (funcionando)
from core.config_loader import load_rules
from core.rule_engine import RuleEngine
```

Arquivos corrigidos:
- `hooks/pretooluse.py`
- `hooks/posttooluse.py`
- `hooks/stop.py`
- `hooks/userpromptsubmit.py`
- `core/rule_engine.py`

---

## 6. Comandos CLI

### 6.1 Uso Básico

```bash
# Loop agêntico completo
fazai agent loop "como otimizar embeddings no DL380?"

# Versão nativa TypeScript (mais rápida)
fazai agent native "status do postgresql"

# Listar scripts GenAIScript disponíveis
fazai agent scripts

# Status do sistema agêntico
fazai agent status
```

### 6.2 Opções

| Flag | Descrição |
|------|-----------|
| `-v, --verbose` | Output detalhado |
| `-m, --model <modelo>` | Modelo Ollama (default: phi3) |
| `-i, --iterations <n>` | Máximo de iterações (default: 5) |
| `--no-learning` | Desabilita salvamento de insights |

---

## 7. Output Exemplo

```
╔════════════════════════════════════════════════════════════╗
║           LOOP AGÊNTICO COMPLETO                           ║
╚════════════════════════════════════════════════════════════╝

📝 Query: como otimizar embeddings locais no DL380
⏱  Duração: 197ms
🔄 Iterações: 1/5

📚 CONTEXTO RECUPERADO (9 itens):
   [learning] (0.338) Query: "como otimizar embeddings..."
   [kb] (0.287) Documentação sobre cache...
   [memory] (0.156) Conversa anterior sobre...

🧠 REFLEXÕES:
   #1: Melhor match: learning (score: 0.338) (confiança: 0.34)

💡 INSIGHTS SALVOS: 1
   [reflection] Query: "como otimizar embeddings..."

📊 AÇÕES EXECUTADAS: 2
✅ Sucesso: 2
❌ Falha: 0
```

---

## 8. Testes

### 8.1 Teste Rápido

```bash
cd /home/rluft/fazai-ng
npm run build
./dist/cli.cjs agent native "teste de funcionamento"
```

### 8.2 Teste Completo

```bash
# Loop com verbose
fazai agent loop "qual a diferença entre phi3 e qwen2?" -v

# Verificar Qdrant
curl http://localhost:6333/collections
```

---

## 9. Próximos Passos

- [ ] Implementar Skill Seekers real (não placeholder)
- [ ] Embeddador local (Phi-3/Gemma-2B para embeddings)
- [ ] Interface web de monitoramento
- [ ] Mais agentes especializados (sysadmin, api, etc)

---

## 10. Commits

| Hash | Mensagem |
|------|----------|
| `4477a9c` | Coração Agêntico MVP - Loop com fusion scoring |
| **Tag** | `v3.9.0-beta` |

---

**Documentado por**: Claude Opus 4.5 (Claudio)
**Revisado por**: _Pendente revisão do Roginho_
